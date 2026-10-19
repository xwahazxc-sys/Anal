"""Sound design for a Lenny episode, read from public/<slug>/ep.json.

    EP=ep02 python3 -m sfx sfx/cues/episode.py

Quiet and motivated only: no whoosh on cuts (the viewer hated it). Sounds come from
things on screen: the phone notification, the stamp, ticks on list items, chapter
cards land on a low D. One riser + one impact for the whole episode (the title sting).
Key: D minor.
"""
import json, os

from sfx.synth import blip, chime, click, impact, pop, riser

EP = os.environ.get("EP", "ep02")
TIMELINE = f"public/{EP}/ep.json"
OUT = f"public/{EP}/sfx.wav"
TARGET_LUFS = -20.0

D2, D3, F3, A3, D4, F4, A4, D5 = 73.42, 146.83, 174.61, 220.0, 293.66, 349.23, 440.0, 587.33


def score(mix, tl):
    put = mix.put
    hero_done = False
    for g in tl["segs"]:
        o, s, e = g.get("ov") or {}, g["s"], g["e"]
        t = o.get("t")
        if t == "title" and not o.get("n") and not hero_done:
            hero_done = True
            put(max(0, s - 1.6), riser(1.6, 160, 3600), 0.10)
            put(s + 0.05, impact(1.6), 0.26)
            put(s + 0.1, chime([D3, A3, F4], dur=2.6, tau=1.0), 0.05)
        elif t == "title":
            put(s + 0.15, blip(D2, dur=1.4, tau=0.55), 0.30)
            put(s + 0.2, chime([D4, A4], dur=1.8, tau=0.7), 0.05)
            put(s + 0.25, click(1300, 0.04), 0.05)
        elif t == "notif":
            put(s + 0.3, pop(880, 1320), 0.13, 0.4)
            put(s + 0.34, chime([1174.66, 1760.0], dur=0.9, tau=0.3), 0.05, 0.4)
        elif t == "stamp":
            at = s + o.get("at", 0.25)
            put(at, blip(D3, dur=0.5, tau=0.18), 0.22)
            put(at, click(900, 0.06), 0.12)
        elif t in ("chips", "list"):
            for i, _ in enumerate(o["items"]):
                put(s + 0.5 + i * 0.32, click(1500 + 120 * i, 0.04), 0.06, -0.3)
        elif t == "cards":
            for i, it in enumerate(o["items"]):
                put(s + 0.65 + i * 0.22, click(1400 + 60 * i, 0.035), 0.05, -0.4 + 0.1 * i)
            put(s + 0.65 + len(o["items"]) * 0.22, chime([D4, F4, A4], dur=1.6, tau=0.6), 0.05)
        elif t == "big":
            at = s + o.get("at", 0.25)
            put(at, blip(D3, dur=0.8, tau=0.3), 0.16)
            put(at + 2.2, chime([A4, D5], dur=1.4, tau=0.5), 0.05)
        elif t == "quote":
            put(s + 0.4, chime([D4, A4], dur=2.0, tau=0.8), 0.04)
        elif t == "call":
            for k in range(3):
                put(s + 0.3 + k * 2.0, chime([A4, F4], dur=0.8, tau=0.25), 0.06)
        elif t in ("lower", "sub", "tag"):
            put(s + 0.6, blip(D4, dur=0.4, tau=0.15), 0.08, -0.4)
        elif t == "end":
            put(s + 0.2, chime([D3, A3, D4, F4, A4], dur=3.0, tau=1.2), 0.08)
