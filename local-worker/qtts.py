"""Qwen3-TTS voice jobs. Runs inside venv-qwen (its own transformers version), started by worker.py.

    venv-qwen\\Scripts\\python qtts.py job.json out_dir

Job (type "qtts"):
{
  "id": "voice-test-1", "type": "qtts",
  "voices": [                                   # 1) design voices from a description ...
    {"name": "deep_male", "lang": "English",
     "instruct": "Male narrator in his 40s, deep warm baritone, calm documentary storytelling, unhurried"}
  ],
  "clone": {"ref": "voices/x.wav", "ref_text": "...", "lang": "English"},   # 2) ... or clone a sample
  "text": "Paragraph one.\\nParagraph two.",    # read with every voice; newline = longer pause
  "pause_ms": 450, "para_pause_ms": 1000
}
Designed voices: the first sentence is generated with the VoiceDesign model and then used as the
reference for the Base model, so the voice stays the same over a long text.
Output: <name>.wav for every voice, <name>_reference.wav (reusable sample).
"""
import json, os, re, sys

import numpy as np
import soundfile as sf
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, "models")


def load(name):
    from qwen_tts import Qwen3TTSModel
    return Qwen3TTSModel.from_pretrained(os.path.join(MODELS, name), device_map="cuda:0",
                                         dtype=torch.bfloat16, attn_implementation="sdpa")


def sentences(par):
    out = []
    for s in re.split(r"(?<=[.!?…])\s+", par.strip()):
        if out and len(out[-1]) + len(s) < 160:
            out[-1] += " " + s
        elif s:
            out.append(s)
    return out


def main(job_path, out_dir):
    job = json.load(open(job_path, encoding="utf-8"))
    os.makedirs(out_dir, exist_ok=True)
    paras = [p for p in job["text"].split("\n") if p.strip()]
    refs = []  # (name, lang, (wav, sr), ref_text)
    if job.get("voices"):
        design = load("Qwen3-TTS-12Hz-1.7B-VoiceDesign")
        ref_text = job.get("ref_text") or sentences(paras[0])[0]
        for v in job["voices"]:
            torch.manual_seed(v.get("seed", 1))
            wavs, sr = design.generate_voice_design(text=ref_text, language=v["lang"], instruct=v["instruct"])
            sf.write(os.path.join(out_dir, f"{v['name']}_reference.wav"), wavs[0], sr)
            refs.append((v["name"], v["lang"], (wavs[0], sr), ref_text))
            print(f"  designed {v['name']}", flush=True)
        del design
        torch.cuda.empty_cache()
    if job.get("clone"):
        c = job["clone"]
        wav, sr = sf.read(c["ref_path"])
        refs.append((c.get("name", "clone"), c["lang"], (wav, sr), c["ref_text"]))
    base = load("Qwen3-TTS-12Hz-1.7B-Base")
    for name, lang, ref, ref_text in refs:
        prompt = base.create_voice_clone_prompt(ref_audio=ref, ref_text=ref_text)
        pieces, sr = [], None
        for p in paras:
            for s in sentences(p):
                torch.manual_seed(7)
                wavs, sr = base.generate_voice_clone(text=s, language=lang, voice_clone_prompt=prompt)
                pieces.append(np.asarray(wavs[0], dtype=np.float32))
                pieces.append(np.zeros(int(sr * job.get("pause_ms", 450) / 1000), np.float32))
            pieces.append(np.zeros(int(sr * (job.get("para_pause_ms", 1000) - job.get("pause_ms", 450)) / 1000),
                                   np.float32))
        sf.write(os.path.join(out_dir, f"{name}.wav"), np.concatenate(pieces), sr)
        print(f"  read text with {name}", flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
