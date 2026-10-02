#!/usr/bin/env python3
"""collect_lang.py - full movies (60+ min) per genre for high-RPM languages.

Writes full/lang_hits.json: {lang: {genre: {median_views, over_1M, results}}}.
"""
import json, os, statistics, time, urllib.parse
import yt_dlp

HERE = os.path.dirname(os.path.abspath(__file__))
G = ["horror", "thriller", "romance", "comedy", "drama", "family"]
Q = {
 "fr": ["film d'horreur complet en français", "thriller film complet en français", "film romantique complet en français",
        "comédie film complet en français", "drame film complet en français", "film familial complet en français"],
 "nl": ["horrorfilm volledige film nederlands", "thriller volledige film nederlands", "romantische film volledige film nederlands",
        "komedie volledige film nederlands", "drama volledige film nederlands", "familiefilm volledige film nederlands"],
 "sv": ["skräckfilm hela filmen svenska", "thriller hela filmen svenska", "romantisk film hela filmen svenska",
        "komedi hela filmen svenska", "drama hela filmen svenska", "familjefilm hela filmen svenska"],
 "no": ["skrekkfilm hele filmen norsk", "thriller hele filmen norsk", "romantisk film hele filmen norsk",
        "komedie hele filmen norsk", "drama hele filmen norsk", "familiefilm hele filmen norsk"],
 "da": ["gyserfilm hele filmen dansk", "thriller hele filmen dansk", "romantisk film hele filmen dansk",
        "komedie hele filmen dansk", "drama hele filmen dansk", "familiefilm hele filmen dansk"],
 "ko": ["공포영화 풀영화", "스릴러 영화 풀버전", "로맨스 영화 풀영화", "코미디 영화 풀영화", "드라마 영화 풀영화", "가족영화 풀영화"],
}
ydl = yt_dlp.YoutubeDL({"extract_flat": True, "quiet": True, "ignoreerrors": True, "skip_download": True})
ydl.params["playlistend"] = 40
out = {}
for lang, qs in Q.items():
    out[lang] = {}
    for g, q in zip(G, qs):
        url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(q) + "&sp=EgIYAg%3D%3D"
        hits = [e for e in ((ydl.extract_info(url, download=False) or {}).get("entries") or []) if e]
        long = [{"title": h.get("title"), "views": h.get("view_count") or 0, "channel": h.get("channel"),
                 "minutes": round((h.get("duration") or 0) / 60)} for h in hits if (h.get("duration") or 0) >= 3600]
        v = [x["views"] for x in long]
        out[lang][g] = {"query": q, "long_results": len(long), "median_views": int(statistics.median(v)) if v else 0,
                        "over_1M": sum(1 for x in v if x >= 1_000_000), "results": sorted(long, key=lambda x: -x["views"])}
        print(f"{lang} {g:9} long={len(long):2} median={out[lang][g]['median_views']:>10,}", flush=True); time.sleep(1)
json.dump(out, open(os.path.join(HERE, "full", "lang_hits.json"), "w"), ensure_ascii=False, indent=1)
