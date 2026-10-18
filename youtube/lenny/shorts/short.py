"""Vertical Shorts from episode lines.  python3 short.py NAME [render]"""
import difflib, glob, json, os, re, subprocess, sys, wave
import numpy as np
SP = "/tmp/claude-0/-home-user-Anal/29395d32-6348-5014-9351-365c62c4f7d2/scratchpad"; H = SP + "/shorts"
sys.path.insert(0, SP + "/voice"); sys.path.insert(0, SP + "/eps/engine")
import imageio_ffmpeg, motion
FF = imageio_ffmpeg.get_ffmpeg_exe(); FPS = 30; VR = 24000
name = sys.argv[1]; SPEC = json.load(open(H + "/shorts.json"))[name]; D = f"{H}/{name}"; os.makedirs(D + "/audio", exist_ok=True); os.makedirs(D + "/img", exist_ok=True)
LIB = sorted(glob.glob(SP + "/eps/ep*/img")) + [SP + "/kaggle/qwen/" + d for d in ("outEA", "outEB", "outF2", "outF1", "outP")]
def find(n):
    for d in LIB:
        for x in (".png", ".jpg"):
            if os.path.exists(f"{d}/{n}{x}"): return f"{d}/{n}{x}"
def read(f):
    w = wave.open(f); return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
def trim(a):
    i = np.where(np.abs(a) > .01)[0]; return a[max(0, i[0] - 1200):i[-1] + 1800] if len(i) else a
LENNY = open(SP + "/voice/lenny_voice_id").read().strip()
items = []
for it in SPEC["items"]:
    if "ep" in it:
        E = SP + "/eps/" + it["ep"]; L = {l["id"]: l for l in json.load(open(E + "/script.json"))["lines"]}[it["id"]]
        W = json.load(open(E + "/words.json"))[it["id"]]
        items.append({"wav": f"{E}/audio/{it['id']}.wav", "text": L["text"], "ov": L.get("ov"), "img": it.get("img", L["img"]), "words": W})
    else:
        f = f"{D}/audio/{it['new']}.wav"
        if not os.path.exists(f):
            from el import tts
            os.environ.setdefault("EL_SPEED", "1.1"); tts(f, LENNY, it["text"])
        items.append({"wav": f, "text": it["text"], "ov": it.get("ov"), "img": it["img"], "words": None, "new": True})
# word timings for new lines (same approach as align.py)
if any(i["words"] is None for i in items):
    from faster_whisper import WhisperModel
    m = WhisperModel("base.en", device="cpu", compute_type="int8")
    norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())
    for i in items:
        if i["words"] is not None: continue
        a = trim(read(i["wav"])); w = wave.open(i["wav"] + ".t.wav", "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(VR)
        w.writeframes((a * 32767).astype(np.int16).tobytes()); w.close(); i["wav"] += ".t.wav"
        segs, _ = m.transcribe(i["wav"], word_timestamps=True, beam_size=1, language="en")
        Hh = [(x.start, norm(x.word)) for s in segs for x in (s.words or [])]; Ws = i["text"].split(); t = [None] * len(Ws)
        for a0, b0, n in difflib.SequenceMatcher(None, [norm(x) for x in Ws], [h[1] for h in Hh], autojunk=False).get_matching_blocks():
            for k in range(n): t[a0 + k] = Hh[b0 + k][0]
        last = 0.0
        for k in range(len(t)):
            if t[k] is None: t[k] = last + .25
            last = t[k]
        i["words"] = t
segs, t = [], 0.12; moves = ["in", "pan", "out", "pan2"]
voice = np.zeros(int(70 * VR), np.float32)
for k, i in enumerate(items):
    a = read(i["wav"]); f = int(.03 * VR); a[:f] *= np.linspace(0, 1, f); a[-f:] *= np.linspace(1, 0, f)
    dur = len(a) / VR; o = int(t * VR); voice[o:o + len(a)] += a
    src = find(i["img"]); dst = f"{D}/img/{i['img']}.jpg"
    if not os.path.exists(dst):
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", src, "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080", "-q:v", "2", dst], check=True)
    segs.append({"start": t, "voice": t, "dur": dur, "end": t + dur + .22, "text": i["text"], "words": i["words"], "ov": i["ov"],
                 "img": "file://" + dst, "move": moves[k % 4], "fx": .5})
    t += dur + .22
total = t + .5; segs[-1]["end"] = total; voice = voice[:int(total * VR)]
w = wave.open(D + "/voice.wav", "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(VR); w.writeframes((np.clip(voice, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
sfx = np.zeros(int(total * 44100), np.float32); tt = np.arange(int(.4 * 44100)) / 44100
ping = np.concatenate([np.sin(2 * np.pi * 1320 * tt[:7900]) * np.exp(-tt[:7900] * 9), np.sin(2 * np.pi * 1760 * tt) * np.exp(-tt * 9)]) * .25
for s in segs:
    if s["ov"] and s["ov"].get("t") == "notif":
        a0 = int((s["start"] + .1) * 44100); sfx[a0:a0 + len(ping)] += ping[:len(sfx) - a0]
w = wave.open(D + "/sfx.wav", "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(44100); w.writeframes((np.clip(sfx, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
json.dump({"segs": segs, "total": total, "screen": SPEC["screen"]}, open(D + "/timeline.json", "w"))
print(name, "total", round(total, 1), "s")
if len(sys.argv) > 2 and sys.argv[2] == "render":
    from playwright.sync_api import sync_playwright
    N = int(total * FPS); K = int(sys.argv[3]) if len(sys.argv) > 3 else 0; parts = 3
    def chunk(k):
        a, z = N * k // parts, N * (k + 1) // parts
        enc = subprocess.Popen([FF, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast",
                                "-crf", "18", "-pix_fmt", "yuv420p", f"{D}/ch_{k}.mp4"], stdin=subprocess.PIPE)
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--allow-file-access-from-files"])
            pg = b.new_page(viewport={"width": 1080, "height": 1920}); pg.goto("file://" + H + "/short.html"); pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(300); pg.evaluate("tl => setup(tl)", json.load(open(D + "/timeline.json")))
            for f in range(a, z):
                pg.evaluate(f"render({f / FPS})"); pg.evaluate("ready()"); enc.stdin.write(pg.screenshot(type="jpeg", quality=92))
            b.close()
        enc.stdin.close(); enc.wait()
    if K == 0:
        ps = [subprocess.Popen([sys.executable, __file__, name, "render", str(k + 1)]) for k in range(parts)]
        [p.wait() for p in ps]
        open(D + "/ch.txt", "w").write("".join(f"file '{D}/ch_{k}.mp4'\n" for k in range(parts)))
        li = motion.master(FF, D + "/ch.txt", D + "/voice.wav", D + "/sfx.wav", f"{H}/{name}.mp4", SP + "/music/Dark_Fog.mp3")
        print("done", f"{H}/{name}.mp4", "input", li)
    else:
        chunk(K - 1)
