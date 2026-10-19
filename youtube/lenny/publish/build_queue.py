"""Build queue.json from the upload kits (upload.md) plus the release plan."""
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]; L = ROOT / "youtube/lenny"

def blocks(md):
    return re.findall(r"```\n(.*?)\n```", md, re.S)

def episode(n, publish_at):
    d = L / f"episodes/ep{n:02d}"
    md = (d / "upload.md").read_text()
    title = re.search(r"^# (.+)$", md, re.M).group(1).strip()
    desc = re.search(r"## Description\s*```\n(.*?)\n```", md, re.S).group(1)
    tags = [t.strip() for t in re.search(r"## Tags\s*```\n(.*?)\n```", md, re.S).group(1).split(",") if t.strip()]
    return {"id": f"ep{n:02d}", "file": f"youtube/lenny/videos/cinematic/lenny_ep{n:02d}_cinematic.mp4", "title": title,
            "description": desc, "tags": tags, "thumbnail": f"youtube/lenny/episodes/ep{n:02d}/thumbnail.png",
            "visibility": "schedule", "publishAt": publish_at}

def shorts(md_path, folder):
    md = md_path.read_text(); out = {}
    for sec in re.split(r"^## Short \d+: ", md, flags=re.M)[1:]:
        fname = re.match(r"`([^`]+)`", sec).group(1)
        b = blocks(sec)
        out[fname.split("_")[0]] = {"file": f"{folder}/{fname}", "title": b[0].strip(), "description": b[1]}
    return out

S = {**shorts(L / "shorts/upload.md", "youtube/lenny/shorts"), **shorts(L / "shorts/cinematic/upload.md", "youtube/lenny/shorts/cinematic")}
def short(k, publish_at):
    s = S[k]; return {"id": k, **s, "tags": [], "visibility": "schedule", "publishAt": publish_at}

# times are channel-local (US Eastern). Long episodes Tue & Fri 12:00 (matches the banner
# "New videos every Tue & Fri"); Shorts on the other days 15:00.
plan = [
    episode(4, "2026-10-20T12:00"), short("s1", "2026-10-21T15:00"), short("s2", "2026-10-22T15:00"),
    episode(2, "2026-10-23T12:00"), short("s3", "2026-10-24T15:00"), short("s5", "2026-10-25T15:00"), short("s8", "2026-10-26T15:00"),
    episode(5, "2026-10-27T12:00"), short("s6", "2026-10-28T15:00"), short("s4", "2026-10-19T15:00"),
    episode(8, "2026-10-30T12:00"), episode(6, "2026-11-03T12:00"), episode(3, "2026-11-06T12:00"),
    episode(7, "2026-11-10T12:00"), short("s7", "2026-11-18T15:00"),
]
# HQ masters are stored split into <95 MB parts (GitHub's file limit); the uploader joins them
for p in plan:
    hq = p["file"].replace("/cinematic/", "/cinematic/hq/")
    if p["id"].startswith("ep"):
        p["hq_parts"] = hq + ".part-"
(Path(__file__).parent / "queue.json").write_text(json.dumps(plan, indent=1, ensure_ascii=False))
for p in plan:
    print(p["id"], p["publishAt"], (ROOT / p["file"]).exists(), p["title"][:60])
