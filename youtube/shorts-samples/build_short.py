#!/usr/bin/env python3
"""Vertical Short from a spec in specs.py.

    python3 build_short.py NAME WORKDIR

WORKDIR/NAME/: img/<k>.png, clips/<k>.mp4 (optional, for motion shots), voice/l<i>.mp3 (voiced shorts), music.flac
Voiced: lines are joined with short pauses; shots cut evenly over the voice; captions word by word (Whisper timings).
Music-only (song / transformation): fixed length, cuts land on the beat grid of the music.
"""
import json, os, re, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from specs import S

W, H, FPS = 1080, 1920, 30
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
GAP = 0.22


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"failed: {' '.join(map(str, cmd))[:300]}\n{r.stderr[-2500:]}")
    return r


def dur(p):
    return float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).stdout)


def t_ass(t):
    return f"{int(t//3600)}:{int(t%3600//60):02d}:{t%60:05.2f}"


ASS_HEAD = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Oswald,96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,1,0,1,7,2,2,70,70,560,1
Style: Big,Bebas Neue,150,&H0000E5FF,&H00FFFFFF,&H00000000,&HB4000000,0,0,0,0,100,100,2,0,1,8,3,8,60,60,250,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def words(voice):
    import numpy as np, soundfile as sf
    from faster_whisper import WhisperModel
    wav = voice + ".16k.wav"
    sh(["ffmpeg", "-y", "-i", voice, "-ar", "16000", "-ac", "1", wav])
    a, _ = sf.read(wav)
    lang = "de" if any(ord(c) > 127 for c in open(voice + ".txt").read()) or "Deutschland" in open(voice + ".txt").read() else "en"
    m = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = m.transcribe(a.astype(np.float32), language=lang, word_timestamps=True, beam_size=5,
                           initial_prompt=open(voice + ".txt").read())
    return [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]


def cap_events(ws, offset):
    ev, cur = [], []
    for i, (w, a, b) in enumerate(ws):
        cur.append(i)
        gap = ws[i + 1][1] - b if i + 1 < len(ws) else 9
        if len(cur) == 3 or w.endswith((".", ",", "?", "!", ":")) or gap > 0.3:
            s, e = ws[cur[0]][1] + offset, ws[cur[-1]][2] + offset + 0.08
            txt = " ".join(ws[j][0].upper() for j in cur)
            ev.append(f"Dialogue: 0,{t_ass(s)},{t_ass(e)},Cap,,0,0,0,,{{\\fad(40,40)\\t(0,80,\\fscx110\\fscy110)"
                      f"\\t(80,160,\\fscx100\\fscy100)}}{txt}")
            cur = []
    return ev


def render_shot(src, d, k, tmp):
    out = os.path.join(tmp, f"s{k:02d}.mp4")
    n = max(2, int(round(d * FPS)))
    grade = "eq=contrast=1.06:saturation=1.08,vignette=PI/5"
    if src.endswith(".mp4"):
        sp = min(max(d / dur(src), 0.7), 1.6)
        vf = (f"setpts={sp}*PTS,fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},"
              f"unsharp=5:5:0.5,{grade},tpad=stop_mode=clone:stop_duration={d},trim=duration={d},setsar=1")
        sh(["ffmpeg", "-y", "-i", src, "-vf", vf, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
            "-pix_fmt", "yuv420p", out])
    else:
        z = ["z='1.0+0.12*on/{n}'", "z='1.12-0.12*on/{n}'", "z='1.08':x='(iw-iw/zoom)*on/{n}'"][k % 3].format(n=n)
        if "x=" not in z:
            z += ":x='iw/2-(iw/zoom/2)'"
        vf = (f"scale={W*2}:{H*2}:force_original_aspect_ratio=increase,crop={W*2}:{H*2},zoompan={z}:y='ih/2-(ih/zoom/2)':"
              f"d={n}:s={W}x{H}:fps={FPS},{grade},setsar=1")
        sh(["ffmpeg", "-y", "-loop", "1", "-i", src, "-vf", vf, "-frames:v", str(n), "-c:v", "libx264", "-preset",
            "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", out])
    return out


def main(name, work):
    s = S[name]
    d = os.path.join(work, name)
    tmp = tempfile.mkdtemp(prefix=f"ss_{name}_")
    shots = []
    for k, sd in enumerate(s["shots"]):
        c = os.path.join(d, "clips", f"{k}.mp4")
        shots.append(c if os.path.exists(c) else os.path.join(d, "img", f"{k}.png"))
    lead, tail = 0.15, 1.2
    ev = []
    if s.get("lines"):
        parts, starts, t = [], [], 0.0
        for i in range(len(s["lines"])):
            p = os.path.join(d, "voice", f"l{i+1}.mp3")
            starts.append(t); parts.append(p); t += dur(p) + GAP
        voice = os.path.join(tmp, "voice.wav")
        inp = sum([["-i", p] for p in parts], [])
        fc = "".join(f"[{i}:a]aresample=48000,aformat=channel_layouts=mono,apad=pad_dur={GAP}[a{i}];" for i in range(len(parts)))
        fc += "".join(f"[a{i}]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=0:a=1[o]"
        sh(["ffmpeg", "-y", *inp, "-filter_complex", fc, "-map", "[o]", voice])
        open(voice + ".txt", "w").write(" ".join(s["lines"]))
        total = lead + dur(voice) + tail
        ev += cap_events(words(voice), lead)
        line_t = [lead + x for x in starts]
    else:
        voice, total = None, (40.0 if s.get("song") else 30.0)
        line_t = None
    # cuts: evenly, nudged to the next voice line start when one is close
    n = len(shots)
    cuts = [total * k / n for k in range(n + 1)]
    if line_t:
        for k in range(1, n):
            near = min(line_t, key=lambda x: abs(x - cuts[k]))
            if abs(near - cuts[k]) < 1.6:
                cuts[k] = near
    clips = [render_shot(shots[k], cuts[k + 1] - cuts[k], k, tmp) for k in range(n)]
    lst = os.path.join(tmp, "l.txt"); open(lst, "w").write("".join(f"file '{c}'\n" for c in clips))
    cat = os.path.join(tmp, "cat.mp4"); sh(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", cat])
    # big texts: anchored to a voice line (voiced) or a shot (music-only)
    for txt, idx in s.get("texts", []):
        if line_t:
            a = line_t[int(idx)] if idx >= 1 or idx == 0 else lead
            a = a if idx != 0 else 0.05
            b = a + 2.6
        else:
            a = cuts[int(idx)] + (idx % 1) * 2 + 0.1; b = min(a + 2.6, cuts[min(int(idx) + 1, n)] - 0.05) if not s.get("song") else a + 3.5
        ev.append(f"Dialogue: 1,{t_ass(a)},{t_ass(b)},Big,,0,0,0,,{{\\fad(60,120)\\t(0,120,\\fscx112\\fscy112)"
                  f"\\t(120,240,\\fscx100\\fscy100)}}{txt}")
    ass = os.path.join(tmp, "c.ass"); open(ass, "w").write(ASS_HEAD + "\n".join(ev) + "\n")
    inputs = ["-i", cat, "-i", os.path.join(d, "music.flac")]
    fc = [f"[0:v]ass={ass}:fontsdir={FONTS},fade=in:st=0:d=0.2,fade=out:st={total-0.6:.2f}:d=0.6,format=yuv420p[vout]"]
    whoosh = []
    for k, c in enumerate(cuts[1:-1]):
        fc.append(f"anoisesrc=color=pink:amplitude=0.35:d=0.35:r=48000,bandpass=f=1800:w=1600,"
                  f"afade=in:st=0:d=0.17,afade=out:st=0.17:d=0.18,aformat=channel_layouts=stereo,"
                  f"adelay={int((c-0.17)*1000)}|{int((c-0.17)*1000)}[w{k}]")
        whoosh.append(f"[w{k}]")
    mg = 0.22 if voice else 0.9
    fc.append(f"[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration={total:.2f},volume={mg},"
              f"afade=out:st={total-1.5:.2f}:d=1.5[mus]")
    if voice:
        inputs += ["-i", voice]
        fc.append(f"[2:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(lead*1000)}|{int(lead*1000)},"
                  f"apad=whole_dur={total:.2f},asplit=2[vo][key]")
        fc.append("[mus][key]sidechaincompress=threshold=0.03:ratio=5:attack=20:release=350[duck]")
        mix = "[vo][duck]" + "".join(whoosh); nm = 2 + len(whoosh)
    else:
        mix = "[mus]" + "".join(whoosh); nm = 1 + len(whoosh)
    fc.append(f"{mix}amix=inputs={nm}:duration=first:normalize=0,alimiter=limit=0.9,loudnorm=I=-14:TP=-1.5:LRA=9[aout]")
    g = os.path.join(tmp, "g.txt"); open(g, "w").write(";\n".join(fc))
    out = os.path.join(work, f"{name}.mp4")
    sh(["ffmpeg", "-y", *inputs, "-filter_complex_script", g, "-map", "[vout]", "-map", "[aout]", "-t", f"{total:.2f}",
        "-c:v", "libx264", "-preset", "medium", "-b:v", "8M", "-maxrate", "10M", "-bufsize", "16M", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out])
    print(f"done {out} {total:.1f}s {n} shots")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
