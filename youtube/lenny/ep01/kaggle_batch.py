import base64, io, json, os, subprocess, sys, threading, time, traceback, gc
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"
os.environ["HF_HOME"] = "/tmp/hf"
t0 = time.time()
def log(*a): print(f"[{time.time()-t0:7.1f}s]", *a, flush=True)
subprocess.run([sys.executable, "-m", "pip", "uninstall", "-y", "-q", "torchao"])
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-U", "diffusers", "transformers", "accelerate", "ftfy", "sentencepiece", "imageio", "imageio-ffmpeg"], check=True)
import torch
from PIL import Image
from diffusers import WanImageToVideoPipeline, WanPipeline, AutoencoderKLWan, WanTransformer3DModel
from diffusers.utils import export_to_video
MODEL = "Wan-AI/Wan2.2-TI2V-5B-Diffusers"
OUT = "/kaggle/working"
H, W, F, STEPS = 480, 832, 81, 30
LENNY = ("cartoon raccoon with fluffy grey-silver fur, black bandit mask, big amber eyes, ringed tail, "
         "charcoal-grey hoodie with a small neon-teal lightning bolt patch, gold chain with a padlock pendant, black fingerless gloves")
NEG = ("static, still image, frozen, blurry, low quality, jpeg artifacts, deformed, disfigured, extra limbs, extra fingers, "
       "bad hands, melting face, morphing, flicker, text, subtitles, watermark, overexposed, photorealistic")
src = open(__file__).read()
IMAGES = {k: Image.open(io.BytesIO(base64.b64decode(v))).convert("RGB") for k, v in json.loads(src.split("#IMAGES:")[-1].split("\n")[0]).items()}
PLAN = json.loads(src.split("#PLAN:")[-1].split("\n")[0])
ONLY = os.environ.get("ONLY")
shots = [(k, v) for k, v in PLAN["shots"].items() if not ONLY or k in ONLY.split(",")]
def full_prompt(p):
    if "raccoon" in p: p = p.replace("The cartoon raccoon", "The " + LENNY, 1)
    return p + ", " + PLAN["style"]
try:
    tp = WanPipeline.from_pretrained(MODEL, transformer=None, vae=None, torch_dtype=torch.bfloat16)
    emb = {}
    with torch.no_grad():
        for k, v in shots:
            pe, ne = tp.encode_prompt(full_prompt(v["prompt"]), NEG, do_classifier_free_guidance=True, device=torch.device("cpu"), dtype=torch.bfloat16)
            emb[k] = (pe.to(torch.float16), ne.to(torch.float16))
    del tp; gc.collect(); log("encoded", len(emb), "prompts")

    vae0 = AutoencoderKLWan.from_pretrained(MODEL, subfolder="vae", torch_dtype=torch.float32)
    vae1 = AutoencoderKLWan.from_pretrained(MODEL, subfolder="vae", torch_dtype=torch.float32).to("cuda:1"); vae1.enable_tiling()
    tr = WanTransformer3DModel.from_pretrained(MODEL, subfolder="transformer", torch_dtype=torch.float16)
    i2v = WanImageToVideoPipeline.from_pretrained(MODEL, transformer=tr, vae=vae0, text_encoder=None, torch_dtype=torch.float16).to("cuda:0")
    t2v = WanPipeline(tokenizer=i2v.tokenizer, text_encoder=None, vae=i2v.vae, scheduler=i2v.scheduler, transformer=i2v.transformer, expand_timesteps=True)
    log("ready; vram0", round(torch.cuda.memory_allocated(0) / 2**30, 1), "GiB")
    mean = torch.tensor(vae1.config.latents_mean).view(1, vae1.config.z_dim, 1, 1, 1).to("cuda:1")
    std = 1.0 / torch.tensor(vae1.config.latents_std).view(1, vae1.config.z_dim, 1, 1, 1).to("cuda:1")

    last, threads = {}, {}
    def decode(k, lat):
        with torch.no_grad():
            v = vae1.decode(lat.to("cuda:1", torch.float32) / std + mean, return_dict=False)[0]
        fr = i2v.video_processor.postprocess_video(v, output_type="pil")[0]
        export_to_video(fr, f"{OUT}/{k}.mp4", fps=24); fr[-1].save(f"{OUT}/{k}_last.png"); last[k] = fr[-1]
        log("saved", k, len(fr), "frames")
    for i, (k, v) in enumerate(shots):
        src_ = v["from"]; pe, ne = (e.to("cuda:0") for e in emb[k])
        g = torch.Generator("cpu").manual_seed(1000 + i); ts = time.time()
        if src_ == "text":
            lat = t2v(prompt_embeds=pe, negative_prompt_embeds=ne, height=H, width=W, num_frames=F, num_inference_steps=STEPS,
                      guidance_scale=5.0, generator=g, output_type="latent").frames
        else:
            if src_.startswith("last:"):
                dep = src_[5:]
                if dep in threads: threads[dep].join()
                img = last[dep]
            else:
                img = IMAGES[src_[4:]]
            lat = i2v(image=img, prompt_embeds=pe, negative_prompt_embeds=ne, height=H, width=W, num_frames=F, num_inference_steps=STEPS,
                      guidance_scale=5.0, generator=g, output_type="latent").frames
        log(f"{k} denoised in {time.time()-ts:.0f}s nan={torch.isnan(lat).any().item()}")
        th = threading.Thread(target=decode, args=(k, lat.detach().clone())); th.start(); threads[k] = th
    for th in threads.values(): th.join()
    log("all done")
except Exception:
    traceback.print_exc(); sys.exit(1)
