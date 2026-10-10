"""Long-form build: timeline from per-sentence clips, parallel frame rendering, final mux.

    python3 build_long.py timeline          # write timeline.json + voice.wav, print duration
    python3 build_long.py preview 12.5 ...  # PNG frames at given seconds
    python3 build_long.py chunk K N         # render chunk K of N to chunk_K.mp4 (video only)
    python3 build_long.py mux N             # concat chunks + voice -> 7_scams_long.mp4
"""
import json, os, subprocess, sys, wave
import imageio_ffmpeg
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
FPS, SGAP, BGAP, STING, TAIL = 30, 0.5, 1.0, 1.3, 10.0
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
P = lambda *a: os.path.join(HERE, *a)


def timeline():
    items = json.load(open(P("items.json")))
    nb = max(i["beat"] for i in items) + 1
    beats, t = [], 0.0
    for b in range(nb):
        ss = [i for i in items if i["beat"] == b]
        lead = 0.3 if b == 0 else STING if 2 <= b <= 8 else 0.0
        local, sents = lead, []
        for i, it in enumerate(ss):
            sents.append({"start": local, "dur": it["dur"], "text": it["text"], "file": it["file"]})
            local += it["dur"] + (SGAP if i < len(ss) - 1 else 0)
        local += TAIL if b == nb - 1 else BGAP
        beats.append({"start": t, "end": t + local, "sents": sents})
        t += local
    return {"beats": beats, "total": t}


def write_voice(tl):
    first = wave.open(P(tl["beats"][0]["sents"][0]["file"]))
    rate, params = first.getframerate(), first.getparams()
    buf = bytearray(int(tl["total"] * rate) * 2)
    for b in tl["beats"]:
        for s in b["sents"]:
            w = wave.open(P(s["file"]))
            data = w.readframes(w.getnframes())
            off = int((b["start"] + s["start"]) * rate) * 2
            buf[off:off + len(data)] = data
    out = wave.open(P("voice.wav"), "wb"); out.setparams(params); out.writeframes(bytes(buf)); out.close()


def page(p, tl):
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    pg.goto("file://" + P("scene.html"))
    pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(400)
    pg.evaluate("tl => setup(tl)", tl)
    return b, pg


cmd = sys.argv[1]
if cmd == "timeline":
    tl = timeline(); json.dump(tl, open(P("timeline.json"), "w")); write_voice(tl)
    print(f"total {tl['total']:.1f}s = {int(tl['total']//60)}:{tl['total']%60:04.1f}")
    for b in tl["beats"]:
        print(f"  {int(b['start']//60)}:{int(b['start']%60):02d}  {b['sents'][0]['text'][:50]}")
elif cmd == "preview":
    tl = json.load(open(P("timeline.json")))
    with sync_playwright() as p:
        b, pg = page(p, tl)
        for t in sys.argv[2:]:
            pg.evaluate(f"render({t})"); pg.screenshot(path=P(f"pv_{float(t):07.1f}.png"))
        b.close()
elif cmd == "chunk":
    k, n = int(sys.argv[2]), int(sys.argv[3])
    tl = json.load(open(P("timeline.json")))
    total = int(tl["total"] * FPS); a, z = total * k // n, total * (k + 1) // n
    enc = subprocess.Popen([FFMPEG, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
                            "-pix_fmt", "yuv420p", P(f"chunk_{k}.mp4")], stdin=subprocess.PIPE)
    with sync_playwright() as p:
        b, pg = page(p, tl)
        for f in range(a, z):
            pg.evaluate(f"render({f / FPS})")
            enc.stdin.write(pg.screenshot(type="jpeg", quality=90))
            if (f - a) % 600 == 0:
                print(f"chunk {k}: {f - a}/{z - a}", flush=True)
        b.close()
    enc.stdin.close(); enc.wait()
    print(f"chunk {k} done", flush=True)
elif cmd == "mux":
    n = int(sys.argv[2])
    open(P("chunks.txt"), "w").write("".join(f"file '{P(f'chunk_{k}.mp4')}'\n" for k in range(n)))
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", P("chunks.txt"),
                    "-i", P("voice.wav"), "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-shortest", "-movflags", "+faststart",
                    P("7_scams_long.mp4")], check=True)
    print("muxed")
