#!/usr/bin/env python3
"""Transparent 1920x1080 overlays (title lower third, chapter cards) in the channel style."""
import os, tempfile
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
FD = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", "network", "_brand", "fonts"))
FONTS = open(os.path.join(FD, "fonts.css")).read().replace("url(", "url(file://" + FD + "/")
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
OUT = os.path.join(HERE, "overlays")

TITLE = """<div style="position:absolute;left:0;bottom:0;width:1920px;height:520px;background:linear-gradient(0deg,rgba(5,15,24,.75),rgba(5,15,24,0))"></div>
<div style="position:absolute;left:110px;bottom:120px">
  <div style="display:inline-block;background:#FF6B2C;color:#fff;font:600 34px Oswald;letter-spacing:8px;padding:6px 18px">78°N 15°E</div>
  <div style="color:#F2F6F8;font:700 104px Oswald;line-height:1.05;letter-spacing:2px;text-shadow:0 4px 24px rgba(0,0,0,.65);margin-top:14px">LONGYEARBYEN</div>
  <div style="color:#F2F6F8;font:500 40px Oswald;letter-spacing:10px;opacity:.9;text-shadow:0 2px 14px rgba(0,0,0,.7)">SVALBARD · NORWAY · 1,300 KM FROM THE NORTH POLE</div>
</div>"""


def card(num, text):
    return f"""<div style="position:absolute;left:110px;top:100px;display:flex;align-items:stretch;box-shadow:0 8px 30px rgba(0,0,0,.45)">
  <div style="background:#FF6B2C;color:#fff;font:700 54px Oswald;padding:8px 22px">{num}</div>
  <div style="background:rgba(14,42,59,.92);color:#F2F6F8;font:600 54px Oswald;letter-spacing:3px;padding:8px 28px">{text}</div>
</div>"""


TITLE_CENTER = """<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,rgba(5,15,24,.55),rgba(5,15,24,0) 60%)"></div>
<div style="position:absolute;left:0;right:0;top:250px;text-align:center">
  <div style="display:inline-block;background:#FF6B2C;color:#fff;font:600 40px Oswald;letter-spacing:10px;padding:6px 22px">78°N 15°E</div>
  <div style="color:#F2F6F8;font:700 190px Oswald;line-height:1.05;letter-spacing:6px;text-shadow:0 6px 40px rgba(0,0,0,.7)">LONGYEARBYEN</div>
  <div style="color:#F2F6F8;font:500 44px Oswald;letter-spacing:12px;text-shadow:0 2px 16px rgba(0,0,0,.8)">THE NORTHERNMOST TOWN ON EARTH</div>
</div>"""

ITEMS = {
    "title_center": TITLE_CENTER,
    "title": TITLE,
    "card1": card("01", "THE DARK"),
    "card2": card("02", "YOU CAN'T BE BORN HERE"),
    "card3": card("03", "YOU CAN'T BE BURIED HERE"),
    "card4": card("04", "THE RIFLE LINE"),
    "card5": card("05", "WHO GETS TO STAY"),
}

os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME)
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    for name, body in ITEMS.items():
        html = (f'<html><head><meta charset="utf-8"><style>{FONTS} body{{margin:0;width:1920px;height:1080px;'
                f'background:transparent;position:relative;overflow:hidden}}</style></head><body>{body}</body></html>')
        f = tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, dir=HERE)
        f.write(html); f.close()
        pg.goto("file://" + f.name)
        pg.evaluate("document.fonts.ready")
        pg.screenshot(path=os.path.join(OUT, name + ".png"), omit_background=True)
        os.unlink(f.name)
        print("ok", name)
    b.close()
