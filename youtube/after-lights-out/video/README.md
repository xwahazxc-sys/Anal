# After Lights Out — Ep.1 "The Group Chat" (vertical Short, 1080×1920, 77.5 s)

Cinematic 2D motion graphics drawn in a canvas, frame by frame (`scene.html`, pure `render(t)`), rendered headless in Chromium, encoded with ffmpeg.

- **Voice:** ElevenLabs, voice *Brian*, `eleven_multilingual_v2`, speed 0.92 → `audio/vo.mp3`. Word timings in `lines.json` drive the captions and the cuts.
- **Sound design:** ElevenLabs Sound Effects → `audio/*.mp3` (drone, hum, vibrate, ping, riser, impact, click, heartbeat). Mixed in `build.py` (`SFX` table), loudnorm −14 LUFS.
- **Look:** parallax layers (fg/mid/bg) with depth-of-field blur, volumetric light (moon through blinds, fluorescent tubes, warm gap under the door), dust only inside light volumes, inertial camera (eased moves + slow handheld drift), 180° motion blur (3 subframes, 8 on fast moves), split-tone grade, vignette, fine grain.

```bash
pip install playwright
python3 build.py preview 5 20 50 68               # stills -> previews/
for k in 0 1 2 3; do python3 build.py chunk $k 4 & done; wait
python3 build.py mux 4                            # -> after_lights_out_ep01.mp4
```

Shot list and timings: `SHOTS` in `scene.html`. Chat messages: `MSGS` / `TYPING`. Script: `vo.txt` (`../ep01-the-group-chat.md`).
Night 2: copy this folder, rewrite `vo.txt`, regenerate the voice with timestamps → `lines.json`, then edit `SHOTS`/`MSGS`.
