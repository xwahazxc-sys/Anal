import base64, glob, json, os, shutil, subprocess, sys, threading, time, traceback, urllib.request
t0 = time.time()
def log(*a): print(f"[{time.time()-t0:7.1f}s]", *a, flush=True)
SRC = open(__file__).read()
PLAN = json.loads(SRC.split("#PLAN:")[-1].split("\n")[0])
IMAGES = json.loads(SRC.split("#IMAGES:")[-1].split("\n")[0])
WF = SRC.split("#WF_B64:")[-1].split("\n")[0]
R = "/tmp/ComfyUI"; OUT = "/kaggle/working"
def sh(*c): return subprocess.run(list(c), check=True)
srv = None
try:
    sh("git", "clone", "--depth", "1", "https://github.com/comfyanonymous/ComfyUI.git", R)
    sh("git", "clone", "--depth", "1", "https://github.com/city96/ComfyUI-GGUF", f"{R}/custom_nodes/ComfyUI-GGUF")
    sh(sys.executable, "-m", "pip", "install", "-q", "-r", f"{R}/requirements.txt", "-r", f"{R}/custom_nodes/ComfyUI-GGUF/requirements.txt", "hf_transfer")
    os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"
    from huggingface_hub import hf_hub_download
    files = [("QuantStack/Qwen-Image-GGUF", "Qwen_Image-Q4_K_S.gguf", "unet"),
             ("QuantStack/Qwen-Image-Edit-2509-GGUF", "Qwen-Image-Edit-2509-Q4_K_S.gguf", "unet"),
             ("Comfy-Org/Qwen-Image_ComfyUI", "split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors", "text_encoders"),
             ("Comfy-Org/Qwen-Image_ComfyUI", "split_files/vae/qwen_image_vae.safetensors", "vae"),
             ("lightx2v/Qwen-Image-Lightning", "Qwen-Image-Lightning-8steps-V2.0-bf16.safetensors", "loras"),
             ("lightx2v/Qwen-Image-Lightning", "Qwen-Image-Edit-2509/Qwen-Image-Edit-2509-Lightning-8steps-V1.0-bf16.safetensors", "loras")]
    def dl(repo, fn, sub):
        p = hf_hub_download(repo, fn, cache_dir="/tmp/hf"); os.makedirs(f"{R}/models/{sub}", exist_ok=True)
        os.symlink(p, f"{R}/models/{sub}/{os.path.basename(fn)}")
    ths = [threading.Thread(target=dl, args=f) for f in files]; [t.start() for t in ths]; [t.join() for t in ths]
    log("models downloaded")
    for k, b in IMAGES.items(): open(f"{R}/input/{k}", "wb").write(base64.b64decode(b))
    exec(base64.b64decode(WF).decode())
    env = dict(os.environ, CUDA_VISIBLE_DEVICES="0")
    def restart():
        global srv
        if srv is not None: srv.terminate(); srv.wait(60)
        srv = subprocess.Popen([sys.executable, "main.py", "--listen", "127.0.0.1", "--port", "8188"], cwd=R, env=env,
                               stdout=open("/tmp/comfy.log", "a"), stderr=subprocess.STDOUT)
        for _ in range(180):
            try: urllib.request.urlopen("http://127.0.0.1:8188/system_stats"); return
            except Exception: time.sleep(2)
        raise RuntimeError("comfy did not start")
    def run(wf):
        req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=json.dumps({"prompt": wf}).encode(), headers={"Content-Type": "application/json"})
        pid = json.loads(urllib.request.urlopen(req).read())["prompt_id"]
        while True:
            h = json.loads(urllib.request.urlopen(f"http://127.0.0.1:8188/history/{pid}").read())
            if pid in h and h[pid].get("status", {}).get("completed") is not None: return h[pid]["status"]
            if srv.poll() is not None: raise RuntimeError("comfy died")
            time.sleep(3)
    last_kind = None
    for i, st in enumerate(PLAN["steps"]):
        k = st["name"]; kind = st["type"]
        if kind != last_kind: restart(); last_kind = kind
        ts = time.time()
        if kind == "t2i":
            wf = qwen_t2i(st["prompt"] + PLAN["style"], PLAN["negative"], 700 + i, prefix=k)
        else:
            wf = qwen_edit(st["ref"], st["prompt"] + PLAN["style"], 700 + i, prefix=k, ref2=st.get("ref2"))
        s = run(wf); f = sorted(glob.glob(f"{R}/output/{k}_*.png"))
        if not f: log("FAILED", k, json.dumps(s)[:1500]); continue
        shutil.copy(f[-1], f"{R}/input/{k}.png"); shutil.copy(f[-1], f"{OUT}/{k}.png")
        log(f"{k} ({kind}) in {time.time()-ts:.0f}s")
    log("all done")
except Exception:
    traceback.print_exc()
    try: print(open("/tmp/comfy.log").read()[-5000:])
    except Exception: pass
    sys.exit(1)
