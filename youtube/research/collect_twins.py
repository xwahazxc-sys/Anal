#!/usr/bin/env python3
"""collect_twins.py - is each real-world twin film already on YouTube as a full (60+ min) upload?

Reads twins.json, runs a long-video search per film, keeps hour-plus results whose title matches
the film's keyword. Writes full/twins_result.json.
"""
import json, os, re, time, urllib.parse
import yt_dlp

HERE = os.path.dirname(os.path.abspath(__file__))
ydl = yt_dlp.YoutubeDL({"extract_flat": True, "quiet": True, "ignoreerrors": True, "skip_download": True})
ydl.params["playlistend"] = 20
out = []
for t in json.load(open(os.path.join(HERE, "twins.json"))):
    url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(t["q"]) + "&sp=EgIYAg%3D%3D"
    hits = [e for e in ((ydl.extract_info(url, download=False) or {}).get("entries") or []) if e]
    m = [h for h in hits if (h.get("duration") or 0) >= 3600 and re.search(t["kw"], h.get("title") or "", re.I)]
    out.append({**t, "full_uploads": len(m), "uploads": [{"title": h.get("title"), "views": h.get("view_count"),
                "channel": h.get("channel"), "minutes": round((h.get("duration") or 0) / 60)}
                for h in sorted(m, key=lambda h: -(h.get("view_count") or 0))[:5]]})
    print(f"{t['twin'][:35]:35} full_uploads={len(m)}", flush=True); time.sleep(1)
json.dump(out, open(os.path.join(HERE, "full", "twins_result.json"), "w"), ensure_ascii=False, indent=1)
