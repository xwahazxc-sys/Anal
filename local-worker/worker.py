#!/usr/bin/env python3
"""Local render worker: connects your GPU computer to Claude through a GitHub queue.

Claude (in the cloud) writes job files to the `render-queue` branch:  jobs/pending/<id>.json
This worker polls that branch, runs each job on your machine (voice, images, video),
and commits the results back:  outputs/<id>/...  +  jobs/done/<id>.json  (or jobs/failed/).

No ports are opened on your computer. The worker only talks to api.github.com
(and to your local ComfyUI on 127.0.0.1). It runs ONLY the job types listed in HANDLERS,
never arbitrary commands from the queue.

    python worker.py            # run forever, poll every poll_seconds
    python worker.py --once     # process what is pending, then exit

Token: a fine-grained GitHub token for this one repository with "Contents: Read and write",
in the environment variable GITHUB_TOKEN. Never put it in config.json or in the repo.
"""
import base64, json, os, platform, re, subprocess, sys, time, traceback
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "config.json")))
REPO = CFG["repo"]
BRANCH = CFG.get("branch", "render-queue")
TOKEN = os.environ.get("GITHUB_TOKEN", "")
API = "https://api.github.com"
H = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json",
     "X-GitHub-Api-Version": "2022-11-28"}
MAX_FILE = 95 * 1024 * 1024  # GitHub refuses files over 100 MB


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def gh(method, path, **kw):
    r = requests.request(method, API + path, headers=kw.pop("headers", H), timeout=300, **kw)
    if r.status_code >= 400:
        raise RuntimeError(f"GitHub {method} {path} -> {r.status_code}: {r.text[:300]}")
    return r.json() if r.content and "json" in r.headers.get("content-type", "") else r.content


def head_sha():
    return gh("GET", f"/repos/{REPO}/git/ref/heads/{BRANCH}")["object"]["sha"]


def pending(sha):
    tree = gh("GET", f"/repos/{REPO}/git/trees/{sha}?recursive=1")["tree"]
    return sorted(t["path"] for t in tree if t["type"] == "blob"
                  and t["path"].startswith("jobs/pending/") and t["path"].endswith(".json"))


def fetch(path):
    """Read a file from the queue branch (voice samples, workflows, start images)."""
    h = dict(H, Accept="application/vnd.github.raw")
    return gh("GET", f"/repos/{REPO}/contents/{path}?ref={BRANCH}", headers=h)


def commit(files, delete, message):
    """One commit with all outputs; retried on top of a newer head if Claude pushed meanwhile."""
    blobs = []
    for path, data in files.items():
        if len(data) > MAX_FILE:
            raise RuntimeError(f"{path} is {len(data) >> 20} MB, over GitHub's limit - split the job")
        b = gh("POST", f"/repos/{REPO}/git/blobs",
               json={"content": base64.b64encode(data).decode(), "encoding": "base64"})
        blobs.append({"path": path, "mode": "100644", "type": "blob", "sha": b["sha"]})
    for attempt in range(5):
        base = head_sha()
        base_tree = gh("GET", f"/repos/{REPO}/git/commits/{base}")["tree"]["sha"]
        entries = blobs + [{"path": p, "mode": "100644", "type": "blob", "sha": None} for p in delete]
        tree = gh("POST", f"/repos/{REPO}/git/trees", json={"base_tree": base_tree, "tree": entries})
        c = gh("POST", f"/repos/{REPO}/git/commits",
               json={"message": message, "tree": tree["sha"], "parents": [base]})
        try:
            gh("PATCH", f"/repos/{REPO}/git/refs/heads/{BRANCH}", json={"sha": c["sha"]})
            return
        except RuntimeError as e:
            log("branch moved, retrying commit", attempt + 1, str(e)[:80])
            time.sleep(3)
    raise RuntimeError("could not commit after 5 tries")


# ---------------- job types ----------------

def job_ping(job):
    """Connectivity test: reports what this machine has."""
    info = {"host": platform.node(), "os": platform.platform(), "python": sys.version.split()[0]}
    try:
        info["gpu"] = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total,driver_version",
                                      "--format=csv,noheader"], capture_output=True, text=True,
                                     timeout=20).stdout.strip()
    except Exception as e:
        info["gpu"] = f"nvidia-smi failed: {e}"
    try:
        import psutil
        info["ram_gb"] = round(psutil.virtual_memory().total / 2**30, 1)
        info["disk_free_gb"] = round(psutil.disk_usage(HERE).free / 2**30, 1)
    except ImportError:
        info["ram_gb"] = "install psutil to see this"
    try:
        import torch
        info["torch"] = torch.__version__
        info["cuda"] = torch.cuda.is_available()
        if torch.cuda.is_available():
            info["cuda_arch"] = ".".join(map(str, torch.cuda.get_device_capability(0)))
    except ImportError:
        info["torch"] = "not installed"
    try:
        info["comfyui"] = requests.get(CFG.get("comfy_url", "http://127.0.0.1:8188") + "/system_stats",
                                       timeout=5).json().get("system", {})
    except Exception as e:
        info["comfyui"] = f"not reachable: {e.__class__.__name__}"
    return {"info.json": json.dumps(info, indent=1).encode()}


def free_comfy():
    """Ask ComfyUI to drop its models from VRAM (12 GB cards cannot hold Wan and the voice at once)."""
    try:
        requests.post(CFG.get("comfy_url", "http://127.0.0.1:8188") + "/free",
                      json={"unload_models": True, "free_memory": True}, timeout=10)
    except Exception:
        pass  # ComfyUI not running - nothing to free


def free_voice():
    """Unload the voice models from this process before a video job."""
    if "tts" in sys.modules:
        t = sys.modules["tts"]
        if t._tts is not None or t._asr is not None:
            t._tts = t._asr = None
            import gc, torch
            gc.collect()
            torch.cuda.empty_cache()
            log("  voice models unloaded to make room for video")


def job_tts(job):
    free_comfy()
    import tts
    return tts.run(job, fetch, CFG)


def job_comfy(job):
    free_voice()
    import comfy
    return comfy.run(job, fetch, CFG)


def job_qtts(job):
    """Qwen3-TTS runs in its own venv (venv-qwen, see setup_qwen.bat) because it needs another transformers."""
    free_comfy()
    free_voice()
    import tempfile, glob
    py = os.path.join(HERE, "venv-qwen", "Scripts", "python.exe")
    if not os.path.exists(py):
        py = os.path.join(HERE, "venv-qwen", "bin", "python")
    if not os.path.exists(py):
        raise RuntimeError("venv-qwen is missing: run setup_qwen.bat once")
    tmp = tempfile.mkdtemp(prefix="qtts_")
    job = dict(job)
    if job.get("clone", {}).get("ref"):
        ref = os.path.join(tmp, "ref" + os.path.splitext(job["clone"]["ref"])[1])
        open(ref, "wb").write(fetch(job["clone"]["ref"]))
        job["clone"] = dict(job["clone"], ref_path=ref)
    jp = os.path.join(tmp, "job.json")
    json.dump(job, open(jp, "w", encoding="utf-8"), ensure_ascii=False)
    out = os.path.join(tmp, "out")
    r = subprocess.run([py, os.path.join(HERE, "qtts.py"), jp, out], capture_output=True, text=True,
                       timeout=job.get("timeout", 7200))
    log(r.stdout.strip()[-1500:])
    if r.returncode:
        raise RuntimeError("qtts failed: " + r.stderr[-2500:])
    import soundfile as sf
    files = {}
    for f in sorted(glob.glob(os.path.join(out, "*.wav"))):
        data, sr = sf.read(f)
        name = os.path.splitext(os.path.basename(f))[0] + ".flac"
        sf.write(os.path.join(out, name), data, sr, format="FLAC")
        files[name] = open(os.path.join(out, name), "rb").read()
    return files


def job_stock(job):
    """Free stock footage, free for commercial use. Keys are set on this PC with setx:
    PIXABAY_API_KEY (pixabay.com/api/docs) and/or PEXELS_API_KEY. Pixabay is tried first.
    {"type": "stock", "queries": [{"q": "svalbard snow", "n": 3}], "min_seconds": 5, "max_width": 1920}"""
    pix, pex = os.environ.get("PIXABAY_API_KEY"), os.environ.get("PEXELS_API_KEY")
    if not (pix or pex):
        raise RuntimeError("no stock key: setx PIXABAY_API_KEY \"...\" and restart the worker")
    maxw, mins = job.get("max_width", 1920), job.get("min_seconds", 5)

    def search(q):
        out = []  # (source, id, page_url, author, seconds, width, height, link)
        if pix:
            r = requests.get("https://pixabay.com/api/videos/", timeout=30,
                             params={"key": pix, "q": q[:100], "per_page": 50, "safesearch": "true"})
            r.raise_for_status()
            for h in r.json().get("hits", []):
                vs = [v for v in h["videos"].values() if v.get("url") and v.get("width") and v["width"] <= maxw]
                if vs:
                    v = max(vs, key=lambda v: v["width"])
                    out.append(("pixabay", h["id"], h["pageURL"], h.get("user"), h["duration"], v["width"],
                                v["height"], v["url"]))
        if pex:
            r = requests.get("https://api.pexels.com/videos/search", headers={"Authorization": pex}, timeout=30,
                             params={"query": q, "per_page": 30, "orientation": "landscape"})
            r.raise_for_status()
            for v in r.json().get("videos", []):
                fs = [f for f in v["video_files"] if f.get("width") and f["width"] <= maxw
                      and f.get("file_type") == "video/mp4"]
                if fs:
                    f = max(fs, key=lambda f: f["width"])
                    out.append(("pexels", v["id"], v["url"], v.get("user", {}).get("name"), v["duration"],
                                f["width"], f["height"], f["link"]))
        return out

    files, manifest, seen = {}, [], set()
    for item in job["queries"]:
        got = 0
        for src, vid, page, author, secs, w, h, link in search(item["q"]):
            if got >= item.get("n", 3):
                break
            if (src, vid) in seen or secs < mins or w < h:
                continue
            data = requests.get(link, timeout=300).content
            if len(data) > MAX_FILE * 0.9:
                continue
            name = f"{re.sub(r'[^a-z0-9]+', '-', item['q'].lower())[:30]}_{src}{vid}.mp4"
            files[name] = data
            seen.add((src, vid)); got += 1
            manifest.append({"file": name, "query": item["q"], "source": src, "id": vid, "url": page,
                             "author": author, "seconds": secs, "width": w, "height": h})
            log(f"  {name} {w}x{h} {secs} s")
    files["manifest.json"] = json.dumps(manifest, indent=1, ensure_ascii=False).encode()
    return files


def job_eleven(job):
    """ElevenLabs speech. Key on this PC: setx ELEVENLABS_API_KEY "...".
    {"type": "eleven", "lines": [{"name": "l1", "text": "..."}], "voice_id": "...", "model": "eleven_multilingual_v2",
     "settings": {"stability": 0.4, "similarity_boost": 0.8, "style": 0.3}}   no lines = list voices"""
    key = os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVEN_API_KEY") or os.environ.get("XI_API_KEY")
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY is not set on this PC (setx ELEVENLABS_API_KEY ... then reopen the worker)")
    h = {"xi-api-key": key}
    if not job.get("lines"):
        r = requests.get("https://api.elevenlabs.io/v1/voices", headers=h, timeout=60); r.raise_for_status()
        v = [{"id": x["voice_id"], "name": x["name"], "labels": x.get("labels"), "category": x.get("category")}
             for x in r.json()["voices"]]
        return {"voices.json": json.dumps(v, indent=1, ensure_ascii=False).encode()}
    files = {}
    for ln in job["lines"]:
        r = requests.post(f"https://api.elevenlabs.io/v1/text-to-speech/{job['voice_id']}?output_format=mp3_44100_192",
                          headers=h, timeout=300, json={"text": ln["text"], "model_id": job.get("model", "eleven_multilingual_v2"),
                                                       "voice_settings": job.get("settings", {})})
        if r.status_code != 200:
            raise RuntimeError(f"ElevenLabs {r.status_code}: {r.text[:500]}")
        files[ln["name"] + ".mp3"] = r.content
    return files


def job_restart(job):
    """Exit after this job; start_worker.bat pulls the newest code and starts the worker again."""
    return {"note.txt": b"worker restarting to load new code"}


HANDLERS = {"ping": job_ping, "tts": job_tts, "comfy": job_comfy, "restart": job_restart, "qtts": job_qtts, "stock": job_stock, "eleven": job_eleven}


def process(path):
    job = json.loads(fetch(path))
    jid = job.get("id") or os.path.basename(path)[:-5]
    kind = job.get("type")
    log(f"job {jid} ({kind})")
    t0 = time.time()
    record = dict(job, finished=time.strftime("%Y-%m-%d %H:%M:%S"))
    files = {}
    try:
        if kind not in HANDLERS:
            raise ValueError(f"unknown job type {kind!r}; allowed: {sorted(HANDLERS)}")
        out = HANDLERS[kind](job)
        for name, data in out.items():
            files[f"outputs/{jid}/{name}"] = data
        record.update(status="done", outputs=sorted(files), seconds=round(time.time() - t0))
        dest = f"jobs/done/{jid}.json"
        log(f"  done in {record['seconds']} s, {len(files)} file(s)")
    except Exception:
        record.update(status="failed", error=traceback.format_exc()[-3000:], seconds=round(time.time() - t0))
        dest = f"jobs/failed/{jid}.json"
        files = {}
        log("  FAILED:", record["error"].strip().splitlines()[-1])
    files[dest] = json.dumps(record, indent=1, ensure_ascii=False).encode()
    commit(files, [path], f"worker: {jid} {record['status']}")
    if kind == "restart":
        log("restart requested: exiting so start_worker.bat can update and restart")
        sys.exit(0)


def main():
    if not TOKEN:
        sys.exit("Set the GITHUB_TOKEN environment variable first (see README).")
    once = "--once" in sys.argv
    log(f"worker for {REPO}@{BRANCH}, polling every {CFG.get('poll_seconds', 60)} s")
    while True:
        try:
            for p in pending(head_sha()):
                process(p)
        except Exception as e:
            log("error:", e)
        if once:
            break
        time.sleep(CFG.get("poll_seconds", 60))


if __name__ == "__main__":
    main()
