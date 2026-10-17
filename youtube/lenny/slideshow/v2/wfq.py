Q_T2I = "Qwen_Image-Q4_K_S.gguf"
Q_EDIT = "Qwen-Image-Edit-2509-Q4_K_S.gguf"
Q_TE = "qwen_2.5_vl_7b_fp8_scaled.safetensors"
Q_VAE = "qwen_image_vae.safetensors"
L_T2I = "Qwen-Image-Lightning-8steps-V2.0-bf16.safetensors"
L_EDIT = "Qwen-Image-Edit-2509-Lightning-8steps-V1.0-bf16.safetensors"

def _n(cls, **inputs): return {"class_type": cls, "inputs": inputs}

def qwen_t2i(prompt, negative, seed, w=1664, h=928, prefix="q"):
    return {
        "1": _n("UnetLoaderGGUF", unet_name=Q_T2I),
        "2": _n("LoraLoaderModelOnly", model=["1", 0], lora_name=L_T2I, strength_model=1.0),
        "3": _n("ModelSamplingAuraFlow", model=["2", 0], shift=3.1),
        "4": _n("CLIPLoader", clip_name=Q_TE, type="qwen_image"),
        "5": _n("CLIPTextEncode", text=prompt, clip=["4", 0]),
        "6": _n("CLIPTextEncode", text=negative, clip=["4", 0]),
        "7": _n("EmptySD3LatentImage", width=w, height=h, batch_size=1),
        "8": _n("KSampler", model=["3", 0], seed=seed, steps=8, cfg=1.0, sampler_name="euler", scheduler="simple",
                positive=["5", 0], negative=["6", 0], latent_image=["7", 0], denoise=1.0),
        "9": _n("VAELoader", vae_name=Q_VAE),
        "10": _n("VAEDecode", samples=["8", 0], vae=["9", 0]),
        "11": _n("SaveImage", images=["10", 0], filename_prefix=prefix),
    }

def qwen_edit(ref, prompt, seed, w=1664, h=928, prefix="e", ref2=None):
    wf = {
        "1": _n("UnetLoaderGGUF", unet_name=Q_EDIT),
        "2": _n("LoraLoaderModelOnly", model=["1", 0], lora_name=L_EDIT, strength_model=1.0),
        "3": _n("ModelSamplingAuraFlow", model=["2", 0], shift=3.0),
        "3b": _n("CFGNorm", model=["3", 0], strength=1.0),
        "4": _n("CLIPLoader", clip_name=Q_TE, type="qwen_image"),
        "9": _n("VAELoader", vae_name=Q_VAE),
        "12": _n("LoadImage", image=ref),
        "13": _n("ImageScaleToTotalPixels", image=["12", 0], upscale_method="lanczos", megapixels=1.0, resolution_steps=1),
        "5": _n("TextEncodeQwenImageEditPlus", clip=["4", 0], prompt=prompt, vae=["9", 0], image1=["13", 0]),
        "6": _n("TextEncodeQwenImageEditPlus", clip=["4", 0], prompt="", vae=["9", 0], image1=["13", 0]),
        "7": _n("EmptySD3LatentImage", width=w, height=h, batch_size=1),
        "8": _n("KSampler", model=["3b", 0], seed=seed, steps=8, cfg=1.0, sampler_name="euler", scheduler="simple",
                positive=["5", 0], negative=["6", 0], latent_image=["7", 0], denoise=1.0),
        "10": _n("VAEDecode", samples=["8", 0], vae=["9", 0]),
        "11": _n("SaveImage", images=["10", 0], filename_prefix=prefix),
    }
    if ref2:
        wf["14"] = _n("LoadImage", image=ref2)
        wf["15"] = _n("ImageScaleToTotalPixels", image=["14", 0], upscale_method="lanczos", megapixels=1.0, resolution_steps=1)
        wf["5"]["inputs"]["image2"] = ["15", 0]; wf["6"]["inputs"]["image2"] = ["15", 0]
    return wf
