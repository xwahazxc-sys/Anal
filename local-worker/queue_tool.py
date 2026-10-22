#!/usr/bin/env python3
"""Cloud side of the render queue (used by Claude): put jobs in, read results out.

    python3 queue_tool.py init                         # create the render-queue branch once
    python3 queue_tool.py add job.json [repo/path=local/file ...]   # queue a job (+ input files)
    python3 queue_tool.py status                       # pending / done / failed
    python3 queue_tool.py get <job-id> <dest-dir>      # copy outputs/<job-id>/ to dest-dir

Works through a git worktree of the render-queue branch (default ~/.render-queue),
so it needs nothing but git and push access to the repository.
"""
import json, os, shutil, subprocess, sys, tempfile, time

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRANCH = os.environ.get("QUEUE_BRANCH", "render-queue")
WT = os.path.expanduser(os.environ.get("QUEUE_WORKTREE", "~/.render-queue"))


def git(*a, cwd=None, check=True):
    return subprocess.run(["git", *a], cwd=cwd or REPO_DIR, check=check, capture_output=True, text=True)


def retry(*a, cwd=None):
    for wait in (0, 2, 4, 8, 16):
        time.sleep(wait)
        r = git(*a, cwd=cwd, check=False)
        if r.returncode == 0:
            return r
    sys.exit(f"git {' '.join(a)} failed: {r.stderr.strip()}")


def worktree():
    retry("fetch", "origin", BRANCH)
    if not os.path.isdir(WT):
        git("worktree", "add", "-B", BRANCH, WT, f"origin/{BRANCH}")
    else:
        git("checkout", BRANCH, cwd=WT)
        git("reset", "--hard", f"origin/{BRANCH}", cwd=WT)
    return WT


def push(msg):
    git("add", "-A", cwd=WT)
    if git("diff", "--cached", "--quiet", cwd=WT, check=False).returncode == 0:
        return print("nothing to commit")
    git("commit", "-m", msg, cwd=WT)
    for _ in range(5):  # the worker may have pushed results meanwhile
        if git("push", "origin", BRANCH, cwd=WT, check=False).returncode == 0:
            return print("pushed:", msg)
        retry("fetch", "origin", BRANCH)
        git("rebase", f"origin/{BRANCH}", cwd=WT)
    sys.exit("push failed")


def init():
    """Create the queue branch from a separate empty repo, so nothing from the main branches leaks in."""
    if git("ls-remote", "--exit-code", "--heads", "origin", BRANCH, check=False).returncode == 0:
        return print(f"{BRANCH} already exists")
    url = git("remote", "get-url", "origin").stdout.strip()
    name = git("config", "user.name", check=False).stdout.strip() or "Claude"
    mail = git("config", "user.email", check=False).stdout.strip() or "noreply@anthropic.com"
    tmp = tempfile.mkdtemp(prefix="render-queue-")
    git("init", "-q", "-b", BRANCH, tmp, cwd=tmp)
    for d in ("jobs/pending", "jobs/done", "jobs/failed", "outputs", "voices", "workflows", "inputs"):
        os.makedirs(os.path.join(tmp, d), exist_ok=True)
        open(os.path.join(tmp, d, ".gitkeep"), "w").close()
    open(os.path.join(tmp, "README.md"), "w").write(
        "# render-queue\n\nQueue between Claude (cloud) and the local GPU worker. See local-worker/README.md "
        "on the main branches. Do not merge this branch anywhere.\n")
    git("add", "-A", cwd=tmp)
    git("-c", f"user.name={name}", "-c", f"user.email={mail}", "commit", "-qm", "render-queue: empty queue", cwd=tmp)
    retry("push", url, f"HEAD:refs/heads/{BRANCH}", cwd=tmp)
    shutil.rmtree(tmp, ignore_errors=True)
    print("created", BRANCH)


def add(job_file, extra):
    job = json.load(open(job_file))
    jid = job["id"]
    wt = worktree()
    for pair in extra:
        dst, src = pair.split("=", 1)
        os.makedirs(os.path.dirname(os.path.join(wt, dst)), exist_ok=True)
        shutil.copy(src, os.path.join(wt, dst))
    json.dump(job, open(os.path.join(wt, "jobs/pending", jid + ".json"), "w"), indent=1, ensure_ascii=False)
    push(f"queue: {jid} ({job['type']})")


def status():
    wt = worktree()
    for state in ("pending", "done", "failed"):
        d = os.path.join(wt, "jobs", state)
        ids = sorted(f[:-5] for f in os.listdir(d) if f.endswith(".json"))
        print(f"{state:8} {len(ids):3}  {' '.join(ids[-15:])}")
        if state == "failed":
            for i in ids[-3:]:
                err = json.load(open(os.path.join(d, i + ".json"))).get("error", "").strip().splitlines()
                print(f"         {i}: {err[-1] if err else '?'}")


def get(jid, dest):
    wt = worktree()
    src = os.path.join(wt, "outputs", jid)
    if not os.path.isdir(src):
        sys.exit(f"no outputs for {jid} yet")
    shutil.copytree(src, dest, dirs_exist_ok=True)
    print("copied", sorted(os.listdir(src)), "->", dest)


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    {"init": lambda: init(), "status": lambda: status(),
     "add": lambda: add(a[1], a[2:]), "get": lambda: get(a[1], a[2])}[a[0]]()
