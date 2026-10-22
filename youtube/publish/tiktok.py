"""TikTok Studio via Playwright, signed in with the account's cookies, through its proxy.

IDS (comma-separated):
  check                 proxy exit + whether the session is signed in (screenshot)
  <id>[:private]        upload a queue item from QUEUE_DIR/queue.json (":private" = Only me)
  profile               set name / bio / avatar from QUEUE_DIR/profile.json

Secrets only from env (YT_COOKIES = TikTok cookies.txt, YT_PROXY = its proxy); never printed.
"""
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lenny/publish"))
from uploader import ROOT, SHOTS, log, parse_cookies, parse_proxy, shot, try_click  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

PUB = ROOT / os.environ.get("QUEUE_DIR", "youtube/whatif/publish")


def signed_in(page):
    page.goto("https://www.tiktok.com/tiktokstudio", wait_until="domcontentloaded")
    page.wait_for_timeout(7000)
    shot(page, "tt_studio")
    return "login" not in page.url


def dismiss_popups(page):
    """Close TikTok Studio's one-time dialogs/tooltips that cover the form."""
    for rx in (r"^\s*turn on\s*$", r"^\s*got it\s*$", r"^\s*not now\s*$", r"^\s*ok\s*$"):
        try:
            b = page.get_by_role("button", name=re.compile(rx, re.I))
            if b.count() and b.first.is_visible():
                b.first.click(timeout=2000)
                page.wait_for_timeout(700)
                log("closed popup:", rx)
        except Exception:
            pass


def set_caption(page, text):
    box = page.locator("div[contenteditable='true']").first
    box.click(timeout=15000)
    page.keyboard.press("Control+A")
    page.keyboard.press("Delete")
    for chunk in re.split(r"(#\w+)", text):
        if not chunk:
            continue
        page.keyboard.type(chunk, delay=15)
        if chunk.startswith("#"):
            page.wait_for_timeout(900)
            page.keyboard.press("Escape")  # close the hashtag suggestion list, keep the text
    page.wait_for_timeout(800)


def upload(page, item):
    vid = ROOT / item["file"]
    log("tiktok upload", item["id"], vid.name)
    page.goto("https://www.tiktok.com/tiktokstudio/upload", wait_until="domcontentloaded")
    page.wait_for_timeout(6000)
    page.wait_for_selector('input[type="file"]', state="attached", timeout=60000)
    page.locator('input[type="file"]').first.set_input_files(str(vid))
    log("file selected")
    page.wait_for_selector("div[contenteditable='true']", timeout=180000)
    page.wait_for_timeout(4000)
    dismiss_popups(page)
    set_caption(page, item["caption"])
    dismiss_popups(page)
    shot(page, f"{item['id']}_caption")
    if item.get("private"):
        # Who can watch → Only me
        try:
            page.get_by_text(re.compile(r"^\s*everyone\s*$", re.I)).first.click(timeout=8000)
            page.wait_for_timeout(800)
            page.get_by_text(re.compile(r"^\s*only (me|you)\s*$", re.I)).last.click(timeout=8000)
            page.wait_for_timeout(800)
            shot(page, f"{item['id']}_only_me")
            log("visibility: only me")
        except Exception as e:
            raise RuntimeError(f"could not set Only me ({type(e).__name__}); not posting") from e
    elif item.get("publishAt"):
        when = datetime.fromisoformat(item["publishAt"])
        page.get_by_text(re.compile(r"^\s*schedule\s*$", re.I)).first.click(timeout=8000)
        page.wait_for_timeout(1500)
        shot(page, f"{item['id']}_schedule_open")
        # TikTok's schedule picker: a date input and a time input
        inputs = page.locator("input[readonly], .TUXTextInputCore-input")
        log("schedule inputs:", inputs.count(), "want", when.isoformat())
        raise RuntimeError("schedule picker not mapped yet — see screenshot")  # mapped after the first private test
    # wait for the upload to finish, then Post
    t0 = time.time()
    while time.time() - t0 < 900:
        btn = page.get_by_role("button", name=re.compile(r"^\s*(post|schedule)\s*$", re.I)).last
        try:
            if btn.is_enabled(timeout=2000):
                break
        except Exception:
            pass
        time.sleep(5)
    dismiss_popups(page)
    shot(page, f"{item['id']}_before_post")
    btn.click(timeout=10000)
    page.wait_for_timeout(8000)
    shot(page, f"{item['id']}_posted")
    log("posted", item["id"], page.url[:80])


def edit_profile(page, prof):
    """Profile page → Edit profile: avatar, username, name, bio → Save. Every field verified by screenshot."""
    page.goto("https://www.tiktok.com/profile", wait_until="domcontentloaded")
    page.wait_for_timeout(7000)
    shot(page, "tt_profile")
    page.get_by_role("button", name=re.compile(r"edit profile", re.I)).first.click(timeout=15000)
    page.wait_for_timeout(2500)
    shot(page, "tt_edit_open")
    # avatar: hidden file input inside the dialog, then the crop dialog's Apply
    try:
        page.locator("input[type='file']").first.set_input_files(str(ROOT / prof["avatar"]), timeout=8000)
        page.wait_for_timeout(3000)
        shot(page, "tt_avatar_crop")
        page.get_by_role("button", name=re.compile(r"^\s*apply\s*$", re.I)).first.click(timeout=8000)
        page.wait_for_timeout(2000)
        log("avatar set")
    except Exception as e:
        log("avatar skipped:", type(e).__name__)
    dlg = page.locator("[role='dialog']").last
    ins = dlg.locator("input[type='text'], input:not([type]):not([type='file'])")
    log("dialog inputs:", ins.count())
    ok_u = ok_n = ok_b = False
    if ins.count() >= 2:
        el = ins.nth(1); el.click(); page.keyboard.press("Control+A"); page.keyboard.press("Delete"); el.type(prof["name"], delay=25)
        ok_n = True
        # first free username wins; TikTok shows "isn't available" under the field for taken ones
        names = ([prof["username"]] + list(prof.get("username_fallbacks", []))) if prof.get("username") else []
        el = ins.nth(0)
        if not names:
            log("username: left as is")
        for u in names:
            el.click(); page.keyboard.press("Control+A"); page.keyboard.press("Delete"); el.type(u, delay=25)
            page.wait_for_timeout(3500)
            taken = dlg.get_by_text(re.compile(r"isn.t available|not available|already taken", re.I))
            if taken.count() and taken.first.is_visible():
                log("username taken:", u)
                continue
            log("username free:", u); ok_u = True
            break
        if names and not ok_u:
            # keep the current handle rather than block Save on name/bio/avatar
            el.click(); page.keyboard.press("Control+A"); page.keyboard.press("Delete"); el.type(prof.get("current_username", ""), delay=25)
            page.wait_for_timeout(3000)
    ta = dlg.locator("textarea")
    if ta.count():
        ta.first.click(); page.keyboard.press("Control+A"); page.keyboard.press("Delete"); ta.first.type(prof["bio"], delay=15); ok_b = True
    page.wait_for_timeout(2500)  # username availability check
    log("fields:", "username", ok_u, "name", ok_n, "bio", ok_b)
    page.wait_for_timeout(1500)
    shot(page, "tt_edit_filled")
    page.get_by_role("button", name=re.compile(r"^\s*save\s*$", re.I)).last.click(timeout=10000)
    page.wait_for_timeout(3000)
    # nickname / username change asks "Set nickname?" → Confirm (the dialog can take a few seconds)
    for _ in range(2):
        try:
            b = page.locator("button", has_text=re.compile(r"^\s*(confirm|set username)\s*$", re.I)).last
            b.wait_for(state="visible", timeout=10000)
            b.click(timeout=5000)
            log("confirmed")
            page.wait_for_timeout(4000)
        except Exception:
            break
    shot(page, "tt_profile_saved")
    page.goto("https://www.tiktok.com/profile", wait_until="domcontentloaded"); page.wait_for_timeout(6000)
    shot(page, "tt_profile_after")
    log("profile page:", page.url[:80])


def main():
    cookies, proxy = os.environ.get("YT_COOKIES", ""), os.environ.get("YT_PROXY", "")
    if not cookies or not proxy:
        sys.exit("TT_COOKIES and TT_PROXY secrets must both be set")
    ids = [x.strip() for x in (os.environ.get("IDS") or "").split(",") if x.strip()]
    with sync_playwright() as p:
        px = parse_proxy(proxy)
        b = p.chromium.launch(headless=True, proxy=px, args=["--disable-blink-features=AutomationControlled"])
        try:
            t = b.new_page(); t.goto("https://ipinfo.io/json", timeout=20000)
            info = json.loads(t.inner_text("body")); t.close()
        except Exception:
            log("http proxy failed, retrying as SOCKS5")
            b.close()
            b = p.chromium.launch(headless=True, proxy=parse_proxy(proxy, force_socks=True), args=["--disable-blink-features=AutomationControlled"])
            t = b.new_page(); t.goto("https://ipinfo.io/json", timeout=20000)
            info = json.loads(t.inner_text("body")); t.close()
        log("proxy exit:", info.get("country"), info.get("region"))
        ctx = b.new_context(locale="en-US", timezone_id="America/New_York", viewport={"width": 1440, "height": 1000},
                            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36")
        ctx.add_cookies(parse_cookies(cookies))
        page = ctx.new_page()
        ok = signed_in(page)
        log("signed in:", ok)
        if not ok:
            sys.exit("TikTok cookies rejected or expired")
        results = {}
        queue = {i["id"]: i for i in json.loads((PUB / "tiktok.json").read_text())} if (PUB / "tiktok.json").exists() else {}
        for raw in ids:
            if raw == "check":
                continue
            if raw == "profile":
                try:
                    edit_profile(page, json.loads((PUB / "profile.json").read_text()))
                    results["profile"] = "ok"
                except Exception as e:
                    shot(page, "profile_error")
                    log("PROFILE FAILED", type(e).__name__, str(e)[:300])
                    results["profile"] = "FAILED"
                continue
            i, _, mode = raw.partition(":")
            item = dict(queue[i])
            item["private"] = mode == "private"
            try:
                upload(page, item)
                results[i] = "ok"
            except Exception as e:
                shot(page, f"{i}_error")
                log("FAILED", i, type(e).__name__, str(e)[:300])
                results[i] = "FAILED"
        b.close()
    log("results", json.dumps(results))
    if any(v == "FAILED" for v in results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
