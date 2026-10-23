#!/usr/bin/env python3
"""Turn a clip (or still) into a vertical 'security camera' analog-horror Short segment.

    python3 cctv_short.py in.mp4|in.png out.mp4 --cam "CAM 03" --shift "SHIFT 20" --clock 03:17:40 \
        --line1 "HE PASSED EVERY CHECK." --line2 "LOOK AGAIN." --dur 5 --glitch 3.4

Look: green night-vision monochrome, grain, scanlines, flicker, chromatic edges, ticking timestamp, blinking REC.
Sound: fluorescent hum + tape static, a low impact and a burst of static at the glitch.
"""
import argparse, os, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
HERE = os.path.dirname(os.path.abspath(__file__))
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"


def font(name, size):
    for p in (os.path.join(HERE, "fonts", name), MONO):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)


def caption_png(text, path, size=104, color=(255, 255, 255), box=(0, 0, 0, 200)):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = font("BebasNeue-400-latin.ttf", size)
    tw, th = d.textbbox((0, 0), text, font=f)[2:]
    x, y = (W - tw) // 2, int(H * 0.62)
    d.rectangle((x - 30, y - 18, x + tw + 30, y + th + 26), fill=box)
    d.text((x, y), text, font=f, fill=color)
    im.save(path)


def scanlines_png(path):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for y in range(0, H, 4):
        d.line((0, y, W, y), fill=(0, 0, 0, 70))
    # vignette-ish dark corners
    for i in range(140):
        a = int(150 * (1 - i / 140) ** 2)
        d.rectangle((i, i, W - i, H - i), outline=(0, 0, 0, a))
    im.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("out")
    ap.add_argument("--cam", default="CAM 03"); ap.add_argument("--shift", default="SHIFT 20")
    ap.add_argument("--clock", default="03:17:40")
    ap.add_argument("--line1", default=""); ap.add_argument("--line2", default="")
    ap.add_argument("--dur", type=float, default=5.0); ap.add_argument("--glitch", type=float, default=3.4)
    a = ap.parse_args()
    tmp = tempfile.mkdtemp(prefix="cctv_")
    scan = os.path.join(tmp, "scan.png"); scanlines_png(scan)
    c1 = os.path.join(tmp, "c1.png"); c2 = os.path.join(tmp, "c2.png")
    caption_png(a.line1, c1)
    caption_png(a.line2, c2, size=150, color=(255, 40, 40))
    g, d = a.glitch, a.dur
    hh, mm, ss = map(int, a.clock.split(":"))
    still = a.src.lower().endswith((".png", ".jpg"))
    src = ["-loop", "1", "-t", f"{d}", "-i", a.src] if still else ["-i", a.src]
    move = (f"zoompan=z='1+0.05*on/{int(d*FPS)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},"
            if still else "")
    osd = (f"drawtext=fontfile={MONO}:text='{a.cam}':x=46:y=60:fontsize=46:fontcolor=white@0.9,"
           f"drawtext=fontfile={MONO}:text='{a.shift}':x=w-tw-46:y=60:fontsize=46:fontcolor=white@0.9,"
           f"drawtext=fontfile={MONO}:text='{hh:02d}\\:{mm:02d}\\:%{{eif\\:{ss}+t\\:d\\:2}}':x=46:y=h-110:"
           f"fontsize=52:fontcolor=white@0.9,"
           f"drawbox=x=w-170:y=h-104:w=34:h=34:color=red@0.95:t=fill:enable='lt(mod(t\\,1)\\,0.55)',"
           f"drawtext=fontfile={MONO}:text='REC':x=w-125:y=h-108:fontsize=46:fontcolor=white@0.9")
    fc = [
        f"[0:v]fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},{move}"
        f"setpts=PTS*1.0,trim=duration={d},format=gbrp,"
        "colorchannelmixer=.25:.55:.1:0:.3:.65:.15:0:.2:.45:.1:0,"            # green monochrome
        "eq=brightness='0.035*sin(t*31)+0.02*sin(t*7)':contrast=1.25:eval=frame,"  # flicker
        "noise=alls=28:allf=t,gblur=sigma=0.8,"
        "rgbashift=rh=-3:bh=3,"
        f"rgbashift=rh=-28:bv=14:gh=10:enable='between(t,{g},{g+0.35})',"
        f"hue=s=0:enable='between(t,{g+0.05},{g+0.15})',format=yuv420p[v0]",
        "[1:v]format=rgba[scan]",
        "[v0][scan]overlay[v1]",
        f"[2:v]format=rgba,fade=in:st=0.3:d=0.2:alpha=1,fade=out:st={g-0.15}:d=0.15:alpha=1[c1]",
        f"[3:v]format=rgba,fade=in:st={g+0.1}:d=0.1:alpha=1[c2]",
        f"[v1][c1]overlay=enable='lt(t,{g})'[v2]",
        f"[v2][c2]overlay=enable='gte(t,{g+0.1})',{osd},format=yuv420p[vout]",
        # sound: hum + static, impact at glitch
        f"aevalsrc='0.05*sin(2*PI*60*t)+0.03*sin(2*PI*120*t)+0.015*sin(2*PI*180*t)':s=48000:d={d}[hum]",
        f"anoisesrc=color=white:amplitude=0.05:d={d}:r=48000,highpass=f=2500,lowpass=f=9000[hiss]",
        f"anoisesrc=color=white:amplitude=0.6:d=0.4:r=48000,afade=out:st=0:d=0.4,adelay={int(g*1000)}|{int(g*1000)}[burst]",
        f"sine=f=42:duration=2:sample_rate=48000,volume=1.6,afade=out:st=0:d=2:curve=exp,adelay={int(g*1000)}|{int(g*1000)}[boom]",
        "[hum][hiss][burst][boom]amix=inputs=4:duration=first:normalize=0,alimiter=limit=0.9,"
        "loudnorm=I=-14:TP=-1.5[aout]",
    ]
    graph = os.path.join(tmp, "g.txt"); open(graph, "w").write(";\n".join(fc))
    cmd = ["ffmpeg", "-y", *src, "-loop", "1", "-t", f"{d}", "-i", scan, "-loop", "1", "-t", f"{d}", "-i", c1,
           "-loop", "1", "-t", f"{d}", "-i", c2, "-filter_complex_script", graph, "-map", "[vout]", "-map", "[aout]",
           "-t", f"{d}", "-r", str(FPS), "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "aac",
           "-b:a", "192k", "-movflags", "+faststart", a.out]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr[-3000:])
    print("done", a.out)


if __name__ == "__main__":
    main()
