"""Old-engine short timeline → public/shorts/<name>/ep.json for the Remotion Short."""
import json, os, shutil, sys, re
SP = "/tmp/claude-0/-home-user-Anal/29395d32-6348-5014-9351-365c62c4f7d2/scratchpad/shorts"
name = sys.argv[1]; D = f"{SP}/{name}"; pub = f"/home/user/claude-motion/public/shorts/{name}"
os.makedirs(pub, exist_ok=True)
t = json.load(open(f"{D}/timeline.json"))
segs = []
for k, s in enumerate(t["segs"]):
    src = s["img"].replace("file://", ""); nm = os.path.basename(src).rsplit(".", 1)[0]
    shutil.copy(src, f"{pub}/{nm}.jpg")
    toks = s["text"].split(); ws = s["words"] or []
    words = [[toks[i], round(s["voice"] + ws[i], 3)] for i in range(min(len(toks), len(ws)))]
    segs.append(dict(s=round(s["start"], 3), e=round(s["end"], 3), img=nm, ov=s.get("ov"), words=words, k=k))
caps = []
for g in segs:
    cur = []
    for i, (w, at) in enumerate(g["words"]):
        cur.append([w, at])
        if len(cur) >= 3 or (re.search(r"[.?!,:;]$", w) and len(cur) >= 1) or i == len(g["words"]) - 1:
            caps.append(cur); cur = []
for i, c in enumerate(caps):
    nxt = caps[i + 1][0][1] if i + 1 < len(caps) else c[-1][1] + 1.0
    caps[i] = {"a": c[0][1], "b": round(min(nxt, c[-1][1] + 0.5 + 0.05 * len(c[-1][0])), 3), "w": c}
spec = json.load(open(f"{SP}/shorts.json"))[name]
json.dump({"duration": round(t["total"], 2), "segs": segs, "caps": caps, "screen": t["screen"], "title": spec["title"]}, open(f"{pub}/ep.json", "w"))
shutil.copy(f"{D}/voice.wav", f"{pub}/voice.wav")
print(name, len(segs), "segs", len(caps), "caps", t["total"])
