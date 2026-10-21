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
import base64, json, os, platform, subprocess, sys, time, traceback
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


def job_tts(job):
    import tts
    return tts.run(job, fetch, CFG)


def job_comfy(job):
    import comfy
    return comfy.run(job, fetch, CFG)


HANDLERS = {"ping": job_ping, "tts": job_tts, "comfy": job_comfy}


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
