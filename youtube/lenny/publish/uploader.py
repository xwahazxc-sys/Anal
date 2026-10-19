"""Upload queued videos through YouTube Studio with Playwright.

Reads youtube/lenny/publish/queue.json. Which ids to upload comes from the IDS env var
(workflow_dispatch input) or, on a push, from youtube/lenny/publish/run.json {"ids": [...]}.

Secrets come only from env (YT_COOKIES, YT_PROXY) and are never printed.
Screenshots of every step go to shots/ (uploaded as a workflow artifact).
"""
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
PUB = ROOT / "youtube/lenny/publish"
SHOTS = ROOT / "shots"
SHOTS.mkdir(exist_ok=True)


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def parse_cookies(text):
    out = []
    for line in text.splitlines():
        http_only = False
        if line.startswith("#HttpOnly_"):
            line = line[len("#HttpOnly_"):]
            http_only = True
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 7:
            continue
        domain, _flag, path, secure, expiry, name, value = parts[:7]
        c = {"name": name, "value": value.strip(), "domain": domain, "path": path or "/",
             "secure": secure.upper() == "TRUE" or name.startswith("__Secure-"), "httpOnly": http_only,
             "sameSite": "None" if (secure.upper() == "TRUE" or name.startswith("__Secure-")) else "Lax"}
        try:
            exp = int(float(expiry))
            if exp > 0:
                c["expires"] = exp
        except ValueError:
            pass
        out.append(c)
    return out


def parse_proxy(s):
    s = s.strip()
    m = re.match(r"^(?:(\w+)://)?([^:@/]+):([^:@/]+)@([^:/]+):(\d+)/?$", s)
    if m:
        scheme, user, pw, host, port = m.groups()
        return {"server": f"{scheme or 'http'}://{host}:{port}", "username": user, "password": pw}
    parts = s.split(":")
    if len(parts) == 4:
        host, port, user, pw = parts
        return {"server": f"http://{host}:{port}", "username": user, "password": pw}
    if len(parts) == 2:
        return {"server": f"http://{s}"}
    sys.exit("YT_PROXY format not recognised (want host:port:user:pass)")


step_no = [0]


def shot(page, name):
    step_no[0] += 1
    try:
        page.screenshot(path=str(SHOTS / f"{step_no[0]:02d}_{name}.png"))
    except Exception as e:  # screenshots are best effort
        log("screenshot failed", name, e)


def set_text(page, selector, text):
    box = page.locator(selector).first
    box.click()
    page.keyboard.press("Control+A")
    page.keyboard.press("Delete")
    # type in chunks: Studio's contenteditable drops characters on one huge insert
    for i in range(0, len(text), 400):
        page.keyboard.insert_text(text[i:i + 400])
    time.sleep(0.5)


def try_click(page, selector, timeout=4000):
    try:
        page.locator(selector).first.click(timeout=timeout)
        return True
    except Exception:
        return False


def upload_one(page, item):
    vid = ROOT / item["file"]
    if not vid.exists():
        raise SystemExit(f"missing file {item['file']}")
    log("upload", item["id"], vid.name, f"{vid.stat().st_size // 1_000_000} MB")

    page.goto("https://studio.youtube.com", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    shot(page, f"{item['id']}_studio")
    if "accounts.google.com" in page.url or "ServiceLogin" in page.url:
        raise SystemExit("Not signed in: the cookies were rejected or expired. Export fresh cookies.")

    # open the upload dialog (Studio's layout changes, so try several ways)
    def file_input_ready(t=8000):
        try:
            page.wait_for_selector('input[type="file"]', state="attached", timeout=t)
            return True
        except Exception:
            return False

    opened = False
    for how in ("upload-icon", "create-menu", "url"):
        try:
            if how == "upload-icon":
                page.get_by_role("button", name=re.compile(r"upload", re.I)).first.click(timeout=6000)
            elif how == "create-menu":
                page.get_by_role("button", name=re.compile(r"^\s*create", re.I)).first.click(timeout=6000)
                page.wait_for_timeout(800)
                page.get_by_text(re.compile(r"upload videos?", re.I)).first.click(timeout=6000)
            else:
                page.goto("https://www.youtube.com/upload", wait_until="domcontentloaded")
                page.wait_for_timeout(5000)
        except Exception as e:
            log("open via", how, "failed:", type(e).__name__)
            continue
        if file_input_ready():
            opened = True
            log("upload dialog opened via", how)
            break
    shot(page, f"{item['id']}_dialog")
    if not opened:
        raise SystemExit("could not open the upload dialog")
    page.locator('input[type="file"]').first.set_input_files(str(vid))
    log("file selected")

    page.wait_for_selector("#title-textarea #textbox", timeout=120000)
    page.wait_for_timeout(2500)
    set_text(page, "#title-textarea #textbox", item["title"])
    set_text(page, "#description-textarea #textbox", item["description"])
    shot(page, f"{item['id']}_details")

    thumb = item.get("thumbnail")
    if thumb and (ROOT / thumb).exists():
        try:
            page.locator("input#file-loader").first.set_input_files(str(ROOT / thumb), timeout=10000)
            page.wait_for_timeout(3000)
            log("thumbnail set")
        except Exception as e:
            log("thumbnail skipped (account may need phone verification):", type(e).__name__)

    # audience: not made for kids
    try_click(page, 'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]', 10000)

    # show more → tags, altered content
    if try_click(page, "#toggle-button", 5000):
        page.wait_for_timeout(1000)
        if item.get("altered", True):
            try_click(page, 'tp-yt-paper-radio-button[name="VIDEO_HAS_ALTERED_CONTENT_YES"]', 3000)
        tags = item.get("tags") or []
        if tags:
            try:
                inp = page.locator("#tags-container input#text-input, ytcp-form-input-container#tags-container input").first
                inp.click(timeout=5000)
                inp.fill(",".join(tags)[:480])
                page.keyboard.press("Enter")
                log("tags set", len(tags))
            except Exception as e:
                log("tags skipped:", type(e).__name__)
    shot(page, f"{item['id']}_more")

    # Details → Video elements → Checks → Visibility
    for _ in range(3):
        page.locator("#next-button").first.click(timeout=20000)
        page.wait_for_timeout(1500)
    shot(page, f"{item['id']}_visibility")

    vis = item.get("visibility", "private")
    if vis == "schedule" and item.get("publishAt"):
        schedule(page, item["publishAt"])
    else:
        page.locator('tp-yt-paper-radio-button[name="PRIVATE"]').first.click(timeout=10000)
    page.wait_for_timeout(1000)
    shot(page, f"{item['id']}_visibility_set")

    # keep the page open until the file has fully uploaded
    t0 = time.time()
    while time.time() - t0 < 3600:
        label = ""
        try:
            label = page.locator("ytcp-video-upload-progress .progress-label, span.progress-label").first.inner_text(timeout=3000)
        except Exception:
            pass
        if label and "upload" in label.lower() and ("%" in label or "uploading" in label.lower()) and "complete" not in label.lower():
            if int(time.time() - t0) % 60 < 5:
                log("progress:", label.strip()[:60])
            time.sleep(5)
            continue
        break
    link = ""
    try:
        link = page.locator("a.style-scope.ytcp-video-info, ytcp-video-info a").first.get_attribute("href", timeout=5000) or ""
    except Exception:
        pass
    page.locator("#done-button").first.click(timeout=30000)
    page.wait_for_timeout(5000)
    shot(page, f"{item['id']}_done")
    try_click(page, "ytcp-button#close-button", 5000)
    log("done", item["id"], link)
    return link


def schedule(page, when_iso):
    """Visibility step: Schedule at a given local time. when_iso like 2026-10-20T12:00 (channel time zone)."""
    when = datetime.fromisoformat(when_iso)
    try_click(page, "#second-container-expand-button", 10000)
    page.wait_for_timeout(1000)
    # date
    page.locator("#datepicker-trigger").first.click(timeout=10000)
    page.wait_for_timeout(600)
    date_in = page.locator("ytcp-date-picker tp-yt-paper-input input, #input-1 input").first
    date_in.fill(when.strftime("%b %-d, %Y"))
    page.keyboard.press("Enter")
    page.wait_for_timeout(600)
    # time
    time_in = page.locator("#time-of-day-container tp-yt-paper-input input, ytcp-form-input-container#time-of-day-container input").first
    time_in.fill(when.strftime("%-I:%M %p"))
    page.keyboard.press("Enter")
    page.wait_for_timeout(600)
    log("scheduled for", when.strftime("%b %-d, %Y %-I:%M %p"))


def audit(page):
    """Read-only tour of the channel: screenshots + visible text of every setup page."""
    out = SHOTS / "audit_text"
    out.mkdir(exist_ok=True)

    def grab(name, url=None, wait=6000, scroll=True):
        if url:
            page.goto(url, wait_until="domcontentloaded")
        page.wait_for_timeout(wait)
        try:
            page.screenshot(path=str(SHOTS / f"a_{name}.png"), full_page=scroll)
        except Exception as e:
            log("shot failed", name, type(e).__name__)
        try:
            (out / f"{name}.txt").write_text(page.inner_text("body"))
        except Exception:
            pass
        log("audit page", name, page.url[:90])

    page.goto("https://studio.youtube.com", wait_until="domcontentloaded")
    page.wait_for_timeout(6000)
    m = re.search(r"/channel/(UC[\w-]+)", page.url)
    if not m:
        raise SystemExit("could not find the channel id (not signed in?)")
    base = f"https://studio.youtube.com/channel/{m.group(1)}"
    log("channel", m.group(1))
    grab("dashboard")
    grab("profile", f"{base}/editing/profile")
    # read form values that inner_text misses
    try:
        vals = page.evaluate("""() => [...document.querySelectorAll('input, textarea, #textbox')].map(e =>
            (e.getAttribute('aria-label')||e.id||e.name||'') + ' = ' + (e.value ?? e.innerText ?? '')).filter(x => x.length > 4)""")
        (out / "profile_values.txt").write_text("\n".join(vals))
    except Exception:
        pass
    grab("branding", f"{base}/editing/images")
    grab("layout", f"{base}/editing/sections")
    grab("content", f"{base}/videos/upload")
    # first video's details page
    try:
        page.locator("a#video-title, ytcp-video-list-cell-video a#anchor-video-title, a#thumbnail-anchor").first.click(timeout=8000)
        page.wait_for_timeout(7000)
        grab("video_details", wait=1000)
        vals = page.evaluate("""() => [...document.querySelectorAll('#textbox, input')].map(e =>
            (e.getAttribute('aria-label')||e.id||'') + ' = ' + (e.value ?? e.innerText ?? '')).filter(x => x.length > 4)""")
        (out / "video_values.txt").write_text("\n".join(vals))
        try:
            page.get_by_text(re.compile(r"show more", re.I)).first.click(timeout=4000)
            page.wait_for_timeout(1500)
            grab("video_details_more", wait=500)
        except Exception:
            pass
    except Exception as e:
        log("video details skipped:", type(e).__name__)
    # settings dialog: channel basic info / advanced / upload defaults
    try:
        page.goto(base, wait_until="domcontentloaded"); page.wait_for_timeout(5000)
        page.get_by_text(re.compile(r"^\s*settings\s*$", re.I)).first.click(timeout=8000)
        page.wait_for_timeout(2500)
        grab("settings_general", wait=500, scroll=False)
        for tab in ("Channel", "Upload defaults", "Permissions"):
            try:
                page.get_by_text(re.compile(rf"^\s*{tab}\s*$", re.I)).first.click(timeout=5000)
                page.wait_for_timeout(2000)
                grab(f"settings_{tab.lower().replace(' ', '_')}", wait=300, scroll=False)
                if tab == "Channel":
                    page.get_by_text(re.compile(r"^\s*advanced settings\s*$", re.I)).first.click(timeout=5000)
                    page.wait_for_timeout(1500)
                    grab("settings_channel_advanced", wait=300, scroll=False)
                    page.get_by_text(re.compile(r"^\s*feature eligibility\s*$", re.I)).first.click(timeout=5000)
                    page.wait_for_timeout(1500)
                    grab("settings_features", wait=300, scroll=False)
            except Exception as e:
                log("settings tab", tab, "skipped:", type(e).__name__)
    except Exception as e:
        log("settings skipped:", type(e).__name__)
    # public side
    grab("public_home", f"https://www.youtube.com/channel/{m.group(1)}", wait=6000)
    grab("public_videos", f"https://www.youtube.com/channel/{m.group(1)}/videos", wait=5000)
    grab("public_about", f"https://www.youtube.com/channel/{m.group(1)}/about", wait=5000)


def main():
    cookies = os.environ.get("YT_COOKIES", "")
    proxy = os.environ.get("YT_PROXY", "")
    if not cookies or not proxy:
        sys.exit("YT_COOKIES and YT_PROXY secrets must both be set")
    ids = [x.strip() for x in (os.environ.get("IDS") or "").split(",") if x.strip()]
    if not ids and (PUB / "run.json").exists():
        ids = json.loads((PUB / "run.json").read_text())["ids"]
    queue = {i["id"]: i for i in json.loads((PUB / "queue.json").read_text())}
    do_audit = "audit" in ids
    ids = [i for i in ids if i != "audit"]
    todo = []
    for raw in ids:  # "ep02:private" uploads ep02 but keeps it private (for tests)
        i, _, mode = raw.partition(":")
        if i in queue:
            item = dict(queue[i])
            if mode == "private":
                item["visibility"] = "private"
            todo.append(item)
    if not todo and not do_audit:
        sys.exit(f"nothing to upload for ids {ids}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, proxy=parse_proxy(proxy),
                                    args=["--disable-blink-features=AutomationControlled"])
        ctx = browser.new_context(locale="en-US", viewport={"width": 1440, "height": 1000},
                                  user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36")
        ctx.add_cookies(parse_cookies(cookies))
        page = ctx.new_page()
        page.set_default_timeout(30000)
        # where does the proxy exit? (country only, for the log)
        try:
            page.goto("https://ipinfo.io/json", timeout=30000)
            info = json.loads(page.inner_text("body"))
            log("proxy exit country:", info.get("country"), info.get("region"))
        except Exception as e:
            log("proxy check failed:", type(e).__name__)
        results = {}
        if do_audit:
            try:
                audit(page)
            except Exception as e:
                shot(page, "audit_error")
                log("AUDIT FAILED", type(e).__name__, str(e)[:300])
                results["audit"] = "FAILED"
        for item in todo:
            try:
                results[item["id"]] = upload_one(page, item) or "ok"
            except (PWTimeout, Exception) as e:
                shot(page, f"{item['id']}_error")
                log("FAILED", item["id"], type(e).__name__, str(e)[:300])
                results[item["id"]] = "FAILED"
        browser.close()
    log("results", json.dumps(results))
    if any(v == "FAILED" for v in results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
