"""Cartoon test build (beats 0-2 of the long video).

    python3 cartoon_build.py preview 3 15 40 ...   # PNG frames
    python3 cartoon_build.py chunk K N             # video-only chunk
    python3 cartoon_build.py mux N                 # -> cartoon_test.mp4
"""
import array, json, math, os, subprocess, sys, wave
import imageio_ffmpeg
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(HERE, *a)
FPS, NBEATS = 30, 3
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
tl = json.load(open(P("timeline.json")))
END = tl["beats"][NBEATS - 1]["end"]


def envelope():
    w = wave.open(P("voice.wav")); rate = w.getframerate()
    a = array.array("h", w.readframes(w.getnframes()))
    step = rate // FPS
    rms = [math.sqrt(sum(x * x for x in a[i:i + step]) / step) for i in range(0, len(a) - step, step)]
    ref = sorted(rms)[int(len(rms) * .97)] or 1
    out, prev = [], 0.0
    for r in rms:
        v = min(1.0, r / ref); prev = v if v > prev else prev * .6 + v * .4
        out.append(round(prev, 3))
    return out


def page(p):
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    pg.goto("file://" + P("cartoon.html"))
    pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(400)
    pg.evaluate("([tl, amp]) => setup(tl, amp)", [tl, envelope()])
    return b, pg


cmd = sys.argv[1]
if cmd == "preview":
    with sync_playwright() as p:
        b, pg = page(p)
        for t in sys.argv[2:]:
            pg.evaluate(f"render({t})"); pg.screenshot(path=P(f"cv_{float(t):06.1f}.png"))
        b.close()
elif cmd == "chunk":
    k, n = int(sys.argv[2]), int(sys.argv[3]); total = int(END * FPS)
    a, z = total * k // n, total * (k + 1) // n
    enc = subprocess.Popen([FFMPEG, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
                            P(f"cchunk_{k}.mp4")], stdin=subprocess.PIPE)
    with sync_playwright() as p:
        b, pg = page(p)
        for f in range(a, z):
            pg.evaluate(f"render({f / FPS})"); enc.stdin.write(pg.screenshot(type="jpeg", quality=90))
        b.close()
    enc.stdin.close(); enc.wait(); print(f"cchunk {k} done", flush=True)
elif cmd == "mux":
    n = int(sys.argv[2])
    open(P("cchunks.txt"), "w").write("".join(f"file '{P(f'cchunk_{k}.mp4')}'\n" for k in range(n)))
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", P("cchunks.txt"),
                    "-t", f"{END:.2f}", "-i", P("voice.wav"), "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
                    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-shortest", "-movflags", "+faststart",
                    P("cartoon_test.mp4")], check=True)
    print("muxed", round(END, 1))
