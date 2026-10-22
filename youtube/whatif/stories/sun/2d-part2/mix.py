"""Sound for lookup: ElevenLabs voice + ElevenLabs SFX placed from timeline.json, mastered to -14 LUFS (two-pass loudnorm).

  python3 sims/lightsout/mix.py                     -> out/sims/sun2d2/mix.wav
  python3 sims/lightsout/mix.py video.mp4 out.mp4   -> also mux onto a silent render
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../.."))
TL = json.load(open(os.path.join(HERE, "timeline.json")))
END = TL["duration"]
A = lambda n: os.path.join(HERE, "audio", f"{n}.mp3")


def graph():
    ins = ["-i", A("vo"), "-stream_loop", "-1", "-i", A("drone")]
    m0, m1 = TL["bedMute"]
    fl = ["[0:a]acompressor=threshold=-20dB:ratio=3:attack=5:release=120,equalizer=f=3000:t=q:w=1:g=2[vo]",
          f"[1:a]atrim=0:{END},volume=-19dB,afade=t=in:d=2,volume='if(between(t,{m0},{m1}),0,1)':eval=frame,afade=t=out:st={END - 2}:d=2[bed]"]
    labels = ["[vo]", "[bed]"]
    for i, (name, st, db, extra) in enumerate(TL["sfx"]):
        ins += ["-i", A(name)]
        ms = int(st * 1000)
        fl.append(f"[{i + 2}:a]{extra + ',' if extra else ''}volume={db}dB,adelay={ms}|{ms}[s{i}]")
        labels.append(f"[s{i}]")
    fl.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0:duration=longest,apad=whole_dur={END},atrim=0:{END},alimiter=limit=0.6:attack=3:release=60:level=false")
    return ins, fl


def main():
    out = os.path.join(ROOT, "out/sims/sun2d2/mix.wav"); os.makedirs(os.path.dirname(out), exist_ok=True)
    ins, fl = graph()
    # pass 1: measure
    r = subprocess.run(["ffmpeg", "-hide_banner", *ins, "-filter_complex", ";".join(fl) + ",loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    m = json.loads(re.findall(r"\{[^{}]*\}", r.stderr)[-1])
    ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
          f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", ";".join(fl) + "," + ln, "-ar", "48000", out], check=True)
    print("->", os.path.relpath(out, ROOT))
    if len(sys.argv) == 3:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", sys.argv[1], "-i", out, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                        "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", "-shortest", sys.argv[2]], check=True)
        print("->", sys.argv[2])


main()
