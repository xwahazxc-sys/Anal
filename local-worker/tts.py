"""Voice jobs: Chatterbox Multilingual + automatic listening check with Whisper.

Job example (jobs/pending/kif-ep01-voice.json):
{
  "id": "kif-ep01-voice", "type": "tts", "lang": "de",
  "voice": "voices/kindheit_narrator.wav",      # 10-20 s clean sample on the queue branch; omit = built-in voice
  "text": "Erinnerst du dich an ...",           # keep one job under ~15 minutes of speech
  "exaggeration": 0.5, "cfg_weight": 0.5, "temperature": 0.8,
  "pause_ms": 300, "para_pause_ms": 900, "retries": 3,
  "say": {"Longyearbyen": "Long-year-bee-en"}   # pronunciation fixes: spoken text only
}
Output: narration.flac + report.json (score per sentence; low scores are flagged for Claude).

How the check works: every chunk is transcribed by Whisper and compared with the script.
If words were swallowed or garbled, the chunk is generated again (up to `retries`), and the
best take is kept. The kept take is trimmed to the words Whisper matched, which removes the
mumbles and breaths Chatterbox sometimes adds after the last word.
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
    """Similarity of what Whisper heard to the text, plus the time span of the matched words."""
    segs, _ = asr(size).transcribe(path, language=lang, beam_size=1, word_timestamps=True)
    words = [w for s in segs for w in (s.words or [])]
    heard = " ".join(w.word.strip() for w in words)
    hw, spans = [], []
    for w in words:
        for t in norm(w.word):
            hw.append(t); spans.append((w.start, w.end))
    tw = norm(text)
    sm = difflib.SequenceMatcher(None, tw, hw)
    blocks = [(a, b, n) for a, b, n in sm.get_matching_blocks() if n]
    span = None
    if blocks:
        # trim only where the text's own first/last word was heard; otherwise (e.g. a number Whisper
        # wrote as digits) keep that edge untouched so no real speech is cut
        a0, b0, _ = blocks[0]
        a1, b1, n1 = blocks[-1]
        start = spans[b0][0] if a0 == 0 else 0.0
        end = spans[b1 + n1 - 1][1] if a1 + n1 == len(tw) else None
        span = (start, end)
    # extra words after the text (mumbles) cost less than missing ones but still count
    return round(sm.ratio(), 3), heard, span


def trim(wav, sr, span, total):
    """Keep only the matched words (+ small margins)."""
    if not span:
        return wav
    a = max(0, int((span[0] - 0.08) * sr))
    b = wav.shape[-1] if span[1] is None else min(wav.shape[-1], int((span[1] + 0.18) * sr))
    if b - a < 0.3 * sr:
        return wav
    fade = int(0.03 * sr)
    out = wav[..., a:b].clone()
    import torch
    out[..., -fade:] *= torch.linspace(1, 0, fade)
    return out


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
    para = torch.zeros(1, int(m.sr * job.get("para_pause_ms", 900) / 1000))
    say = job.get("say", {})
    chunks = []  # (text, ends_paragraph)
    for block in [b for b in job["text"].split("\n") if b.strip()]:
        cs = split(block)
        chunks += [(c, k == len(cs) - 1) for k, c in enumerate(cs)]
    pieces, report = [], []
    for i, (chunk, last_in_para) in enumerate(chunks):
        spoken = chunk
        for k, v in say.items():
            spoken = spoken.replace(k, v)
        best = None
        for take in range(job.get("retries", 3)):
            wav = m.generate(spoken, language_id=lang, audio_prompt_path=voice,
                             exaggeration=job.get("exaggeration", 0.5),
                             cfg_weight=job.get("cfg_weight", 0.5),
                             temperature=job.get("temperature", 0.8))
            p = os.path.join(tmp, f"c{i}_{take}.wav")
            sf.write(p, wav.squeeze(0).cpu().numpy(), m.sr)
            sc, heard, span = score(p, spoken.replace('-', ' '), lang, size)
            if best is None or sc > best[0]:
                best = (sc, trim(wav.cpu(), m.sr, span, wav.shape[-1]), heard, take + 1)
            if sc >= threshold:
                break
        pieces += [best[1].cpu(), para if last_in_para else gap]
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
