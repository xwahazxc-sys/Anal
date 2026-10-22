"""Cut a 15-35 s Short from a finished Night: start/end land in the quietest 50 ms near the given times.

  python cut.py <in.mp4> <start> <end> <out.mp4>
"""
import array, math, subprocess, sys, wave, tempfile, os

def quiet_point(src, t, span=0.6):
    tmp = tempfile.mktemp(suffix=".wav")
    a0 = max(0, t - span)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(a0), "-t", str(2 * span), "-i", src, "-vn", "-ac", "1", "-ar", "16000", tmp], check=True)
    w = wave.open(tmp); sr = w.getframerate(); a = array.array("h", w.readframes(w.getnframes())); os.remove(tmp)
    hop = sr // 50; best = None
    for k in range(0, len(a) // hop - 2):
        seg = a[k * hop:(k + 2) * hop]
        e = math.sqrt(sum(x * x for x in seg) / len(seg))
        # prefer points close to t when energies are similar
        score = e * (1 + 0.6 * abs(a0 + k * hop / sr - t))
        if best is None or score < best[0]:
            best = (score, a0 + (k + 1) * hop / sr)
    return round(best[1], 3)

src, s, e, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
s2, e2 = quiet_point(src, s), quiet_point(src, e)
d = e2 - s2
print(f"cut {s2:.2f}-{e2:.2f} ({d:.1f}s)")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(s2), "-i", src, "-t", str(d),
                "-af", f"afade=t=in:d=0.04,afade=t=out:st={d - 0.35:.2f}:d=0.35",
                "-vf", f"fade=t=out:st={d - 0.3:.2f}:d=0.3",
                "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out], check=True)
