#!/usr/bin/env python3
"""Fast-cut edit for hooks and short segments: shots timed to the narration's lines, word-by-word captions,
wind/impact sound design, ducked music.

    python3 fast_edit.py spec.json out.mp4

spec.json (paths relative to the spec):
{
  "narration": "voice.flac", "tempo": 0.93,          # tempo < 1 slows the voice down (pitch kept)
  "music": "music.flac", "music_gain": 0.14, "music_start": 20,
  "lines": [                                          # one entry per narration line, in order
    {"text": "A polar bear walks down the main street.", "shots": ["clips/m37.mp4"]},
    {"text": "This is Longyearbyen.", "shots": ["img/s03.png"], "overlay": "overlays/title.png", "hit": true}
  ],
  "keywords": ["polar bear", "born", "buried"],      # highlighted in the captions
  "fonts": "fonts", "lead_in": 0.4, "tail": 1.6
}
Line timing comes from Whisper word timestamps on the narration, matched to each line's text.
"""
import difflib, json, os, re, subprocess, sys, tempfile

W, H, FPS = 1920, 1080, 30
ACCENT = "&H002C6BFF&"  # ASS colour (BGR) = #FF6B2C


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"failed: {' '.join(cmd)[:200]}\n{r.stderr[-2500:]}")
    return r


def dur(p):
    return float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).stdout)


def words_of(path):
    from faster_whisper import WhisperModel
    m = WhisperModel("small.en", device="cpu", compute_type="int8")
    segs, _ = m.transcribe(path, language="en", word_timestamps=True, beam_size=5)
    return [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]


def norm(s):
    return re.sub(r"[^a-z0-9 ]+", "", s.lower().replace("-", " ")).split()


def align(lines, words):
    """Start/end time of every line, via a word-level diff between script and transcript."""
    script, owner = [], []
    for i, l in enumerate(lines):
        for t in norm(l["text"]):
            script.append(t); owner.append(i)
    heard, idx = [], []
    for k, (w, a, b) in enumerate(words):
        for t in norm(w):
            heard.append(t); idx.append(k)
    sm = difflib.SequenceMatcher(None, script, heard, autojunk=False)
    first, last = {}, {}
    for a, b, n in sm.get_matching_blocks():
        for j in range(n):
            i, k = owner[a + j], idx[b + j]
            first.setdefault(i, k); last[i] = k
    spans = []
    for i in range(len(lines)):
        if i not in first:
            sys.exit(f"line {i} not found in narration: {lines[i]['text']!r}")
        spans.append((words[first[i]][1], words[last[i]][2]))
    return spans


def render_shot(src, d, k, tmp, move):
    out = os.path.join(tmp, f"s{k:03d}.mp4")
    n = max(2, int(round(d * FPS)))
    if src.endswith(".mp4"):
        src_d = dur(src)
        speed = min(max(d / src_d, 0.6), 1.6)
        vf = (f"setpts={speed}*PTS,fps={FPS},scale=-2:{H}:flags=lanczos,crop={W}:{H},unsharp=5:5:0.6,"
              f"tpad=stop_mode=clone:stop_duration={d},trim=duration={d},setsar=1")
        sh(["ffmpeg", "-y", "-i", src, "-vf", vf, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
            "-pix_fmt", "yuv420p", out])
    else:
        z = ["z='1.0+0.10*on/{n}'", "z='1.10-0.10*on/{n}'"][move % 2].format(n=n)
        vf = (f"scale={W*2}:-2,crop={W*2}:{H*2},zoompan={z}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:"
              f"s={W}x{H}:fps={FPS},setsar=1")
        sh(["ffmpeg", "-y", "-loop", "1", "-i", src, "-vf", vf, "-frames:v", str(n), "-c:v", "libx264",
            "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", out])
    return out


def ass_time(t):
    t = max(t, 0)
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def captions(words, offset, keywords, path):
    """Groups of up to 3 words, the spoken word in white, keywords in the channel accent."""
    keys = [norm(k) for k in keywords]
    flat = [norm(w)[0] if norm(w) else "" for w, _, _ in words]
    hot = set()
    for k in keys:
        for i in range(len(flat) - len(k) + 1):
            if flat[i:i + len(k)] == k:
                hot.update(range(i, i + len(k)))
    groups, cur = [], []
    for i, (w, a, b) in enumerate(words):
        cur.append(i)
        gap = words[i + 1][1] - b if i + 1 < len(words) else 9
        if len(cur) == 3 or w.endswith((".", ",", "?", "!")) or gap > 0.35:
            groups.append(cur); cur = []
    if cur:
        groups.append(cur)
    ev = []
    for g in groups:
        a = words[g[0]][1] + offset
        b = words[g[-1]][2] + offset + 0.12
        txt = " ".join((f"{{\\c{ACCENT}}}" + words[i][0].upper().strip(".,") + "{\\c&HFFFFFF&}") if i in hot
                       else words[i][0].upper().strip(".,") for i in g)
        ev.append(f"Dialogue: 0,{ass_time(a)},{ass_time(b)},Cap,,0,0,0,,{{\\fad(60,60)\\t(0,90,\\fscx108\\fscy108)"
                  f"\\t(90,180,\\fscx100\\fscy100)}}{txt}")
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Oswald,92,&H00FFFFFF,&H00FFFFFF,&H00101010,&H96000000,1,0,0,0,100,100,1,0,1,6,3,2,80,80,150,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    open(path, "w").write(head + "\n".join(ev) + "\n")


def main(spec_path, out):
    base = os.path.dirname(os.path.abspath(spec_path))
    spec = json.load(open(spec_path))
    P = lambda p: os.path.join(base, p)
    tmp = tempfile.mkdtemp(prefix="fe_")
    voice = os.path.join(tmp, "voice.wav")
    sh(["ffmpeg", "-y", "-i", P(spec["narration"]), "-af", f"atempo={spec.get('tempo', 1.0)}", "-ar", "48000", voice])
    words = words_of(voice)
    lines = spec["lines"]
    spans = align(lines, words)
    lead, tail = spec.get("lead_in", 0.4), spec.get("tail", 1.6)
    vlen = dur(voice)
    total = lead + vlen + tail
    # each line owns the time from its first word until the next line starts (cuts land on line starts)
    starts = [0.0] + [lead + spans[i][0] - 0.05 for i in range(1, len(lines))]
    ends = starts[1:] + [total]
    timeline = []
    for i, l in enumerate(lines):
        n = len(l["shots"])
        for j, s in enumerate(l["shots"]):
            a = starts[i] + (ends[i] - starts[i]) * j / n
            timeline.append((P(s), a, (ends[i] - starts[i]) / n))
    clips = [render_shot(s, d, k, tmp, k) for k, (s, a, d) in enumerate(timeline)]
    lst = os.path.join(tmp, "list.txt")
    open(lst, "w").write("".join(f"file '{c}'\n" for c in clips))
    cat = os.path.join(tmp, "cat.mp4")
    sh(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", cat])
    ass = os.path.join(tmp, "cap.ass")
    captions(words, lead, spec.get("keywords", []), ass)

    inputs = ["-i", cat]
    fc, last = [], "[0:v]"
    ov = [(i, l["overlay"]) for i, l in enumerate(lines) if l.get("overlay")]
    for j, (i, png) in enumerate(ov):
        t0, d = starts[i] + 0.15, min(ends[i] - starts[i] + 1.5, 5)
        inputs += ["-loop", "1", "-t", f"{d}", "-i", P(png)]
        fc.append(f"[{1+j}:v]format=rgba,fade=in:st=0:d=0.25:alpha=1,fade=out:st={d-0.4}:d=0.4:alpha=1,"
                  f"setpts=PTS+{t0:.3f}/TB[o{j}]")
        fc.append(f"{last}[o{j}]overlay=eof_action=pass[w{j}]"); last = f"[w{j}]"
    fonts = P(spec.get("fonts", "fonts"))
    fc.append(f"{last}ass={ass}:fontsdir={fonts},fade=in:st=0:d=0.3,fade=out:st={total-1.2:.3f}:d=1.2,"
              f"format=yuv420p[vout]")
    a0 = 1 + len(ov)
    inputs += ["-i", voice, "-ss", str(spec.get("music_start", 0)), "-i", P(spec["music"])]
    # wind bed + impact hits on lines marked "hit"
    fc.append(f"anoisesrc=color=brown:amplitude=0.6:duration={total:.2f}:sample_rate=48000,lowpass=f=700,highpass=f=60,"
              f"tremolo=f=0.13:d=0.6,volume=0.10[wind]")
    hits = [starts[i] for i, l in enumerate(lines) if l.get("hit")]
    mix = ["[vo]", "[duck]", "[wind]"]
    for j, t in enumerate(hits):
        fc.append(f"sine=f=48:duration=1.6:sample_rate=48000,afade=out:st=0:d=1.6:curve=exp,volume=0.9,"
                  f"adelay={int(t*1000)}|{int(t*1000)}[hit{j}]")
        mix.append(f"[hit{j}]")
    fc.append(f"[{a0}:a]adelay={int(lead*1000)}|{int(lead*1000)},apad=whole_dur={total:.3f},asplit=2[vo][key]")
    fc.append(f"[{a0+1}:a]aresample=48000,atrim=duration={total:.3f},volume={spec.get('music_gain', 0.14)},"
              f"afade=in:st=0:d=0.8,afade=out:st={total-1.5:.3f}:d=1.5[mus]")
    fc.append("[mus][key]sidechaincompress=threshold=0.03:ratio=5:attack=30:release=500[duck]")
    fc.append(f"{''.join(mix)}amix=inputs={len(mix)}:duration=first:normalize=0,"
              f"loudnorm=I=-14:TP=-1.5:LRA=9[aout]")
    g = os.path.join(tmp, "g.txt")
    open(g, "w").write(";\n".join(fc))
    sh(["ffmpeg", "-y", *inputs, "-filter_complex_script", g, "-map", "[vout]", "-map", "[aout]", "-t", f"{total:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", str(FPS), "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", out])
    print(f"done: {out} {total:.1f}s, {len(clips)} shots, lines at {[round(s, 1) for s in starts]}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
