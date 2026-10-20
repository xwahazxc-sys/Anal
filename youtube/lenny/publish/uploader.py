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
PUB = ROOT / os.environ.get("QUEUE_DIR", "youtube/lenny/publish")
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


def _bridge_socks(host, port, user, pw):
    """Chromium can't do SOCKS5 with a password: bridge it through a local pproxy HTTP listener."""
    import subprocess
    remote = f"socks5://{host}:{port}" + (f"#{user}:{pw}" if user else "")
    subprocess.Popen(["pproxy", "-l", "http://127.0.0.1:18899", "-r", remote], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)
    return {"server": "http://127.0.0.1:18899"}


def _shape(s):
    """Redacted shape of a proxy string for logs: letters→a, digits→9, keeps separators."""
    return re.sub(r"[A-Za-z]+", "a", re.sub(r"\d+", "9", s))


def parse_proxy(s, force_socks=None):
    """Accepts any common proxy notation:
    scheme://user:pass@host:port, user:pass@host:port, host:port@user:pass,
    host:port:user:pass, scheme://host:port:user:pass, host:port (scheme defaults to http,
    PROXY_SCHEME=socks5 or force_socks=True switches to SOCKS5)."""
    raw = s.strip().splitlines()[0].strip() if s.strip() else ""
    scheme = None
    m = re.match(r"^(\w+)://(.*)$", raw)
    rest = raw
    if m:
        scheme, rest = m.group(1).lower(), m.group(2)
    rest = rest.rstrip("/")
    user = pw = None
    host = port = None
    if "@" in rest:
        left, right = rest.rsplit("@", 1)
        if re.match(r"^[^:]+:\d+$", right):          # user:pass@host:port
            host, port = right.split(":"); user, _, pw = left.partition(":")
        elif re.match(r"^[^:]+:\d+$", left):         # host:port@user:pass
            host, port = left.split(":"); user, _, pw = right.partition(":")
    else:
        parts = rest.split(":")
        if len(parts) == 4 and parts[1].isdigit():     # host:port:user:pass
            host, port, user, pw = parts
        elif len(parts) == 4 and parts[3].isdigit():   # user:pass:host:port
            user, pw, host, port = parts
        elif len(parts) == 2 and parts[1].isdigit():   # host:port
            host, port = parts
    if not host:
        sys.exit(f"proxy format not recognised, shape: {_shape(raw)}")
    if force_socks or (not scheme and os.environ.get("PROXY_SCHEME", "").startswith("socks")):
        scheme = "socks5"
    scheme = scheme or "http"
    log("proxy:", scheme, "auth" if user else "no-auth", "shape", _shape(raw))
    if scheme.startswith("socks"):
        return _bridge_socks(host, port, user, pw)
    out = {"server": f"http://{host}:{port}"}
    if user:
        out.update(username=user, password=pw)
    return out


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
    parts = sorted(ROOT.glob(item["hq_parts"] + "*")) if item.get("hq_parts") else []
    if parts:  # full-quality master, stored in parts: join it
        vid = ROOT / "hq_join" / Path(item["file"]).name
        vid.parent.mkdir(exist_ok=True)
        with open(vid, "wb") as out:
            for part in parts:
                out.write(part.read_bytes())
        log("joined HQ master from", len(parts), "parts")
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
        # animated, clearly unrealistic content: no "altered or synthetic" disclosure (owner's choice)
        try_click(page, 'tp-yt-paper-radio-button[name="VIDEO_HAS_ALTERED_CONTENT_NO"]', 3000)
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
    """Visibility step: Schedule at a given local time (browser runs in US Eastern).
    Verifies the date and time actually took; raises instead of silently publishing on the wrong day."""
    when = datetime.fromisoformat(when_iso)
    want_date = when.strftime("%b %-d, %Y")
    want_time = when.strftime("%-I:%M %p")
    try_click(page, "#second-container-expand-button", 6000)
    page.wait_for_timeout(1000)

    def trigger_text():
        try:
            return page.locator("#datepicker-trigger").first.inner_text(timeout=3000).strip()
        except Exception:
            return ""

    ok = False
    for attempt in range(4):
        page.locator("#datepicker-trigger").first.click(timeout=10000)
        page.wait_for_timeout(900)
        try:
            (SHOTS / "datepicker.html").write_text(page.locator("ytcp-date-picker, tp-yt-iron-dropdown").last.inner_html(timeout=3000)[:20000])
        except Exception:
            pass
        cands = [
            'tp-yt-paper-input[aria-label="Enter date"] input',
            "ytcp-date-picker tp-yt-paper-input input",
            "tp-yt-iron-dropdown ytcp-date-picker input",
            "ytcp-date-picker input",
            "tp-yt-paper-dialog input.tp-yt-paper-input",
        ]
        typed = False
        for sel in cands[attempt:] + cands[:attempt]:
            loc = page.locator(sel)
            for i in range(min(loc.count(), 4)):
                el = loc.nth(i)
                try:
                    if not el.is_visible():
                        continue
                    el.click(timeout=2000)
                    page.keyboard.press("Control+A")
                    page.keyboard.type(want_date, delay=30)
                    page.keyboard.press("Enter")
                    typed = True
                    break
                except Exception:
                    continue
            if typed:
                break
        if not typed:  # last resort: the focused element after opening the picker
            page.keyboard.press("Control+A")
            page.keyboard.type(want_date, delay=30)
            page.keyboard.press("Enter")
        page.wait_for_timeout(1200)  # Enter submits the picker's form and closes it (no Escape: that closes the whole dialog)
        got = trigger_text()
        log("date attempt", attempt + 1, "->", got)
        if got == want_date:
            ok = True
            break
    if not ok:
        raise RuntimeError(f"could not set publish date to {want_date} (picker shows {trigger_text()!r})")

    time_in = page.locator("#time-of-day-container input, ytcp-form-input-container#time-of-day-container input").first
    time_in.click(timeout=5000)
    page.keyboard.press("Control+A")
    page.keyboard.type(want_time, delay=30)
    page.keyboard.press("Enter")
    page.wait_for_timeout(800)
    got_t = time_in.input_value(timeout=3000).strip()
    if got_t.replace("\u202f", " ") != want_time:
        raise RuntimeError(f"could not set publish time to {want_time} (field shows {got_t!r})")
    log("scheduled for", want_date, want_time)


def reschedule(page, video_id, item):
    """Change an already uploaded video's visibility to Schedule at item['publishAt']."""
    page.goto(f"https://studio.youtube.com/video/{video_id}/edit", wait_until="domcontentloaded")
    page.wait_for_timeout(7000)
    shot(page, f"{item['id']}_edit")
    opened = False
    for sel in ("ytcp-video-metadata-visibility #select-button", "ytcp-video-metadata-visibility", "#visibility-select"):
        if try_click(page, sel, 5000):
            opened = True
            break
    if not opened:
        raise RuntimeError("could not open the visibility editor")
    page.wait_for_timeout(1500)
    shot(page, f"{item['id']}_visibility_dialog")
    schedule(page, item["publishAt"])
    shot(page, f"{item['id']}_visibility_scheduled")
    for sel in ("ytcp-video-visibility-select #save-button", "#save-button", "text=Done"):
        if try_click(page, sel, 5000):
            break
    page.wait_for_timeout(1500)
    for sel in ("ytcp-button#save", "#save", "text=Save"):
        if try_click(page, sel, 5000):
            break
    page.wait_for_timeout(4000)
    shot(page, f"{item['id']}_saved")
    log("rescheduled", video_id, "->", item["publishAt"])
    return f"https://youtu.be/{video_id}"


def set_country(page, country="United States"):
    """Settings → Channel → Basic info → Country of residence."""
    page.goto("https://studio.youtube.com", wait_until="domcontentloaded")
    page.wait_for_timeout(6000)
    page.get_by_text(re.compile(r"^\s*settings\s*$", re.I)).first.click(timeout=10000)
    page.wait_for_timeout(2500)
    page.get_by_text(re.compile(r"^\s*channel\s*$", re.I)).first.click(timeout=8000)
    page.wait_for_timeout(2000)
    page.get_by_text(re.compile(r"^\s*basic info\s*$", re.I)).first.click(timeout=8000)
    page.wait_for_timeout(1500)
    shot(page, "country_before")
    opened = False
    for sel in ("ytcp-form-select#country #select-button", "#country #select-button", "ytcp-form-select#country", "text=Select"):
        if try_click(page, sel, 5000):
            opened = True
            break
    if not opened:
        raise RuntimeError("could not open the country list")
    page.wait_for_timeout(1500)
    item = page.locator("tp-yt-paper-item, ytcp-text-menu tp-yt-paper-item").filter(has_text=re.compile(rf"^\s*{country}\s*$"))
    item.first.scroll_into_view_if_needed(timeout=8000)
    item.first.click(timeout=8000)
    page.wait_for_timeout(1500)
    shot(page, "country_selected")
    page.get_by_role("button", name=re.compile(r"^\s*save\s*$", re.I)).last.click(timeout=10000)
    page.wait_for_timeout(4000)
    shot(page, "country_saved")
    # re-open and confirm
    page.goto("https://studio.youtube.com", wait_until="domcontentloaded"); page.wait_for_timeout(5000)
    page.get_by_text(re.compile(r"^\s*settings\s*$", re.I)).first.click(timeout=10000); page.wait_for_timeout(2000)
    page.get_by_text(re.compile(r"^\s*channel\s*$", re.I)).first.click(timeout=8000); page.wait_for_timeout(2000)
    shot(page, "country_check")
    if country not in page.inner_text("body"):
        raise RuntimeError("country did not stick after save")
    log("country set to", country)


def altered_no(page, video_id, label):
    """Open an uploaded video's details and set 'Altered content' to No."""
    page.goto(f"https://studio.youtube.com/video/{video_id}/edit", wait_until="domcontentloaded")
    page.wait_for_timeout(7000)
    try:
        page.get_by_text(re.compile(r"^\s*show more\s*$", re.I)).first.click(timeout=6000)
    except Exception:
        try_click(page, "#toggle-button", 4000)
    page.wait_for_timeout(1500)
    no = page.locator('tp-yt-paper-radio-button[name="VIDEO_HAS_ALTERED_CONTENT_NO"]').first
    no.scroll_into_view_if_needed(timeout=8000)
    was = no.get_attribute("aria-checked") or no.get_attribute("checked")
    no.click(timeout=8000)
    page.wait_for_timeout(1000)
    shot(page, f"{label}_altered_no")
    saved = False
    for sel in ("ytcp-button#save", "#save"):
        btn = page.locator(sel).first
        try:
            if btn.is_enabled(timeout=3000):
                btn.click(timeout=5000)
                saved = True
                break
        except Exception:
            continue
    page.wait_for_timeout(3500)
    shot(page, f"{label}_altered_saved")
    log("altered=No", label, video_id, "was checked:" , was, "saved:", saved)


def set_related(page, short_id, episode_title):
    """Short's details → Related video → pick the episode by title → Save."""
    page.goto(f"https://studio.youtube.com/video/{short_id}/edit", wait_until="domcontentloaded")
    page.wait_for_timeout(7000)
    card = page.get_by_text(re.compile(r"related video", re.I)).first
    card.scroll_into_view_if_needed(timeout=8000)
    card.click(timeout=8000)
    page.wait_for_timeout(2500)
    shot(page, f"{short_id}_related_dialog")
    # search box in the picker, if present
    try:
        box = page.get_by_role("textbox").filter(has_not_text="").last
        page.locator("input[type='text'], input:not([type])").last.fill(episode_title[:40], timeout=4000)
        page.wait_for_timeout(2500)
    except Exception:
        pass
    pick = page.get_by_text(episode_title[:30], exact=False)
    n = pick.count()
    if n == 0:
        raise RuntimeError(f"episode {episode_title!r} not found in the related-video picker (is it public yet?)")
    pick.last.click(timeout=8000)
    page.wait_for_timeout(1500)
    for sel in ("#save-button", "text=Done"):
        if try_click(page, sel, 4000):
            break
    page.wait_for_timeout(1500)
    for sel in ("ytcp-button#save", "#save"):
        if try_click(page, sel, 5000):
            break
    page.wait_for_timeout(3500)
    shot(page, f"{short_id}_related_saved")
    log("related video set", short_id, "->", episode_title)


def brand_channel(page, prof):
    """Studio → Customization → Profile: banner, picture, name, handle, description → Publish."""
    page.goto("https://studio.youtube.com", wait_until="domcontentloaded"); page.wait_for_timeout(6000)
    m = re.search(r"/channel/(UC[\w-]+)", page.url)
    if not m:
        raise RuntimeError("no channel id (does this account have a channel yet?)")
    page.goto(f"https://studio.youtube.com/channel/{m.group(1)}/editing/profile", wait_until="domcontentloaded")
    page.wait_for_timeout(7000)
    shot(page, "brand_before")
    files = page.locator("input[type='file']")
    log("file inputs:", files.count())

    def upload_image(idx, path, label):
        try:
            files.nth(idx).set_input_files(str(ROOT / path), timeout=8000)
            page.wait_for_timeout(4000)
            shot(page, f"brand_{label}_crop")
            page.get_by_role("button", name=re.compile(r"^\s*done\s*$", re.I)).last.click(timeout=10000)
            page.wait_for_timeout(2500)
            log(label, "set")
        except Exception as e:
            log(label, "failed:", type(e).__name__, str(e)[:120])

    upload_image(0, prof["banner"], "banner")
    upload_image(1, prof["avatar"], "picture")

    def set_field(rx, value):
        box = page.get_by_label(re.compile(rx, re.I)).first
        try:
            box.click(timeout=5000); page.keyboard.press("Control+A"); page.keyboard.press("Delete")
            page.keyboard.insert_text(value); return True
        except Exception:
            return False
    # Name and Handle are plain inputs under their headings; find them by position relative to the headings
    def input_under(heading):
        h = page.get_by_text(re.compile(rf"^\s*{heading}\s*$")).first
        h.scroll_into_view_if_needed(timeout=5000)
        hb = h.bounding_box()
        best = None
        for el in page.locator("input:visible").all():
            b = el.bounding_box()
            if b and hb and b["y"] > hb["y"] and (best is None or b["y"] < best[0]):
                best = (b["y"], el)
        return best[1] if best else None

    def set_input(heading, value):
        try:
            el = input_under(heading)
            el.click(timeout=5000); page.keyboard.press("Control+A"); page.keyboard.press("Delete")
            el.type(value, delay=20)
            return el.input_value() == value
        except Exception as e:
            log("set", heading, "failed:", type(e).__name__)
            return False
    ok_name = set_input("Name", prof["name"])
    ok_handle = set_input("Handle", prof["handle"])
    ok_desc = set_field(r"tell viewers about your channel", prof["description"])
    log("fields:", "name", ok_name, "handle", ok_handle, "description", ok_desc)
    page.wait_for_timeout(3000)  # handle availability check
    shot(page, "brand_filled")
    page.get_by_role("button", name=re.compile(r"^\s*publish\s*$", re.I)).first.click(timeout=10000)
    page.wait_for_timeout(5000)
    shot(page, "brand_published")
    # keywords: Settings → Channel → Basic info
    try:
        page.goto("https://studio.youtube.com", wait_until="domcontentloaded"); page.wait_for_timeout(5000)
        page.get_by_text(re.compile(r"^\s*settings\s*$", re.I)).first.click(timeout=8000); page.wait_for_timeout(2000)
        page.get_by_text(re.compile(r"^\s*channel\s*$", re.I)).first.click(timeout=8000); page.wait_for_timeout(2000)
        kw = page.locator("#keywords-input input, ytcp-form-input-container input").last
        kw.click(timeout=5000); kw.fill(prof["keywords"]); page.keyboard.press("Enter")
        page.get_by_role("button", name=re.compile(r"^\s*save\s*$", re.I)).last.click(timeout=8000)
        page.wait_for_timeout(3000); shot(page, "brand_keywords"); log("keywords set")
    except Exception as e:
        log("keywords skipped:", type(e).__name__)


def pin_comment(page, video_id, text):
    """Post a comment as the channel under a public video/Short and pin it."""
    m = re.search(r"\{title:([^}]+)\}", text)
    if m:  # resolve {title:Part Of A Title} to that video's link from Studio's content list
        page.goto("https://studio.youtube.com", wait_until="domcontentloaded"); page.wait_for_timeout(6000)
        cid = re.search(r"/channel/(UC[\w-]+)", page.url).group(1)
        page.goto(f"https://studio.youtube.com/channel/{cid}/videos/upload", wait_until="domcontentloaded"); page.wait_for_timeout(7000)
        link = page.locator("ytcp-video-row").filter(has_text=m.group(1)).first.locator("a#anchor-video-title, a#video-title, a").first
        href = link.get_attribute("href", timeout=8000) or ""
        vid = re.search(r"/video/([\w-]{11})", href)
        if not vid:
            raise RuntimeError(f"could not resolve {m.group(0)}")
        text = text.replace(m.group(0), f"https://youtu.be/{vid.group(1)}")
        log("resolved", m.group(1), "->", vid.group(1))
    page.goto(f"https://www.youtube.com/watch?v={video_id}", wait_until="domcontentloaded")
    page.wait_for_timeout(6000)
    for _ in range(6):  # comments load lazily below the player
        page.mouse.wheel(0, 900); page.wait_for_timeout(1200)
        if page.locator("#simplebox-placeholder").count():
            break
    page.locator("#simplebox-placeholder").first.click(timeout=15000)
    page.wait_for_timeout(1000)
    box = page.locator("#contenteditable-root").first
    box.click(timeout=8000)
    page.keyboard.insert_text(text)
    page.wait_for_timeout(800)
    page.locator("#submit-button").first.click(timeout=8000)
    page.wait_for_timeout(5000)
    shot(page, f"{video_id}_commented")
    # the new comment is the first thread; open its ⋮ menu → Pin → confirm
    th = page.locator("ytd-comment-thread-renderer").first
    th.hover(timeout=8000)
    th.locator("#action-menu-button button, #action-menu-button").first.click(timeout=8000)
    page.wait_for_timeout(1000)
    page.get_by_text(re.compile(r"^\s*pin\s*$", re.I)).first.click(timeout=8000)
    page.wait_for_timeout(1500)
    page.get_by_role("button", name=re.compile(r"^\s*pin\s*$", re.I)).last.click(timeout=8000)
    page.wait_for_timeout(3000)
    shot(page, f"{video_id}_pinned")
    pinned = page.locator("ytd-comment-thread-renderer").first.inner_text(timeout=5000)
    if "Pinned" not in pinned:
        raise RuntimeError("comment posted but pin not confirmed")
    log("pinned under", video_id)


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
    if "check" in ids:
        with sync_playwright() as p:
            px = parse_proxy(proxy)
            b = p.chromium.launch(headless=True, proxy=px)
            try:
                t = b.new_page(); t.goto("https://ipinfo.io/json", timeout=20000); t.close()
            except Exception:
                log("http proxy failed, retrying as SOCKS5")
                b.close(); b = p.chromium.launch(headless=True, proxy=parse_proxy(proxy, force_socks=True))
            ctx = b.new_context(locale="en-US")
            ctx.add_cookies(parse_cookies(cookies))
            pg = ctx.new_page()
            try:
                pg.goto("https://ipinfo.io/json", timeout=30000); info = json.loads(pg.inner_text("body"))
                log("proxy exit:", info.get("country"), info.get("region"))
            except Exception as e:
                log("proxy check failed:", type(e).__name__, str(e)[:120])
            pg.goto("https://studio.youtube.com", wait_until="domcontentloaded"); pg.wait_for_timeout(6000)
            shot(pg, "check_studio")
            log("signed in:", "accounts.google.com" not in pg.url, pg.url[:60])
            b.close()
        return
    do_country = "country" in ids
    do_brand = "brand" in ids
    fix_altered = [i.split("=", 1)[1] for i in ids if i.startswith("noai=")]
    related = [i.split("=", 1)[1] for i in ids if i.startswith("related=")]  # related=SHORTVIDEOID:epNN
    pins = [i.split("=", 1)[1] for i in ids if i.startswith("pin=")]  # pin=VIDEOID (text from PIN_TEXT env)
    ids = [i for i in ids if i not in ("audit", "country", "brand") and not i.startswith(("noai=", "related=", "pin="))]
    todo = []
    for raw in ids:  # "ep02:private" uploads ep02 but keeps it private (for tests)
        raw, _, existing = raw.partition("@")
        i, _, mode = raw.partition(":")
        if i in queue:
            item = dict(queue[i])
            if mode == "private":
                item["visibility"] = "private"
            if existing:
                item["existing"] = existing
            todo.append(item)
    if not todo and not do_audit and not do_country and not fix_altered and not related and not do_brand and not pins:
        sys.exit(f"nothing to upload for ids {ids}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, proxy=parse_proxy(proxy),
                                    args=["--disable-blink-features=AutomationControlled"])
        ctx = browser.new_context(locale="en-US", timezone_id="America/New_York", viewport={"width": 1440, "height": 1000},
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
        if do_brand:
            try:
                brand_channel(page, json.loads((PUB / "yt_profile.json").read_text()))
                results["brand"] = "ok"
            except Exception as e:
                shot(page, "brand_error")
                log("BRAND FAILED", type(e).__name__, str(e)[:300])
                results["brand"] = "FAILED"
        if do_country:
            try:
                set_country(page)
                results["country"] = "ok"
            except Exception as e:
                shot(page, "country_error")
                log("COUNTRY FAILED", type(e).__name__, str(e)[:300])
                results["country"] = "FAILED"
        for vid_id in pins:
            try:
                pin_comment(page, vid_id, os.environ["PIN_TEXT"])
                results[f"pin {vid_id}"] = "ok"
            except Exception as e:
                shot(page, f"{vid_id}_pin_error")
                log("PIN FAILED", vid_id, type(e).__name__, str(e)[:200])
                results[f"pin {vid_id}"] = "FAILED"
        for spec in related:
            sid, _, ep = spec.partition(":")
            ep_title = queue[ep]["title"] if ep in queue else ep
            if ep == "ep01":
                ep_title = "Don't Fall For Scam #7"
            try:
                set_related(page, sid, ep_title)
                results[f"related {sid}"] = "ok"
            except Exception as e:
                shot(page, f"{sid}_related_error")
                log("RELATED FAILED", sid, type(e).__name__, str(e)[:200])
                results[f"related {sid}"] = "FAILED"
        for vid_id in fix_altered:
            try:
                altered_no(page, vid_id, vid_id)
                results[f"noai {vid_id}"] = "ok"
            except Exception as e:
                shot(page, f"{vid_id}_altered_error")
                log("ALTERED FIX FAILED", vid_id, type(e).__name__, str(e)[:200])
                results[f"noai {vid_id}"] = "FAILED"
        if do_audit:
            try:
                audit(page)
            except Exception as e:
                shot(page, "audit_error")
                log("AUDIT FAILED", type(e).__name__, str(e)[:300])
                results["audit"] = "FAILED"
        for item in todo:
            try:
                if item.get("existing"):
                    results[item["id"]] = reschedule(page, item["existing"], item)
                else:
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
