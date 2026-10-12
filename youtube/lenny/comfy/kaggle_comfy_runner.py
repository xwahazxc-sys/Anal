import base64, glob, json, os, shutil, subprocess, sys, threading, time, traceback, urllib.request
t0 = time.time()
def log(*a): print(f"[{time.time()-t0:7.1f}s]", *a, flush=True)
SRC = open(__file__).read()
PLAN = json.loads(SRC.split("#PLAN:")[-1].split("\n")[0])
IMAGES = json.loads(SRC.split("#IMAGES:")[-1].split("\n")[0])
WF = SRC.split("#WF_B64:")[-1].split("\n")[0]
R = "/tmp/ComfyUI"; OUT = "/kaggle/working"
def sh(*c, **k): return subprocess.run(list(c), check=True, **k)
try:
    sh("git", "clone", "--depth", "1", "https://github.com/comfyanonymous/ComfyUI.git", R)
    sh("git", "clone", "--depth", "1", "https://github.com/city96/ComfyUI-GGUF", f"{R}/custom_nodes/ComfyUI-GGUF")
    sh(sys.executable, "-m", "pip", "install", "-q", "-r", f"{R}/requirements.txt", "-r", f"{R}/custom_nodes/ComfyUI-GGUF/requirements.txt", "hf_transfer")
    log("comfy installed")
    os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"
    from huggingface_hub import hf_hub_download
    files = [("QuantStack/Wan2.2-I2V-A14B-GGUF", "HighNoise/Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf", "unet"),
             ("QuantStack/Wan2.2-I2V-A14B-GGUF", "LowNoise/Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf", "unet"),
             ("Comfy-Org/Wan_2.2_ComfyUI_Repackaged", "split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors", "loras"),
             ("Comfy-Org/Wan_2.2_ComfyUI_Repackaged", "split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors", "loras"),
             ("Comfy-Org/Wan_2.2_ComfyUI_Repackaged", "split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors", "text_encoders"),
             ("Comfy-Org/Wan_2.2_ComfyUI_Repackaged", "split_files/vae/wan_2.1_vae.safetensors", "vae")]
    def dl(repo, fn, sub):
        p = hf_hub_download(repo, fn, cache_dir="/tmp/hf"); os.makedirs(f"{R}/models/{sub}", exist_ok=True)
        os.symlink(p, f"{R}/models/{sub}/{os.path.basename(fn)}")
    ths = [threading.Thread(target=dl, args=f) for f in files]; [t.start() for t in ths]; [t.join() for t in ths]
    log("models downloaded")
    for k, b in IMAGES.items(): open(f"{R}/input/{k}.jpg", "wb").write(base64.b64decode(b))
    exec(base64.b64decode(WF).decode())  # defines workflow()
    env = dict(os.environ, CUDA_VISIBLE_DEVICES="0")
    srv = subprocess.Popen([sys.executable, "main.py", "--listen", "127.0.0.1", "--port", "8188"], cwd=R, env=env,
                           stdout=open("/tmp/comfy.log", "w"), stderr=subprocess.STDOUT)
    for _ in range(120):
        try: urllib.request.urlopen("http://127.0.0.1:8188/system_stats"); break
        except Exception: time.sleep(2)
    log("server up")
    for i, (k, v) in enumerate(PLAN["shots"].items()):
        src = v["from"]
        if src.startswith("last:"):
            shutil.copy(f"{OUT}/{src[5:]}_last.png", f"{R}/input/{src[5:]}_last.png"); img = f"{src[5:]}_last.png"
        else:
            img = src[4:] + ".jpg"
        wf = workflow(img, v["prompt"], PLAN["negative"], 1000 + i, prefix=k)
        req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=json.dumps({"prompt": wf}).encode(), headers={"Content-Type": "application/json"})
        pid = json.loads(urllib.request.urlopen(req).read())["prompt_id"]; ts = time.time()
        while True:
            h = json.loads(urllib.request.urlopen(f"http://127.0.0.1:8188/history/{pid}").read())
            if pid in h and h[pid].get("status", {}).get("completed") is not None:
                st = h[pid]["status"]; break
            if srv.poll() is not None: raise RuntimeError("comfy died")
            time.sleep(5)
        frames = sorted(glob.glob(f"{R}/output/{k}_*.png"))
        log(f"{k}: {len(frames)} frames in {time.time()-ts:.0f}s status={st.get('status_str')}")
        if not frames: raise RuntimeError(json.dumps(st)[:2000])
        shutil.copy(frames[-1], f"{OUT}/{k}_last.png")
        sh("ffmpeg", "-y", "-loglevel", "error", "-framerate", "16", "-pattern_type", "glob", "-i", f"{R}/output/{k}_*.png",
           "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", f"{OUT}/{k}.mp4")
    log("all done")
except Exception:
    traceback.print_exc()
    try: print(open("/tmp/comfy.log").read()[-6000:])
    except Exception: pass
    sys.exit(1)
