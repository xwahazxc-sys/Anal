"""Voice jobs: Chatterbox Multilingual + automatic listening check with Whisper.

Job example (jobs/pending/kif-ep01-voice.json):
{
  "id": "kif-ep01-voice", "type": "tts", "lang": "de",
  "voice": "voices/kindheit_narrator.wav",      # 10-20 s clean sample on the queue branch; omit = built-in voice
  "text": "Erinnerst du dich an ...",           # keep one job under ~15 minutes of speech
  "exaggeration": 0.5, "cfg_weight": 0.5, "temperature": 0.8,
  "pause_ms": 300, "retries": 3
}
Output: narration.flac + report.json (score per sentence; low scores are flagged for Claude).

How the check works: every chunk is transcribed by Whisper and compared with the script.
If words were swallowed or garbled, the chunk is generated again (up to `retries`), and the
best take is kept.
"""
import difflib, io, json, os, re, tempfile

_tts = None
_asr = None


def split(text, limit=240):
    """Sentences, merged up to `limit` chars; long sentences are cut at commas."""
    parts = []
    for s in re.split(r"(?<=[.!?…])\s+", text.strip()):
        while len(s) > limit:
            cut = s.rfind(",", 0, limit)
            cut = cut + 1 if cut > 40 else limit
            parts.append(s[:cut].strip()); s = s[cut:].strip()
        if s:
            parts.append(s)
    out = []
    for p in parts:
        if out and len(out[-1]) + len(p) + 1 <= limit // 2:
            out[-1] += " " + p
        else:
            out.append(p)
    return out


HERE = os.path.dirname(os.path.abspath(__file__))


def local(name):
    """Models fetched by `python download_models.py voice` (works where Hugging Face is blocked)."""
    d = os.path.join(HERE, "models", name)
    return d if os.path.isdir(d) else None


def model():
    global _tts
    if _tts is None:
        import torch
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        dev = "cuda" if torch.cuda.is_available() else "cpu"
        d = local("chatterbox")
        _tts = ChatterboxMultilingualTTS.from_local(d, dev) if d else ChatterboxMultilingualTTS.from_pretrained(dev)
    return _tts


def asr(size):
    global _asr
    if _asr is None:
        from faster_whisper import WhisperModel
        src = local(f"faster-whisper-{size}") or size
        try:
            _asr = WhisperModel(src, device="cuda", compute_type="float16")
        except Exception:  # missing CUDA libs for CTranslate2 -> CPU is fine for checking
            _asr = WhisperModel(src, device="cpu", compute_type="int8")
    return _asr


def norm(s):
    return re.sub(r"[^\w ]+", "", s.lower()).split()


def score(path, text, lang, size):
    segs, _ = asr(size).transcribe(path, language=lang, beam_size=1)
    heard = " ".join(s.text for s in segs)
    return round(difflib.SequenceMatcher(None, norm(text), norm(heard)).ratio(), 3), heard


def run(job, fetch, cfg):
    import torch, soundfile as sf
    m = model()
    lang = job["lang"]
    threshold = job.get("threshold", cfg.get("tts_threshold", 0.85))
    size = cfg.get("whisper_model", "small")
    tmp = tempfile.mkdtemp(prefix="tts_")
    voice = None
    if job.get("voice"):
        voice = os.path.join(tmp, "voice" + os.path.splitext(job["voice"])[1])
        open(voice, "wb").write(fetch(job["voice"]))
    gap = torch.zeros(1, int(m.sr * job.get("pause_ms", 300) / 1000))
    pieces, report = [], []
    for i, chunk in enumerate(split(job["text"])):
        best = None
        for take in range(job.get("retries", 3)):
            wav = m.generate(chunk, language_id=lang, audio_prompt_path=voice,
                             exaggeration=job.get("exaggeration", 0.5),
                             cfg_weight=job.get("cfg_weight", 0.5),
                             temperature=job.get("temperature", 0.8))
            p = os.path.join(tmp, f"c{i}_{take}.wav")
            sf.write(p, wav.squeeze(0).cpu().numpy(), m.sr)
            sc, heard = score(p, chunk, lang, size)
            if best is None or sc > best[0]:
                best = (sc, wav, heard, take + 1)
            if sc >= threshold:
                break
        pieces += [best[1].cpu(), gap]
        report.append({"n": i, "text": chunk, "heard": best[2], "score": best[0], "takes": best[3],
                       "flag": best[0] < threshold})
        print(f"    chunk {i}: score {best[0]} after {best[3]} take(s)", flush=True)
    audio = torch.cat(pieces, dim=1).squeeze(0).numpy()
    buf = io.BytesIO()
    sf.write(buf, audio, m.sr, format="FLAC")
    flagged = sum(r["flag"] for r in report)
    summary = {"chunks": len(report), "flagged": flagged, "seconds": round(len(audio) / m.sr, 1),
               "sample_rate": m.sr, "chunks_detail": report}
    return {"narration.flac": buf.getvalue(),
            "report.json": json.dumps(summary, indent=1, ensure_ascii=False).encode()}
