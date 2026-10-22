#!/usr/bin/env python3
"""Download the Wan 2.2 video models into the right ComfyUI folders. Resumes after a broken connection.

    python download_models.py D:\\ComfyUI_windows_portable            # both sets (~38 GB)
    python download_models.py D:\\ComfyUI_windows_portable lite       # only the fast 5B set (~18 GB)
    python download_models.py D:\\ComfyUI_windows_portable cinema     # only the 14B set (~28 GB)
    python download_models.py ... --source modelscope                # skip Hugging Face entirely
    python download_models.py ... --dry                              # show what would be downloaded

Sources: Hugging Face first; if it drops the connection (common in Russia), the ModelScope mirror
(modelscope.cn) is used automatically. Every finished file is checked against the SHA-256 published
on Hugging Face, so a mirror cannot hand over a different file.

lite   = Wan 2.2 TI2V 5B: fast, fits 12 GB easily, good for simple Shorts motion.
cinema = Wan 2.2 I2V 14B (GGUF Q4_K_M) + 4-step LightX2V LoRAs: much better motion, needs 32+ GB RAM.
Uses only the Python standard library, so it runs with any Python 3.
"""
import hashlib, os, sys, time, urllib.request

SOURCES = {
    "huggingface": ("https://huggingface.co/{repo}/resolve/main/{path}", 2),
    "modelscope": ("https://www.modelscope.cn/models/{repo}/resolve/master/{path}", 6),
}
REPACK = "Comfy-Org/Wan_2.2_ComfyUI_Repackaged"
GGUF = "QuantStack/Wan2.2-I2V-A14B-GGUF"
# (repo, path in repo, ComfyUI models subfolder, size in bytes, sha256 from Hugging Face)
TE = (REPACK, "split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors", "text_encoders", 6735906897,
      "c3355d30191f1f066b26d93fba017ae9809dce6c627dda5f6a66eaa651204f68")
SETS = {
    "lite": [
        (REPACK, "split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors", "diffusion_models", 9999658848,
         "456f901338bd9eadbded3828b819109a9b68e8a525ca5cf8d0049a69fcfeca1e"),
        TE,
        (REPACK, "split_files/vae/wan2.2_vae.safetensors", "vae", 1409400960,
         "e40321bd36b9709991dae2530eb4ac303dd168276980d3e9bc4b6e2b75fed156"),
    ],
    "cinema": [
        (GGUF, "HighNoise/Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf", "unet", 9651728896,
         "836250abfaa3411694e2c9cf3a0cc18265329d5156d81aa116d5366b0f8f02e7"),
        (GGUF, "LowNoise/Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf", "unet", 9651728896,
         "e2f98d834af009d035c6b0918268f2eba0aa8a63025ce942277e2384d40b0866"),
        (REPACK, "split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors", "loras", 1226977424,
         "d176c808d6fc461999b68e321efcb7501b20b8c3797523ed0df14f7d1deff11e"),
        (REPACK, "split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors", "loras", 1226977424,
         "024f21de095bc8fad9809ded3e9e49a2e170dcf27075da8145ba7d60d8aab7f9"),
        TE,
        (REPACK, "split_files/vae/wan_2.1_vae.safetensors", "vae", 253815318,
         "2fc39d31359a4b0a64f55876d8ff7fa8d780956ae2cb13463b0223e15148976b"),
    ],
}
order = ["huggingface", "modelscope"]  # the working source moves to the front


def comfy_root(path):
    """Accept the portable folder or the ComfyUI folder inside it."""
    for p in (path, os.path.join(path, "ComfyUI")):
        if os.path.isdir(os.path.join(p, "models")):
            return p
    sys.exit(f"No 'models' folder in {path} or {path}\\ComfyUI - is this the ComfyUI folder?")


def open_from(start, item):
    """Open a stream at byte `start` from the first source that answers; remembers the one that worked."""
    repo, path = item[0], item[1]
    for src in list(order):
        url, tries = SOURCES[src]
        url = url.format(repo=repo, path=path)
        for i in range(tries):
            try:
                req = urllib.request.Request(url, headers={"Range": f"bytes={start}-", "User-Agent": "Mozilla/5.0"})
                r = urllib.request.urlopen(req, timeout=60)
                if start and r.status != 206:
                    r.close(); raise IOError("server ignored the resume request")
                if order[0] != src:
                    order.remove(src); order.insert(0, src)
                    print(f"  using {src}", flush=True)
                return r
            except Exception as e:
                wait = 5 * (i + 1)
                print(f"  {src}: connection problem ({e.__class__.__name__}), retry {i + 1}/{tries} in {wait} s",
                      flush=True)
                time.sleep(wait)
    raise IOError("no source answered")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(8 << 20)
            if not b:
                return h.hexdigest()
            h.update(b)


def download(item, dest):
    total, digest = item[3], item[4]
    name = os.path.basename(dest)
    if os.path.exists(dest) and os.path.getsize(dest) == total:
        return print(f"  already there: {name}")
    part = dest + ".part"
    have = os.path.getsize(part) if os.path.exists(part) else 0
    if have > total:
        os.remove(part); have = 0
    for attempt in range(30):
        if have >= total:
            break
        try:
            with open_from(have, item) as r, open(part, "ab" if have else "wb") as f:
                t0, done0, shown = time.time(), have, 0.0
                while True:
                    buf = r.read(1 << 20)
                    if not buf:
                        break
                    f.write(buf); have += len(buf)
                    if time.time() - shown > 1 or have >= total:
                        shown = time.time()
                        speed = (have - done0) / max(shown - t0, 1e-3) / 2**20
                        print(f"\r  {name}: {have / 2**30:5.2f} / {total / 2**30:.2f} GB  {speed:5.1f} MB/s ",
                              end="", flush=True)
        except Exception as e:
            print(f"\n  connection dropped ({e.__class__.__name__}), resuming in 10 s (try {attempt + 1}/30)...",
                  flush=True)
            time.sleep(10)
    print()
    if os.path.getsize(part) != total:
        sys.exit(f"  {name}: not complete yet - run the same command again to resume")
    print(f"  checking {name} ...", end="", flush=True)
    if sha256(part) != digest:
        os.remove(part)
        sys.exit(f"\n  {name}: checksum mismatch, the file was deleted - run the command again")
    os.replace(part, dest)
    print(" OK")


def main():
    a = [x for x in sys.argv[1:] if x != "--dry"]
    if "--source" in a:
        i = a.index("--source"); src = a[i + 1]; del a[i:i + 2]
        order.remove(src); order.insert(0, src)
    if not a:
        sys.exit(__doc__)
    # messengers turn "quotes" into «guillemets» or “curly quotes” when commands are pasted through them
    root = comfy_root(a[0].strip("\"'«»“”„ "))
    which = a[1] if len(a) > 1 else "all"
    files = SETS["lite"] + SETS["cinema"] if which == "all" else SETS[which]
    plan, seen = [], set()
    for item in files:
        if item[1] not in seen:
            seen.add(item[1])
            plan.append((item, os.path.join(root, "models", item[2], item[1].rsplit("/", 1)[-1])))
    total = sum(i[3] for i, _ in plan)
    print(f"ComfyUI: {root}\n{len(plan)} files, {total / 2**30:.1f} GB in total")
    for _, dest in plan:
        print(f"  -> models\\{os.path.relpath(dest, os.path.join(root, 'models'))}")
    if "--dry" in sys.argv:
        return
    for item, dest in plan:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        download(item, dest)
    print("Done. Restart ComfyUI so it sees the new models.")


if __name__ == "__main__":
    main()
