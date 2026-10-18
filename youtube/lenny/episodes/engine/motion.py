"""Dynamic editing plan shared by both compositors: shot cuts inside a line, framings, keyword hits."""
import re
KEY = re.compile(r"(\d|\$|never|scam|free|money|code|password|bank|fake|crypto|gone|stop|always|every|nobody|trust|"
                 r"secret|steal|stole|lose|lost|card|urgent|now|today|real|warning|police|arrest|voice|clone)", re.I)
CALM = {"title", "big", "stamp", "list", "chips", "cards", "end", "quote", "notif", "call", "sub", "head"}
FR = {"W": (1.04, .5, .5), "M": (1.22, .5, .42), "C": (1.42, .5, .36), "L": (1.26, .36, .42), "R": (1.26, .64, .42)}
PAT = [["W", "M", "C"], ["M", "C", "W"], ["C", "W", "M"], ["W", "L", "R"], ["M", "R", "C"]]

def plan(seg, idx, calm=False):
    """Adds seg['shots'] = [{'t','z','fx','fy'}] (t relative to seg start) and seg['hits'] = [t...]."""
    d = seg["end"] - seg["start"]; lead = seg["voice"] - seg["start"] if seg.get("line") else 0
    W = (seg.get("text") or "").split(); T = seg.get("words") or []
    pat = PAT[idx % len(PAT)]
    cuts = [0.0]
    if not calm and len(T) == len(W) and W:
        for i in range(1, len(W)):
            c = lead + T[i] - 0.06
            if re.search(r"[.,?!:;]$", W[i - 1]) and c - cuts[-1] >= 1.6 and d - c >= 1.1:
                cuts.append(c)
        if len(cuts) == 1 and d > 4.2:                      # no punctuation: cut near the middle word
            m = len(W) // 2; c = lead + T[m] - 0.06
            if 1.6 <= c <= d - 1.1: cuts.append(c)
    shots = []
    for k, c in enumerate(cuts[:4]):
        f = "W" if calm else pat[k % len(pat)]
        z, fx, fy = FR[f]; shots.append({"t": round(c, 3), "z": z, "fx": fx, "fy": fy})
    hits = []
    if len(T) == len(W):
        for i, w in enumerate(W):
            t = lead + T[i]
            if KEY.search(w) and (not hits or t - hits[-1] >= 0.9) and len(hits) < 3: hits.append(round(t, 3))
    seg["shots"] = shots; seg["hits"] = hits
    return seg
