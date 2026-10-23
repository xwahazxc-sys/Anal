"""Channel creation date from the public /about page (no player API, so no bot-check)."""
import json, os, re, time, urllib.request, concurrent.futures as cf, datetime as dt

D = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(D, "joined.json")
out = json.load(open(P)) if os.path.exists(P) else {}
urls = set()
for f, cap in (("long_channels.json", 200_000), ("shorts_channels.json", 300_000)):
    for u, v in json.load(open(os.path.join(D, f))).items():
        if v and (v.get("subs") is None or v["subs"] < cap):
            urls.add(u)
todo = [u for u in urls if u not in out]
print("channels", len(todo), flush=True)


def get(u):
    for i in range(3):
        try:
            t = urllib.request.urlopen(urllib.request.Request(u + "/about", headers={
                "User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en;q=0.9"}), timeout=40).read().decode("utf-8", "ignore")
            m = re.search(r'joinedDateText":\{"content":"Joined ([^"]+)"', t)
            return u, dt.datetime.strptime(m.group(1), "%b %d, %Y").strftime("%Y%m%d") if m else "unknown"
        except Exception:
            time.sleep(5)
    return u, None


with cf.ThreadPoolExecutor(6) as ex:
    for i, (u, d) in enumerate(ex.map(get, todo)):
        out[u] = d
        if i % 100 == 0:
            json.dump(out, open(P, "w")); print(i, flush=True)
json.dump(out, open(P, "w"))
print("JOINED done", len(out), sum(1 for v in out.values() if v and v != "unknown"), flush=True)
