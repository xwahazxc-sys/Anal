#!/usr/bin/env python3
"""collect_full.py - full-length (60+ min) movies on YouTube: demand vs competition per genre x language.

For each query it runs a YouTube search filtered to long videos, keeps results of an hour or more,
then opens each ranking channel to read its subscriber count and the median views of ITS OWN
hour-plus uploads. Output: youtube/research/full/<genre>_<lang>.json and summary.json.
"""
import json, os, statistics, time, urllib.parse
import yt_dlp

Q = {
    "horror":   {"en": "horror full movie", "es": "película de terror completa en español", "pt": "filme de terror completo dublado", "ja": "ホラー映画 フル"},
    "thriller": {"en": "thriller full movie", "es": "película de suspenso completa en español", "pt": "filme de suspense completo dublado", "ja": "サスペンス映画 フル"},
    "romance":  {"en": "romance full movie", "es": "película romántica completa en español", "pt": "filme de romance completo dublado", "ja": "恋愛映画 フル"},
    "drama":    {"en": "drama full movie", "es": "película de drama completa en español", "pt": "filme de drama completo dublado", "ja": "ドラマ映画 フル"},
    "comedy":   {"en": "comedy full movie", "es": "película de comedia completa en español", "pt": "filme de comédia completo dublado", "ja": "コメディ映画 フル"},
    "action":   {"en": "action full movie", "es": "película de acción completa en español", "pt": "filme de ação completo dublado", "ja": "アクション映画 フル"},
    "scifi":    {"en": "sci-fi full movie", "es": "película de ciencia ficción completa en español", "pt": "filme de ficção científica completo dublado", "ja": "SF映画 フル"},
    "faith":    {"en": "christian full movie", "es": "película cristiana completa en español", "pt": "filme gospel completo dublado", "ja": "キリスト教 映画 フル"},
    "family":   {"en": "family full movie", "es": "película familiar completa en español", "pt": "filme de família completo dublado", "ja": "家族映画 フル"},
    "crime":    {"en": "crime full movie", "es": "película policial completa en español", "pt": "filme policial completo dublado", "ja": "犯罪映画 フル"},
    "mystery":  {"en": "mystery full movie", "es": "película de misterio completa en español", "pt": "filme de mistério completo dublado", "ja": "ミステリー映画 フル"},
    "lifetime": {"en": "lifetime movie full", "es": "película basada en hechos reales completa", "pt": "filme baseado em fatos reais completo dublado", "ja": "実話 映画 フル"},
}
SEARCH_N, CHANNELS, PER_CHANNEL, LONG = 40, 8, 40, 3600
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "full")
YDL = yt_dlp.YoutubeDL({"extract_flat": True, "quiet": True, "ignoreerrors": True, "skip_download": True})

def get(url, n):
    YDL.params["playlistend"] = n
    return YDL.extract_info(url, download=False) or {}

def med(xs): return int(statistics.median(xs)) if xs else 0

def main():
    os.makedirs(OUT, exist_ok=True)
    summary, errors, chan_cache = [], [], {}
    for genre, langs in Q.items():
        for lang, q in langs.items():
            url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(q) + "&sp=EgIYAg%3D%3D"
            try:
                hits = [e for e in (get(url, SEARCH_N).get("entries") or []) if e]
            except Exception as ex:
                errors.append(f"{genre}/{lang}: {ex}"); hits = []
            if sum(1 for h in hits if (h.get("duration") or 0) >= LONG) < 10:
                hits += [e for e in (get(f"ytsearch{SEARCH_N}:{q}", SEARCH_N).get("entries") or []) if e]
                hits = list({h.get("id"): h for h in hits}.values())
            long_hits = [h for h in hits if (h.get("duration") or 0) >= LONG]
            chans = []
            for h in long_hits:
                cid = h.get("channel_id")
                if cid and cid not in chans: chans.append(cid)
            rows = []
            for cid in chans[:CHANNELS]:
                if cid not in chan_cache:
                    info = get(f"https://www.youtube.com/channel/{cid}/videos", PER_CHANNEL)
                    vids = [v for v in (info.get("entries") or []) if v]
                    lv = [v.get("view_count") or 0 for v in vids if (v.get("duration") or 0) >= LONG]
                    chan_cache[cid] = {"channel": info.get("channel") or info.get("uploader") or cid,
                                       "subs": info.get("channel_follower_count") or 0,
                                       "long_uploads_in_last_%d" % PER_CHANNEL: len(lv),
                                       "long_median_views": med(lv), "long_views": lv}
                    time.sleep(1)
                rows.append({"channel_id": cid, **chan_cache[cid]})
            res = [{"title": h.get("title"), "channel": h.get("channel"), "channel_id": h.get("channel_id"),
                    "views": h.get("view_count") or 0, "minutes": round((h.get("duration") or 0) / 60),
                    "url": f"https://www.youtube.com/watch?v={h.get('id')}"} for h in long_hits]
            json.dump({"query": q, "results": res, "channels": rows},
                      open(os.path.join(OUT, f"{genre}_{lang}.json"), "w"), ensure_ascii=False, indent=1)
            subs = {r["channel_id"]: r["subs"] for r in rows}
            v = [r["views"] for r in res]
            small = [r for r in res if r["channel_id"] in subs and subs[r["channel_id"]] < 100_000]
            summary.append({
                "genre": genre, "lang": lang, "query": q,
                "long_results": len(res), "distinct_channels": len(set(r["channel_id"] for r in res)),
                "median_views_long": med(v), "p75_views_long": int(sorted(v)[int(len(v) * .75)]) if v else 0,
                "results_over_1M": sum(1 for x in v if x >= 1_000_000),
                "median_subs_ranking": med([r["subs"] for r in rows]),
                "channel_long_median": med([r["long_median_views"] for r in rows if r["long_views"]]),
                "small_channel_results": len(small), "small_channel_median_views": med([r["views"] for r in small]),
            })
            s = summary[-1]
            print(f"{genre:9} {lang} long={s['long_results']:2} med={s['median_views_long']:>10,} "
                  f"subs={s['median_subs_ranking']:>10,} small={s['small_channel_results']}", flush=True)
    json.dump({"summary": summary, "errors": errors[:200]},
              open(os.path.join(OUT, "summary.json"), "w"), ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
