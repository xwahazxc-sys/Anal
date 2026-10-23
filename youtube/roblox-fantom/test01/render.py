"""Render scene.html frame by frame (headless Chromium) into a silent 1080x1920 30 fps video, or a contact sheet.

  python3 render.py video out/silent.mp4
  python3 render.py stills out/sheet.png 0 1.5 3.3 3.7 4.8 6.4 7.5 7.99
"""
import base64, os, subprocess, sys
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
FPS = 30


def frames(page, times):
    for t in times:
        page.evaluate(f"draw({t})")
        url = page.evaluate("document.getElementById('c').toDataURL('image/jpeg', 0.93)")
        yield base64.b64decode(url.split(",", 1)[1])


def main():
    mode, out = sys.argv[1], sys.argv[2]
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None)
        page = b.new_page(viewport={"width": 1080, "height": 1920})
        page.goto("file://" + os.path.join(HERE, "scene.html"))
        page.wait_for_timeout(500)
        if mode == "stills":
            ts = [float(x) for x in sys.argv[3:]]
            tmp = []
            for i, jpg in enumerate(frames(page, ts)):
                f = f"{out}.{i}.jpg"; open(f, "wb").write(jpg); tmp.append(f)
            ins = sum((["-i", f] for f in tmp), [])
            n = len(tmp)
            subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex",
                            "".join(f"[{i}:v]scale=270:480[s{i}];" for i in range(n)) +
                            "".join(f"[s{i}]" for i in range(n)) + f"xstack=inputs={n}:grid=4x{(n + 3) // 4}", out], check=True)
            for f in tmp: os.remove(f)
        else:
            dur = page.evaluate("DUR")
            ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg",
                                   "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", out],
                                  stdin=subprocess.PIPE)
            for jpg in frames(page, [i / FPS for i in range(int(round(dur * FPS)))]):
                ff.stdin.write(jpg)
            ff.stdin.close(); ff.wait()
        b.close()


if __name__ == "__main__":
    main()
