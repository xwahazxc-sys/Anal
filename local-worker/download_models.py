#!/usr/bin/env python3
"""Download the Wan 2.2 video models into the right ComfyUI folders. Resumes after a broken connection.

    python download_models.py "C:\\ComfyUI_windows_portable"            # both sets (~38 GB)
    python download_models.py "C:\\ComfyUI_windows_portable" lite       # only the fast 5B set (~18 GB)
    python download_models.py "C:\\ComfyUI_windows_portable" cinema     # only the 14B set (~28 GB)
    python download_models.py ... --dry                                 # show what would be downloaded

lite   = Wan 2.2 TI2V 5B: fast, fits 12 GB easily, good for simple Shorts motion.
cinema = Wan 2.2 I2V 14B (GGUF Q4_K_M) + 4-step LightX2V LoRAs: much better motion, needs 32+ GB RAM.
Uses only the Python standard library, so it runs with any Python 3.
"""
import os, sys, time, urllib.request

HF = "https://huggingface.co/"
REPACK = "Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/"
GGUF = "QuantStack/Wan2.2-I2V-A14B-GGUF/resolve/main/"
SETS = {
    "lite": [
        (REPACK + "diffusion_models/wan2.2_ti2v_5B_fp16.safetensors", "diffusion_models"),
        (REPACK + "text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors", "text_encoders"),
        (REPACK + "vae/wan2.2_vae.safetensors", "vae"),
    ],
    "cinema": [
        (GGUF + "HighNoise/Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf", "unet"),
        (GGUF + "LowNoise/Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf", "unet"),
        (REPACK + "loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors", "loras"),
        (REPACK + "loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors", "loras"),
        (REPACK + "text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors", "text_encoders"),
        (REPACK + "vae/wan_2.1_vae.safetensors", "vae"),
    ],
}


def comfy_root(path):
    """Accept the portable folder or the ComfyUI folder inside it."""
    for p in (path, os.path.join(path, "ComfyUI")):
        if os.path.isdir(os.path.join(p, "models")):
            return p
    sys.exit(f"No 'models' folder in {path} or {path}\\ComfyUI - is this the ComfyUI folder?")


def size_of(url):
    req = urllib.request.Request(HF + url, method="HEAD")
    with urllib.request.urlopen(req, timeout=60) as r:
        return int(r.headers["Content-Length"])


def download(url, dest):
    total = size_of(url)
    have = os.path.getsize(dest) if os.path.exists(dest) else 0
    if have == total:
        return print(f"  already there: {os.path.basename(dest)}")
    part = dest + ".part"
    have = os.path.getsize(part) if os.path.exists(part) else 0
    for attempt in range(20):
        try:
            req = urllib.request.Request(HF + url, headers={"Range": f"bytes={have}-"} if have else {})
            with urllib.request.urlopen(req, timeout=60) as r, open(part, "ab" if have else "wb") as f:
                t0, done0, shown = time.time(), have, 0.0
                while True:
                    buf = r.read(1 << 20)
                    if not buf:
                        break
                    f.write(buf); have += len(buf)
                    if time.time() - shown > 1 or have >= total:
                        shown = time.time()
                        speed = (have - done0) / max(shown - t0, 1e-3) / 2**20
                        print(f"\r  {os.path.basename(dest)}: {have / 2**30:5.2f} / {total / 2**30:.2f} GB  "
                              f"{speed:5.1f} MB/s ", end="", flush=True)
            if have >= total:
                break
        except Exception as e:
            print(f"\n  connection dropped ({e.__class__.__name__}), resuming in 10 s...")
            time.sleep(10)
    print()
    if os.path.getsize(part) != total:
        sys.exit(f"  {dest}: size mismatch, run the script again to resume")
    os.replace(part, dest)


def main():
    a = [x for x in sys.argv[1:] if x != "--dry"]
    if not a:
        sys.exit(__doc__)
    root = comfy_root(a[0])
    which = a[1] if len(a) > 1 else "all"
    files = SETS["lite"] + SETS["cinema"] if which == "all" else SETS[which]
    seen, plan = set(), []
    for url, sub in files:
        if url not in seen:
            seen.add(url); plan.append((url, os.path.join(root, "models", sub, url.rsplit("/", 1)[-1])))
    total = sum(size_of(u) for u, _ in plan)
    print(f"ComfyUI: {root}\n{len(plan)} files, {total / 2**30:.1f} GB in total")
    for url, dest in plan:
        print(f"  -> models\\{os.path.relpath(dest, os.path.join(root, 'models'))}")
    if "--dry" in sys.argv:
        return
    for url, dest in plan:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        download(url, dest)
    print("Done. Restart ComfyUI so it sees the new models.")


if __name__ == "__main__":
    main()
