import base64, io, os, subprocess, sys, time, traceback
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
import diffusers; log("diffusers", diffusers.__version__, "torch", torch.__version__)

MODEL = "Wan-AI/Wan2.2-TI2V-5B-Diffusers"
IMG = Image.open(io.BytesIO(base64.b64decode(open(__file__).read().split("#IMG:")[-1].strip())))
PROMPT = ("A charming cartoon raccoon in a charcoal-grey hoodie with a gold padlock chain sits backwards on a wooden chair "
          "in a cozy dim hideout room, talking to the camera with a sly knowing smirk, he nods, raises one eyebrow, "
          "gestures with his gloved paw toward the viewer, blinks, his ringed tail sways gently, the neon sign glows softly, "
          "the camera slowly pushes in, stylized 3D animated feature film, smooth natural motion, consistent character")
NEG = ("static, still image, frozen, blurry, low quality, jpeg artifacts, deformed, disfigured, extra limbs, extra fingers, "
       "bad hands, melting face, morphing, flicker, text, subtitles, watermark, overexposed")
H, W, F, STEPS = 480, 832, int(os.environ.get("FRAMES", 81)), int(os.environ.get("STEPS", 30))

try:
    # 1) text encoder on CPU in bf16 (T4 has no native bf16), then free it
    tp = WanPipeline.from_pretrained(MODEL, transformer=None, vae=None, torch_dtype=torch.bfloat16)
    with torch.no_grad():
        pe, ne = tp.encode_prompt(PROMPT, NEG, do_classifier_free_guidance=True, device=torch.device("cpu"), dtype=torch.bfloat16)
    pe, ne = pe.to(torch.float16), ne.to(torch.float16)
    del tp; import gc; gc.collect(); log("prompt encoded", tuple(pe.shape))

    # 2) transformer fp16 + VAE fp32, offloaded to the GPU one at a time
    vae = AutoencoderKLWan.from_pretrained(MODEL, subfolder="vae", torch_dtype=torch.float32)
    tr = WanTransformer3DModel.from_pretrained(MODEL, subfolder="transformer", torch_dtype=torch.float16)
    pipe = WanImageToVideoPipeline.from_pretrained(MODEL, transformer=tr, vae=vae, text_encoder=None, torch_dtype=torch.float16)
    pipe.to("cuda:0")
    pe, ne = pe.to("cuda:0"), ne.to("cuda:0")
    log("pipeline ready on cuda:0", type(pipe).__name__, f"vram {torch.cuda.memory_allocated(0)/2**30:.1f} GiB")

    g = torch.Generator("cpu").manual_seed(42)
    ts = time.time()
    lat = pipe(image=IMG, prompt_embeds=pe, negative_prompt_embeds=ne, height=H, width=W, num_frames=F,
               num_inference_steps=STEPS, guidance_scale=5.0, generator=g, output_type="latent").frames
    log(f"denoised in {time.time()-ts:.0f}s; peak vram {torch.cuda.max_memory_allocated(0)/2**30:.1f} GiB; nan={torch.isnan(lat).any().item()}")

    # decode on the second T4 so the 5B transformer can stay put
    vae = pipe.vae.to("cuda:1"); vae.enable_tiling()
    lat = lat.to("cuda:1", vae.dtype)
    mean = torch.tensor(vae.config.latents_mean).view(1, vae.config.z_dim, 1, 1, 1).to(lat)
    std = 1.0 / torch.tensor(vae.config.latents_std).view(1, vae.config.z_dim, 1, 1, 1).to(lat)
    with torch.no_grad():
        video = vae.decode(lat / std + mean, return_dict=False)[0]
    frames = pipe.video_processor.postprocess_video(video, output_type="pil")[0]
    log(f"decoded {len(frames)} frames")
    export_to_video(frames, "/kaggle/working/lenny_wan_test.mp4", fps=24)
    log("saved")
except Exception:
    traceback.print_exc(); sys.exit(1)

