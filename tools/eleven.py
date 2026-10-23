"""Runs in GitHub Actions: jobs/eleven/<id>.json -> outputs/<id>/*.mp3 (or voices.json), job moved to jobs/done|failed."""
import glob, json, os, urllib.request

key = os.environ.get("KEY", "")
for path in sorted(glob.glob("jobs/eleven/*.json")):
    job = json.load(open(path)); jid = job["id"]; out = f"outputs/{jid}"; os.makedirs(out, exist_ok=True)
    try:
        if not key:
            raise RuntimeError("no ElevenLabs secret found (tried ELEVENLABS_API_KEY, ELEVEN_API_KEY, ELEVENLABS_KEY, ...)")
        h = {"xi-api-key": key, "Content-Type": "application/json"}
        if not job.get("lines"):
            r = urllib.request.urlopen(urllib.request.Request("https://api.elevenlabs.io/v1/voices", headers=h))
            v = [{"id": x["voice_id"], "name": x["name"], "labels": x.get("labels"), "category": x.get("category")}
                 for x in json.load(r)["voices"]]
            json.dump(v, open(f"{out}/voices.json", "w"), indent=1)
            u = urllib.request.urlopen(urllib.request.Request("https://api.elevenlabs.io/v1/user/subscription", headers=h))
            s = json.load(u); json.dump({k: s.get(k) for k in ("tier", "character_count", "character_limit")},
                                        open(f"{out}/quota.json", "w"))
        for ln in job.get("lines", []):
            body = json.dumps({"text": ln["text"], "model_id": job.get("model", "eleven_multilingual_v2"),
                               "voice_settings": job.get("settings", {})}).encode()
            r = urllib.request.urlopen(urllib.request.Request(
                f"https://api.elevenlabs.io/v1/text-to-speech/{job['voice_id']}?output_format=mp3_44100_128",
                data=body, headers=h))
            open(f"{out}/{ln['name']}.mp3", "wb").write(r.read())
        job["status"] = "done"; dest = f"jobs/done/{jid}.json"
    except Exception as e:
        msg = getattr(e, "read", lambda: b"")().decode()[:500]
        job.update(status="failed", error=f"{e} {msg}"); dest = f"jobs/failed/{jid}.json"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    json.dump(job, open(dest, "w"), indent=1); os.remove(path)
    print(jid, job["status"], job.get("error", ""))
