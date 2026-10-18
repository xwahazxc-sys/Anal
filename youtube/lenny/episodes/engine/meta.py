"""Write upload.md (title, description with chapters, tags) for an episode from script + timeline."""
import json, os, re, sys
E = os.path.abspath(sys.argv[1]); SC = json.load(open(os.path.join(E, "script.json")))
TL = json.load(open(os.path.join(E, "timeline.json")))
M = json.load(open(os.path.join(os.path.dirname(__file__), "meta.json")))[os.path.basename(E)]
def clean(h):
    h = re.sub(r"<[^>]+>", " ", h).replace("&amp;", "&")
    cap = lambda w: w if w in ("AI", "#1") or w.isdigit() else (w[0] + w[1:].lower() if w[0] not in "\"'" else w[0] + w[1:2] + w[2:].lower())
    return " ".join(cap(w) for w in h.split())
def ts(t): t = int(t); return f"{t // 60}:{t % 60:02d}"
ch = [(0, "Intro")]
for s in TL["segs"]:
    ov = s.get("ov") or {}
    if ov.get("t") == "title" and s.get("line"):
        name = (ov.get("n", "") + " " + clean(ov["s"])).strip() if ov.get("n") else clean(ov["s"])
        if s["start"] - ch[-1][0] >= 10: ch.append((s["start"], name))
    if ov.get("t") == "head" and s["start"] > TL["total"] * 0.6 and s["start"] - ch[-1][0] >= 10:
        ch.append((s["start"], clean(ov["s"])))
last = [s for s in TL["segs"] if (s.get("ov") or {}).get("t") == "cards" and s["start"] > TL["total"] * 0.8]
if last and last[0]["start"] - ch[-1][0] >= 10: ch.append((last[0]["start"], "Recap"))
MUS = {"ep02":"Spy Glass","ep03":"Investigations","ep04":"Hidden Agenda","ep05":"Investigations","ep06":"Sneaky Snitch","ep07":"Spy Glass","ep08":"Hidden Agenda"}
MUSIC_CREDIT = f'🎵 Music: "{MUS.get(os.path.basename(E), "Sneaky Snitch")}" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/'
desc = M["desc"].strip() + "\n\n⏱ CHAPTERS\n" + "\n".join(f"{ts(t)} {n}" for t, n in ch) + "\n\n" + M.get("extra", "").strip() + """

🛡 If you've lost money to a scam (US): call your bank first, then report at reportfraud.ftc.gov and ic3.gov. People over 60 can call the National Elder Fraud Hotline: 1-833-FRAUD-11 (1-833-372-8311). UK: forward scam texts to 7726 and report to Action Fraud.

🦝 Lenny is a fictional character — a reformed con artist who takes scams apart so they stop working on you. Messages, names, numbers and websites shown are made up for education. This video is not financial or legal advice.

#scams #scamawareness #fraudprevention""".replace("\n\n#scams", "\n\n" + MUSIC_CREDIT + "\n\n#scams")
out = f"# {M['titles'][0]}\n\n## Title options\n" + "\n".join(f"- {t}" for t in M["titles"]) + \
      f"\n\n## Description\n```\n{desc}\n```\n\n## Tags\n```\n{', '.join(M['tags'])}\n```\n\n## Thumbnail\n`thumbnail.png` (1280×720)\n\n## Length\n{ts(TL['total'])}\n"
open(os.path.join(E, "upload.md"), "w").write(out); print(out[:600])
