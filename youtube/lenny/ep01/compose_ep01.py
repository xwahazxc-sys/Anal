"""Episode 1 part 1 compositor.

    python3 compose_ep01.py frames CLIPDIR      # extract + upscale clip frames to frames/<shot>/NNN.jpg
    python3 compose_ep01.py timeline            # timeline.json + voice.wav + sfx.wav
    python3 compose_ep01.py preview 3 20 ...    # PNG previews
    python3 compose_ep01.py chunk K N           # render chunk K of N (video only)
    python3 compose_ep01.py mux N               # -> lenny_ep01_part1.mp4
"""
import glob, json, math, os, subprocess, sys, wave
import numpy as np
import imageio_ffmpeg
HERE = os.path.dirname(os.path.abspath(__file__)); P = lambda *a: os.path.join(HERE, *a)
FF = imageio_ffmpeg.get_ffmpeg_exe(); FPS, SR = 30, 44100
CLIP = 81 / 24
BG = {"T01": ("S04", 1), "G01": ("S06", 1), "G02": ("S07", 1), "T02": ("S09", 1), "G03": ("S10", 1), "G04": ("S12", 1), "STING": ("S03", 1)}
cmd = sys.argv[1]

if cmd == "frames":
    src = sys.argv[2]
    for f in sorted(glob.glob(os.path.join(src, "S*.mp4"))):
        k = os.path.basename(f)[:-4]; d = P("frames", k); os.makedirs(d, exist_ok=True)
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", f, "-vf",
                        "scale=1920:1108:flags=lanczos,crop=1920:1080,unsharp=5:5:0.6:5:5:0.0", "-q:v", "2", os.path.join(d, "%03d.jpg")], check=True)
        print(k, len(os.listdir(d)))
    sys.exit()

if cmd == "timeline":
    lines = json.load(open(P("lines.json")))
    segs, t = [], 0.3
    def nf(shot): return len(glob.glob(P("frames", shot, "*.jpg"))) or 81
    for l in lines:
        kind = l["shot"]; bg, blur = BG.get(kind, (kind, 0))
        lead = 0.55 if kind in ("T01", "T02") else 0.0
        dur = lead + l["dur"] + 0.45
        speed = 0.6 if blur else max(0.65, min(1.0, CLIP / dur))
        segs.append({"kind": kind, "bg": bg, "blur": blur, "start": t, "end": t + dur, "voice": t + lead, "dur": l["dur"],
                     "text": l["text"], "line": l["id"], "speed": speed, "nframes": nf(bg), "flash": kind in ("T01", "T02")})
        t += dur
        if l["id"] == "L03":   # show title sting after the intro
            segs.append({"kind": "STING", "bg": "S03", "blur": 1, "start": t, "end": t + 2.6, "voice": 1e9, "dur": 0, "text": "",
                         "line": None, "speed": 0.5, "nframes": nf("S03"), "flash": True}); t += 2.6
    total = t + 0.6; segs[-1]["end"] = total
    json.dump({"segs": segs, "total": total}, open(P("timeline.json"), "w"), indent=1)

    # voice (24 kHz) placed on the timeline
    vr = 24000; voice = np.zeros(int(total * vr) + vr, np.float32)
    for s in segs:
        if not s["line"]: continue
        w = wave.open(P("audio", s["line"] + ".wav")); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        o = int(s["voice"] * vr); voice[o:o + len(a)] += a
    w = wave.open(P("voice.wav"), "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(vr)
    w.writeframes((np.clip(voice, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()

    # synthesized SFX + bed
    rng = np.random.default_rng(5); sfx = np.zeros(int(total * SR) + SR, np.float32)
    def put(sig, at, g):
        a = int(at * SR); b = min(len(sfx), a + len(sig)); sfx[a:b] += sig[:b - a] * g
    def whoosh(d=.45, up=True):
        n = int(d * SR); x = rng.standard_normal(n).astype(np.float32); y = np.zeros(n, np.float32); acc = 0.0
        for i in range(n):
            k = (i / n) if up else 1 - i / n; c = .02 + .25 * k; acc += c * (x[i] - acc); y[i] = acc
        return y * np.sin(np.linspace(0, math.pi, n)) * 2.5
    def tone(f, d, decay=9, h=.4):
        tt = np.arange(int(d * SR)) / SR
        return (np.sin(2 * math.pi * f * tt) + h * np.sin(2 * math.pi * f * 2.01 * tt)) * np.exp(-tt * decay)
    def boom(d=1.3):
        tt = np.arange(int(d * SR)) / SR; f = 90 * np.exp(-tt * 3) + 38
        return np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.5) * 1.4
    def buzz(d=.9):
        tt = np.arange(int(d * SR)) / SR; env = (np.sin(2 * math.pi * 3 * tt) > 0).astype(np.float32)
        return np.sin(2 * math.pi * 170 * tt) * np.sign(np.sin(2 * math.pi * 85 * tt)) * env * .35
    def ring(d=2.4):
        tt = np.arange(int(d * SR)) / SR; on = ((tt % 1.2) < .8).astype(np.float32)
        return (np.sin(2 * math.pi * 440 * tt) + np.sin(2 * math.pi * 480 * tt)) * on * .3
    W = whoosh(); W2 = whoosh(.3)
    for s in segs:
        put(W, max(0, s["start"] - .25), .22)
        k, a = s["kind"], s["start"]
        if k in ("T01", "T02", "STING"): put(boom(), a, .8)
        if k == "S04": put(buzz(), a + .1, .7); put(np.concatenate([tone(1320, .18), tone(1760, .4)]), a + .2, .25)
        if k == "S11": put(np.concatenate([tone(1320, .18), tone(1760, .4)]), a + .25, .25)
        if k == "S09": put(ring(), a + .1, .5)
        if k == "S10":
            for d in (.3, 1.6): put(tone(1046, .5), a + d, .2)
        if k == "G01": put(tone(1568, .8, 5, .6), a + 1.2, .25)
        if k == "G03": put(boom(.6), a + .05, .9)
        if k in ("S03", "G04"):
            for i in range(7): put(W2, a + .1 + i * .12, .12)
        if k == "G02":
            for i in range(3): put(tone(880, .3), a + 2.2 + i * .5, .15)
    tt = np.arange(len(sfx)) / SR
    bed = .45 * np.sin(2 * math.pi * 55 * tt) * np.exp(-((tt * 2) % 1) * 5)
    chord = [110, 164.8, 220, 261.6]
    bed += .18 * sum(np.sin(2 * math.pi * f * tt) for f in chord) / 2 * (0.6 + 0.4 * np.sin(2 * math.pi * .125 * tt))
    hat = rng.standard_normal(len(tt)).astype(np.float32) * np.exp(-((tt * 4) % 1) * 40) * .08
    bed = (bed + hat) * np.clip(tt / 1.5, 0, 1) * np.clip((total - tt) / 2, 0, 1)
    sfx += bed.astype(np.float32) * .09
    w = wave.open(P("sfx.wav"), "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(sfx, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    print(f"total {total:.1f}s, {len(segs)} segments")
    sys.exit()

from playwright.sync_api import sync_playwright
tl = json.load(open(P("timeline.json")))
def page(p):
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--allow-file-access-from-files"])
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    pg.goto("file://" + P("ep01.html")); pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(400)
    pg.evaluate("tl => setup(tl)", tl); return b, pg

if cmd == "preview":
    with sync_playwright() as p:
        b, pg = page(p)
        for t in sys.argv[2:]:
            pg.evaluate(f"render({t})"); pg.evaluate("ready()"); pg.screenshot(path=P(f"pv_{float(t):06.1f}.png"))
        b.close()
elif cmd == "chunk":
    k, n = int(sys.argv[2]), int(sys.argv[3]); N = int(tl["total"] * FPS); a, z = N * k // n, N * (k + 1) // n
    enc = subprocess.Popen([FF, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-i", "-", "-c:v", "libx264",
                            "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", P(f"ch_{k}.mp4")], stdin=subprocess.PIPE)
    with sync_playwright() as p:
        b, pg = page(p)
        for f in range(a, z):
            pg.evaluate(f"render({f / FPS})"); pg.evaluate("ready()"); enc.stdin.write(pg.screenshot(type="jpeg", quality=90))
        b.close()
    enc.stdin.close(); enc.wait(); print("chunk", k, "done", flush=True)
elif cmd == "mux":
    n = int(sys.argv[2])
    open(P("ch.txt"), "w").write("".join(f"file '{P(f'ch_{k}.mp4')}'\n" for k in range(n)))
    subprocess.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", P("ch.txt"), "-i", P("voice.wav"), "-i", P("sfx.wav"),
                    "-filter_complex", "[1]aresample=48000[v];[2]aresample=48000[s];[v][s]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart",
                    P("lenny_ep01_part1.mp4")], check=True)
    print("muxed", round(tl["total"], 1))
