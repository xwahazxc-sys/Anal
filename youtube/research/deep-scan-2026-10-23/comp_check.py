"""Competition check for the 4 shortlisted niches: who is active now, how big, how new, how newcomers fare."""
import json, os, re, subprocess, time, urllib.parse, urllib.request, statistics as st, datetime as dt, concurrent.futures as cf

D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, "comp.json")
NICHES = {
 "travel_en": {"kind": "long", "q": ["how people live in", "life in the poorest country documentary", "living in north korea documentary",
     "daily life in africa documentary", "how people survive in", "life in the coldest village", "most isolated country documentary", "how people live in the arctic"]},
 "earth_es": {"kind": "long", "q": ["hace millones de años", "tierra prehistórica documental", "cómo era la tierra", "extinción de los dinosaurios documental",
     "supervolcán documental", "el impacto que acabó con los dinosaurios", "la tierra antes de los humanos", "eras geológicas documental"]},
 "disasters_de": {"kind": "long", "q": ["Katastrophe Doku", "Unglück Doku ganze Folge", "was geschah wirklich Unglück", "Schiffsunglück Doku",
     "Flugzeugabsturz Doku", "Explosion Katastrophe Geschichte", "Bergwerksunglück", "Zugunglück Doku"]},
 "hfy_de": {"kind": "long", "q": ["HFY deutsch", "Sci-Fi Geschichte deutsch Menschen Aliens", "Menschen sind Todesweltler", "Alien Rat Menschen Geschichte",
     "Sci-Fi Hörbuch deutsch", "Menschheit Aliens Geschichte deutsch", "HFY Geschichte deutsch", "Science Fiction Kurzgeschichte deutsch"]},
 "nostalgia_en": {"kind": "long", "q": ["things from the 1960s", "1950s america nostalgia", "things that disappeared from the 1970s", "growing up in the 1960s",
     "1960s grocery store", "forgotten american places", "things every 1960s kid", "life in the 1950s america"]},
 "royals_en": {"kind": "long", "q": ["british royal family history", "queen elizabeth secrets", "royal scandal history", "british aristocracy history",
     "victorian london history", "tudor history documentary", "king charles past", "royal family secrets documentary"]},
 "history_ja": {"kind": "long", "q": ["日本史 その後", "家系図 日本史", "戦国武将 その後", "日本史 解説 わかりやすく", "幕末 解説", "江戸時代 暮らし 解説",
     "歴史 雑学 日本", "大河ドラマ 史実 解説"]},
 "porque_es": {"kind": "short", "q": ["por qué los", "sabías que historia", "curiosidades historia", "datos curiosos", "por qué existe",
     "la verdad sobre", "historia increíble", "nadie te contó"]},
 "compare_de": {"kind": "short", "q": ["welcher ist am ungesündesten", "was ist gesünder", "supermarkt vergleich", "lebensmittel vergleich",
     "welches ist besser", "ranking lebensmittel", "supermarkt test", "zucker vergleich"]},
 "myth_shorts": {"kind": "short", "q": ["greek mythology story", "mythology animation", "zeus story", "norse mythology story", "folklore animation",
     "japanese folklore story", "myth explained", "legend animation"]},
 "bible_shorts": {"kind": "short", "q": ["bible story", "jesus miracle story", "moses story", "david and goliath", "bible animation",
     "old testament story", "bible explained", "noah ark story"]},
 "ww2_shorts": {"kind": "short", "q": ["ww2 story", "ww2 history", "soldier story ww2", "d day story", "ww2 facts", "world war 2 untold",
     "wwii pilot story", "ww2 mystery"]},
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
