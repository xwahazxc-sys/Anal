"""Sound for one part of the long video: voice + drone bed + SFX from the part's timeline, -14 LUFS.

  python3 sims/gc2d/mix.py <part> <voice.mp3> <out.wav>
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
part, vo, out = sys.argv[1], sys.argv[2], sys.argv[3]
TL = json.load(open(os.path.join(HERE, "data", f"{part}.timeline.json")))
END = TL["duration"]
A = lambda n: os.path.join(HERE, "audio", f"{n}.mp3")
ins = ["-i", vo, "-stream_loop", "-1", "-i", A("drone")]
m0, m1 = TL.get("bedMute", [999, 1000])
fl = ["[0:a]acompressor=threshold=-20dB:ratio=3:attack=5:release=120,equalizer=f=3000:t=q:w=1:g=2[vo]",
      f"[1:a]atrim=0:{END},volume=-19dB,afade=t=in:d=2,volume='if(between(t,{m0},{m1}),0,1)':eval=frame,afade=t=out:st={END - 2}:d=2[bed]"]
labels = ["[vo]", "[bed]"]
for i, (name, st, db, extra) in enumerate(TL.get("sfx", [])):
    ins += ["-i", A(name)]
    ms = int(st * 1000)
    fl.append(f"[{i + 2}:a]{extra + ',' if extra else ''}volume={db}dB,adelay={ms}|{ms}[s{i}]")
    labels.append(f"[s{i}]")
fl.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0:duration=longest,apad=whole_dur={END},atrim=0:{END},alimiter=limit=0.6:attack=3:release=60:level=false")
r = subprocess.run(["ffmpeg", "-hide_banner", *ins, "-filter_complex", ";".join(fl) + ",loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
m = json.loads(re.findall(r"\{[^{}]*\}", r.stderr)[-1])
ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
      f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", ";".join(fl) + "," + ln, "-ar", "48000", "-ac", "2", out], check=True)
print("->", out)
