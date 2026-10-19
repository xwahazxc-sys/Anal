"""After Lights Out ep.1 — render scene.html in Chromium frame by frame, mix voice + SFX, encode a 1080x1920 Short.

  python3 build.py preview 3 20 50     # PNG stills -> previews/
  python3 build.py chunk K N           # render part K of N -> parts/K.mp4 (run N in parallel)
  python3 build.py mux N               # join parts, mix audio -> after_lights_out_ep01.mp4
"""
import base64, json, os, subprocess, sys
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
FPS, END = 30, 77.5
CHROME = "/opt/pw-browsers/chromium"
P = lambda *a: os.path.join(HERE, *a)


def page(p):
    b = p.chromium.launch(executable_path=CHROME, args=["--disable-gpu-vsync"])
    pg = b.new_page(viewport={"width": 1080, "height": 1920})
    pg.goto("file://" + P("scene.html"))
    pg.evaluate("l => setup(l)", json.load(open(P("lines.json"))))
    return b, pg


def preview(ts):
    os.makedirs(P("previews"), exist_ok=True)
    with sync_playwright() as p:
        b, pg = page(p)
        for t in ts:
            data = pg.evaluate(f"frameJPEG({t})")
            open(P("previews", f"{float(t):05.1f}.jpg"), "wb").write(base64.b64decode(data.split(",")[1]))
        b.close()


def chunk(k, n):
    os.makedirs(P("parts"), exist_ok=True)
    total = int(END * FPS)
    a, z = total * k // n, total * (k + 1) // n
    enc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                            "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", P("parts", f"{k}.mp4")], stdin=subprocess.PIPE)
    with sync_playwright() as p:
        b, pg = page(p)
        for f in range(a, z):
            enc.stdin.write(base64.b64decode(pg.evaluate(f"frameJPEG({f / FPS})").split(",")[1]))
            if (f - a) % 150 == 0:
                print(f"[{k}] {f - a}/{z - a}", flush=True)
        b.close()
    enc.stdin.close(); enc.wait()


# (file, start s, gain dB, extra filter)
SFX = [
    ("vibrate", 0.25, -6, ""), ("ping", 6.75, -14, ""), ("ping", 13.45, -14, ""), ("ping", 15.55, -16, ""),
    ("ping", 22.95, -14, ""), ("ping", 28.75, -14, ""), ("ping", 37.65, -14, ""), ("ping", 40.45, -16, ""), ("ping", 46.05, -13, ""),
    ("hum", 20.45, -12, "atrim=0:2.55,afade=t=out:st=2.3:d=0.25"), ("hum", 25.6, -12, "atrim=0:3.2,afade=t=out:st=2.9:d=0.3"),
    ("heartbeat", 30.0, -10, "afade=t=in:d=1.5,afade=t=out:st=6:d=2"),
    ("riser", 42.4, -9, "afade=t=out:st=5.6:d=0.4"), ("impact", 48.4, -4, ""), ("impact", 65.45, -9, ""),
    ("ping", 67.35, -12, ""), ("click", 69.25, -2, ""), ("impact", 74.6, -14, "atrim=0:3,afade=t=out:st=2:d=1"),
]


def mux(n):
    open(P("parts", "list.txt"), "w").write("".join(f"file '{k}.mp4'\n" for k in range(n)))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", P("parts", "list.txt"), "-c", "copy", P("parts", "video.mp4")], check=True)
    ins, fl = ["-i", P("audio", "vo.mp3"), "-stream_loop", "-1", "-i", P("audio", "drone.mp3")], []
    # voice: light compression + presence; drone bed ducks out for the black beat before the click
    fl.append("[1:a]acompressor=threshold=-20dB:ratio=3:attack=5:release=120,equalizer=f=3000:t=q:w=1:g=2[vo]")
    fl.append("[2:a]atrim=0:%s,volume=-19dB,afade=t=in:d=2,volume='if(between(t,69.05,70.2),0,1)':eval=frame,afade=t=out:st=%s:d=2[bed]" % (END, END - 2))
    labels = ["[vo]", "[bed]"]
    for i, (name, st, db, extra) in enumerate(SFX):
        ins += ["-i", P("audio", f"{name}.mp3")]
        chain = (extra + "," if extra else "") + f"volume={db}dB,adelay={int(st * 1000)}|{int(st * 1000)}"
        fl.append(f"[{i + 3}:a]{chain}[s{i}]"); labels.append(f"[s{i}]")
    fl.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0:duration=longest,apad=whole_dur={END},atrim=0:{END},loudnorm=I=-14:TP=-1.5:LRA=9[mix]")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", P("parts", "video.mp4"), *ins, "-filter_complex", ";".join(fl),
                    "-map", "0:v", "-map", "[mix]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart",
                    P("after_lights_out_ep01.mp4")], check=True)
    print("done")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "preview": preview([float(x) for x in sys.argv[2:]])
    elif cmd == "chunk": chunk(int(sys.argv[2]), int(sys.argv[3]))
    elif cmd == "mux": mux(int(sys.argv[2]))
