"""Build slides/<name>.jpg (1920x1080) for every image the timeline needs.
Qwen output wins (outF2, outF1, outP); otherwise fall back to the old Wan slide."""
import json, os, subprocess, imageio_ffmpeg
HERE = os.path.dirname(os.path.abspath(__file__)); S = os.path.dirname(HERE)
FF = imageio_ffmpeg.get_ffmpeg_exe()
Q = [os.path.join(S, "kaggle/qwen", d) for d in ("outEA", "outEB", "outF2", "outF1", "outP")]
OLD = os.path.join(S, "ep01_slides/slides")
OLDRE = json.load(open("/home/user/Anal/youtube/lenny/slideshow/slides_plan.json"))["reuse"]
RE = json.load(open(os.path.join(HERE, "reuse.json")))["reuse"]
ids = [l["id"] for l in json.load(open(os.path.join(HERE, "lines.json")))]
need = sorted({RE.get(i, i) for i in ids} | {"L03"})
os.makedirs(os.path.join(HERE, "slides"), exist_ok=True)
qn = old = 0
for n in need:
    if n == "lab": continue
    src = next((os.path.join(d, n + ".png") for d in Q if os.path.exists(os.path.join(d, n + ".png"))), None)
    if src: qn += 1
    else:
        src = os.path.join(OLD, OLDRE.get(n, n) + ".jpg"); old += 1
        if not os.path.exists(src): src = os.path.join(OLD, "lab.jpg")
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", src, "-vf",
                    "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,unsharp=5:5:0.4",
                    "-q:v", "2", os.path.join(HERE, "slides", n + ".jpg")], check=True)
print(f"slides: {qn} qwen, {old} old fallback")
