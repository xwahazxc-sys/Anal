"""Narration through ElevenLabs, run inside GitHub Actions (the key lives only in the ELEVENLABS_API_KEY secret).

  python youtube/whatif/tts/tts.py <script.txt> <out_dir>      # one take of the whole script
  python youtube/whatif/tts/tts.py --quota                     # characters left this month

Writes <out_dir>/<name>.mp3 and, when the API returns it, <name>.alignment.json (character timings).
Voice and settings match Nights 1–3: "True – Crime & Horror Narrator", eleven_v3, stability 0.5.
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

VOICE = "tZssYepgGaQmegsMEXjK"
MODEL = "eleven_v3"
API = "https://api.elevenlabs.io/v1"


def call(path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None,
                                 headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "Content-Type": "application/json"},
                                 method="POST" if body else "GET")
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read()


def quota():
    """Characters left; None when the key has no "User: read" permission (TTS still works)."""
    try:
        s = json.loads(call("/user/subscription"))
    except urllib.error.HTTPError as e:
        print("quota: not readable with this key (HTTP", e.code, ") — continuing")
        return None
    used, limit = s.get("character_count", 0), s.get("character_limit", 0)
    print(f"quota: {used}/{limit} used, {limit - used} left, resets {s.get('next_character_count_reset_unix')}")
    return limit - used


def main():
    if not os.environ.get("ELEVENLABS_API_KEY"):
        sys.exit("ELEVENLABS_API_KEY secret is not set")
    if sys.argv[1] == "--quota":
        quota()
        return
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    text = src.read_text().strip()
    left = quota()
    print(f"script: {src.name}, {len(text)} characters")
    if left is not None and len(text) > left:
        sys.exit("not enough characters left this month")
    body = {"text": text, "model_id": MODEL,
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}}
    name = src.stem
    try:
        r = json.loads(call(f"/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128", body))
        (out / f"{name}.mp3").write_bytes(base64.b64decode(r["audio_base64"]))
        (out / f"{name}.alignment.json").write_text(json.dumps(r.get("alignment") or r.get("normalized_alignment")))
    except urllib.error.HTTPError as e:
        print("with-timestamps failed:", e.code, e.read()[:300].decode(errors="replace"))
        try:
            (out / f"{name}.mp3").write_bytes(call(f"/text-to-speech/{VOICE}?output_format=mp3_44100_128", body))
        except urllib.error.HTTPError as e2:
            sys.exit(f"TTS failed: HTTP {e2.code} {e2.read()[:300].decode(errors='replace')}")
    print("wrote", out / f"{name}.mp3", (out / f"{name}.mp3").stat().st_size, "bytes")
    quota()


if __name__ == "__main__":
    main()
