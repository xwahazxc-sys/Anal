#!/usr/bin/env python3
"""Avatar (800x800), banner (2560x1440) and thumbnail template (1280x720) for the two launch channels.

    python3 make_brand.py                      # both
    python3 make_brand.py life-across-the-map  # one

Pure HTML/CSS/SVG rendered in Chromium with the local fonts in youtube/network/_brand/fonts.
The photo/landscape areas of the thumbnail templates are placeholders: the real episode image goes there.
"""
import os, sys
from playwright.sync_api import sync_playwright

B = os.path.dirname(os.path.abspath(__file__))
FD = os.path.normpath(os.path.join(B, "..", "..", "network", "_brand", "fonts"))
FONTS = open(os.path.join(FD, "fonts.css")).read().replace("url(", "url(file://" + FD + "/")
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
SAFE = "left:507px;top:508px;width:1546px;height:423px"  # visible on every device


def page(w, h, css, body):
    return (f'<html><head><meta charset="utf-8"><style>{FONTS} *{{box-sizing:border-box}} '
            f'body{{margin:0;width:{w}px;height:{h}px;overflow:hidden;position:relative}} .abs{{position:absolute}} {css}'
            f'</style></head><body>{body}</body></html>')


def globe_svg(size, stroke, accent, lw=3):
    c = size / 2
    rings = "".join(f'<ellipse cx="{c}" cy="{c}" rx="{c*0.86}" ry="{c*0.86*k}" fill="none" stroke="{stroke}" stroke-width="{lw}"/>'
                    for k in (1, 0.62, 0.28))
    merid = "".join(f'<ellipse cx="{c}" cy="{c}" rx="{c*0.86*k}" ry="{c*0.86}" fill="none" stroke="{stroke}" stroke-width="{lw}"/>'
                    for k in (0.62, 0.28))
    star = (f'<polygon points="{c},{c*0.08} {c*1.07},{c*0.93} {c},{c*1.92} {c*0.93},{c*0.93}" fill="{accent}"/>'
            f'<polygon points="{c*0.08},{c} {c*0.93},{c*1.07} {c*1.92},{c} {c*0.93},{c*0.93}" fill="#F2F6F8" opacity=".9"/>')
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}">{rings}{merid}'
            f'<line x1="{c}" y1="{c*0.14}" x2="{c}" y2="{c*1.86}" stroke="{stroke}" stroke-width="{lw}"/>{star}'
            f'<circle cx="{c}" cy="{c}" r="{c*0.09}" fill="{accent}" stroke="#F2F6F8" stroke-width="{lw*2}"/></svg>')


C = {}
C["life-across-the-map"] = dict(
    css="""body{background:#0E2A3B;font-family:Oswald}
    .contour{position:absolute;inset:0;background:repeating-radial-gradient(circle at 30% 40%,transparent 0 38px,rgba(242,246,248,.06) 38px 40px),
      repeating-radial-gradient(circle at 75% 70%,transparent 0 52px,rgba(242,246,248,.05) 52px 54px)}
    .coord{position:absolute;color:rgba(242,246,248,.55);font:500 34px Oswald;letter-spacing:6px}""",
    avatar=f"""<div class="contour"></div><div class="abs" style="left:70px;top:70px">{globe_svg(660, 'rgba(242,246,248,.75)', '#FF6B2C', 5)}</div>""",
    banner=f"""<div class="contour"></div>
    <div class="coord" style="left:560px;top:470px">78°N 15°E</div><div class="coord" style="right:560px;top:470px">16°S 68°W</div>
    <div class="coord" style="left:560px;top:930px">37°S 12°W</div><div class="coord" style="right:560px;top:930px">63°N 142°E</div>
    <div class="abs" style="{SAFE};display:flex;align-items:center;justify-content:center;gap:50px">
      <div>{globe_svg(330, 'rgba(242,246,248,.8)', '#FF6B2C', 4)}</div>
      <div><div style="color:#F2F6F8;font:700 132px Oswald;letter-spacing:4px;line-height:1">LIFE ACROSS<br>THE MAP</div>
        <div style="height:10px;width:260px;background:#FF6B2C;margin:22px 0"></div>
        <div style="color:#F2F6F8;font:500 44px Inter">Every place on Earth has its own way to survive.</div>
        <div style="color:#FF6B2C;font:600 38px Oswald;letter-spacing:3px;margin-top:12px">NEW DOCUMENTARY EVERY TUE &amp; SAT</div></div></div>""",
    thumb="""<div class="abs" style="inset:0;background:linear-gradient(180deg,#0b1b2a 0%,#20465f 45%,#9fb7c6 70%,#e9f0f4 100%)"></div>
    <div class="abs" style="left:0;top:470px;width:1280px;height:250px;background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.35))"></div>
    <div class="abs" style="left:48px;bottom:56px;color:rgba(14,42,59,.65);font:500 24px Inter">[AI image: Longyearbyen under the polar night, snowmobiles, colourful houses]</div>
    <div class="abs" style="left:48px;top:44px;width:1000px;color:#FF6B2C;font:700 172px Oswald;line-height:.92;text-shadow:0 6px 0 #000,0 0 40px rgba(0,0,0,.6)">NO DYING<br>ALLOWED</div>
    <div class="abs" style="right:40px;bottom:40px;background:#0E2A3B;color:#F2F6F8;font:600 40px Oswald;letter-spacing:4px;padding:10px 26px;border-left:10px solid #FF6B2C">78°N 15°E</div>""",
)
C["backlot-whispers"] = dict(
    css="""body{background:#0B0B0B;font-family:'Playfair Display'}
    .rays{position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 50% 100%,rgba(212,175,55,.22) 0 4deg,transparent 4deg 10deg)}
    .stamp{position:absolute;border:10px solid #B3261E;color:#B3261E;font:700 64px 'Courier Prime';padding:6px 26px;transform:rotate(-12deg);opacity:.92}""",
    avatar="""<div class="rays" style="background:repeating-conic-gradient(from 0deg at 50% 50%,rgba(212,175,55,.35) 0 5deg,transparent 5deg 15deg)"></div>
    <div class="abs" style="left:150px;top:150px;width:500px;height:500px;border-radius:50%;background:#0B0B0B;border:14px solid #D4AF37;box-shadow:0 0 0 14px #0B0B0B,0 0 0 22px #D4AF37"></div>
    <div class="abs" style="left:0;top:250px;width:800px;text-align:center;color:#D4AF37;font:900 250px 'Playfair Display';font-style:italic;line-height:1">BW</div>""",
    banner=f"""<div class="rays"></div>
    <div class="abs" style="{SAFE};display:flex;flex-direction:column;align-items:center;justify-content:center;border-top:6px double #D4AF37;border-bottom:6px double #D4AF37;background:rgba(11,11,11,.85)">
      <div style="color:#F3E9D2;font:700 36px Inter;letter-spacing:18px">HOLLYWOOD · 1930 – 1980</div>
      <div style="color:#D4AF37;font:900 140px 'Playfair Display';font-style:italic;line-height:1.05">Backlot Whispers</div>
      <div style="color:#F3E9D2;font:700 italic 44px 'Playfair Display'">The stories the studios buried. New episodes every Wednesday &amp; Sunday.</div></div>""",
    thumb="""<div class="abs" style="inset:0;background:#0B0B0B"></div><div class="rays"></div>
    <div class="abs" style="left:50px;top:50px;width:540px;height:620px;border:10px solid #D4AF37;background:radial-gradient(ellipse,#8a8a8a 0%,#2a2a2a 75%);display:flex;align-items:center;justify-content:center;color:#eee;font:500 26px Inter;text-align:center">[public-domain b&amp;w<br>studio portrait<br>from Wikimedia Commons]</div>
    <div class="abs" style="left:640px;top:120px;color:#D4AF37;font:900 150px 'Playfair Display';font-style:italic;line-height:.95;text-shadow:0 6px 0 #000">One<br>Clause</div>
    <div class="stamp" style="left:690px;top:470px">FILE</div>
    <div class="abs" style="left:930px;top:520px;color:#F3E9D2;font:700 40px Inter;letter-spacing:8px">1921–1957</div>""",
)


def main():
    only = sys.argv[1:] or list(C)
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for slug in only:
            c = C[slug]
            out = os.path.join(B, "..", slug, "brand")
            os.makedirs(out, exist_ok=True)
            for name, w, h in (("avatar_800", 800, 800), ("banner_2560x1440", 2560, 1440), ("thumb_template_1280x720", 1280, 720)):
                body = c["avatar" if name.startswith("avatar") else "banner" if name.startswith("banner") else "thumb"]
                pg = br.new_page(viewport={"width": w, "height": h})
                tmp = os.path.join(out, f".{name}.html")  # opened as a file so Chromium may load the local fonts
                open(tmp, "w").write(page(w, h, c["css"], body))
                pg.goto("file://" + tmp)
                pg.evaluate("document.fonts.ready")
                pg.wait_for_timeout(300)
                os.remove(tmp)
                pg.screenshot(path=os.path.join(out, name + ".png"))
                pg.close()
            print("ok", slug)
        br.close()


if __name__ == "__main__":
    main()
