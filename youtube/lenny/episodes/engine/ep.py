"""Lenny episode builder. One script.json per episode folder.

    python3 ep.py EPDIR tts                 # audio/<id>.wav + lines.json (durations)
    python3 ep.py EPDIR prep                # slides/<img>.jpg 1920x1080 from the image library
    python3 ep.py EPDIR timeline            # timeline.json + voice.wav + sfx.wav
    python3 ep.py EPDIR preview t1 t2 ...   # pv_*.png
    python3 ep.py EPDIR chunk K N           # video chunk
    python3 ep.py EPDIR mux N               # final.mp4 + send.mp4 (<30 MB)
    python3 ep.py EPDIR thumb               # thumbnail.png 1280x720
    python3 ep.py EPDIR all                 # prep, timeline, 4 chunks in parallel, mux, thumb
"""
import json, math, os, subprocess, sys, wave
import numpy as np
import imageio_ffmpeg
ENG = os.path.dirname(os.path.abspath(__file__)); SP = os.path.dirname(os.path.dirname(ENG))
E = os.path.abspath(sys.argv[1]); P = lambda *a: os.path.join(E, *a)
FF = imageio_ffmpeg.get_ffmpeg_exe(); FPS, SR = 30, 44100
LIB = [P("img")] + [os.path.join(SP, "kaggle/qwen", d) for d in ("outEA", "outEB", "outF2", "outF1", "outP")]
SC = json.load(open(P("script.json"))); cmd = sys.argv[2]
DIM = {"title", "big", "stamp", "list", "chips", "cards", "end"}

def find(name):
    for d in LIB:
        for ext in (".png", ".jpg"):
            if os.path.exists(os.path.join(d, name + ext)): return os.path.join(d, name + ext)

if cmd == "tts":
    from kokoro_onnx import Kokoro
    k = Kokoro(os.path.join(SP, "kokoro/kokoro-v1.0.onnx"), os.path.join(SP, "kokoro/voices-v1.0.bin"))
    os.makedirs(P("audio"), exist_ok=True); out = []
    for l in SC["lines"]:
        f = P("audio", l["id"] + ".wav")
        if not os.path.exists(f) or l.get("redo"):
            a, sr = k.create(l["text"], voice=l.get("voice", "am_liam"), speed=l.get("speed", 0.9), lang="en-us")
            w = wave.open(f, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
            w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
        w = wave.open(f); out.append({"id": l["id"], "dur": round(w.getnframes() / w.getframerate(), 3)})
    json.dump(out, open(P("lines.json"), "w")); print("voice", round(sum(o["dur"] for o in out)), "s,", len(out), "lines")
    sys.exit()

if cmd == "prep":
    os.makedirs(P("slides"), exist_ok=True); miss = []
    names = {l["img"] for l in SC["lines"]} | ({SC["sting"]["img"]} if SC.get("sting") else set())
    for n in sorted(names):
        src = find(n)
        if not src: miss.append(n); src = find(SC.get("fallback", "L02")) or find("L02")
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", src, "-vf",
                        "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,unsharp=5:5:0.4",
                        "-q:v", "2", P("slides", n + ".jpg")], check=True)
    print(len(names), "slides; missing:", miss); sys.exit()

if cmd == "timeline":
    dur = {o["id"]: o["dur"] for o in json.load(open(P("lines.json")))}
    segs, t = [], 0.3
    for l in SC["lines"]:
        ov = l.get("ov"); k = ov["t"] if ov else ""
        lead = 0.55 if k == "title" else 0.0
        d = lead + dur[l["id"]] + l.get("pad", 0.6)
        segs.append({"kind": k, "ov": ov, "dim": k in DIM, "start": t, "end": t + d, "voice": t + lead, "dur": dur[l["id"]],
                     "text": l["text"], "line": l["id"], "img": f"slides/{l['img']}.jpg", "flash": k == "title"})
        t += d
        if SC.get("sting") and SC["sting"]["after"] == l["id"]:
            s = SC["sting"]
            segs.append({"kind": "title", "ov": {"t": "title", "s": s["s"], "size": 120}, "dim": True, "start": t, "end": t + 2.6,
                         "voice": 1e9, "dur": 0, "text": "", "line": None, "img": f"slides/{s['img']}.jpg", "flash": True}); t += 2.6
    total = t + 0.6; segs[-1]["end"] = total
    json.dump({"segs": segs, "total": total}, open(P("timeline.json"), "w"), indent=1)
    vr = 24000; voice = np.zeros(int(total * vr) + vr, np.float32)
    for s in segs:
        if not s["line"]: continue
        w = wave.open(P("audio", s["line"] + ".wav")); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        o = int(s["voice"] * vr); voice[o:o + len(a)] += a
    w = wave.open(P("voice.wav"), "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(vr)
    w.writeframes((np.clip(voice, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    rng = np.random.default_rng(5); sfx = np.zeros(int(total * SR) + SR, np.float32)
    def put(sig, at, g):
        a = int(at * SR); b = min(len(sfx), a + len(sig)); sfx[a:b] += sig[:b - a] * g
    def whoosh(d=.45):
        n = int(d * SR); x = rng.standard_normal(n).astype(np.float32); y = np.zeros(n, np.float32); acc = 0.0
        for i in range(n): c = .02 + .25 * i / n; acc += c * (x[i] - acc); y[i] = acc
        return y * np.sin(np.linspace(0, math.pi, n)) * 2.5
    def tone(f, d, decay=9, h=.4):
        tt = np.arange(int(d * SR)) / SR; return (np.sin(2 * math.pi * f * tt) + h * np.sin(2 * math.pi * f * 2.01 * tt)) * np.exp(-tt * decay)
    def boom(d=1.3):
        tt = np.arange(int(d * SR)) / SR; f = 90 * np.exp(-tt * 3) + 38
        return np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.5) * 1.4
    def ring(d=2.4):
        tt = np.arange(int(d * SR)) / SR; on = ((tt % 1.2) < .8).astype(np.float32)
        return (np.sin(2 * math.pi * 440 * tt) + np.sin(2 * math.pi * 480 * tt)) * on * .3
    W = whoosh(); W2 = whoosh(.3); PING = np.concatenate([tone(1320, .18), tone(1760, .4)])
    for s in segs:
        put(W, max(0, s["start"] - .25), .22); k, a = s["kind"], s["start"]; at = (s["ov"] or {}).get("at", .2)
        if k in ("title", "end"): put(boom(), a, .8)
        if k == "stamp": put(boom(.6), a + at, .9)
        if k == "notif": put(PING, a + at + .1, .25)
        if k == "call": put(ring(), a + .1, .5)
        if k == "cards":
            for i in range(len(s["ov"]["items"])): put(W2, a + .1 + i * .12, .12)
        if k in ("list", "chips"):
            n = len(s["ov"]["items"]); a0 = s["ov"].get("at", .3)
            for i in range(n): put(tone(880, .3), a + a0 + i * ((s["dur"] * .85 - a0) / max(1, n)), .12)
    tt = np.arange(len(sfx)) / SR
    bed = .45 * np.sin(2 * math.pi * 55 * tt) * np.exp(-((tt * 2) % 1) * 5)
    bed += .18 * sum(np.sin(2 * math.pi * f * tt) for f in [110, 164.8, 220, 261.6]) / 2 * (0.6 + 0.4 * np.sin(2 * math.pi * .125 * tt))
    bed += rng.standard_normal(len(tt)).astype(np.float32) * np.exp(-((tt * 4) % 1) * 40) * .08
    sfx += (bed * np.clip(tt / 1.5, 0, 1) * np.clip((total - tt) / 2, 0, 1)).astype(np.float32) * .09
    w = wave.open(P("sfx.wav"), "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(sfx, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    print(f"total {total:.1f}s ({int(total // 60)}:{int(total % 60):02d}), {len(segs)} segments"); sys.exit()

if cmd == "all":
    py = [sys.executable, __file__, E]
    for c in ("prep", "timeline"): subprocess.run(py + [c], check=True)
    ps = [subprocess.Popen(py + ["chunk", str(k), "4"]) for k in range(4)]
    if any(p.wait() for p in ps): sys.exit("chunk failed")
    subprocess.run(py + ["mux", "4"], check=True); subprocess.run(py + ["thumb"], check=True); sys.exit()

from playwright.sync_api import sync_playwright
def browser(p, w=1920, h=1080):
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--allow-file-access-from-files"])
    return b, b.new_page(viewport={"width": w, "height": h})

if cmd == "thumb":
    th = SC["thumb"]; src = "file://" + P("slides", th["img"] + ".jpg")
    if not os.path.exists(P("slides", th["img"] + ".jpg")):
        f = find(th["img"]) or find("L02"); src = "file://" + f
    html = f"""<html><head><style>@font-face{{font-family:Inter;src:url(file:///home/user/Anal/youtube/video/fonts/inter-latin.woff2)}}
    body{{margin:0;width:1280px;height:720px;overflow:hidden;background:#000;font-family:Inter}}
    img{{position:absolute;width:1280px;height:720px;object-fit:cover;object-position:{th.get('pos','70% 40%')}}}
    .sh{{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.4) 45%,rgba(0,0,0,0) 65%)}}
    .t{{position:absolute;left:44px;top:{th.get('top',120)}px;width:{th.get('w',700)}px;font-weight:900;font-size:{th.get('size',104)}px;line-height:.98;letter-spacing:-3px;color:#fff;
       text-transform:uppercase;-webkit-text-stroke:3px #000;paint-order:stroke fill;text-shadow:0 8px 0 #000}}
    em{{font-style:normal;color:#ffd60a}} b{{color:#ff3b3b}}</style></head><body><img src="{src}"><div class="sh"></div><div class="t">{th['text']}</div></body></html>"""
    open(P("thumb.html"), "w").write(html)
    with sync_playwright() as p:
        b, pg = browser(p, 1280, 720); pg.goto("file://" + P("thumb.html")); pg.wait_for_timeout(800)
        pg.screenshot(path=P("thumbnail.png")); b.close()
    print("thumb ok"); sys.exit()

tl = json.load(open(P("timeline.json")))
def page(p):
    b, pg = browser(p); pg.goto("file://" + os.path.join(ENG, "ep.html")); pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(400)
    pg.evaluate("tl => { tl.segs.forEach(s => s.img = 'file://" + E + "/' + s.img); setup(tl) }", tl); return b, pg

if cmd == "preview":
    with sync_playwright() as p:
        b, pg = page(p)
        for t in sys.argv[3:]:
            pg.evaluate(f"render({t})"); pg.evaluate("ready()"); pg.screenshot(path=P(f"pv_{float(t):06.1f}.png"))
        b.close()
elif cmd == "chunk":
    k, n = int(sys.argv[3]), int(sys.argv[4]); N = int(tl["total"] * FPS); a, z = N * k // n, N * (k + 1) // n
    enc = subprocess.Popen([FF, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-i", "-", "-c:v", "libx264",
                            "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", P(f"ch_{k}.mp4")], stdin=subprocess.PIPE)
    with sync_playwright() as p:
        b, pg = page(p)
        for f in range(a, z):
            pg.evaluate(f"render({f / FPS})"); pg.evaluate("ready()"); enc.stdin.write(pg.screenshot(type="jpeg", quality=90))
        b.close()
    enc.stdin.close(); enc.wait(); print("chunk", k, "done", flush=True)
elif cmd == "mux":
    n = int(sys.argv[3]); slug = SC["slug"]
    open(P("ch.txt"), "w").write("".join(f"file '{P(f'ch_{k}.mp4')}'\n" for k in range(n)))
    subprocess.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", P("ch.txt"), "-i", P("voice.wav"), "-i", P("sfx.wav"),
                    "-filter_complex", "[1]aresample=48000[v];[2]aresample=48000[s];[v][s]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart",
                    P(f"{slug}.mp4")], check=True)
    kb = int(28 * 8 * 1024 / tl["total"]) - 70   # fit the preview copy under ~28 MB
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", P(f"{slug}.mp4"), "-c:v", "libx264", "-preset", "medium", "-b:v", f"{kb}k",
                    "-maxrate", f"{int(kb * 1.5)}k", "-bufsize", f"{kb * 3}k", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart",
                    P(f"{slug}_send.mp4")], check=True)
    print("muxed", round(tl["total"], 1), "send kbps", kb)
