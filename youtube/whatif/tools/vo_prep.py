"""ElevenLabs take -> tightened voice + lines.json (word timings) for the 3D sims.

  python3 vo_prep.py <take.mp3> <take.alignment.json> <out_dir> [--gap 0.42] [--tempo 1.0]

- Silences between words longer than --gap are shortened to --gap (keeps the whisper pauses, drops dead air).
- --tempo speeds the result up without changing pitch (1.05 = 5% faster).
- Writes <out_dir>/vo.mp3 and <out_dir>/lines.json: one entry per script line,
  {"text", "t0", "t1", "words": [[word, start, end], ...]} on the new timeline. Audio tags like [whispers] are dropped.
"""
import json, os, re, subprocess, sys


def words_from_alignment(al):
    chars, st, en = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
    lines, cur_line, cur_w, in_tag = [], [], None, False
    for ch, a, b in zip(chars, st, en):
        if ch == "[":
            in_tag = True; continue
        if in_tag:
            if ch == "]":
                in_tag = False
            continue
        if ch == "\n":
            if cur_w: cur_line.append(cur_w); cur_w = None
            if cur_line: lines.append(cur_line); cur_line = []
            continue
        if ch.isspace():
            if cur_w: cur_line.append(cur_w); cur_w = None
            continue
        if cur_w is None: cur_w = [ch, a, b]
        else: cur_w[0] += ch; cur_w[2] = b
    if cur_w: cur_line.append(cur_w)
    if cur_line: lines.append(cur_line)
    return lines


def main():
    src, alp, out = sys.argv[1], sys.argv[2], sys.argv[3]
    gap = float(sys.argv[sys.argv.index("--gap") + 1]) if "--gap" in sys.argv else 0.42
    tempo = float(sys.argv[sys.argv.index("--tempo") + 1]) if "--tempo" in sys.argv else 1.0
    os.makedirs(out, exist_ok=True)
    lines = words_from_alignment(json.load(open(alp)))
    words = [w for L in lines for w in L]
    # keep-segments of the original audio: speech plus at most `gap` of each silence
    segs, cut_from = [], 0.0
    lead = min(0.25, words[0][1])
    s0 = words[0][1] - lead
    for i, w in enumerate(words[:-1]):
        nxt = words[i + 1]
        silence = nxt[1] - w[2]
        if silence > gap:
            segs.append((s0, w[2] + gap / 2)); s0 = nxt[1] - gap / 2
    segs.append((s0, words[-1][2] + 0.6))
    # time map original -> tightened
    def remap(t):
        acc = 0.0
        for a, b in segs:
            if t < a: return acc
            if t <= b: return acc + (t - a)
            acc += b - a
        return acc
    total = sum(b - a for a, b in segs)
    fl = "".join(f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={b - a - 0.02:.3f}:d=0.02[s{i}];" for i, (a, b) in enumerate(segs))
    fl += "".join(f"[s{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=0:a=1" + (f",atempo={tempo}" if tempo != 1 else "") + "[o]"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex", fl, "-map", "[o]", "-c:a", "libmp3lame", "-b:a", "192k", os.path.join(out, "vo.mp3")], check=True)
    f = lambda t: round(remap(t) / tempo, 3)
    res = []
    for L in lines:
        ws = [[w, f(a), f(b)] for w, a, b in L]
        res.append({"text": " ".join(w[0] for w in ws), "t0": ws[0][1], "t1": ws[-1][2], "words": ws})
    json.dump(res, open(os.path.join(out, "lines.json"), "w"), indent=1)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", os.path.join(out, "vo.mp3")], capture_output=True, text=True).stdout)
    print(f"original {words[-1][2]:.1f}s -> {dur:.1f}s ({len(segs)} segments)")
    for r in res: print(f"{r['t0']:6.2f} {r['t1']:6.2f}  {r['text'][:80]}")


if __name__ == "__main__":
    main()
