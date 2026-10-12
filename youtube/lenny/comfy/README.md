# ComfyUI on Kaggle (free 2× T4)

- `kaggle_comfy_runner.py` — installs ComfyUI + ComfyUI-GGUF on Kaggle, downloads models from Hugging Face, runs each shot through the ComfyUI API, saves `<shot>.mp4` (16 fps) + `<shot>_last.png`. Append `#PLAN:`, `#IMAGES:` (base64 files) and `#WF_B64:` (base64 of a workflow module) lines.
- `wf_i2v_14b.py` — Wan 2.2 I2V A14B, GGUF Q4_K_M high/low-noise experts + LightX2V 4-step LoRAs (2+2 steps, cfg 1, shift 5), 832×480, 81 frames.
- `wf_s2v.py` — Wan 2.2 S2V 14B GGUF Q3_K_M + wav2vec2 audio encoder: the character's mouth follows the voice line (20 steps uni_pc, cfg 6, shift 8).

Both workflows were validated against ComfyUI 0.39 (`/prompt` returned no node errors).
