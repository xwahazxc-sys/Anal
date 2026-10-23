#!/usr/bin/env python3
"""Assemble a narrated documentary video from stills, motion clips, narration and music.

    python3 assemble.py edit.json out.mp4

edit.json:
{
  "narration": "narration.flac",        # one voice track
  "script": "full narration text",      # used to place sections in time (proportional to characters)
  "music": "music.flac", "music_gain": 0.16,
  "lead_in": 1.0, "tail": 3.0,
  "sections": [                          # in order; "starts" = the first words of the section in the script
    {"starts": "In this town", "shots": ["img/s01.png", "clips/m02.mp4", ...],
     "card": "overlays/card1.png"}       # optional transparent PNG shown for 4 s at section start
  ],
  "overlays": [{"png": "overlays/title.png", "section": 1, "offset": 0.6, "dur": 6}]
}
Stills get a slow push/pull or pan (alternating); clips are scaled to 1920x1080 and stretched up to 1.5x
to fill their slot. Shots in a section share its time equally. Music is ducked under the voice.
"""
import json, os, re, subprocess, sys, tempfile

W, H, FPS, XF = 1920, 1080, 30, 0.5  # crossfade length between shots


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"ffmpeg failed: {' '.join(cmd)[:300]}\n{r.stderr[-2000:]}")
    return r


def duration(path):
    r = sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
    return float(r.stdout.strip())


def silences(path, noise="-35dB", d=0.25):
    r = subprocess.run(["ffmpeg", "-i", path, "-af", f"silencedetect=noise={noise}:d={d}", "-f", "null", "-"],
                       capture_output=True, text=True)
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    return ends


def section_times(spec, voice_len):
    """Start of each section in narration time: proportional to characters, snapped to the nearest pause."""
    text = re.sub(r"\s+", " ", spec["script"])
    total = len(text)
    pauses = silences(spec["narration"])
    out = []
    for i, s in enumerate(spec["sections"]):
        if i == 0:
            out.append(0.0)
            continue
        pos = text.find(s["starts"])
        if pos < 0:
            sys.exit(f"section start not found in script: {s['starts']!r}")
        t = voice_len * pos / total
        near = min(pauses, key=lambda p: abs(p - t)) if pauses else t
        out.append(near if abs(near - t) < 4 else t)
    return out


MOVES = [
    "z='1.0+0.07*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",            # push in
    "z='1.07-0.07*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",           # pull out
    "z='1.08':x='(iw-iw/zoom)*on/{n}':y='ih/2-(ih/zoom/2)'",                    # pan right
    "z='1.08':x='(iw-iw/zoom)*(1-on/{n})':y='ih/2-(ih/zoom/2)'",                # pan left
]


def render_shot(src, dur, k, tmp):
    out = os.path.join(tmp, f"shot{k:03d}.mp4")
    n = int(round(dur * FPS))
    if src.lower().endswith((".mp4", ".webm", ".mov")):
        stretch = min(max(dur / duration(src), 1.0), 1.5)
        vf = (f"setpts={stretch}*PTS,fps={FPS},scale=-2:{H},crop={W}:{H},"
              f"tpad=stop_mode=clone:stop_duration={dur},trim=duration={dur},setsar=1")
        sh(["ffmpeg", "-y", "-i", src, "-vf", vf, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
            "-pix_fmt", "yuv420p", out])
    else:
        move = MOVES[k % len(MOVES)].format(n=n)
        vf = f"scale={W*2}:-2,crop={W*2}:{H*2},zoompan={move}:d={n}:s={W}x{H}:fps={FPS},setsar=1"
        sh(["ffmpeg", "-y", "-loop", "1", "-i", src, "-vf", vf, "-frames:v", str(n), "-c:v", "libx264",
            "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", out])
    return out


def main(spec_path, out_path):
    base = os.path.dirname(os.path.abspath(spec_path))
    spec = json.load(open(spec_path))
    for k in ("narration", "music"):
        spec[k] = os.path.join(base, spec[k])
    lead, tail = spec.get("lead_in", 1.0), spec.get("tail", 3.0)
    vlen = duration(spec["narration"])
    total = lead + vlen + tail
    starts = [lead + t for t in section_times(spec, vlen)]
    starts[0] = 0.0
    bounds = starts + [total]

    # timeline: (src, start, slot)
    timeline = []
    for i, s in enumerate(spec["sections"]):
        a, b = bounds[i], bounds[i + 1]
        slot = (b - a) / len(s["shots"])
        for j, src in enumerate(s["shots"]):
            timeline.append((os.path.join(base, src), a + j * slot, slot))

    tmp = tempfile.mkdtemp(prefix="asm_")
    clips = []
    for k, (src, st, slot) in enumerate(timeline):
        extra = XF if k < len(timeline) - 1 else 0
        clips.append(render_shot(src, slot + extra, k, tmp))
        print(f"  shot {k+1}/{len(timeline)} {os.path.basename(src)} {slot:.1f}s", flush=True)

    # crossfade chain
    inputs, fc, last = [], [], "[0:v]"
    for c in clips:
        inputs += ["-i", c]
    for k in range(1, len(clips)):
        off = timeline[k][1]
        fc.append(f"{last}[{k}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}[v{k}]")
        last = f"[v{k}]"
    # overlays
    n = len(clips)
    ov = list(spec.get("overlays", []))
    for i, s in enumerate(spec["sections"]):
        if s.get("card"):
            ov.append({"png": s["card"], "section": i, "offset": 0.3, "dur": 4})
    for j, o in enumerate(ov):
        t0 = bounds[o["section"]] + o.get("offset", 0)
        d = o.get("dur", 4)
        inputs += ["-loop", "1", "-t", f"{d}", "-i", os.path.join(base, o["png"])]
        idx = n + j
        fc.append(f"[{idx}:v]format=rgba,fade=in:st=0:d=0.4:alpha=1,fade=out:st={d-0.5}:d=0.5:alpha=1,"
                  f"setpts=PTS+{t0:.3f}/TB[o{j}]")
        fc.append(f"{last}[o{j}]overlay=eof_action=pass:format=auto[w{j}]")
        last = f"[w{j}]"
    fc.append(f"{last}fade=in:st=0:d=1,fade=out:st={total-1.5:.3f}:d=1.5,format=yuv420p[vout]")
    # audio
    ai = n + len(ov)
    inputs += ["-i", spec["narration"], "-stream_loop", "-1", "-i", spec["music"]]
    g = spec.get("music_gain", 0.16)
    fc.append(f"[{ai}:a]aresample=48000,adelay={int(lead*1000)}|{int(lead*1000)},apad=whole_dur={total:.3f},"
              f"asplit=2[voice][key]")
    fc.append(f"[{ai+1}:a]aresample=48000,atrim=duration={total:.3f},volume={g},"
              f"afade=in:st=0:d=2,afade=out:st={total-3:.3f}:d=3[mus]")
    fc.append("[mus][key]sidechaincompress=threshold=0.03:ratio=4:attack=50:release=600[duck]")
    fc.append("[voice][duck]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
    script = os.path.join(tmp, "graph.txt")
    open(script, "w").write(";\n".join(fc))
    sh(["ffmpeg", "-y", *inputs, "-filter_complex_script", script, "-map", "[vout]", "-map", "[aout]",
        "-t", f"{total:.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out_path])
    print(f"done: {out_path} ({total:.1f} s, {len(clips)} shots)")


if __name__ == "__main__":
    main(*sys.argv[1:3])
