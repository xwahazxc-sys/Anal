# Free animation: Wan 2.2 TI2V-5B on Kaggle (2× T4, 30 GPU h/week)

`wan_i2v.py` is the Kaggle script. It expects the start frame appended as a base64 line `#IMG:<base64 jpeg>` (832×480) at the end of the file; `kernel-metadata.json` must set `"machine_shape": "NvidiaTeslaT4"` and internet on (account needs phone verification).

How it fits on T4 (no bf16): UMT5 text encoder runs on CPU in bf16, transformer fp16 on cuda:0 (12 GiB, 13.5 GiB peak), VAE decode fp32 + tiling on cuda:1. `torchao` is uninstalled first (diffusers 0.41 import conflict).

Measured (first test, 832×480, 81 frames, 30 steps): setup 7 min (download + load), denoise 7.8 min, decode 5 min → `clips/01_scam_lab_talk_test.mp4`.

Push / fetch:
```bash
kaggle kernels push -p . --accelerator NvidiaTeslaT4
kaggle kernels status <user>/lenny-wan-test
kaggle kernels output <user>/lenny-wan-test -p out
```
The Kaggle token lives in `~/.kaggle/access_token` (never in this repo).
