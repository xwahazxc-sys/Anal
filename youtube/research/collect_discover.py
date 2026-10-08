#!/usr/bin/env python3
"""collect_discover.py - find recent (2023+) English-language full movies on YouTube and how many channels upload each.

Phase 1: long-video searches per genre x year collect candidate uploads whose title carries a 2023-2026 year.
Phase 2: for the most-viewed candidate films, search the film title again and count distinct channels with an
hour-plus upload - several independent uploaders is the piracy signal; one upload is usually the rights holder.
Fakes (AI concepts, game footage, reactions, reviews, trailers) are dropped. Writes discover/*.json.
"""
import json, os, re, time, unicodedata, urllib.parse
import yt_dlp

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "discover")
GENRES = ["horror", "thriller", "action", "romance", "romantic comedy", "comedy", "drama", "christian", "family",
          "animated", "sci-fi", "crime", "war", "western", "mystery", "true story"]
YEARS = [2023, 2024, 2025, 2026]
FAKE = re.compile(r"\bai\b|concept|trailer|teaser|reaction|react|review|explained|recap|summary|ending|gameplay|game|"
                  r"walkthrough|fan ?made|parody|podcast|breakdown|facts|trivia|verdict|information|knowledge|"
                  r"audiobook|asmr|compilation|episode|season|part \d|live\b|stream", re.I)
YEAR = re.compile(r"\b(2023|2024|2025|2026)\b")
ydl = yt_dlp.YoutubeDL({"extract_flat": True, "quiet": True, "ignoreerrors": True, "skip_download": True})

def search(q, n):
    ydl.params["playlistend"] = n
    url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(q) + "&sp=EgIYAg%3D%3D"
    try:
        return [e for e in ((ydl.extract_info(url, download=False) or {}).get("entries") or []) if e]
    except Exception:
        return []

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def core(title):
    """Film name = text before the first separator, minus year/marketing words."""
    t = re.split(r"\s[|\-–—:]\s|\||\(|\[|🎬|🔥|//", title)[0]
    t = re.sub(r"(?i)full movie|full film|new|movie|film|hd|4k|english|hollywood|latest|exclusive|official|"
               r"\b(2023|2024|2025|2026)\b", " ", t)
    return norm(t)

os.makedirs(OUT, exist_ok=True)
cand = {}
for g in GENRES:
    for y in YEARS:
        for q in (f"{g} full movie {y}", f"new {g} movie {y} full movie english"):
            for h in search(q, 40):
                t = h.get("title") or ""
                if (h.get("duration") or 0) < 3600 or FAKE.search(t) or not YEAR.search(t): continue
                c = core(t)
                if len(c) < 3 or len(c.split()) > 8: continue
                e = cand.setdefault(c, {"core": c, "genres": set(), "years": set(), "views": 0, "examples": []})
                e["genres"].add(g); e["years"].add(YEAR.search(t).group(1)); e["views"] += h.get("view_count") or 0
                if len(e["examples"]) < 3: e["examples"].append({"title": t, "channel": h.get("channel"), "views": h.get("view_count") or 0})
            time.sleep(1)
    print("phase1", g, len(cand), flush=True)
cands = sorted(cand.values(), key=lambda e: -e["views"])
json.dump([{**e, "genres": sorted(e["genres"]), "years": sorted(e["years"])} for e in cands],
          open(os.path.join(OUT, "candidates.json"), "w"), ensure_ascii=False, indent=1)

res = []
for e in cands[:220]:
    year = sorted(e["years"])[0]
    seen = {}
    for q in (f"{e['core']} {year} full movie", f"{e['core']} full movie english"):
        for h in search(q, 20):
            t = h.get("title") or ""
            if (h.get("duration") or 0) < 3600 or FAKE.search(t): continue
            if f" {e['core']} " not in f" {norm(t)} ": continue
            seen[h.get("id")] = {"title": t, "channel": h.get("channel"), "channel_id": h.get("channel_id"),
                                 "views": h.get("view_count") or 0, "minutes": round(h["duration"] / 60)}
        time.sleep(1)
    ups = sorted(seen.values(), key=lambda u: -u["views"])
    res.append({"film": e["core"], "year": year, "genres": sorted(e["genres"]), "channels": len({u["channel_id"] for u in ups}),
                "total_views": sum(u["views"] for u in ups), "uploads": ups[:12]})
    json.dump(res, open(os.path.join(OUT, "films.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{e['core'][:40]:40} ch={res[-1]['channels']:2} views={res[-1]['total_views']:>11,}", flush=True)
