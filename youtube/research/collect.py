#!/usr/bin/env python3
"""collect.py - gather public YouTube listings per genre x language for yt-viral.

Runs in GitHub Actions (see .github/workflows/yt-collect.yml). For each query it takes the top
search results, then the latest uploads of each channel found, so every channel has enough videos
for a median. Writes youtube/research/data/<genre>_<lang>.json (swipe.py input) and summary.json.
"""
import json, os, statistics, time
import yt_dlp

GENRES = {
    "horror":      {"en": "horror short film", "es": "cortometraje de terror", "pt": "curta de terror", "ja": "ホラー 短編映画"},
    "moral_drama": {"en": "moral story short film", "es": "historias con moraleja dramatización", "pt": "dramatização história com lição", "ja": "教訓 ドラマ"},
    "micro_drama": {"en": "short drama series episode", "es": "minidrama serie corta", "pt": "minissérie curta drama", "ja": "ショートドラマ"},
    "comedy":      {"en": "comedy sketch", "es": "sketch de comedia", "pt": "esquete de comédia", "ja": "コント"},
    "scifi":       {"en": "sci-fi short film", "es": "cortometraje ciencia ficción", "pt": "curta ficção científica", "ja": "SF 短編映画"},
    "thriller":    {"en": "thriller short film", "es": "cortometraje de suspenso", "pt": "curta suspense", "ja": "サスペンス 短編"},
    "animated":    {"en": "animated series episode 1", "es": "serie animada episodio 1", "pt": "série animada episódio 1", "ja": "漫画動画"},
    "romance":     {"en": "romance short film", "es": "cortometraje romántico", "pt": "curta romance", "ja": "恋愛 ショートドラマ"},
}
SEARCH_N, CHANNELS_PER_QUERY, VIDEOS_PER_CHANNEL = 20, 6, 20
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
YDL = yt_dlp.YoutubeDL({"extract_flat": True, "quiet": True, "ignoreerrors": True, "skip_download": True})

def entries(url, n):
    YDL.params["playlistend"] = n
    info = YDL.extract_info(url, download=False) or {}
    return [e for e in (info.get("entries") or []) if e]

def row(e, channel):
    vid = e.get("id")
    return {"channel": channel, "title": e.get("title") or "", "views": e.get("view_count") or 0,
            "url": f"https://www.youtube.com/watch?v={vid}", "duration": e.get("duration") or 0}

def main():
    os.makedirs(OUT, exist_ok=True)
    summary, errors = [], []
    for genre, langs in GENRES.items():
        for lang, q in langs.items():
            try:
                hits = entries(f"ytsearch{SEARCH_N}:{q}", SEARCH_N)
            except Exception as ex:
                errors.append(f"{genre}/{lang} search: {ex}"); continue
            chans = []
            for h in hits:
                cid = h.get("channel_id")
                if cid and cid not in [c[0] for c in chans]:
                    chans.append((cid, h.get("channel") or h.get("uploader") or cid))
            rows, medians = [], []
            for cid, name in chans[:CHANNELS_PER_QUERY]:
                vids = []
                for tab in ("videos", "shorts"):
                    try:
                        vids = entries(f"https://www.youtube.com/channel/{cid}/{tab}", VIDEOS_PER_CHANNEL)
                    except Exception as ex:
                        errors.append(f"{genre}/{lang} {name}/{tab}: {ex}")
                    if len(vids) >= 4: break
                vids = [v for v in vids if v.get("view_count") is not None]
                rows += [row(v, name) for v in vids]
                if len(vids) >= 4:
                    medians.append(statistics.median(v["view_count"] for v in vids))
                time.sleep(1)
            with open(os.path.join(OUT, f"{genre}_{lang}.json"), "w") as f:
                json.dump(rows, f, ensure_ascii=False, indent=1)
            sv = sorted((h.get("view_count") or 0) for h in hits)
            summary.append({"genre": genre, "lang": lang, "query": q, "search_hits": len(hits),
                            "channels_measured": len(medians),
                            "typical_channel_median": int(statistics.median(medians)) if medians else 0,
                            "search_top_views": sv[-1] if sv else 0,
                            "search_median_views": int(statistics.median(sv)) if sv else 0})
            print(f"{genre:12} {lang}  hits={len(hits):2}  channels={len(medians)}  "
                  f"typical={summary[-1]['typical_channel_median']:,}", flush=True)
    with open(os.path.join(OUT, "summary.json"), "w") as f:
        json.dump({"summary": summary, "errors": errors[:200]}, f, ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
