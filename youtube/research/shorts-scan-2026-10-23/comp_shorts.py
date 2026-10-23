"""Competition check for the 4 shortlisted niches: who is active now, how big, how new, how newcomers fare."""
import json, os, re, subprocess, time, urllib.parse, urllib.request, statistics as st, datetime as dt, concurrent.futures as cf

D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, "comp_shorts.json")
NICHES = {
 "space_en": {"kind": "short", "q": ["how big is the sun compared", "what if earth", "size comparison universe", "black hole explained", "what happens if you fall into", "biggest star in the universe", "planet size comparison", "space facts"]},
 "body_en": {"kind": "short", "q": ["what happens to your body if", "human body facts", "what happens when you stop", "your brain when", "body facts you didn't know", "what happens if you don't sleep", "inside human body animation", "how your body"]},
 "money_en": {"kind": "short", "q": ["how much does it cost to", "how rich is", "salary of a", "money facts", "how billionaires spend", "most expensive thing", "how much does a pilot make", "net worth explained"]},
 "psych_en": {"kind": "short", "q": ["psychology facts", "dark psychology", "psychology trick", "why do we", "human behavior facts", "manipulation tactics", "body language facts", "mind facts"]},
 "history_en": {"kind": "short", "q": ["history facts", "ancient history facts", "medieval life", "what life was like in", "history you didn't learn", "ancient rome facts", "worst jobs in history", "history explained"]},
 "ww2_en": {"kind": "short", "q": ["ww2 story", "ww2 history", "soldier story ww2", "d day story", "ww2 facts", "world war 2 untold", "wwii pilot story", "ww2 mystery"]},
 "myth_en": {"kind": "short", "q": ["greek mythology story", "mythology animation", "zeus story", "norse mythology story", "folklore animation", "japanese folklore story", "myth explained", "legend animation"]},
 "horror_en": {"kind": "short", "q": ["analog horror", "scary story animation", "creepy cctv footage story", "liminal space horror", "found footage horror short", "night shift horror", "horror animation short", "scary facts"]},
 "survival_en": {"kind": "short", "q": ["how to survive", "survival tips", "what would you do if", "could you survive", "survival facts", "how long can you survive", "deadliest place on earth", "survive in the wild"]},
 "animals_en": {"kind": "short", "q": ["animal facts", "strongest animal", "animal comparison", "who would win animal", "deadliest animals", "animal size comparison", "rare animals", "ocean creatures"]},
 "cars_en": {"kind": "short", "q": ["car facts", "how engines work", "fastest car in the world", "car history", "supercar facts", "why cars have", "car evolution", "most expensive car"]},
 "engineering_en": {"kind": "short", "q": ["how it's made", "engineering explained", "how was it built", "megaprojects", "how bridges are built", "ancient engineering", "how does it work animation", "inside a"]},
 "geo_en": {"kind": "short", "q": ["map facts", "geography facts", "why is this country", "border explained", "countries explained", "map animation", "why nobody lives in", "strange borders"]},
 "compare_de": {"kind": "short", "q": ["welcher ist am ungesündesten", "was ist gesünder", "supermarkt vergleich", "lebensmittel vergleich", "welches ist besser", "ranking lebensmittel", "supermarkt test", "zucker vergleich"]},
 "facts_de": {"kind": "short", "q": ["wusstest du", "fakten die du nicht kanntest", "geschichte fakten", "krasse fakten", "was wäre wenn", "warum ist", "erklärt in 60 sekunden", "unglaubliche fakten"]},
 "drama_en": {"kind": "short", "q": ["she didn't know he was", "he humiliated her", "pov story", "story time animation", "sci fi pov", "military story", "revenge story", "plot twist story"]},
}
SP = {"long": ["CAMSBggEEAEYAg%3D%3D", "EgYIBBABGAI%3D"],      # this month + long: by views / by relevance
      "short": ["EgYIBBABGAE%3D", "CAISBggCEAEYAQ%3D%3D"]}    # this month + short by relevance / this week + short by date
WEEK = {"long": "CAISBggCEAEYAg%3D%3D", "short": "CAISBggCEAEYAQ%3D%3D"}  # this week, by upload date


def ytdlp(args, timeout=150):
    try:
        r = subprocess.run(["python3", "-m", "yt_dlp", "--no-warnings", *args], capture_output=True, text=True, timeout=timeout)
        return json.loads(r.stdout) if r.stdout.strip() else None
    except Exception:
        return None


def search(q, sp, n=40):
    d = ytdlp(["--flat-playlist", "-J", "--playlist-end", str(n),
               f"https://www.youtube.com/results?search_query={urllib.parse.quote(q)}&sp={sp}"])
    return [{"id": e.get("id"), "title": e.get("title"), "views": e.get("view_count") or 0, "dur": e.get("duration"),
             "channel": e.get("channel"), "url": e.get("channel_url")} for e in (d or {}).get("entries", []) if e]


data = json.load(open(OUT)) if os.path.exists(OUT) else {}
for name, cfg in NICHES.items():
    if name in data:
        continue
    kind = cfg["kind"]
    q = [x + (" #shorts" if kind == "short" else "") for x in cfg["q"]]
    jobs = [(x, sp) for x in q for sp in SP[kind]]
    with cf.ThreadPoolExecutor(6) as ex:
        res = list(ex.map(lambda a: (a, search(*a)), jobs))
    vids = {}
    for (x, sp), ents in res:
        for e in ents:
            if not e["id"] or not e["url"]:
                continue
            d = e.get("dur") or 0
            if kind == "long" and d < 1200: continue
            if kind == "short" and (d == 0 or d > 180): continue
            vids[e["id"]] = e
    week = {}
    with cf.ThreadPoolExecutor(6) as ex:
        for x, ents in zip(q, ex.map(lambda x: search(x, WEEK[kind], 100), q)):
            for e in ents:
                if e["id"]:
                    week[e["id"]] = e
    chans = sorted({v["url"] for v in vids.values()})
    print(name, "videos", len(vids), "channels", len(chans), "week uploads", len(week), flush=True)

    def chan(u):
        tab = "/videos" if kind == "long" else "/shorts"
        d = ytdlp(["--flat-playlist", "-J", "--playlist-end", "60", u + tab], timeout=200)
        if not d:
            return u, None
        joined = None
        try:
            t = urllib.request.urlopen(urllib.request.Request(u + "/about", headers={"User-Agent": "Mozilla/5.0",
                "Accept-Language": "en-US,en;q=0.9"}), timeout=40).read().decode("utf-8", "ignore")
            m = re.search(r'joinedDateText":\{"content":"Joined ([^"]+)"', t)
            joined = dt.datetime.strptime(m.group(1), "%b %d, %Y").strftime("%Y%m%d") if m else None
        except Exception:
            pass
        return u, {"name": d.get("channel") or d.get("title"), "subs": d.get("channel_follower_count"), "joined": joined,
                   "views": [e.get("view_count") or 0 for e in d.get("entries", []) if e]}

    with cf.ThreadPoolExecutor(6) as ex:
        cd = dict(ex.map(chan, chans))
    data[name] = {"kind": kind, "videos": vids, "week": week, "channels": cd}
    json.dump(data, open(OUT, "w"), ensure_ascii=False)
print("COMP done", flush=True)
