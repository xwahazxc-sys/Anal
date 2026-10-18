"""Split an episode's image list into two Kaggle batches (pushA, pushB)."""
import base64, io, json, os, sys
from PIL import Image
ENG = os.path.dirname(os.path.abspath(__file__)); SP = os.path.dirname(os.path.dirname(ENG)); K = os.path.join(SP, "kaggle/qwen")
E = os.path.abspath(sys.argv[1]); ep = os.path.basename(E)
SC = json.load(open(os.path.join(E, "script.json")))
src = open(K + "/pushF1t/qfull1.py").read()
P0 = json.loads(src.split("#PLAN:")[-1].split("\n")[0]); I0 = json.loads(src.split("#IMAGES:")[-1].split("\n")[0])
body = open(K + "/qbody.py").read(); wf = base64.b64encode(open(K + "/wfq720.py", "rb").read()).decode()
LIB = [os.path.join(K, d) for d in ("outEA", "outEB", "outF2", "outF1", "outP")]
def jpg(p):
    b = io.BytesIO(); im = Image.open(p).convert("RGB"); im.thumbnail((1024, 1024)); im.save(b, "JPEG", quality=80); return base64.b64encode(b.getvalue()).decode()
imgs = [i for i in SC["images"] if not os.path.exists(os.path.join(E, "img", i["name"] + ".png"))]
t2i = [i for i in imgs if i["type"] == "t2i"]; ed = [i for i in imgs if i["type"] == "edit"]
halves = [t2i[0::2] + ed[0::2], t2i[1::2] + ed[1::2]]
for part, steps in zip("ab", halves):
    if not steps: continue
    refs = {"lenny.jpg": I0["lenny.jpg"]}
    for s in steps:
        r = s.get("ref", "")
        if r and r not in refs:
            n = r.rsplit(".", 1)[0]
            p = next((os.path.join(d, n + x) for d in LIB for x in (".png", ".jpg") if os.path.exists(os.path.join(d, n + x))), None)
            if r == "W_BASE.jpg": refs[r] = jpg(io.BytesIO(base64.b64decode(I0["W_BASE.jpg"])))
            elif p: refs[r] = jpg(p)
            else: sys.exit(f"missing ref {r}")
    plan = {"steps": steps, "style": P0["style"], "negative": P0["negative"]}
    d = os.path.join(E, "push" + part); os.makedirs(d, exist_ok=True)
    open(f"{d}/q.py", "w").write(body + "\n#PLAN:" + json.dumps(plan) + "\n#IMAGES:" + json.dumps(refs) + "\n#WF_B64:" + wf + "\n")
    slug = f"lenny-{ep}-{part}"
    json.dump({"id": f"iiiiafsdfs/{slug}", "title": slug, "code_file": "q.py", "language": "python", "kernel_type": "script", "is_private": True,
               "enable_gpu": True, "machine_shape": "NvidiaTeslaT4", "enable_internet": True, "dataset_sources": [], "competition_sources": [],
               "kernel_sources": []}, open(f"{d}/kernel-metadata.json", "w"))
    print(slug, len(steps), "images", os.path.getsize(f"{d}/q.py") // 1024, "KB")
