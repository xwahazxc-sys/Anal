#!/usr/bin/env python3
"""Hit-format Shorts (structure copied from current hits, content ours).

    python3 build_hits.py ghibli|jam|doorway|thennow|monsters WORKDIR [--track file]

WORKDIR/<name>/: img/<k>.png (thennow: <k>a.png/<k>b.png), clips/<k>.mp4, music.flac, voice/l*.mp3 (doorway)
"""
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_v2 as B
from specs_hits import H

W, H_, FPS = 1080, 1920, 30
YEL = B.YEL

HEAD = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H_}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Archivo Black,128,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,10,5,2,70,70,640,1
Style: Header,Archivo Black,92,&H00FFFFFF,&H00FFFFFF,&H00000000,&HC8000000,0,0,0,0,100,100,0,0,3,18,0,8,40,40,150,1
Style: Sub,Archivo Black,84,{YEL[:-1]},&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,8,4,8,50,50,300,1
Style: Year,Archivo Black,230,{YEL[:-1]},&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,12,6,2,50,50,330,1
Style: Place,Archivo Black,100,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,9,4,8,50,50,330,1
Style: Story,Inter,64,&H00FFFFFF,&H00FFFFFF,&H00000000,&H78000000,1,0,0,0,100,100,0,0,1,4,3,2,90,90,420,1
Style: Q,Archivo Black,74,&H00FFFFFF,&H00FFFFFF,&H00000000,&HB4000000,0,0,0,0,100,100,0,0,3,14,0,2,50,50,250,1
Style: OSD,DejaVu Sans Mono,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3,0,7,46,46,60,1
Style: Mon,Archivo Black,120,&H002626FF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,10,5,2,50,50,330,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def ev(layer, a, b, style, txt, fx="\\fad(120,160)"):
    return f"Dialogue: {layer},{B.ta(a)},{B.ta(b)},{style},,0,0,0,,{{{fx}}}{txt}"


POP = "\\fad(40,120)\\t(0,110,\\fscx114\\fscy114)\\t(110,220,\\fscx100\\fscy100)"


def music_mix(cat, ass, music, total, cuts, tmp, voice=None, mg=0.9, fonts=B.FONTS, extra_v=""):
    inputs = ["-i", cat, "-i", music]
    fc = [f"[0:v]setpts=N/({FPS}*TB),{extra_v}ass={ass}:fontsdir={fonts},fade=in:st=0:d=0.15,"
          f"fade=out:st={total-0.6:.2f}:d=0.6,format=yuv420p[vout]"]
    wh = []
    for k, c in enumerate(cuts):
        fc.append(f"anoisesrc=color=pink:amplitude=0.25:d=0.3:r=48000,bandpass=f=2200:w=1800,afade=in:st=0:d=0.15,"
                  f"afade=out:st=0.15:d=0.15,aformat=channel_layouts=stereo,adelay={int(max(0,c-0.15)*1000)}|{int(max(0,c-0.15)*1000)}[w{k}]")
        wh.append(f"[w{k}]")
    fc.append(f"[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration={total:.2f},volume={mg},"
              f"afade=out:st={total-1.5:.2f}:d=1.5[mus]")
    if voice:
        inputs += ["-i", voice]
        fc.append(f"[2:a]aresample=48000,aformat=channel_layouts=stereo,adelay=50|50,apad=whole_dur={total:.2f},asplit=2[vo][key]")
        fc.append("[mus][key]sidechaincompress=threshold=0.03:ratio=5:attack=15:release=300[duck]")
        mix, n = "[vo][duck]" + "".join(wh), 2 + len(wh)
    else:
        mix, n = "[mus]" + "".join(wh), 1 + len(wh)
    fc.append(f"{mix}amix=inputs={n}:duration=first:normalize=0,alimiter=limit=0.9,loudnorm=I=-14:TP=-1.5:LRA=9[aout]")
    g = os.path.join(tmp, "g.txt"); open(g, "w").write(";\n".join(fc))
    return inputs, g


def concat(clips, tmp):
    lst = os.path.join(tmp, "l.txt"); open(lst, "w").write("".join(f"file '{c}'\n" for c in clips))
    cat = os.path.join(tmp, "cat.mp4"); B.sh(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", cat])
    return cat


def encode(inputs, g, total, out):
    B.sh(["ffmpeg", "-y", *inputs, "-filter_complex_script", g, "-map", "[vout]", "-map", "[aout]", "-t", f"{total:.2f}",
          "-c:v", "libx264", "-preset", "medium", "-b:v", "9M", "-maxrate", "12M", "-bufsize", "18M", "-r", str(FPS),
          "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out])


def slots(d, n, total, tmp, imgs):
    clips, cuts = [], []
    step = total / n
    for k in range(n):
        c = os.path.join(d, "clips", f"{k}.mp4")
        src = c if os.path.exists(c) else imgs[k]
        seg = B.render_slot(src, imgs[k], step, k, tmp)
        sub = step / len(seg)
        cuts += [k * step + sub * j for j in range(len(seg)) if k or j]
        clips += seg
    return clips, cuts, [k * step for k in range(n + 1)]


def build_story(name, work, total):
    s, d = H[name], os.path.join(work, name)
    tmp = tempfile.mkdtemp(prefix=f"h_{name}_")
    n = len(s["shots"])
    imgs = [os.path.join(d, "img", f"{k}.png") for k in range(n)]
    clips, cuts, bounds = slots(d, n, total, tmp, imgs)
    e = []
    if name == "ghibli":
        for k, line in enumerate(s["story"]):
            e.append(ev(0, bounds[k] + 0.4, bounds[k + 1] - 0.3, "Story", line, "\\fad(400,400)"))
    if name == "jam":
        e.append(ev(2, 0, total, "Header", s["header"], ""))
        for k, line in enumerate(s["sub"]):
            e.append(ev(1, bounds[k] + 0.1, bounds[k + 1] - 0.1, "Sub", line, POP))
    ass = os.path.join(tmp, "c.ass"); open(ass, "w").write(HEAD + "\n".join(e) + "\n")
    inputs, g = music_mix(concat(clips, tmp), ass, os.path.join(d, "music.flac"), total, cuts, tmp, mg=0.9)
    encode(inputs, g, total, os.path.join(work, f"{name}.mp4"))


def build_doorway(work):
    s, d = H["doorway"], os.path.join(work, "doorway")
    tmp = tempfile.mkdtemp(prefix="h_door_")
    parts, spans, t = [], [], 0.0
    for i in range(len(s["lines"])):
        p = os.path.join(d, "voice", f"l{i+1}.mp3"); dd = B.dur(p)
        spans.append((0.05 + t, 0.05 + t + dd)); parts.append(p); t += dd + 0.2
    voice = os.path.join(tmp, "voice.wav")
    fc = "".join(f"[{i}:a]aresample=48000,aformat=channel_layouts=mono,apad=pad_dur=0.2[a{i}];" for i in range(len(parts)))
    fc += "".join(f"[a{i}]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=0:a=1[o]"
    B.sh(["ffmpeg", "-y", *sum([["-i", p] for p in parts], []), "-filter_complex", fc, "-map", "[o]", voice])
    w16 = voice + ".16k.wav"; B.sh(["ffmpeg", "-y", "-i", voice, "-ar", "16000", "-ac", "1", w16])
    heard = [(w, a + 0.05, b + 0.05) for w, a, b in B.whisper_words(w16, " ".join(s["lines"]), "en")]
    total = spans[-1][1] + 1.2
    n = len(s["shots"])
    imgs = [os.path.join(d, "img", f"{k}.png") for k in range(n)]
    clips, cuts, _ = slots(d, n, total, tmp, imgs)
    e = B.karaoke(B.caption_words(s["caps"], spans, heard))
    e.append(ev(3, 0, total, "Header", s["header"], ""))
    e.append(ev(3, 0, spans[1][0], "Q", s["question"], "\\fad(0,200)"))
    ass = os.path.join(tmp, "c.ass"); open(ass, "w").write(HEAD + "\n".join(e) + "\n")
    inputs, g = music_mix(concat(clips, tmp), ass, os.path.join(d, "music.flac"), total, cuts, tmp, voice=voice, mg=0.24)
    encode(inputs, g, total, os.path.join(work, "doorway.mp4"))


def build_thennow(work):
    s, d = H["thennow"], os.path.join(work, "thennow")
    tmp = tempfile.mkdtemp(prefix="h_tn_")
    clips, cuts, e, t = [], [], [], 0.0
    e.append(None)
    for k, (place, ya, yb, _, _) in enumerate(s["pairs"]):
        a, b = os.path.join(d, "img", f"{k}a.png"), os.path.join(d, "img", f"{k}b.png")
        clips.append(B.render_shot(a, 4.0, 2 * k, tmp)); clips.append(B.render_shot(b, 5.0, 2 * k + 1, tmp))
        e.append(ev(1, t + 0.1, t + 8.9, "Place", place.upper(), "\\fad(150,150)"))
        e.append(ev(2, t + 0.1, t + 3.95, "Year", ya, POP))
        e.append(ev(2, t + 4.05, t + 8.95, "Year", yb, POP))
        cuts += [t + 4.0] + ([t + 9.0] if k < len(s["pairs"]) - 1 else []); t += 9.0
    total = t + 0.6
    e[0] = ev(3, 0, total, "Header", s["header"], "")
    ass = os.path.join(tmp, "c.ass"); open(ass, "w").write(HEAD + "\n".join(e) + "\n")
    inputs, g = music_mix(concat(clips, tmp), ass, os.path.join(d, "music.flac"), total, cuts, tmp, mg=0.9)
    # white flash on every then->now switch
    flash = "".join(f"eq=brightness=0.6:enable='between(t,{c-0.04:.2f},{c+0.08:.2f})'," for c in cuts[::2])
    inputs, g = music_mix(concat(clips, tmp), ass, os.path.join(d, "music.flac"), total, cuts, tmp, mg=0.9, extra_v=flash)
    encode(inputs, g, total, os.path.join(work, "thennow.mp4"))


MON = [("seek", "SEEK", "DOORS", "CAM 02 · HALLWAY"), ("figure", "THE FIGURE", "DOORS", "PHONE · 02:41"),
       ("screech", "SCREECH", "DOORS", "PHONE · 03:07"), ("deer", "THE DEER", "99 NIGHTS IN THE FOREST", "DOORBELL · 03:12"),
       ("rush", "RUSH", "DOORS", "PHONE · 03:19"), ("blue", "BLUE", "RAINBOW FRIENDS", "STORE CAM 07 · 03:33")]
HITS = [0.0, 7.36, 13.61, 20.78, 29.0, 35.55, 43.17]


def build_monsters(work, track):
    d = os.path.join(work, "monsters")
    tmp = tempfile.mkdtemp(prefix="h_mon_")
    order = ["seek", "figure", "screech", "deer", "rush", "blue"]
    clips, e = [], []
    total = 47.0
    looks = ["colorchannelmixer=.25:.55:.1:0:.3:.65:.15:0:.2:.45:.1:0,", "", "", "hue=s=0.15,", "", "hue=s=0.6,"]
    for k, key in enumerate(order):
        a, b = HITS[k], HITS[k + 1]
        c = os.path.join(d, "clips", f"{key}.mp4")
        src = c if os.path.exists(c) else os.path.join(d, "img", f"{key}.png")
        o = B.render_shot(src, b - a, k, tmp)
        g = os.path.join(tmp, f"g{k}.mp4")
        B.sh(["ffmpeg", "-y", "-i", o, "-vf", f"format=gbrp,{looks[k]}eq=brightness='0.03*sin(t*29)':eval=frame,"
              "noise=alls=24:allf=t,rgbashift=rh=-3:bh=3,format=yuv420p", "-c:v", "libx264", "-crf", "17", "-preset",
              "veryfast", g])
        clips.append(g)
        _, name, game, cam = MON[k]
        e.append(ev(1, a, b, "OSD", f"{cam}   {{\\c&H0000FF&}}● REC", ""))
        e.append(ev(2, a + 0.6, b - 0.2, "Mon", name, POP))
        e.append(ev(2, a + 0.6, b - 0.2, "Sub", game, "\\fad(100,100)"))
    endcard = os.path.join(tmp, "end.mp4")
    B.sh(["ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c=black:s={W}x{H_}:d={total-HITS[6]}:r={FPS}", "-c:v", "libx264",
          "-pix_fmt", "yuv420p", endcard])
    clips.append(endcard)
    e.append(ev(3, 0, HITS[6], "Header", "IF ROBLOX MONSTERS WERE REAL", ""))
    e.append(ev(3, HITS[6] + 0.2, total, "Mon", "WHICH ONE\\NWOULD YOU RUN FROM?", POP))
    e.append(ev(3, HITS[6] + 0.8, total, "Sub", "▼ COMMENT ▼", "\\fad(200,0)"))
    ass = os.path.join(tmp, "c.ass"); open(ass, "w").write(HEAD + "\n".join(e) + "\n")
    glitch = "".join(f"rgbashift=rh=-28:bv=14:enable='between(t,{h-0.05:.2f},{h+0.25:.2f})'," for h in HITS[1:])
    inputs, g = music_mix(concat(clips, tmp), ass, track, total, [], tmp, mg=0.95, extra_v=glitch)
    encode(inputs, g, total, os.path.join(work, "monsters.mp4"))


if __name__ == "__main__":
    name, work = sys.argv[1], sys.argv[2]
    if name in ("ghibli", "jam"):
        build_story(name, work, 45.0 if name == "ghibli" else 42.0)
    elif name == "doorway":
        build_doorway(work)
    elif name == "thennow":
        build_thennow(work)
    elif name == "monsters":
        build_monsters(work, sys.argv[sys.argv.index("--track") + 1])
    print("done", name)
