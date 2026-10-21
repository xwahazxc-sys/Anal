# Локальный воркер: твоя видеокарта ↔ Claude

Claude работает в облаке и не может напрямую зайти на твой компьютер. Поэтому связь идёт через
**очередь в GitHub** (ветка `render-queue` этого репозитория):

```
Claude (облако)                       GitHub                         Твой ПК (RTX 5070)
 пишет сценарий, ставит задание ──►  jobs/pending/<id>.json  ──►  worker.py забирает задание
                                                                    ├─ голос: Chatterbox
                                                                    └─ картинки/видео: ComfyUI
 монтирует ролик, грузит на YouTube ◄── outputs/<id>/...  ◄──  кладёт результат обратно
```

- **Ничего не открывается наружу.** Воркер сам ходит только на api.github.com и на твой локальный ComfyUI.
- **Выполняются только 3 типа заданий:** `ping` (проверка связи), `tts` (озвучка), `comfy` (картинки/видео).
  Произвольные команды из очереди воркер не запускает.
- **Если ПК выключен**, задания просто ждут в очереди и выполнятся, когда он включится.

Файлы: `worker.py` — сам воркер · `tts.py` — озвучка с автопроверкой Whisper · `comfy.py` — задания для ComfyUI ·
`queue_tool.py` — инструмент Claude на облачной стороне · `start_worker.bat` — автозапуск в Windows.

---

## Установка (Windows, RTX 5070)

### 1. Базовое
- Обнови драйвер NVIDIA (GeForce Experience / сайт NVIDIA).
- Установи **Python 3.11** с python.org (галочка «Add python.exe to PATH»).
- Установи **Git** (git-scm.com) — проще всего скачать репозиторий так.
- В настройках питания: «Спящий режим — Никогда» при питании от сети, иначе ночью рендер встанет.

### 2. Скачать воркер
```bat
cd C:\
git clone -b claude/ecstatic-goldberg-c57vtd https://github.com/xwahazxc-sys/Anal.git
cd Anal\local-worker
copy config.example.json config.json
```
(Репозиторий приватный: при клонировании Git попросит войти в GitHub — войди своим аккаунтом.)

### 3. Окружение для голоса
```bat
python -m venv venv
venv\Scripts\activate
pip install chatterbox-tts
pip install --force-reinstall torch torchaudio --index-url https://download.pytorch.org/whl/cu128
pip install -r requirements.txt
python -c "import torch;print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_capability())"
```
Последняя строка должна показать `True` и `(12, 0)`. RTX 50xx (архитектура Blackwell) работает только с
PyTorch-сборкой **CUDA 12.8** (`cu128`); вторая команда ставит именно её поверх той, что притянул chatterbox.
Если pip ругается на конфликт версий — это нормально. Если `import chatterbox` падает — пришли Claude текст ошибки.

### 4. ComfyUI и видео-модель Wan 2.2
Подробно, по шагам, для новичка: **[COMFYUI_SETUP.md](COMFYUI_SETUP.md)**.
Коротко: распаковать ComfyUI Portable в `C:\`, поставить 2 дополнения, скачать модели одной командой
`python download_models.py "C:\ComfyUI_windows_portable"`, проверить шаблон «Wan 2.2 5B».

### 5. Токен GitHub (доступ воркера к очереди)
GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token:
- Repository access: **Only select repositories → xwahazxc-sys/Anal**
- Permissions → Repository permissions → **Contents: Read and write** (больше ничего)
- Expiration: 90 дней (потом выпустить новый)

Сохрани токен в переменную окружения (в обычной командной строке, затем закрой и открой её заново):
```bat
setx GITHUB_TOKEN "сюда_токен"
```
**Не присылай токен в чат и не вписывай его в config.json или в репозиторий.**

### 6. Запуск
```bat
cd C:\Anal\local-worker
venv\Scripts\activate
python worker.py
```
Увидишь `worker for xwahazxc-sys/Anal@render-queue, polling every 60 s`. Окно не закрывай.

**Автозапуск:** Планировщик заданий → Создать задачу → Триггер «При входе в систему» → Действие:
запуск `C:\Anal\local-worker\start_worker.bat`. Так же добавь `run_nvidia_gpu.bat` из ComfyUI.

### 7. Проверка связи
Напиши Claude «воркер запущен». Claude поставит задание `ping`, через минуту в окне появится
`job ping-1 (ping) … done`, и Claude увидит твою видеокарту, память, версию CUDA и доступность ComfyUI.

---

## Linux (если вместо Windows)
То же самое, отличия: `source venv/bin/activate`, ComfyUI — `git clone` + `python main.py`,
токен — строка `export GITHUB_TOKEN=...` в `~/.profile`, автозапуск — systemd:
```ini
# ~/.config/systemd/user/render-worker.service
[Service]
WorkingDirectory=%h/Anal/local-worker
ExecStart=%h/Anal/local-worker/venv/bin/python worker.py
Restart=always
RestartSec=30
[Install]
WantedBy=default.target
```
`systemctl --user enable --now render-worker` и `loginctl enable-linger $USER`.

---

## Форматы заданий (для Claude)

**Озвучка** — `{"id":"kif-ep01-voice","type":"tts","lang":"de","voice":"voices/kif.wav","text":"…"}`
Текст режется по предложениям; каждый кусок переслушивает Whisper и сверяет с текстом; если слова
съедены — кусок озвучивается заново (до 3 раз). Результат: `narration.flac` + `report.json` (оценка по каждому куску).
Одно задание — до ~15 минут речи (лимит GitHub 100 МБ на файл).

**ComfyUI** — `{"id":"lr-drac-03","type":"comfy","workflow":"workflows/wan22_i2v.json","files":{"start_image":"inputs/x.png"},"vars":{"prompt":"…","seed":42}}`
Workflow — экспорт из ComfyUI в формате API, со вставками `{{prompt}}`, `{{seed}}`, `{{start_image}}`.

**Облачная сторона:**
```bash
python3 local-worker/queue_tool.py init                      # один раз создать ветку render-queue
python3 local-worker/queue_tool.py add job.json voices/kif.wav=/path/kif.wav
python3 local-worker/queue_tool.py status
python3 local-worker/queue_tool.py get kif-ep01-voice ./out
```
Ветка `render-queue` со временем растёт от результатов; Claude периодически пересоздаёт её с чистой историей.
