"""Channel-level evidence for the shortlisted niches: size, age, uploads, median, best multiple, top videos."""
import json, os, statistics as st, datetime as dt

D = os.path.dirname(os.path.abspath(__file__))
J = json.load(open(os.path.join(D, "joined.json")))
LC = json.load(open(os.path.join(D, "long_channels.json")))
SC = json.load(open(os.path.join(D, "shorts_channels.json")))
search = json.load(open(os.path.join(D, "long_search.json")))
sinfo = json.load(open(os.path.join(D, "shorts_info.json")))
TODAY = dt.date.today()


def card(url, chans, kind):
    c = chans.get(url)
    if not c or len(c["vids"]) < 4:
        return None
    v = [x["views"] for x in c["vids"]]
    med = st.median(v[:30])
    best = max(c["vids"], key=lambda x: x["views"])
    j = J.get(url)
    age = (TODAY - dt.datetime.strptime(j, "%Y%m%d").date()).days if j and j != "unknown" else None
    return dict(name=c["name"], subs=c["subs"], age_days=age, joined=j, uploads=len(c["vids"]),
                uploads_note="90+" if (kind == "long" and len(c["vids"]) >= 90) or (kind == "shorts" and len(c["vids"]) >= 120) else "",
                median=int(med), best_mult=round(best["views"] / max(med, 1), 1), best=best["title"], best_views=best["views"],
                long25=sum(1 for x in c["vids"][:30] if (x.get("dur") or 0) >= 1500) if kind == "long" else None)


LONG = {"nostalgia_60s|en": None, "old_hollywood|en": None, "hfy_scifi|de": None, "hfy_scifi|en": None,
        "space_sleep|de": None, "space_sleep|en": None, "disasters|es": None, "disasters|de": None,
        "ancient_mysteries|fr": None, "unsolved_mysteries|fr": None, "local_history|de": None, "royals|en": None,
        "sleep_history|de": None, "nature_docs|es": None}
for key in LONG:
    print(f"\n######## {key}  ({search[key]['q']})")
    seen = set()
    for e in search[key]["entries"]:
        u = e.get("channel_url")
        if not u or u in seen:
            continue
        seen.add(u)
        c = card(u, LC, "long")
        if c and (c["subs"] or 0) < 150_000:
            print(f"  {c['name'][:24]:24} subs={str(c['subs']):>7} age={str(c['age_days']):>5}d up={c['uploads']:>2}{c['uploads_note']:3} "
                  f"med={c['median']:>8,} best x{c['best_mult']:<6} 25m+={c['long25']:>2}/30 | {c['best'][:60]}")

print("\n\n======== SHORTS channels (recent small-channel hits)")
seen = set()
for vid, i in sinfo.items():
    if not i or not i.get("channel_url") or i["channel_url"] in seen:
        continue
    lang = (i.get("language") or "").split("-")[0]
    if lang not in ("en", "es", "de", "fr") or (i.get("channel_follower_count") or 10**9) >= 100_000:
        continue
    if (i.get("upload_date") or "0") < (TODAY - dt.timedelta(days=120)).strftime("%Y%m%d") or (i.get("view_count") or 0) < 300_000:
        continue
    seen.add(i["channel_url"])
    c = card(i["channel_url"], SC, "shorts")
    if c:
        print(f"  [{i.get('language')}] {c['name'][:24]:24} subs={str(c['subs']):>7} age={str(c['age_days']):>5}d shorts={c['uploads']:>3}{c['uploads_note']:3} "
              f"med={c['median']:>9,} hit={i['view_count']:>11,} | {(i.get('title') or '')[:60]}")
