# Long video: 7 Scams That Don't Look Like Scams (8:06, 1920x1080)

Script: `../../7-scams-long.txt`. `beats.json` = script split into beats/sentences; `items.json` = per-sentence clips (text shown, text spoken, duration) — regenerate audio with Piper `en_US-ryan-high`, `length_scale=1.28` into `audio/NNN.wav`.

```bash
python3 build_long.py timeline        # timeline.json + voice.wav (8:05.7)
python3 build_long.py preview 95 255  # check frames
for k in 0 1 2 3; do python3 build_long.py chunk $k 4 & done; wait
python3 build_long.py mux 4           # -> 7_scams_long.mp4 (loudnorm -14 LUFS)
```
`thumb.html` renders the 1280x720 thumbnail. Elements in `scene.html` appear on sentence `data-s` (+`data-d` s) and leave on `data-out`.

## Cartoon style (test: first 69 s)
`cartoon.html` draws every frame as SVG: Sam (victim), the fox (scammer), the phone mascot (narrator, mouth driven by the voice envelope). `python3 cartoon_build.py preview 25` / `chunk K N` / `mux N` → `cartoon_test.mp4`. Needs `timeline.json` + `voice.wav` from `build_long.py timeline`.
