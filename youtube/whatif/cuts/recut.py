"""Recut a finished Short into the looping format: the scariest moment first, then the story up to it.

  python recut.py <in.mp4> <out.mp4> a1-b1 a2-b2 ...

Segments are source times in seconds, played in the given order. Every boundary is moved to the
quietest 40 ms within 0.25 s, so cuts land between words. Make the last segment end where the first
one starts: then the end of the video runs straight into its beginning when it loops.
"""
import array, math, os, subprocess, sys, tempfile, wave


def quiet_point(src, t, span=0.25):
    if t <= 0.05:
        return 0.0
    tmp = tempfile.mktemp(suffix=".wav")
    a0 = max(0, t - span)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(a0), "-t", str(2 * span), "-i", src, "-vn", "-ac", "1", "-ar", "16000", tmp], check=True)
    w = wave.open(tmp); sr = w.getframerate(); a = array.array("h", w.readframes(w.getnframes())); os.remove(tmp)
    hop = sr // 50; best = None
    for k in range(0, len(a) // hop - 1):
        seg = a[k * hop:(k + 2) * hop]
        e = math.sqrt(sum(x * x for x in seg) / max(1, len(seg)))
        score = e * (1 + 0.8 * abs(a0 + (k + 1) * hop / sr - t))
        if best is None or score < best[0]:
            best = (score, a0 + (k + 1) * hop / sr)
    return round(best[1], 3)


def main():
    src, out = sys.argv[1], sys.argv[2]
    segs = [tuple(float(v) for v in s.split("-")) for s in sys.argv[3:]]
    cache = {}
    q = lambda t: cache.setdefault(t, quiet_point(src, t))
    segs = [(q(a), q(b)) for a, b in segs]
    fl, labels = [], []
    for i, (a, b) in enumerate(segs):
        d = b - a
        fl.append(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS[v{i}]")
        fl.append(f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st={d - 0.03:.3f}:d=0.03[a{i}]")
        labels.append(f"[v{i}][a{i}]")
    fl.append("".join(labels) + f"concat=n={len(segs)}:v=1:a=1[v][a]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex", ";".join(fl), "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out], check=True)
    total = sum(b - a for a, b in segs)
    print(f"{os.path.basename(out)}: " + " + ".join(f"{a:.2f}-{b:.2f}" for a, b in segs) + f" = {total:.1f}s")


if __name__ == "__main__":
    main()
