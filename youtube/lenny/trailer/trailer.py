"""Sound design for the Lenny trailer. Every time comes from trailer.json.

    python3 -m sfx sfx/cues/trailer.py

Key: D minor. One riser, one impact (the 7). Mastered quieter than -14 because the
voice-over is mixed on top afterwards and the final mix is normalised there.
"""

from sfx.synth import blip, chime, click, envelope, impact, pad, pop, riser, whoosh

TIMELINE = "trailer.json"
OUT = "public/trailer-sfx.wav"
TARGET_LUFS = -20.0

BED_A = [73.42, 146.83, 220.0, 293.66, 349.23]          # Dm(add octave)
BED_B = [73.42, 146.83, 174.61, 261.63, 349.23, 440.0]  # Dm7 colour after the 7
BED_C = [73.42, 146.83, 220.0, 293.66, 440.0, 587.33]   # D minor, open, for the title
CARD_NOTES = [293.66, 329.63, 349.23, 392.0, 440.0, 466.16]  # D E F G A Bb: climbing


def score(mix, tl):
    o, m, s, l, ti = tl["open"], tl["montage"], tl["seven"], tl["lenny"], tl["title"]
    dur = tl["duration"]
    put = mix.put

    vol = envelope([
        (0, 0.0), (1.5, 0.8), (m["riser"], 1.0), (s["hit"] - 0.05, 1.2), (s["hit"] + 0.1, 0.25),
        (s["through"], 0.6), (l["in"], 0.9), (ti["in"], 0.7), (ti["line2"], 1.15), (dur - 1.0, 1.0), (dur, 0.0),
    ])
    mix.put_stereo(0, *pad(dur, [(0, BED_A), (s["hit"], BED_B), (ti["in"], BED_C)], volume=vol), gain=0.05)

    # cold open: typing label, the notification lands, the line reveals
    mix.typing(o["label"], o["label"] + 0.7, 19)
    put(o["notif"], whoosh(0.35, 900, 3000, peak=0.5), 0.08, 0.5)
    put(o["notif"] + 0.18, pop(880, 1320), 0.16, 0.5)
    put(o["notif"] + 0.22, chime([1174.66, 1760.0], dur=0.9, tau=0.3), 0.06, 0.5)
    put(o["line1"], whoosh(0.5, 300, 1800, peak=0.55), 0.12, -0.4)
    put(o["line1"] + 0.5, blip(146.83, dur=0.5, tau=0.2), 0.18)

    # montage: each wipe gets a short air pass and a note that climbs the scale
    for i, c in enumerate(m["cards"]):
        pan = -0.6 + 1.2 * (i % 2)
        put(c - 0.06, whoosh(0.34, 400, 2600, peak=0.6), 0.12, pan)
        put(c + 0.14, blip(CARD_NOTES[i], dur=0.4, tau=0.14), 0.12, pan * 0.5)
        put(c + 0.05, click(1400, 0.04), 0.06, pan)
    put(m["riser"], riser(s["hit"] - m["riser"], 180, 4200), 0.16)

    # the hero: the 7
    put(s["hit"], impact(1.8), 0.34)
    put(s["hit"] + 0.02, chime([146.83, 220.0, 349.23], dur=3.0, tau=1.2), 0.06)
    put(s["through"], whoosh(1.1, 2600, 300, peak=0.3), 0.16)
    put(s["anna"] + 0.15, pop(1046.5, 1568.0), 0.14, 0.4)

    # Lenny: light sweep, lower third, the line
    put(l["in"] + 0.2, whoosh(1.6, 200, 900, peak=0.5), 0.08, -0.3)
    put(l["lower"] + 0.1, click(1600, 0.05), 0.08, -0.5)
    put(l["lower"] + 0.12, blip(293.66, dur=0.5, tau=0.2), 0.12, -0.5)
    put(l["swap"], whoosh(0.6, 500, 1600, peak=0.5), 0.08)
    put(l["line"] + 0.4, blip(220.0, dur=0.5, tau=0.2), 0.14)

    # title: the line rises, the red title lands on a D minor chord
    put(ti["line1"], whoosh(0.55, 300, 2000, peak=0.6), 0.1)
    put(ti["line2"], whoosh(0.8, 2400, 400, peak=0.2), 0.12)
    put(ti["line2"] + 0.05, chime([293.66, 349.23, 440.0, 587.33], dur=3.2, tau=1.3), 0.12)
    put(ti["sub"] + 0.2, blip(587.33, dur=0.4, tau=0.15), 0.08)
