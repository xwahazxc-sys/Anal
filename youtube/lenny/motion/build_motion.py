"""Lenny cold-open proof: motion comic from reference art + Piper voice + synthesized SFX.

    python3 build_motion.py preview 1.5 4 ...   # PNG frames
    python3 build_motion.py                      # -> lenny_cold_open.mp4
"""
import json, math, os, subprocess, sys, wave
import numpy as np
import imageio_ffmpeg
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); P = lambda *a: os.path.join(HERE, *a)
FPS, SR = 30, 44100
FF = imageio_ffmpeg.get_ffmpeg_exe()
lines = json.load(open(P("lines.json")))

starts, t = [], 0.5
for i, l in enumerate(lines):
    if i == 3: t += 0.6                       # dramatic beat before "But the seventh?"
    starts.append(t); t += l["dur"] + 0.45
end_title = starts[4] + lines[4]["dur"] + 0.6
total = end_title + 2.6
tl = {"starts": starts, "lines": lines, "endTitle": end_title, "total": total}

# ---- voice track (22.05 kHz, same timing) ----
w0 = wave.open(P("audio/0.wav")); vr = w0.getframerate()
voice = np.zeros(int(total * vr), dtype=np.float32)
for i, s in enumerate(starts):
    w = wave.open(P(f"audio/{i}.wav"))
    d = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    a = int(s * vr); voice[a:a + len(d)] += d
wave_out = wave.open(P("voice.wav"), "wb"); wave_out.setnchannels(1); wave_out.setsampwidth(2); wave_out.setframerate(vr)
wave_out.writeframes((np.clip(voice, -1, 1) * 32767).astype(np.int16).tobytes()); wave_out.close()

# mouth/bounce envelope from the voice
step = vr // FPS
env = np.array([np.sqrt(np.mean(voice[i:i + step] ** 2)) for i in range(0, len(voice) - step, step)])
env = np.clip(env / (np.percentile(env, 97) or 1), 0, 1)
sm, prev = [], 0.0
for v in env: prev = v if v > prev else prev * .6 + v * .4; sm.append(round(float(prev), 3))

# ---- synthesized SFX + music bed (44.1 kHz) ----
rng = np.random.default_rng(7)
sfx = np.zeros(int(total * SR), dtype=np.float32)
def put(sig, at, gain):
    a = int(at * SR); b = min(len(sfx), a + len(sig)); sfx[a:b] += sig[:b - a] * gain
def whoosh(d=.45, up=True):
    n = int(d * SR); x = rng.standard_normal(n).astype(np.float32); y = np.zeros(n, np.float32); acc = 0.0
    for i in range(n):  # one-pole low-pass with a sweeping cutoff
        k = (i / n) if up else 1 - i / n; c = .02 + .25 * k; acc += c * (x[i] - acc); y[i] = acc
    return y * np.sin(np.linspace(0, math.pi, n)) * 2.5
def ding(f, d=.5):
    tt = np.arange(int(d * SR)) / SR
    return (np.sin(2 * math.pi * f * tt) + .4 * np.sin(2 * math.pi * f * 2.01 * tt)) * np.exp(-tt * 9)
def boom(d=1.2):
    tt = np.arange(int(d * SR)) / SR; f = 90 * np.exp(-tt * 3) + 38
    return np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.5) * 1.4
def ping():
    return np.concatenate([ding(1320, .18), ding(1760, .4)])

put(whoosh(.6), 0.05, .5)
for i in range(7): put(whoosh(.3), starts[1] + .1 + i * .12, .18)
for i in range(6): put(ding(880 * 2 ** (i / 12 * 2)), starts[2] + .1 + i * .18, .22)
put(whoosh(.5, False), starts[3] - .45, .45); put(boom(), starts[3] - .05, .8)
put(ping(), starts[3] + .5, .3)
put(whoosh(.5), starts[4] - .45, .4); put(boom(), end_title, .9)
tt = np.arange(len(sfx)) / SR  # tension bed: low pulse + soft pad
bed = .5 * np.sin(2 * math.pi * 55 * tt) * (0.5 + 0.5 * np.sign(np.sin(2 * math.pi * 2 * tt))) * np.exp(-((tt * 2) % 1) * 4)
bed += .25 * (np.sin(2 * math.pi * 110 * tt) + np.sin(2 * math.pi * 164.8 * tt)) * (0.6 + 0.4 * np.sin(2 * math.pi * .25 * tt))
bed *= np.clip(tt / 1.0, 0, 1) * np.clip((total - tt) / 1.5, 0, 1)
sfx += bed.astype(np.float32) * .07
wave_out = wave.open(P("sfx.wav"), "wb"); wave_out.setnchannels(1); wave_out.setsampwidth(2); wave_out.setframerate(SR)
wave_out.writeframes((np.clip(sfx, -1, 1) * 32767).astype(np.int16).tobytes()); wave_out.close()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--allow-file-access-from-files"])
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    pg.goto("file://" + P("motion.html")); pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(600)
    pg.evaluate("([tl, amp]) => setup(tl, amp)", [tl, sm])
    if len(sys.argv) > 2 and sys.argv[1] == "preview":
        for t in sys.argv[2:]:
            pg.evaluate(f"render({t})"); pg.screenshot(path=P(f"mv_{float(t):05.1f}.png"))
        sys.exit()
    enc = subprocess.Popen([FF, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", P("v.mp4")],
                           stdin=subprocess.PIPE)
    for f in range(int(total * FPS)):
        pg.evaluate(f"render({f / FPS})"); enc.stdin.write(pg.screenshot(type="jpeg", quality=92))
    enc.stdin.close(); enc.wait(); b.close()

subprocess.run([FF, "-y", "-loglevel", "error", "-i", P("v.mp4"), "-i", P("voice.wav"), "-i", P("sfx.wav"),
                "-filter_complex", "[1]aresample=48000,volume=1.0[v];[2]aresample=48000[s];[v][s]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]",
                "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                "-movflags", "+faststart", P("lenny_cold_open.mp4")], check=True)
print(f"done {total:.1f}s")
