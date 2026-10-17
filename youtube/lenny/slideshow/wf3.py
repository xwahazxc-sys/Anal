HIGH = "Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf"
LOW = "Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf"
LORA_H = "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors"
LORA_L = "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors"
TE = "umt5_xxl_fp8_e4m3fn_scaled.safetensors"
VAE = "wan_2.1_vae.safetensors"

def workflow(image, prompt, negative, seed, w=832, h=480, length=81, prefix="clip", shift=5.0):
    n = lambda cls, **inputs: {"class_type": cls, "inputs": inputs}
    return {
        "1": n("UnetLoaderGGUF", unet_name=HIGH),
        "2": n("UnetLoaderGGUF", unet_name=LOW),
        "3": n("LoraLoaderModelOnly", model=["1", 0], lora_name=LORA_H, strength_model=1.0),
        "4": n("LoraLoaderModelOnly", model=["2", 0], lora_name=LORA_L, strength_model=1.0),
        "5": n("ModelSamplingSD3", model=["3", 0], shift=shift),
        "6": n("ModelSamplingSD3", model=["4", 0], shift=shift),
        "7": n("CLIPLoader", clip_name=TE, type="wan"),
        "8": n("CLIPTextEncode", text=prompt, clip=["7", 0]),
        "9": n("CLIPTextEncode", text=negative, clip=["7", 0]),
        "10": n("VAELoader", vae_name=VAE),
        "11": n("LoadImage", image=image),
        "12": n("WanImageToVideo", positive=["8", 0], negative=["9", 0], vae=["10", 0], width=w, height=h, length=length,
                batch_size=1, start_image=["11", 0]),
        "13": n("KSamplerAdvanced", model=["5", 0], add_noise="enable", noise_seed=seed, steps=4, cfg=1.0, sampler_name="euler",
                scheduler="simple", positive=["12", 0], negative=["12", 1], latent_image=["12", 2], start_at_step=0, end_at_step=2,
                return_with_leftover_noise="enable"),
        "14": n("KSamplerAdvanced", model=["6", 0], add_noise="disable", noise_seed=seed, steps=4, cfg=1.0, sampler_name="euler",
                scheduler="simple", positive=["12", 0], negative=["12", 1], latent_image=["13", 0], start_at_step=2, end_at_step=10000,
                return_with_leftover_noise="disable"),
        "15": n("VAEDecode", samples=["14", 0], vae=["10", 0]),
        "16": n("SaveImage", images=["15", 0], filename_prefix=prefix),
    }

T_HIGH = "Wan2.2-T2V-A14B-HighNoise-Q4_K_M.gguf"
T_LOW = "Wan2.2-T2V-A14B-LowNoise-Q4_K_M.gguf"
T_LORA_H = "wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors"
T_LORA_L = "wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors"

def t2i(prompt, negative, seed, w=1280, h=720, prefix="img"):
    n = lambda cls, **inputs: {"class_type": cls, "inputs": inputs}
    return {
        "1": n("UnetLoaderGGUF", unet_name=T_HIGH), "2": n("UnetLoaderGGUF", unet_name=T_LOW),
        "3": n("LoraLoaderModelOnly", model=["1", 0], lora_name=T_LORA_H, strength_model=1.0),
        "4": n("LoraLoaderModelOnly", model=["2", 0], lora_name=T_LORA_L, strength_model=1.0),
        "5": n("ModelSamplingSD3", model=["3", 0], shift=5.0), "6": n("ModelSamplingSD3", model=["4", 0], shift=5.0),
        "7": n("CLIPLoader", clip_name=TE, type="wan"),
        "8": n("CLIPTextEncode", text=prompt, clip=["7", 0]), "9": n("CLIPTextEncode", text=negative, clip=["7", 0]),
        "10": n("VAELoader", vae_name=VAE),
        "11": n("EmptyHunyuanLatentVideo", width=w, height=h, length=1, batch_size=1),
        "13": n("KSamplerAdvanced", model=["5", 0], add_noise="enable", noise_seed=seed, steps=4, cfg=1.0, sampler_name="euler",
                scheduler="simple", positive=["8", 0], negative=["9", 0], latent_image=["11", 0], start_at_step=0, end_at_step=2,
                return_with_leftover_noise="enable"),
        "14": n("KSamplerAdvanced", model=["6", 0], add_noise="disable", noise_seed=seed, steps=4, cfg=1.0, sampler_name="euler",
                scheduler="simple", positive=["8", 0], negative=["9", 0], latent_image=["13", 0], start_at_step=2, end_at_step=10000,
                return_with_leftover_noise="disable"),
        "15": n("VAEDecode", samples=["14", 0], vae=["10", 0]), "16": n("SaveImage", images=["15", 0], filename_prefix=prefix),
    }
