#!/usr/bin/env python3
"""Night Shift Footage — File 01 ("Patient 13"). Vertical Short, ~50 s.

    python3 build.py WORKDIR [--track track.mp3]

WORKDIR holds: shots (see SHOTS), voice/l1..l7.mp3, and gets out_*.mp4.
Cuts and the reveal sit on the track's strong hits (136 bpm; drop at 29.0 s).
Without --track the bed is fluorescent hum, tape hiss and a low drone with the same impacts.
"""
import json, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
HERE = os.path.dirname(os.path.abspath(__file__))
BEBAS = os.path.join(HERE, "..", "..", "tools", "fonts", "BebasNeue-400-latin.ttf")

# (file, start, end, cam, clock_start "hh:mm:ss")
SHOTS = [  # optional 6th item: digital zoom (factor, x, y) on the target, as a guard zooming the CCTV
    ("corridor.mp4", 0.00, 2.88, "CAM 03 ×2.4", "03:11:52", (2.4, 0.49, 0.42)),
    ("corridor.mp4", 2.88, 7.36, "CAM 03", "03:11:55"),
    ("wait.png",     7.36, 13.61, "CAM 05", "01:24:10"),
    ("wait.mp4",    13.61, 29.00, "CAM 05", "03:02:47"),
    ("empty.png",   29.00, 35.55, "CAM 03", "03:19:07"),
    ("sec.mp4",     35.55, 45.84, "CAM 08", "03:33:00"),
]
END = 50.5
VOICE = [("l1", 0.35), ("l2", 6.0), ("l3", 13.9), ("l4", 24.6), ("l5", 30.3), ("l6", 36.4), ("l7", 40.0)]
GLITCH = [(7.30, 0.18), (13.55, 0.15), (28.85, 0.45), (35.45, 0.2), (43.10, 0.55), (45.75, 0.3)]
HITS = [0.07, 7.36, 13.61, 29.0, 35.55, 43.17, 45.84]
# on-screen text: (text, start, end, style)  style: "tag" small box top, "big" red centre
TEXTS = [
    ("PATIENT #13", 0.4, 7.2, "tag"),
    ("TEMP ✓   PULSE ✓   CHECK-IN ✓", 7.5, 13.4, "tag"),
    ("2 HOURS. NEVER BLINKED.", 19.5, 28.8, "tag"),
    ("SIGNAL LOST", 29.0, 30.6, "big"),
    ("CAM 08 — SECURITY ROOM", 36.0, 43.0, "tag"),
    ("LOOK AGAIN.", 43.25, 45.8, "big"),
]
CARD = ("WOULD YOU\nLET HIM IN?", "SHIFT 20 · FILE 01", 45.84, END)


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"failed: {' '.join(map(str, cmd))[:300]}\n{r.stderr[-2500:]}")
    return r


def dur(p):
    return float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).stdout)


def png_text(path, text, style):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if style == "tag":
        f = ImageFont.truetype(MONO, 44)
        tw, th = d.textbbox((0, 0), text, font=f)[2:]
        x, y = (W - tw) // 2, 190
        d.rectangle((x - 24, y - 14, x + tw + 24, y + th + 18), fill=(0, 0, 0, 190))
        d.text((x, y), text, font=f, fill=(235, 255, 235))
    else:
        f = ImageFont.truetype(BEBAS, 170)
        tw, th = d.textbbox((0, 0), text, font=f)[2:]
        x, y = (W - tw) // 2, int(H * 0.40)
        d.rectangle((x - 34, y - 20, x + tw + 34, y + th + 34), fill=(0, 0, 0, 215))
        d.text((x, y), text, font=f, fill=(255, 38, 38))
    im.save(path)


def png_sub(path, text):
    """Narration subtitle: typewriter mono, wrapped, lower third, above the clock."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = ImageFont.truetype(MONO, 46)
    words, rows, cur = text.split(), [], ""
    for w in words:
        if d.textbbox((0, 0), (cur + " " + w).strip(), font=f)[2] > W - 160:
            rows.append(cur); cur = w
        else:
            cur = (cur + " " + w).strip()
    rows.append(cur)
    y = 1560 - 62 * len(rows)
    for r in rows:
        tw, th = d.textbbox((0, 0), r, font=f)[2:]
        x = (W - tw) // 2
        d.rectangle((x - 16, y - 8, x + tw + 16, y + th + 12), fill=(0, 0, 0, 170))
        d.text((x, y), r, font=f, fill=(255, 255, 255)); y += 62
    im.save(path)


def png_card(path, big, small):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 255)); d = ImageDraw.Draw(im)
    f = ImageFont.truetype(BEBAS, 190); f2 = ImageFont.truetype(MONO, 46)
    y = 700
    for line in big.split("\n"):
        tw = d.textbbox((0, 0), line, font=f)[2]
        d.text(((W - tw) // 2, y), line, font=f, fill=(240, 240, 240)); y += 190
    tw = d.textbbox((0, 0), small, font=f2)[2]
    d.text(((W - tw) // 2, y + 60), small, font=f2, fill=(255, 60, 60))
    d.text(((W - d.textbbox((0, 0), "▼ COMMENT ▼", font=f2)[2]) // 2, y + 160), "▼ COMMENT ▼", font=f2,
           fill=(170, 170, 170))
    im.save(path)


def scan_png(path):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for y in range(0, H, 4):
        d.line((0, y, W, y), fill=(0, 0, 0, 60))
    for i in range(150):
        d.rectangle((i, i, W - i, H - i), outline=(0, 0, 0, int(160 * (1 - i / 150) ** 2)))
    im.save(path)


def shot(src, a, b, cam, clock, out, tmp, zoom=None):
    d = b - a
    hh, mm, ss = map(int, clock.split(":"))
    if src.endswith(".png"):
        inp = ["-loop", "1", "-t", f"{d}", "-i", src]
        pre = f"zoompan=z='1+0.04*on/{int(d*FPS)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},"
    else:
        inp = ["-i", src]
        st = max(1.0, d / dur(src))
        pre = f"setpts=PTS*{st:.4f},fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
    zf = ""
    if zoom:
        z, zx, zy = zoom
        zf = (f"scale={int(W*z)}:{int(H*z)},crop={W}:{H}:{int(W*z*zx - W/2)}:{int(H*z*zy - H/2)},")
    vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},{pre}{zf}"
          f"tpad=stop_mode=clone:stop_duration={d},trim=duration={d},setpts=PTS-STARTPTS,format=gbrp,"
          "colorchannelmixer=.25:.55:.1:0:.3:.65:.15:0:.2:.45:.1:0,"
          "eq=brightness='0.035*sin(t*31)+0.02*sin(t*7)':contrast=1.25:eval=frame,"
          "noise=alls=26:allf=t,gblur=sigma=0.7,rgbashift=rh=-3:bh=3,format=yuv420p,"
          f"drawtext=fontfile={MONO}:text='{cam}':x=46:y=70:fontsize=46:fontcolor=white@0.9,"
          f"drawtext=fontfile={MONO}:text='SHIFT 20':x=w-tw-46:y=70:fontsize=46:fontcolor=white@0.9,"
          f"drawtext=fontfile={MONO}:text='%{{eif\\:{hh}\\:d\\:2}}\\:%{{eif\\:{mm}+floor(({ss}+t)/60)\\:d\\:2}}"
          f"\\:%{{eif\\:mod({ss}+t\\,60)\\:d\\:2}}':x=46:y=h-120:fontsize=52:fontcolor=white@0.9,"
          f"drawbox=x=w-178:y=h-112:w=34:h=34:color=red@0.95:t=fill:enable='lt(mod(t\\,1)\\,0.55)',"
          f"drawtext=fontfile={MONO}:text='REC':x=w-130:y=h-116:fontsize=46:fontcolor=white@0.9")
    sh(["ffmpeg", "-y", *inp, "-vf", vf, "-an", "-r", str(FPS), "-c:v", "libx264", "-crf", "16", "-preset", "veryfast",
        "-pix_fmt", "yuv420p", out])


def main(work, track=None):
    tmp = tempfile.mkdtemp(prefix="ep1_")
    parts = []
    for k, sd in enumerate(SHOTS):
        o = os.path.join(tmp, f"p{k}.mp4"); shot(os.path.join(work, sd[0]), *sd[1:5], o, tmp, *sd[5:]); parts.append(o)
    card = os.path.join(tmp, "card.png"); png_card(card, CARD[0], CARD[1])
    cardv = os.path.join(tmp, "card.mp4")
    sh(["ffmpeg", "-y", "-loop", "1", "-t", f"{END-CARD[2]}", "-i", card, "-vf", "format=yuv420p,noise=alls=10:allf=t",
        "-r", str(FPS), "-c:v", "libx264", "-crf", "16", cardv]); parts.append(cardv)
    lst = os.path.join(tmp, "l.txt"); open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    cat = os.path.join(tmp, "cat.mp4"); sh(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", cat])

    scan = os.path.join(tmp, "scan.png"); scan_png(scan)
    inputs = ["-i", cat, "-loop", "1", "-t", f"{END}", "-i", scan]
    fc = ["[1:v]format=rgba[sc]", "[0:v][sc]overlay=enable='lt(t,%.2f)'[v0]" % CARD[2]]
    last = "[v0]"
    for g0, gd in GLITCH:
        fc.append(f"{last}rgbashift=rh=-30:bv=16:gh=12:enable='between(t,{g0},{g0+gd})',"
                  f"hue=s=0:enable='between(t,{g0+0.03},{g0+gd*0.6})'[g{len(fc)}]"); last = f"[g{len(fc)-1}]"
    for k, (t, a, b, st) in enumerate(TEXTS):
        p = os.path.join(tmp, f"t{k}.png"); png_text(p, t, st)
        inputs += ["-loop", "1", "-t", f"{END}", "-i", p]
        fc.append(f"{last}[{2+k}:v]overlay=enable='between(t,{a},{b})'[x{k}]"); last = f"[x{k}]"
    lines = json.load(open(os.path.join(work, "voice", "lines.json")))
    for k, (name, t) in enumerate(VOICE):
        p = os.path.join(tmp, f"s{k}.png"); png_sub(p, lines[name])
        e = t + dur(os.path.join(work, "voice", name + ".mp3"))
        inputs += ["-loop", "1", "-t", f"{END}", "-i", p]
        fc.append(f"{last}[{2+len(TEXTS)+k}:v]overlay=enable='between(t,{t},{e})'[y{k}]"); last = f"[y{k}]"
    fc.append(f"{last}fade=in:st=0:d=0.15,fade=out:st={END-0.8}:d=0.8,format=yuv420p[vout]")
    n = 2 + len(TEXTS) + len(VOICE)
    # voice
    vi = []
    for name, t in VOICE:
        inputs += ["-i", os.path.join(work, "voice", name + ".mp3")]
        fc.append(f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.35,adelay={int(t*1000)}|{int(t*1000)}"
                  f"[vo{n}]"); vi.append(f"[vo{n}]"); n += 1
    fc.append(f"{''.join(vi)}amix=inputs={len(vi)}:normalize=0,apad=whole_dur={END},"
              "highpass=f=120,acompressor=threshold=0.1:ratio=3,aecho=0.6:0.3:18:0.12,asplit=2[voice][key]")
    if track:
        inputs += ["-i", track]
        fc.append(f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration={END},volume=0.55,"
                  f"afade=out:st={END-2.5}:d=2.5[mus]")
        fc.append("[mus][key]sidechaincompress=threshold=0.04:ratio=4:attack=25:release=400[bed]")
    else:
        fc.append(f"aevalsrc='0.05*sin(2*PI*60*t)+0.03*sin(2*PI*120*t)':s=48000:d={END},aformat=channel_layouts=stereo[hum]")
        fc.append(f"anoisesrc=color=pink:amplitude=0.04:d={END}:r=48000,highpass=f=2000,aformat=channel_layouts=stereo[hiss]")
        fc.append(f"aevalsrc='0.10*sin(2*PI*41*t)*(0.6+0.4*sin(2*PI*0.07*t))*min(1,t/20)':s=48000:d={END},"
                  "aformat=channel_layouts=stereo[drone]")
        hits = []
        for k, t in enumerate(HITS[1:]):
            fc.append(f"sine=f=38:duration=2.2:sample_rate=48000,volume=1.4,afade=out:st=0:d=2.2:curve=exp,"
                      f"aformat=channel_layouts=stereo,adelay={int(t*1000)}|{int(t*1000)}[h{k}]")
            fc.append(f"anoisesrc=color=white:amplitude=0.5:d=0.3:r=48000,afade=out:st=0:d=0.3,"
                      f"aformat=channel_layouts=stereo,adelay={int(t*1000)}|{int(t*1000)}[z{k}]")
            hits += [f"[h{k}]", f"[z{k}]"]
        fc.append(f"[hum][hiss][drone]{''.join(hits)}amix=inputs={3+len(hits)}:duration=first:normalize=0[bed0]")
        fc.append("[bed0][key]sidechaincompress=threshold=0.05:ratio=3:attack=25:release=400[bed]")
    fc.append(f"[voice][bed]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95,loudnorm=I=-13:TP=-1.2:LRA=8[aout]")
    g = os.path.join(tmp, "g.txt"); open(g, "w").write(";\n".join(fc))
    out = os.path.join(work, "out_track.mp4" if track else "out_notrack.mp4")
    sh(["ffmpeg", "-y", *inputs, "-filter_complex_script", g, "-map", "[vout]", "-map", "[aout]", "-t", f"{END}",
        "-r", str(FPS), "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", out])
    print("done", out)


if __name__ == "__main__":
    a = sys.argv[1:]
    main(a[0], a[a.index("--track") + 1] if "--track" in a else None)
