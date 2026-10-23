@echo off
rem One-time setup for Qwen3-TTS voices (own venv, ~13 GB with models). Run from any folder.
cd /d "%~dp0"
if not exist venv-qwen python -m venv venv-qwen
call venv-qwen\Scripts\activate.bat
python -m pip install --upgrade pip
pip install qwen-tts==0.1.1 modelscope faster-whisper
rem qwen-tts may pull a CPU-only torch: replace it with the CUDA 12.8 build for the RTX 50 series
pip install --force-reinstall --no-deps torch==2.7.1 torchaudio==2.7.1 --index-url https://download.pytorch.org/whl/cu128
modelscope download --model Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign --local_dir models\Qwen3-TTS-12Hz-1.7B-VoiceDesign
modelscope download --model Qwen/Qwen3-TTS-12Hz-1.7B-Base --local_dir models\Qwen3-TTS-12Hz-1.7B-Base
python -c "import torch, qwen_tts; print('QWEN OK, CUDA:', torch.cuda.is_available())"
pause
