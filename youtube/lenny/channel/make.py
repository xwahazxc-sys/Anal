"""Avatar 800x800, banner 2560x1440, watermark 300x300 for Lenny's Scam Lab."""
import os, sys
from PIL import Image, ImageDraw, ImageFilter
from playwright.sync_api import sync_playwright
B = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1] if len(sys.argv) > 1 else "L09.png"      # avatar source
box = tuple(int(v) for v in (sys.argv[2] if len(sys.argv) > 2 else "380,10,920,550").split(","))
ban = sys.argv[3] if len(sys.argv) > 3 else "L44.png"       # banner character image

# avatar: square crop around the head, lanczos upscale, light sharpen
im = Image.open(os.path.join(B, src)).convert("RGB").crop(box).resize((800, 800), Image.LANCZOS)
im = im.filter(ImageFilter.UnsharpMask(2, 60, 2)); im.save(os.path.join(B, "avatar.png"))
# watermark: circular avatar with a teal ring, transparent outside
w = im.resize((300, 300), Image.LANCZOS).convert("RGBA")
m = Image.new("L", (300, 300), 0); ImageDraw.Draw(m).ellipse((6, 6, 294, 294), fill=255); w.putalpha(m)
ImageDraw.Draw(w).ellipse((4, 4, 296, 296), outline=(30, 227, 207, 255), width=8); w.save(os.path.join(B, "watermark.png"))

html = f"""<html><head><style>
@font-face{{font-family:Inter;src:url(file:///home/user/Anal/youtube/video/fonts/inter-latin.woff2)}}
body{{margin:0;width:2560px;height:1440px;overflow:hidden;font-family:Inter;
 background:radial-gradient(ellipse at 70% 50%,#14403f 0%,#0b2224 45%,#060d10 100%)}}
.lenny{{position:absolute;left:740px;top:457px;width:1664px;
 -webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 45%,#000 85%,transparent 100%),linear-gradient(180deg,transparent 0%,#000 10%,#000 70%,transparent 100%);
 -webkit-mask-composite:source-in}}
.t{{position:absolute;left:560px;top:530px;width:1100px;color:#fff;font-weight:900;letter-spacing:-4px;line-height:.92;font-size:150px;
 text-shadow:0 10px 0 #000,0 0 60px rgba(0,0,0,.8)}}
.t em{{font-style:normal;color:#ff3b3b}} .t i{{font-style:normal;color:#1ee3cf;text-shadow:0 0 40px rgba(30,227,207,.7),0 10px 0 #000}}
.s{{position:absolute;left:566px;top:822px;color:#fff;font:800 44px/1.2 Inter;letter-spacing:0}}
.s b{{color:#ffd60a}}
.grid{{position:absolute;inset:0;background-image:linear-gradient(rgba(30,227,207,.05) 2px,transparent 2px),linear-gradient(90deg,rgba(30,227,207,.05) 2px,transparent 2px);background-size:80px 80px}}
</style></head><body><div class="grid"></div>
<img class="lenny" src="file://{os.path.join(B, ban)}">
<div class="t">LENNY'S<br><em>SCAM</em> <i>LAB</i></div>
<div class="s">Ex-scammer. Now on your side.<br><b>New videos every Tue &amp; Fri</b></div>
</body></html>"""
open(os.path.join(B, "banner.html"), "w").write(html)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--allow-file-access-from-files"])
    pg = b.new_page(viewport={"width": 2560, "height": 1440}); pg.goto("file://" + os.path.join(B, "banner.html")); pg.wait_for_timeout(800)
    pg.screenshot(path=os.path.join(B, "banner.png")); b.close()
# preview with YouTube's safe zones marked (TV full, desktop 2560x423, mobile 1546x423)
pv = Image.open(os.path.join(B, "banner.png")).convert("RGB"); d = ImageDraw.Draw(pv)
d.rectangle((0, 508, 2559, 931), outline=(255, 214, 10), width=6); d.rectangle((507, 508, 2053, 931), outline=(255, 59, 59), width=6)
pv.resize((1280, 720)).save(os.path.join(B, "banner_zones.png")); print("ok")
