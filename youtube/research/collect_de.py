#!/usr/bin/env python3
"""collect_de.py - German-language full movies (60+ min): what ranks and how big, per genre.

Writes full/de_hits.json: per query the hour-plus search results with views.
"""
import json, os, statistics, time, urllib.parse
import yt_dlp

HERE = os.path.dirname(os.path.abspath(__file__))
Q = {"horror": "horrorfilm ganzer film deutsch", "thriller": "thriller ganzer film deutsch",
     "romance": "liebesfilm ganzer film deutsch", "drama": "drama ganzer film deutsch",
     "comedy": "komödie ganzer film deutsch", "action": "actionfilm ganzer film deutsch",
     "scifi": "science fiction ganzer film deutsch", "faith": "christlicher film ganzer film deutsch",
     "family": "familienfilm ganzer film deutsch", "crime": "krimi ganzer film deutsch",
     "history": "historienfilm ganzer film deutsch", "true_story": "wahre geschichte ganzer film deutsch"}
ydl = yt_dlp.YoutubeDL({"extract_flat": True, "quiet": True, "ignoreerrors": True, "skip_download": True})
ydl.params["playlistend"] = 40
out = {}
for g, q in Q.items():
    url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(q) + "&sp=EgIYAg%3D%3D"
    hits = [e for e in ((ydl.extract_info(url, download=False) or {}).get("entries") or []) if e]
    long = [{"title": h.get("title"), "views": h.get("view_count") or 0, "channel": h.get("channel"),
             "minutes": round((h.get("duration") or 0) / 60)} for h in hits if (h.get("duration") or 0) >= 3600]
    v = [x["views"] for x in long]
    out[g] = {"query": q, "long_results": len(long), "median_views": int(statistics.median(v)) if v else 0,
              "over_1M": sum(1 for x in v if x >= 1_000_000), "results": sorted(long, key=lambda x: -x["views"])}
    print(f"{g:10} long={len(long):2} median={out[g]['median_views']:>10,}", flush=True); time.sleep(1)
json.dump(out, open(os.path.join(HERE, "full", "de_hits.json"), "w"), ensure_ascii=False, indent=1)
