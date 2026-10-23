"""Deep long-form niche scan. Stage A: search (this month, 20+ min, by views). Stage B: full info of top 10.
Stage C: channel recent uploads (90) + age of the oldest listed upload. Everything cached to JSON so it can resume."""
import json, os, subprocess, sys, time, urllib.parse, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from queries_long import Q

D = os.path.dirname(os.path.abspath(__file__))
SP_LONG = "CAMSBggEEAEYAg%3D%3D"   # sort=views, upload=this month, type=video, duration=long(>20min)


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


# ---- A: search
search = load("long_search.json", {})
jobs = [(n, l, q) for n, ls in Q.items() for l, q in ls.items() if f"{n}|{l}" not in search]


def do_search(a):
    n, l, q = a
    url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(q)}&sp={SP_LONG}"
    d = ytdlp(["--flat-playlist", "-J", "--playlist-end", "20", url])
    ents = [{"id": e.get("id"), "title": e.get("title"), "views": e.get("view_count") or 0, "dur": e.get("duration"),
             "channel": e.get("channel"), "channel_url": e.get("channel_url")} for e in (d or {}).get("entries", []) if e]
    return f"{n}|{l}", {"q": q, "entries": ents}


with cf.ThreadPoolExecutor(8) as ex:
    for i, (k, v) in enumerate(ex.map(do_search, jobs)):
        search[k] = v
        if i % 20 == 0:
            save("long_search.json", search); print("search", i, len(jobs), flush=True)
save("long_search.json", search)
print("A done", len(search), flush=True)

# ---- B: full info of top 10 per query
info = load("long_info.json", {})
ids = []
for k, v in search.items():
    for e in v["entries"][:10]:
        if e["id"] and e["id"] not in info and e["id"] not in ids:
            ids.append(e["id"])


def do_info(vid):
    d = ytdlp(["-J", "--skip-download", f"https://www.youtube.com/watch?v={vid}"], timeout=120)
    if not d:
        return vid, None
    return vid, {k: d.get(k) for k in ("upload_date", "view_count", "duration", "channel", "channel_url",
                                         "channel_follower_count", "language", "title", "like_count", "comment_count")}


with cf.ThreadPoolExecutor(12) as ex:
    for i, (vid, v) in enumerate(ex.map(do_info, ids)):
        info[vid] = v
        if i % 100 == 0:
            save("long_info.json", info); print("info", i, len(ids), flush=True)
save("long_info.json", info)
print("B done", len(info), flush=True)

# ---- C: channels with any top video >= 10k views
chans = load("long_channels.json", {})
want = {}
for k, v in search.items():
    for e in v["entries"]:
        if e["channel_url"] and e["views"] >= 10000:
            want[e["channel_url"]] = max(want.get(e["channel_url"], 0), e["views"])
todo = [u for u, _ in sorted(want.items(), key=lambda x: -x[1]) if u not in chans][:900]


def do_chan(u):
    d = ytdlp(["--flat-playlist", "-J", "--playlist-end", "90", u + "/videos"], timeout=200)
    if not d:
        return u, None
    vids = [{"id": e.get("id"), "title": e.get("title"), "views": e.get("view_count") or 0, "dur": e.get("duration")}
            for e in d.get("entries", []) if e]
    res = {"name": d.get("channel") or d.get("title"), "subs": d.get("channel_follower_count"), "vids": vids, "first": None}
    if 0 < len(vids) < 90:  # young channel: date of the oldest listed upload
        o = ytdlp(["-J", "--skip-download", f"https://www.youtube.com/watch?v={vids[-1]['id']}"], timeout=120)
        res["first"] = (o or {}).get("upload_date")
    return u, res


with cf.ThreadPoolExecutor(10) as ex:
    for i, (u, r) in enumerate(ex.map(do_chan, todo)):
        chans[u] = r
        if i % 50 == 0:
            save("long_channels.json", chans); print("chan", i, len(todo), flush=True)
save("long_channels.json", chans)
print("C done", len(chans), flush=True)
