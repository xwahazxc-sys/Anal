#!/usr/bin/env python3
"""v2 vertical Short builder.

    python3 build_v2.py NAME WORKDIR

Changes from v1: hook text on screen from 0.0 s and voice from 0.05 s; strongest moving shot first; karaoke captions
(heavy font, 1-2 words, the spoken word in yellow, numbers as digits from spec "caps"), placed at ~65% height so the
Shorts UI never covers them; punch-in on every cut; texts can sit mid-line (index 1.5 = halfway through line 1).
"""
import os, re, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from specs_v2 import S

W, H, FPS = 1080, 1920, 30
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
GAP, LEAD = 0.18, 0.05
YEL = "&H0000E1FF&"


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"failed: {' '.join(map(str, cmd))[:300]}\n{r.stderr[-2500:]}")
    return r


def dur(p):
    return float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).stdout)


def ta(t):
    t = max(0, t)
    return f"{int(t//3600)}:{int(t%3600//60):02d}:{t%60:05.2f}"


HEAD = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Archivo Black,128,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,10,5,2,70,70,640,1
Style: Hook,Archivo Black,150,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,11,5,8,60,60,260,1
Style: Big,Archivo Black,104,{YEL[:-1]},&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,10,5,8,60,60,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def whisper_words(wav, text, lang):
    import numpy as np, soundfile as sf
    from faster_whisper import WhisperModel
    a, _ = sf.read(wav)
    m = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = m.transcribe(a.astype(np.float32), language=lang, word_timestamps=True, beam_size=5, initial_prompt=text)
    return [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]


def caption_words(caps, spans, heard):
    """Timed caption tokens: per line, take Whisper's words inside the line; if the counts match use their timings,
    otherwise spread the caption tokens over the spoken span by length."""
    out = []
    for text, (a, b) in zip(caps, spans):
        toks = text.split()
        hw = [w for w in heard if w[1] >= a - 0.15 and w[2] <= b + 0.25]
        if len(hw) == len(toks):
            out += [(t, w[1], w[2]) for t, w in zip(toks, hw)]
            continue
        if hw:
            a, b = hw[0][1], hw[-1][2]
        wts = [len(t) + 2 for t in toks]
        tot, t0 = sum(wts), a
        for t, wt in zip(toks, wts):
            d = (b - a) * wt / tot
            out.append((t, t0, t0 + d)); t0 += d
    return out


def karaoke(words):
    ev, grp = [], []
    for i, (w, a, b) in enumerate(words):
        grp.append(i)
        nxt = words[i + 1][1] if i + 1 < len(words) else None
        long_word = len(w) > 9
        if len(grp) == 2 or long_word or w.endswith((".", ",", "?", "!", ":")) or nxt is None or nxt - b > 0.25:
            g_end = min(words[grp[-1]][2] + 0.1, nxt - 0.01) if nxt else words[grp[-1]][2] + 0.4
            for j in grp:
                s = words[j][1]
                e = words[j + 1][1] if j != grp[-1] else g_end
                parts = []
                for k in grp:
                    t = words[k][0].upper().rstrip(",.")
                    if len(t) > 11:  # long words (German compounds) shrink to fit the width
                        t = f"{{\\fs{int(128 * 11 / len(t))}}}{t}{{\\fs128}}"
                    parts.append(f"{{\\c{YEL}\\fscx106\\fscy106}}{t}{{\\c&HFFFFFF&\\fscx100\\fscy100}}" if k == j else t)
                pop = "\\t(0,70,\\fscx108\\fscy108)\\t(70,140,\\fscx100\\fscy100)" if j == grp[0] else ""
                ev.append(f"Dialogue: 0,{ta(s)},{ta(e)},Cap,,0,0,0,,{{{pop}}}{' '.join(parts)}")
            grp = []
    return ev


FRAMES = [(1.0, 0.5, 0.5), (1.55, 0.5, 0.38), (1.45, 0.5, 0.62), (1.7, 0.42, 0.45)]


def render_slot(src, img, d, k, tmp):
    """A slot longer than ~3 s is split into 2-3 framings (wide / close / detail) so the eye gets a new picture."""
    m = 1 if d <= 3.3 else min(3, int(d // 2.6) + (1 if d % 2.6 > 1.2 else 0))
    if m <= 1:
        return [render_shot(src, d, k, tmp)]
    out, seg = [], d / m
    for j in range(m):
        if j == 0:
            out.append(render_shot(src, seg, k * 10, tmp))
        else:
            out.append(render_shot(img, seg, k * 10 + j, tmp, FRAMES[j % len(FRAMES) or 1]))
    return out


def render_shot(src, d, k, tmp, frame=None):
    out = os.path.join(tmp, f"s{k:03d}.mp4")
    n = max(2, int(round(d * FPS)))
    grade = "eq=contrast=1.07:saturation=1.1,vignette=PI/5"
    punch = f"zoompan=z='if(lt(on,9),1.10-0.10*on/9,1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}"
    if src.endswith(".mp4"):
        sp = min(max(d / dur(src), 0.75), 1.5)
        vf = (f"setpts={sp}*PTS,fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},"
              f"unsharp=5:5:0.6,{grade},tpad=stop_mode=clone:stop_duration={d},trim=duration={d},setpts=PTS-STARTPTS,"
              f"{punch},setsar=1")
        sh(["ffmpeg", "-y", "-i", src, "-vf", vf, "-an", "-frames:v", str(n), "-c:v", "libx264", "-preset", "veryfast",
            "-crf", "17", "-pix_fmt", "yuv420p", out])
    else:
        f0, fx, fy = frame or (1.0, 0.5, 0.5)
        z = [f"{f0+0.10}+0.10*on/{n}", f"{f0+0.20}-0.10*on/{n}"][k % 2]
        z = f"if(lt(on,9),{f0+0.30}-({f0+0.30}-({z}))*on/9,{z})"
        vf = (f"scale={W*2}:{H*2}:force_original_aspect_ratio=increase,crop={W*2}:{H*2},zoompan=z='{z}':"
              f"x='max(0,min(iw-iw/zoom,iw*{fx}-(iw/zoom/2)))':y='max(0,min(ih-ih/zoom,ih*{fy}-(ih/zoom/2)))':"
              f"d={n}:s={W}x{H}:fps={FPS},{grade},setsar=1")
        sh(["ffmpeg", "-y", "-loop", "1", "-i", src, "-vf", vf, "-frames:v", str(n), "-c:v", "libx264", "-preset",
            "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", out])
    return out


def main(name, work):
    s = S[name]
    d = os.path.join(work, name)
    tmp = tempfile.mkdtemp(prefix=f"v2_{name}_")
    shots = [os.path.join(d, "clips", f"{k}.mp4") if os.path.exists(os.path.join(d, "clips", f"{k}.mp4"))
             else os.path.join(d, "img", f"{k}.png") for k in range(len(s["shots"]))]
    ev, tail = [], 1.0
    voice = None
    if s.get("lines"):
        parts, spans, t = [], [], 0.0
        for i in range(len(s["lines"])):
            p = os.path.join(d, "voice", f"l{i+1}.mp3")
            dd = dur(p); spans.append((LEAD + t, LEAD + t + dd)); parts.append(p); t += dd + GAP
        voice = os.path.join(tmp, "voice.wav")
        fc = "".join(f"[{i}:a]aresample=48000,aformat=channel_layouts=mono,apad=pad_dur={GAP}[a{i}];" for i in range(len(parts)))
        fc += "".join(f"[a{i}]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=0:a=1[o]"
        sh(["ffmpeg", "-y", *sum([["-i", p] for p in parts], []), "-filter_complex", fc, "-map", "[o]", voice])
        w16 = voice + ".16k.wav"; sh(["ffmpeg", "-y", "-i", voice, "-ar", "16000", "-ac", "1", w16])
        lang = "de" if name == "autobahn" else "en"
        heard = [(w, a + LEAD, b + LEAD) for w, a, b in whisper_words(w16, " ".join(s["lines"]), lang)]
        ev += karaoke(caption_words(s["caps"], spans, heard))
        total = spans[-1][1] + tail
        anchor = [sp[0] for sp in spans]
    else:
        total = 38.0 if s.get("song") else 26.0
        anchor = None
    n = len(shots)
    cuts = [total * k / n for k in range(n + 1)]
    if anchor:  # cut on line starts: first shot holds the hook line, then shots spread over the rest
        cuts = [0.0]
        per = max(1, round((n - 1) / max(1, len(anchor) - 1)))
        rest = anchor[1:]
        cuts.append(rest[0] if rest else total / n)
        while len(cuts) < n:
            a, b = cuts[-1], total
            nxt = [x for x in rest if x > a + 1.8]
            cuts.append(nxt[0] if nxt else a + (b - a) / (n - len(cuts) + 1))
        cuts.append(total)
    clips, subcuts = [], []
    for k in range(n):
        seg = render_slot(shots[k], os.path.join(d, "img", f"{k}.png"), cuts[k + 1] - cuts[k], k, tmp)
        step = (cuts[k + 1] - cuts[k]) / len(seg)
        subcuts += [cuts[k] + step * j for j in range(1, len(seg))]
        clips += seg
    lst = os.path.join(tmp, "l.txt"); open(lst, "w").write("".join(f"file '{c}'\n" for c in clips))
    cat = os.path.join(tmp, "cat.mp4"); sh(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", cat])
    hook_end = (anchor[1] - 0.1) if anchor and len(anchor) > 1 else 2.6
    ev.append(f"Dialogue: 2,{ta(0)},{ta(min(hook_end, 3.2))},Hook,,0,0,0,,{{\\t(0,100,\\fscx112\\fscy112)"
              f"\\t(100,200,\\fscx100\\fscy100)}}{s['hook']}")
    for txt, idx in s.get("texts", []):
        if anchor:
            i = int(idx); a0, b0 = anchor[i], (anchor[i + 1] if i + 1 < len(anchor) else total)
            a = a0 + (b0 - a0) * (idx - i) if idx else 3.3
            b = a + 2.3
        else:
            a = cuts[int(idx)] + (idx % 1) * 2 + (0.1 if idx else 2.7); b = a + 2.4
        ev.append(f"Dialogue: 1,{ta(a)},{ta(b)},Big,,0,0,0,,{{\\fad(50,100)\\t(0,110,\\fscx114\\fscy114)"
                  f"\\t(110,220,\\fscx100\\fscy100)}}{txt}")
    ass = os.path.join(tmp, "c.ass"); open(ass, "w").write(HEAD + "\n".join(ev) + "\n")
    inputs = ["-i", cat, "-i", os.path.join(d, "music.flac")]
    fc = [f"[0:v]setpts=N/({FPS}*TB),ass={ass}:fontsdir={FONTS},fade=out:st={total-0.5:.2f}:d=0.5,format=yuv420p[vout]"]
    wh = []
    for k, c in enumerate(cuts[1:-1] + subcuts):
        fc.append(f"anoisesrc=color=pink:amplitude=0.3:d=0.3:r=48000,bandpass=f=2200:w=1800,afade=in:st=0:d=0.15,"
                  f"afade=out:st=0.15:d=0.15,aformat=channel_layouts=stereo,adelay={int((c-0.15)*1000)}|{int((c-0.15)*1000)}[w{k}]")
        wh.append(f"[w{k}]")
    fc.append(f"sine=f=55:duration=0.9:sample_rate=48000,volume=1.3,afade=out:st=0:d=0.9:curve=exp,aformat=channel_layouts=stereo[hit]")
    mg = 0.24 if voice else 0.95
    fc.append(f"[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration={total:.2f},volume={mg},"
              f"afade=out:st={total-1.2:.2f}:d=1.2[mus]")
    if voice:
        inputs += ["-i", voice]
        fc.append(f"[2:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(LEAD*1000)}|{int(LEAD*1000)},"
                  f"apad=whole_dur={total:.2f},asplit=2[vo][key]")
        fc.append("[mus][key]sidechaincompress=threshold=0.03:ratio=5:attack=15:release=300[duck]")
        mix, nm = "[vo][duck][hit]" + "".join(wh), 3 + len(wh)
    else:
        mix, nm = "[mus][hit]" + "".join(wh), 2 + len(wh)
    fc.append(f"{mix}amix=inputs={nm}:duration=first:normalize=0,alimiter=limit=0.9,loudnorm=I=-14:TP=-1.5:LRA=9[aout]")
    g = os.path.join(tmp, "g.txt"); open(g, "w").write(";\n".join(fc))
    out = os.path.join(work, f"{name}.mp4")
    sh(["ffmpeg", "-y", *inputs, "-filter_complex_script", g, "-map", "[vout]", "-map", "[aout]", "-t", f"{total:.2f}",
        "-c:v", "libx264", "-preset", "medium", "-b:v", "9M", "-maxrate", "12M", "-bufsize", "18M", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out])
    print(f"done {out} {total:.1f}s cuts={[round(c,1) for c in cuts]}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
