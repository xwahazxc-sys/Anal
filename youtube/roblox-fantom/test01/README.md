# Тест 01 — «POV: Your Oct 31 Patient Has No Pulse 🎃» (8 с, петля)

Формат A («Мем») из `../content-plan.md`. Сделано без GPU: 2D-сцена на canvas (`scene.html`), рендер кадров в
headless Chromium (`render.py`), звук синтезирован с нуля (`audio.py`, без чужих треков), громкость −14 LUFS.

```bash
python3 audio.py /tmp/mix.wav
python3 render.py video /tmp/silent.mp4
ffmpeg -i /tmp/silent.mp4 -i /tmp/mix.wav -filter_complex "[1:a]loudnorm=I=-14:TP=-1.5[a]" -map 0:v -map "[a]" -c:v copy -c:a aac test01_pumpkin.mp4
python3 render.py stills sheet.png 0 3.3 4.8 6.4      # контрольные кадры
```

Биты: 0 с врач слушает тыкву, монитор «♥ 0» · 3,0 монитор 180, лицо тыквы загорается · 3,6 моргает ·
4,6 врач отпрыгивает («бум», тряска, зум) · 6,0 «trick or treat?» · 7,3 свет мигает и гаснет · 8,0 → снова кадр 0.
