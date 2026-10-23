"""Deep Shorts scan. S1: popular Shorts per hashtag. S2: full info (date, channel, subs, language) for those with
>= 50k views. S3: /shorts tab of small channels with recent breakouts (median, count)."""
import json, os, subprocess, time, concurrent.futures as cf, datetime as dt

D = os.path.dirname(os.path.abspath(__file__))
TAGS = {
 "en": ["darkhistory", "historyfacts", "history", "mythology", "greekmythology", "urbanlegends", "creepyfacts", "scaryfacts",
        "truecrime", "unsolvedmysteries", "spacefacts", "psychologyfacts", "didyouknow", "aicat", "aianimals", "aistory",
        "catstory", "oddlysatisfying", "aiasmr", "whatif", "bibleshorts", "biblestory", "nostalgia", "oldhollywood", "ww2",
        "ancientrome", "ancientegypt", "medieval", "folklore", "scifi", "stoicism", "sciencefacts", "animalfacts", "deepsea",
        "vikings", "survival", "lostcivilization", "japanesefolklore", "geography", "engineering"],
 "de": ["geschichte", "wussteste", "fakten", "mythologie", "gruselig", "truecrimedeutsch", "ddr", "mittelalter", "katze",
        "nostalgie", "wissen", "kigeneriert", "römer", "wikinger"],
 "fr": ["histoire", "lesaviezvous", "mythologie", "faitsdivers", "horreur", "chat", "nostalgie", "culturegenerale", "moyenage",
        "histoiredefrance"],
 "nl": ["geschiedenis", "weetjes", "wistjedat"],
 "no": ["visstedu", "norskhistorie"], "da": ["vidstedu", "danmarkshistorie"], "sv": ["historia", "fakta"],
 "fi": ["tiesitkö", "historia"],
 "it": ["storia", "curiosità", "losapevi", "mitologia", "misteri"],
 "es": ["historia", "sabiasque", "curiosidades", "mitologia", "misterio"],
 "ja": ["雑学", "歴史", "都市伝説", "怖い話", "猫", "日本史"],
 "ko": ["역사", "미스터리", "상식", "고양이", "무서운이야기"],
}


def ytdlp(args, timeout=150):
    try:
        r = subprocess.run(["python3", "-m", "yt_dlp", "--no-warnings", *args], capture_output=True, text=True, timeout=timeout)
        return json.loads(r.stdout) if r.stdout.strip() else None
    except Exception:
        return None


def load(name, default):
    p = os.path.join(D, name)
    return json.load(open(p)) if os.path.exists(p) else default


def save(name, obj):
    json.dump(obj, open(os.path.join(D, name), "w"), ensure_ascii=False)


tags = load("shorts_tags.json", {})
jobs = [(l, t) for l, ts in TAGS.items() for t in ts if f"{l}|{t}" not in tags]


def do_tag(a):
    l, t = a
    d = ytdlp(["--flat-playlist", "-J", "--playlist-end", "60", f"https://www.youtube.com/hashtag/{t}/shorts"])
    return f"{l}|{t}", [{"id": e.get("id"), "views": e.get("view_count") or 0} for e in (d or {}).get("entries", []) if e]


with cf.ThreadPoolExecutor(6) as ex:
    for k, v in ex.map(do_tag, jobs):
        tags[k] = v
save("shorts_tags.json", tags)
print("S1 done", len(tags), sum(len(v) for v in tags.values()), flush=True)

info = load("shorts_info.json", {})
ids = []
for v in tags.values():
    for e in v:
        if e["id"] and e["views"] >= 50000 and e["id"] not in info and e["id"] not in ids:
            ids.append(e["id"])


def do_info(vid):
    d = ytdlp(["-J", "--skip-download", f"https://www.youtube.com/shorts/{vid}"], timeout=120)
    if not d:
        return vid, None
    return vid, {k: d.get(k) for k in ("upload_date", "view_count", "duration", "channel", "channel_url",
                                         "channel_follower_count", "language", "title")}


with cf.ThreadPoolExecutor(10) as ex:
    for i, (vid, v) in enumerate(ex.map(do_info, ids)):
        info[vid] = v
        if i % 100 == 0:
            save("shorts_info.json", info); print("info", i, len(ids), flush=True)
save("shorts_info.json", info)
print("S2 done", len(info), flush=True)

cut = (dt.date.today() - dt.timedelta(days=120)).strftime("%Y%m%d")
small = {}
for v in info.values():
    if v and (v.get("upload_date") or "0") >= cut and (v.get("channel_follower_count") or 0) < 300000 and v.get("channel_url"):
        small[v["channel_url"]] = 1
chans = load("shorts_channels.json", {})
todo = [u for u in small if u not in chans]


def do_chan(u):
    d = ytdlp(["--flat-playlist", "-J", "--playlist-end", "120", u + "/shorts"], timeout=200)
    if not d:
        return u, None
    return u, {"name": d.get("channel") or d.get("title"), "subs": d.get("channel_follower_count"),
               "vids": [{"id": e.get("id"), "title": e.get("title"), "views": e.get("view_count") or 0}
                        for e in d.get("entries", []) if e]}


with cf.ThreadPoolExecutor(8) as ex:
    for u, r in ex.map(do_chan, todo):
        chans[u] = r
save("shorts_channels.json", chans)
print("S3 done", len(chans), flush=True)
