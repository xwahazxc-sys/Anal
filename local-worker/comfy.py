"""Image / video jobs through your local ComfyUI (http://127.0.0.1:8188).

Job example (jobs/pending/lr-dracula-shot03.json):
{
  "id": "lr-dracula-shot03", "type": "comfy",
  "workflow": "workflows/wan22_i2v_14b.json",     # API-format workflow on the queue branch
  "files": {"start_image": "inputs/lr-dracula/shot03.png"},   # uploaded to ComfyUI first
  "vars": {"prompt": "Count Dracula descends the castle stairs, 1956 Technicolor", "seed": 42},
  "timeout": 3600
}
In the workflow JSON, write placeholders as strings: "{{prompt}}", "{{seed}}", "{{start_image}}".
A value that is exactly "{{name}}" is replaced with the value as-is (numbers stay numbers);
a placeholder inside a longer string is replaced as text.
Output: every file the workflow saved (images, mp4/webp/gif), named as ComfyUI named them.
"""
import json, re, time, uuid
import requests


def fill(node, vars):
    if isinstance(node, dict):
        return {k: fill(v, vars) for k, v in node.items()}
    if isinstance(node, list):
        return [fill(v, vars) for v in node]
    if isinstance(node, str):
        m = re.fullmatch(r"\{\{(\w+)\}\}", node)
        if m and m.group(1) in vars:
            return vars[m.group(1)]
        return re.sub(r"\{\{(\w+)\}\}", lambda x: str(vars.get(x.group(1), x.group(0))), node)
    return node


def run(job, fetch, cfg):
    url = cfg.get("comfy_url", "http://127.0.0.1:8188")
    vars = dict(job.get("vars", {}))
    for key, path in job.get("files", {}).items():
        name = f"{job['id']}_{path.rsplit('/', 1)[-1]}"
        r = requests.post(f"{url}/upload/image", files={"image": (name, fetch(path))},
                          data={"overwrite": "true"}, timeout=120)
        r.raise_for_status()
        vars[key] = r.json()["name"]
    wf = fill(json.loads(fetch(job["workflow"])), vars)
    left = re.findall(r"\{\{\w+\}\}", json.dumps(wf))
    if left:
        raise ValueError(f"workflow placeholders without a value: {sorted(set(left))}")
    r = requests.post(f"{url}/prompt", json={"prompt": wf, "client_id": str(uuid.uuid4())}, timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"ComfyUI refused the workflow: {r.text[:1500]}")
    pid = r.json()["prompt_id"]
    deadline = time.time() + job.get("timeout", 3600)
    while time.time() < deadline:
        h = requests.get(f"{url}/history/{pid}", timeout=30).json()
        if pid in h:
            break
        time.sleep(5)
    else:
        raise TimeoutError(f"ComfyUI did not finish in {job.get('timeout', 3600)} s")
    st = h[pid].get("status", {})
    if st.get("status_str") == "error":
        raise RuntimeError("ComfyUI error: " + json.dumps(st.get("messages", []))[-1500:])
    out = {}
    for node_out in h[pid].get("outputs", {}).values():
        for items in node_out.values():
            if not isinstance(items, list):
                continue
            for it in items:
                if isinstance(it, dict) and "filename" in it and it.get("type", "output") == "output":
                    v = requests.get(f"{url}/view", params={"filename": it["filename"],
                                     "subfolder": it.get("subfolder", ""), "type": "output"}, timeout=300)
                    v.raise_for_status()
                    out[it["filename"]] = v.content
    if not out:
        raise RuntimeError("workflow finished but saved no files (is there a Save node?)")
    return out
