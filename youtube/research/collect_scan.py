#!/usr/bin/env python3
"""collect_scan.py - how often each candidate film is uploaded in full by third parties on YouTube.

For every film in scan/films.json it runs long-video searches (EN / ES / PT, local titles, DE/FR native),
keeps hour-plus results whose title contains the film's title (and the year, for generic titles), drops
reviews/recaps, and records each copy's channel and views. Which copies are authorised is for the rights
holder to confirm. Writes scan/results.json (incrementally) and scan/summary.csv.
"""
import csv, json, os, re, time, unicodedata, urllib.parse
import yt_dlp

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "scan")
BAD = re.compile(r"review|facts|explained|explication|reseña|resenha|podcast|reaction|recap|resumen|resumo|trailer|tráiler|"
                 r"behind the scenes|making of|soundtrack|ost\b|analysis|análisis|análise|breakdown|kino\+|ending", re.I)
ydl = yt_dlp.YoutubeDL({"extract_flat": True, "quiet": True, "ignoreerrors": True, "skip_download": True})
ydl.params["playlistend"] = 20

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return " " + re.sub(r"[^a-z0-9]+", " ", s).strip() + " "

def search(q):
    url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(q) + "&sp=EgIYAg%3D%3D"
    return [e for e in ((ydl.extract_info(url, download=False) or {}).get("entries") or []) if e]

films = json.load(open(os.path.join(OUT, "films.json")))
res_path = os.path.join(OUT, "results.json")
results = json.load(open(res_path)) if os.path.exists(res_path) else {}
for f in films:
    key = f"{f['title']} ({f['year']})"
    if key in results: continue
    names = [norm(n) for n in [f["title"]] + f["alts"]]
    qs = [f"{f['title']} {f['year']} full movie", f"{f['title']} película completa", f"{f['title']} filme completo dublado"]
    qs += [f"{a} {f['year']}" for a in f["alts"][:2]]
    if f["country"] == "DE": qs.append(f"{f['title']} ganzer film deutsch")
    if f["country"] == "FR": qs.append(f"{f['title']} film complet")
    seen = {}
    for q in qs:
        try:
            hits = search(q)
        except Exception:
            hits = []
        for h in hits:
            t = h.get("title") or ""; nt = norm(t)
            if (h.get("duration") or 0) < 3600 or BAD.search(t): continue
            if not any(n in nt for n in names): continue
            if f["strict"] and str(f["year"]) not in t: continue
            seen[h.get("id")] = {"title": t, "views": h.get("view_count") or 0, "channel": h.get("channel"),
                                 "channel_id": h.get("channel_id"), "minutes": round(h["duration"] / 60), "id": h.get("id")}
        time.sleep(1)
    copies = sorted(seen.values(), key=lambda c: -c["views"])
    results[key] = {"country": f["country"], "copies": copies, "channels": len({c["channel_id"] for c in copies}),
                    "total_views": sum(c["views"] for c in copies), "max_views": copies[0]["views"] if copies else 0}
    json.dump(results, open(res_path, "w"), ensure_ascii=False, indent=1)
    print(f"{key[:45]:45} copies={len(copies):2} channels={results[key]['channels']:2} total={results[key]['total_views']:>12,}", flush=True)

rows = sorted(results.items(), key=lambda kv: -kv[1]["total_views"])
with open(os.path.join(OUT, "summary.csv"), "w", newline="") as fh:
    w = csv.writer(fh); w.writerow(["film", "country", "copies", "channels", "total_views", "max_views", "top_channels"])
    for k, v in rows:
        w.writerow([k, v["country"], len(v["copies"]), v["channels"], v["total_views"], v["max_views"],
                    "; ".join(f"{c['channel']} ({c['views']:,})" for c in v["copies"][:5])])
