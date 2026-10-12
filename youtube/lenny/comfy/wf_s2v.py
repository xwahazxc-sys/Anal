S2V = "Wan2.2-S2V-14B-Q3_K_M.gguf"
TE = "umt5_xxl_fp8_e4m3fn_scaled.safetensors"
VAE = "wan_2.1_vae.safetensors"
AENC = "wav2vec2_large_english_fp16.safetensors"

def workflow(image, audio, prompt, negative, seed, w=832, h=480, length=85, steps=20, cfg=6.0, prefix="s2v"):
    n = lambda cls, **inputs: {"class_type": cls, "inputs": inputs}
    return {
        "1": n("UnetLoaderGGUF", unet_name=S2V),
        "2": n("ModelSamplingSD3", model=["1", 0], shift=8.0),
        "3": n("CLIPLoader", clip_name=TE, type="wan"),
        "4": n("CLIPTextEncode", text=prompt, clip=["3", 0]),
        "5": n("CLIPTextEncode", text=negative, clip=["3", 0]),
        "6": n("VAELoader", vae_name=VAE),
        "7": n("LoadImage", image=image),
        "8": n("LoadAudio", audio=audio),
        "9": n("AudioEncoderLoader", audio_encoder_name=AENC),
        "10": n("AudioEncoderEncode", audio_encoder=["9", 0], audio=["8", 0]),
        "11": n("WanSoundImageToVideo", positive=["4", 0], negative=["5", 0], vae=["6", 0], width=w, height=h, length=length,
                batch_size=1, audio_encoder_output=["10", 0], ref_image=["7", 0]),
        "12": n("KSampler", model=["2", 0], seed=seed, steps=steps, cfg=cfg, sampler_name="uni_pc", scheduler="simple",
                positive=["11", 0], negative=["11", 1], latent_image=["11", 2], denoise=1.0),
        "13": n("VAEDecode", samples=["12", 0], vae=["6", 0]),
        "14": n("SaveImage", images=["13", 0], filename_prefix=prefix),
    }
