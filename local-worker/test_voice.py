#!/usr/bin/env python3
"""Quick local check that voice works: one sentence per language with the built-in voice.

    venv\\Scripts\\activate
    python test_voice.py

Writes test_de.wav, test_en.wav, test_fr.wav, test_it.wav next to this file and prints, for each,
how long it took and how well Whisper understood it (score 1.0 = every word heard as written).
Listen to the files: this is the sound the channels will get before any voice cloning.
"""
import os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import soundfile as sf
import tts

TEXTS = {
    "de": "Erinnerst du dich noch an die Samstagabende im Jahr neunzehnhundertfünfundsiebzig? "
          "Die ganze Familie saß vor dem Fernseher, und es gab Erdnussflips.",
    "en": "The alien doctor laughed at human pain tolerance. Then he watched his first marathon, "
          "and he never laughed again.",
    "fr": "Pendant trois ans, une bête mystérieuse a terrorisé les villages du Gévaudan. "
          "Personne ne savait vraiment ce que c'était.",
    "it": "Ti ricordi quanto costava un caffè al bar nel millenovecentosessantacinque? "
          "Pensaci bene prima di rispondere.",
}

print("Loading voice model (first time takes a minute)...", flush=True)
t0 = time.time()
m = tts.model()
print(f"loaded in {time.time() - t0:.0f} s on {m.device}\n", flush=True)
for lang, text in TEXTS.items():
    t = time.time()
    wav = m.generate(text, language_id=lang)
    path = os.path.join(HERE, f"test_{lang}.wav")
    sf.write(path, wav.squeeze(0).cpu().numpy(), m.sr)
    took = time.time() - t
    seconds = wav.shape[-1] / m.sr
    score, heard = tts.score(path, text, lang, "small")
    print(f"{lang}: {seconds:4.1f} s of speech in {took:4.1f} s, check score {score}  -> {os.path.basename(path)}")
    print(f"    heard: {heard.strip()}\n", flush=True)
print("Done. Open the test_*.wav files in this folder and listen.")
