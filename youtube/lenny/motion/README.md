# Lenny motion-comic pipeline (no paid APIs)

Reference art from `../refs/` → cutouts (`rembg`, model `isnet-general-use`) → animated in `motion.html` (parallax, camera moves, voice-driven bounce, UI overlays, captions) → `build_motion.py` adds Piper voice (pitched +9%) and synthesized SFX/music bed → `lenny_cold_open.mp4`.

```bash
pip install piper-tts imageio-ffmpeg playwright "rembg[cpu]"
# voice lines: see lines.json; regenerate audio/N.wav with Piper en_US-ryan-high, length_scale 1.08, then asetrate*1.09
python3 build_motion.py preview 3 9   # frames
python3 build_motion.py               # full render
```

## Talking rig (`rig.py`)
OpenCV puppet rig on `lenny_point.png`: head tilt/nod around the neck, breathing, eyelid blinks, and a mouth that opens with the voice envelope (jaw warp + painted interior). Landmarks are hard-coded for this image — a new pose needs its eye/mouth/neck coordinates. `build_motion.py` renders `rig/NNNNN.png` for the talking shot and `motion.html` swaps them in per frame.
