# Episode 1, part 1 (0:00–1:42) — "7 Scams That Don't Look Like Scams", Lenny version

- `script_part1.json` — lines (Lenny voice) + shot list (Wan prompts) + graphics plan. Hook: "You could lose your savings to 7 scams, but only one of them almost nobody spots. I ran it. Which?" (hookscore 76 STRONG).
- `kaggle_batch.py` — one Kaggle run renders all 12 Wan 2.2 clips (S01–S12). Append `#PLAN:<json shots+style>` and `#IMAGES:<json {lab,stand,phone: base64}>` lines (start frames in `start_frames/`). Chained shots (`last:Sxx`) start from the previous clip's last frame so characters stay consistent.
- `lines.json` — voiced lines with durations (Kokoro `am_liam` 0.9×; the scam SMS L05 in `af_bella`).
- `compose_ep01.py` + `ep01.html` — compositor: `frames <clipdir>` → `timeline` → `chunk K N` ×4 → `mux 4` → `lenny_ep01_part1.mp4`.

## Run log (first episode render)
Kaggle 2× T4: prompt encoding on CPU 20 min (slowest step — move to GPU/fp32 chunks next time), load 3 min, 12 clips × 8.3 min denoise, chained shots waited ~5 min each for decode; total 2 h 19 min (≈2.3 GPU h of the 30 h/week quota). `clips/` holds the 12 Wan clips (S08 is trimmed to 48 frames in the edit: a second phone appears later). Compositor render: ~4 min on 4 CPU workers → 1:43, 1920×1080.
