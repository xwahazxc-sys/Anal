# Video pipeline (test Short: delivery text)

Motion-graphics video rendered from `scene.html` frame by frame in Chromium, voiced with Piper TTS, encoded with ffmpeg.

```bash
pip install piper-tts imageio-ffmpeg playwright
mkdir -p voice audio && cd voice
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx.json
cd .. && python3 -c "import json,subprocess;[subprocess.run(['python3','-m','piper','-m','voice/en_US-ryan-high.onnx','-f',f'audio/{i}.wav','--sentence-silence','0.25'],input=t.encode(),check=True) for i,t in enumerate(json.load(open('lines.json')))]"
python3 build.py          # -> short_delivery_test.mp4
python3 build.py 12.5     # -> preview_12.5.png (single frame)
```

`build.py` expects Chromium at `/opt/pw-browsers/chromium`; change `executable_path` elsewhere.
Phone numbers on screen are from fiction-reserved ranges (US 555-01xx, UK 07700 900xxx).
