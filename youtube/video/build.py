"""Render scene.html frame by frame, lay the per-line voiceover on top, encode MP4."""
import json, os, subprocess, sys, wave
import imageio_ffmpeg
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
FPS, LEAD, GAP, TAIL = 30, 0.25, 0.35, 0.8
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
only = float(sys.argv[1]) if len(sys.argv) > 1 else None  # preview: render one timestamp to PNG

lines = json.load(open(os.path.join(HERE, "lines.json")))
scenes, t = [], 0.0
for i, text in enumerate(lines):
    w = wave.open(os.path.join(HERE, f"audio/{i}.wav"))
    dur, rate, params = w.getnframes() / w.getframerate(), w.getframerate(), w.getparams()
    lead = LEAD if i == 0 else 0
    end = t + lead + dur + (GAP if i < len(lines) - 1 else TAIL)
    scenes.append({"start": t, "voice": t + lead, "dur": dur, "end": end, "text": text})
    t = end
total = t

# one continuous voice track with the same timings
out = wave.open(os.path.join(HERE, "voice.wav"), "wb")
out.setparams(params)
for i, s in enumerate(scenes):
    w = wave.open(os.path.join(HERE, f"audio/{i}.wav"))
    pad = int((s["voice"] - s["start"]) * rate)
    out.writeframes(b"\0\0" * pad + w.readframes(w.getnframes()))
    tail = int((s["end"] - s["voice"] - s["dur"]) * rate)
    out.writeframes(b"\0\0" * tail)
out.close()

frames = os.path.join(HERE, "frames")
os.makedirs(frames, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
    pg = b.new_page(viewport={"width": 1080, "height": 1920})
    pg.goto("file://" + os.path.join(HERE, "scene.html"))
    pg.evaluate("document.fonts.ready")
    pg.wait_for_timeout(500)
    pg.evaluate("tl => setup(tl)", {"scenes": scenes, "total": total})
    if only is not None:
        pg.evaluate(f"render({only})")
        pg.screenshot(path=os.path.join(HERE, f"preview_{only}.png"))
        sys.exit()
    n = int(total * FPS)
    for f in range(n):
        pg.evaluate(f"render({f / FPS})")
        pg.screenshot(path=os.path.join(frames, f"{f:05d}.jpg"), type="jpeg", quality=92)
        if f % 150 == 0:
            print(f"frame {f}/{n}", flush=True)
    b.close()

subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-framerate", str(FPS),
                "-i", os.path.join(frames, "%05d.jpg"), "-i", os.path.join(HERE, "voice.wav"),
                "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart",
                os.path.join(HERE, "short_delivery_test.mp4")], check=True)
print(f"done: {total:.1f}s")
