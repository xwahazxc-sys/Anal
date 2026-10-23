"""Synthesised soundtrack for test02 (no third-party audio). Cue times match the beats in scene.html.

  python3 audio.py out/mix.wav
"""
import sys, wave
import numpy as np

SR, D = 48000, 8.1
N = int(SR * D)
T = np.arange(N) / SR
rng = np.random.default_rng(7)


def tone(f, dur, decay=4.0, harm=(1, .5, .25)):
    t = np.arange(int(SR * dur)) / SR
    w = sum(a * np.sin(2 * np.pi * f * (k + 1) * t) for k, a in enumerate(harm))
    return w * np.exp(-decay * t) * np.minimum(1, t / 0.004)


def put(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf): return
    x = x[:len(buf) - i]; buf[i:i + len(x)] += gain * x


def note(n): return 440 * 2 ** ((n - 69) / 12)


# creepy music box, A minor waltz
mus = np.zeros(N)
mel = [81, 76, 72, 76, 81, 77, 76, 72, 71, 72, 76, 74]
for i in range(int(7.3 / .25)):
    t0 = i * .25; m = mel[i % len(mel)]
    put(mus, tone(note(m) * 1.003, 1.2, 3.5, (1, .3, .12)), t0, .22)
    if i % 3 == 0: put(mus, tone(note(m - 24), 1.0, 2.5, (1, .2)), t0, .12)
put(mus, tone(note(mel[0]) * 1.003, .2, 12, (1, .3)), 8.0, .2)   # restart into the loop

sfx = np.zeros(N)
beep = tone(1000, .09, 1, (1,))
dbeep = tone(1300, .07, 1, (1,))


def beeps(a, b, per, x, gain):
    k = 0
    while a + k * per < b:
        put(sfx, x, a + k * per, gain); k += 1


# 0.3 one eye lights (shimmer), 0.45 wink (ding)
t = np.arange(int(SR * .3)) / SR
put(sfx, np.sin(2 * np.pi * (600 + 1800 * t) * t) * np.exp(-6 * t), .3, .08)
put(sfx, tone(note(93), .5, 7, (1, .6, .3)), .45, .35)
put(sfx, tone(note(100), .4, 9, (1, .4)), .5, .18)
# 1.3 monitor spikes while the doctor looks away
beeps(1.3, 1.9, .32, beep, .2)
# 1.9 the pumpkin "switches off" (quick boop down)
t = np.arange(int(SR * .15)) / SR
put(sfx, np.sin(2 * np.pi * (500 - 1500 * t) * t) * np.exp(-12 * t), 1.88, .25)
# 2.4 tension riser while the doctor leans in
t = np.arange(int(SR * .6)) / SR
put(sfx, (np.sin(2 * np.pi * (180 + 500 * t ** 2) * t) * .6 + rng.normal(0, .3, len(t))) * (t / .6) ** 2, 2.4, .25)
# 3.0 blaze: shimmer + fast beeps; 3.4 boom
t = np.arange(int(SR * .4)) / SR
put(sfx, np.sin(2 * np.pi * (300 + 1600 * t) * t) * np.exp(-4 * t), 3.0, .15)
beeps(3.0, 4.6, .32, beep, .22)
t = np.arange(int(SR * 1.2)) / SR
boom = np.sin(2 * np.pi * 70 * np.exp(-1.5 * t) * t) * np.exp(-3 * t) + rng.normal(0, 1, len(t)) * np.exp(-25 * t) * .4
put(sfx, boom, 3.4, .95)
# 4.6 twist: whoosh + pizzicato sting, then the doctor's racing heart
t = np.arange(int(SR * .3)) / SR
put(sfx, rng.normal(0, 1, len(t)) * np.sin(np.pi * t / .3) ** 2, 4.35, .08)
for j, m in enumerate([69, 72, 76, 81, 84]):
    put(sfx, tone(note(m), .4, 14, (1, .4, .2)), 4.6 + j * .08, .3)
beeps(4.7, 7.3, .22, dbeep, .17)
# 7.3 lights: buzz, thunk into darkness
t = np.arange(int(SR * .15)) / SR
put(sfx, np.sign(np.sin(2 * np.pi * 100 * t)) * .5, 7.3, .12)
put(sfx, tone(90, .3, 12, (1, .5)), 7.45, .5)

duck = np.ones(N)
duck[(T > 1.3) & (T < 1.95)] = 0.0       # comedic pause while the doctor looks away
duck[(T > 3.4) & (T < 4.0)] = .5
duck[(T > 7.45) & (T < 7.95)] = 0
mix = np.tanh((mus * duck + sfx) * 1.2) * .8
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.stack([mix, mix], 1) * 32767).astype(np.int16).tobytes())
