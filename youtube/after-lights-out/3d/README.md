# After Lights Out — Ep.1 in 3D (claude-motion sim)

The same episode rebuilt as a three.js sim for [claude-motion](https://github.com/whaleyxbt/claude-motion) (`sims/` pipeline): one 3D apartment 4B + the hallway, moonlight through the blinds with real shadows and a volumetric beam, dust in the light, a warm gap under the door, IR-lit security-camera shots, the phone UI as a live screen texture (`chat.js`), depth of field on phone shots, motion blur on fast moves, split-tone grade + grain.

Install into a claude-motion checkout and render:

```bash
cp -r . <claude-motion>/sims/lightsout && cp ../video/audio/*.mp3 <claude-motion>/sims/lightsout/audio/ && cp audio/vo_true_v3.mp3 <claude-motion>/sims/lightsout/audio/vo.mp3
cd <claude-motion>
node sims/build.mjs lightsout
node sims/capture.mjs lightsout --size 1080x1920 --dpr 1 --stills 2,22,52,76 --cols 4 --out out/sims/lo-review.png
for k in 0 1 2 3; do node sims/capture.mjs lightsout --size 1080x1920 --dpr 1 --fps 30 --from A --to B --out out/sims/lo-parts/$k.mp4 & done
python3 sims/lightsout/mix.py out/sims/lo-video.mp4 out/sims/after_lights_out_ep01_3d.mp4
```
Beats, shots, chat messages and the SFX cue sheet: `timeline.json`. Voice word timings: `lines.json`.
On a software GPU (SwiftShader) a frame takes ~2–3 s; the 3D renders at 0.8 scale (`GL_SCALE`) and is upscaled, titles stay full-res.

Voice: ElevenLabs library voice **True – Crime & Horror Narrator** (`tZssYepgGaQmegsMEXjK`), model `eleven_v3` with audio tags (`vo.txt`), stability 0.5. The timeline was retimed from the first voice by mapping every line's start/end.
