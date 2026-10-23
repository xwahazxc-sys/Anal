import json, os, statistics as st, datetime as dt

D = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(D, "comp.json")))
T = dt.date.today()
for name, n in data.items():
    vids, ch = n["videos"], n["channels"]
    by_ch = {}
    for v in vids.values():
        by_ch.setdefault(v["url"], []).append(v["views"])
    tot = sum(sum(x) for x in by_ch.values()) or 1
    top3 = sum(sorted((sum(x) for x in by_ch.values()), reverse=True)[:3]) / tot
    rows = []
    for u, c in ch.items():
        if not c or len(c["views"]) < 3:
            continue
        age = (T - dt.datetime.strptime(c["joined"], "%Y%m%d").date()).days if c.get("joined") else None
        rows.append(dict(name=c["name"], subs=c["subs"] or 0, age=age, n=len(c["views"]), med=st.median(c["views"][:30]),
                         month=sum(by_ch.get(u, []))))
    subs = [r["subs"] for r in rows]
    b = lambda lo, hi: sum(1 for s in subs if lo <= s < hi)
    new = [r for r in rows if r["age"] is not None and r["age"] <= 180]
    old = [r for r in rows if r["age"] is not None and r["age"] > 365]
    share = lambda rs, x: f"{sum(1 for r in rs if r['med'] >= x)}/{len(rs)}"
    print(f"\n==== {name} ({n['kind']})")
    print(f"  active channels in month sample: {len(rows)} (videos {len(vids)}); new uploads this week (8 queries): {len(n['week'])}")
    print(f"  size: <10k {b(0, 10_000)} | 10-100k {b(10_000, 100_000)} | 100k-1M {b(100_000, 1_000_000)} | 1M+ {b(1_000_000, 10**12)}")
    print(f"  top-3 channels take {top3:.0%} of sampled views")
    print(f"  channels <=6 months: {len(new)}  | median>=1k {share(new, 1000)}  >=5k {share(new, 5000)}  >=20k {share(new, 20000)}")
    print(f"  channels >1 year:   {len(old)}  | median>=1k {share(old, 1000)}  >=5k {share(old, 5000)}  >=20k {share(old, 20000)}")
    if new:
        print(f"  newcomers' median-of-medians: {int(st.median([r['med'] for r in new])):,}")
    for r in sorted(rows, key=lambda r: -r["month"])[:8]:
        print(f"    {r['name'][:26]:26} subs={r['subs']:>9,} age={str(r['age']):>5}d med={int(r['med']):>9,} month-sample={r['month']:>11,}")
