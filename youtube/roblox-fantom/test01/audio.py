"""Synthesised soundtrack for test01 (no third-party audio): music box, monitor beeps, boom, sting, light buzz.
Cue times match the beats in scene.html.

  python3 audio.py out/mix.wav
"""
import sys, wave
import numpy as np

SR, D = 48000, 8.0
N = int(SR * D)
t_all = np.arange(N) / SR


def tone(f, dur, decay=4.0, harm=(1, .5, .25), vib=0.0):
    t = np.arange(int(SR * dur)) / SR
    w = sum(a * np.sin(2 * np.pi * f * (k + 1) * t + vib * np.sin(2 * np.pi * 5 * t)) for k, a in enumerate(harm))
    env = np.exp(-decay * t) * np.minimum(1, t / 0.004)
    return w * env


def put(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf): return
    x = x[:len(buf) - i]
    buf[i:i + len(x)] += gain * x


def note(n):  # MIDI -> Hz
    return 440 * 2 ** ((n - 69) / 12)


mus = np.zeros(N)
# creepy music box: A minor waltz with a flat-6 twist, slightly detuned
mel = [81, 76, 72, 76, 81, 77, 76, 72, 71, 72, 76, 74]
step = 0.25
for i in range(int(7.3 / step)):
    t0 = i * step
    m = mel[i % len(mel)]
    put(mus, tone(note(m) * 1.003, 1.2, decay=3.5, harm=(1, .3, .12)), t0, .22)
    if i % 3 == 0:
        put(mus, tone(note(m - 24), 1.0, decay=2.5, harm=(1, .2)), t0, .12)
# restart at the loop point so the end runs into the beginning
put(mus, tone(note(mel[0]) * 1.003, .2, decay=12, harm=(1, .3)), 7.95, .2)

sfx = np.zeros(N)
beep = tone(1000, .09, decay=1, harm=(1,))
for k in range(4):                       # slow heartbeat monitor, flat patient
    put(sfx, beep, k * .75, .18)
k = 0
while True:                              # fast beeps once the pumpkin lights up
    tb = 3.0 + k * .32
    if tb >= 7.3: break
    put(sfx, beep * 1.0, tb, .2); k += 1
# pumpkin lights up: rising shimmer
t = np.arange(int(SR * .5)) / SR
put(sfx, np.sin(2 * np.pi * (300 + 1400 * t) * t) * np.minimum(1, t / .3) * np.exp(-3 * t), 2.95, .12)
# boom when the doctor jumps
t = np.arange(int(SR * 1.2)) / SR
boom = np.sin(2 * np.pi * (70 * np.exp(-1.5 * t)) * t * 1.0) * np.exp(-3 * t)
boom += np.random.default_rng(1).normal(0, 1, len(t)) * np.exp(-25 * t) * .4
put(sfx, boom, 4.6, .9)
# whoosh + pizzicato sting on "trick or treat?"
t = np.arange(int(SR * .35)) / SR
put(sfx, np.random.default_rng(2).normal(0, 1, len(t)) * np.sin(np.pi * t / .35) ** 2, 5.75, .08)
for j, m in enumerate([69, 72, 76, 81]):
    put(sfx, tone(note(m), .4, decay=14, harm=(1, .4, .2)), 6.0 + j * .09, .3)
# lights flicker: electrical buzz, then a thunk into darkness
t = np.arange(int(SR * .15)) / SR
put(sfx, np.sign(np.sin(2 * np.pi * 100 * t)) * .5, 7.3, .12)
put(sfx, tone(90, .3, decay=12, harm=(1, .5)), 7.45, .5)

mix = mus + sfx
# duck the music under the boom, silence while the lights are out
duck = np.ones(N)
duck[(t_all > 4.6) & (t_all < 5.2)] = .5
duck[(t_all > 7.45) & (t_all < 7.9)] = 0
mix = mus * duck + sfx
mix = np.tanh(mix * 1.2) * .8
st = np.stack([mix, mix], 1)
out = sys.argv[1]
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype(np.int16).tobytes())
