#!/usr/bin/env python3
"""collect_gaps.py - (1) details for the top full movies, (2) does a 'twin' of each hit already exist?

For every concept in gaps.json it runs a long-video search and counts hour-plus results whose
title matches the concept keyword. Few matches = gap. Writes full/top_details.json, full/gaps_result.json.
"""
import json, os, re, time, urllib.parse
import yt_dlp

HERE = os.path.dirname(os.path.abspath(__file__))
flat = yt_dlp.YoutubeDL({"extract_flat": True, "quiet": True, "ignoreerrors": True, "skip_download": True})
full = yt_dlp.YoutubeDL({"quiet": True, "ignoreerrors": True, "skip_download": True})

details = []
for t in json.load(open(os.path.join(HERE, "top_films.json"))):
    i = full.extract_info(t["url"], download=False) or {}
    details.append({**t, "upload_date": i.get("upload_date"), "likes": i.get("like_count"),
                    "comments": i.get("comment_count"), "channel": i.get("channel"),
                    "subs": i.get("channel_follower_count"), "minutes": round((i.get("duration") or 0) / 60),
                    "description": (i.get("description") or "")[:900], "tags": (i.get("tags") or [])[:15]})
    print("detail", t["title"][:60], flush=True); time.sleep(1)
json.dump(details, open(os.path.join(HERE, "full", "top_details.json"), "w"), ensure_ascii=False, indent=1)

out = []
for g in json.load(open(os.path.join(HERE, "gaps.json"))):
    url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(g["q"]) + "&sp=EgIYAg%3D%3D"
    flat.params["playlistend"] = 30
    hits = [e for e in ((flat.extract_info(url, download=False) or {}).get("entries") or []) if e]
    long = [h for h in hits if (h.get("duration") or 0) >= 3600]
    match = [h for h in long if re.search(g["kw"], h.get("title") or "", re.I)]
    out.append({**g, "long_results": len(long), "matching": len(match),
                "matching_views": sorted([h.get("view_count") or 0 for h in match], reverse=True),
                "top_matches": [{"title": h.get("title"), "views": h.get("view_count"), "channel": h.get("channel")}
                                for h in sorted(match, key=lambda h: -(h.get("view_count") or 0))[:5]]})
    print(f"gap {g['concept'][:40]:40} long={len(long):2} match={len(match):2}", flush=True); time.sleep(1)
json.dump(out, open(os.path.join(HERE, "full", "gaps_result.json"), "w"), ensure_ascii=False, indent=1)
