"""Score each hashtag x language from the Shorts scan: recent breakouts by small channels, weighted by Shorts RPM."""
import json, math, os, statistics as st, datetime as dt

D = os.path.dirname(os.path.abspath(__file__))
tags = json.load(open(os.path.join(D, "shorts_tags.json")))
info = json.load(open(os.path.join(D, "shorts_info.json")))
chans = json.load(open(os.path.join(D, "shorts_channels.json"))) if os.path.exists(os.path.join(D, "shorts_channels.json")) else {}
# Shorts RPM per 1000 views, rough (AIR Media-Tech 2026 country data; others lower)
RPM = {"en": 0.25, "de": 0.16, "no": 0.16, "da": 0.15, "sv": 0.15, "nl": 0.14, "fi": 0.12, "fr": 0.10, "ja": 0.10,
       "ko": 0.08, "it": 0.07, "es": 0.06}
cut = (dt.date.today() - dt.timedelta(days=120)).strftime("%Y%m%d")


def chan_stats(url):
    c = chans.get(url or "")
    if not c or len(c["vids"]) < 6:
        return None, None
    v = [x["views"] for x in c["vids"][:60]]
    return st.median(v), len(c["vids"])


rows = []
for key, ents in tags.items():
    lang, tag = key.split("|")
    recs = []
    for e in ents:
        i = info.get(e["id"])
        if not i or (i.get("upload_date") or "0") < cut:
            continue
        recs.append(i)
    if not recs:
        rows.append(dict(lang=lang, tag=tag, recent=0, score=0)); continue
    views = [r["view_count"] or 0 for r in recs]
    lang_ok = [r for r in recs if (r.get("language") or "").split("-")[0].lower() == lang]
    small = [r for r in recs if (r.get("channel_follower_count") or 10**9) < 50_000]
    small_native = [r for r in small if r in lang_ok]
    chs = {r["channel_url"] for r in recs}
    mults = []
    for r in small:
        m, n = chan_stats(r["channel_url"])
        if m:
            mults.append((r["view_count"] or 0) / max(m, 1))
    score = (math.log10(st.median(views) + 1) * (1 + len(small) + 2 * len(small_native)) * RPM.get(lang, 0.08) * 10
             * (len(chs) / max(1, len(recs))))
    rows.append(dict(lang=lang, tag=tag, recent=len(recs), med=int(st.median(views)), native=len(lang_ok),
                     chans=len(chs), small=len(small), small_native=len(small_native),
                     best_mult=round(max(mults), 1) if mults else 0, score=round(score, 1),
                     examples=[(r["channel"], r.get("channel_follower_count"), r["view_count"], r.get("duration"),
                                r.get("upload_date"), r.get("language"), (r.get("title") or "")[:70]) for r in
                               sorted(small, key=lambda r: -(r["view_count"] or 0))[:5]]))
rows.sort(key=lambda r: -r["score"])
json.dump(rows, open(os.path.join(D, "shorts_scores.json"), "w"), ensure_ascii=False, indent=1)
print(f"{'lang':4} {'tag':18} {'score':>6} {'recent':>6} {'median':>9} {'nat':>4} {'chans':>5} {'small':>5} {'smN':>4} {'xMed':>6}")
for r in rows[:60]:
    if r.get("recent"):
        print(f"{r['lang']:4} {r['tag'][:18]:18} {r['score']:6.1f} {r['recent']:6} {r['med']:9,} {r['native']:4} {r['chans']:5} "
              f"{r['small']:5} {r['small_native']:4} {r['best_mult']:6.1f}")
