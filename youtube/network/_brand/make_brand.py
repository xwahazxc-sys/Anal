#!/usr/bin/env python3
"""Draw avatar (800x800), banner (2560x1440) and a sample cover for all 10 network channels.

    python3 make_brand.py            # all channels
    python3 make_brand.py grim-why   # one channel

Output goes to ../<slug>/brand/. Everything is HTML/CSS rendered in Chromium, fonts are local
(fonts/fonts.css), so a fresh machine needs only `pip install playwright pillow`.
The sample cover's photo area is a placeholder: replace it with the AI image of the episode.
"""
import os, sys
from playwright.sync_api import sync_playwright

B = os.path.dirname(os.path.abspath(__file__))
FONTS = open(os.path.join(B, "fonts", "fonts.css")).read().replace("url(", "url(file://" + B + "/fonts/")
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

def page(w, h, css, body):
    return f"""<html><head><meta charset="utf-8"><style>{FONTS}
*{{box-sizing:border-box}} body{{margin:0;width:{w}px;height:{h}px;overflow:hidden;position:relative}}
.abs{{position:absolute}} {css}</style></head><body>{body}</body></html>"""

# Banner: YouTube shows only the centre 1546x423 on every device, so all text sits inside it.
SAFE = "left:507px;top:508px;width:1546px;height:423px"

C = {}

# ---------- LONG-FORM ----------
C["kindheit-in-farbe"] = dict(
 css="""body{background:#F6E7C8;font-family:ArchivoBlack}
 .arc{position:absolute;border-radius:50%;border-style:solid;border-bottom-color:transparent!important;border-left-color:transparent!important;transform:rotate(-45deg)}
 .grain{position:absolute;inset:0;background:repeating-radial-gradient(circle at 30% 30%,rgba(90,58,34,.05) 0 2px,transparent 2px 5px)}""",
 avatar="""<div class="abs" style="inset:0;background:#F6E7C8"></div>
 <div class="abs" style="left:150px;top:150px;width:500px;height:500px;border-radius:50%;
  background:radial-gradient(circle,#F6E7C8 0 28%,#2E8C83 28% 40%,#F2B33D 40% 54%,#E8702A 54% 70%,#5A3A22 70% 86%,transparent 86%)"></div>
 <div class="abs" style="left:0;top:400px;width:800px;height:400px;background:#F6E7C8"></div>
 <div class="abs" style="left:0;top:430px;width:800px;text-align:center;color:#5A3A22;font-size:150px;letter-spacing:-4px">60·70</div>
 <div class="abs" style="left:0;top:610px;width:800px;text-align:center;color:#E8702A;font:600 64px Fredoka">in Farbe</div><div class="grain"></div>""",
 banner=f"""<div class="abs" style="left:-300px;top:200px;width:1400px;height:1400px;border-radius:50%;
  background:radial-gradient(circle,transparent 0 40%,#2E8C83 40% 50%,#F2B33D 50% 62%,#E8702A 62% 76%,#5A3A22 76% 90%,transparent 90%)"></div>
 <div class="abs" style="right:-300px;top:200px;width:1400px;height:1400px;border-radius:50%;
  background:radial-gradient(circle,transparent 0 40%,#2E8C83 40% 50%,#F2B33D 50% 62%,#E8702A 62% 76%,#5A3A22 76% 90%,transparent 90%)"></div>
 <div class="abs" style="{SAFE};display:flex;flex-direction:column;align-items:center;justify-content:center;background:#F6E7C8;border-radius:40px">
  <div style="color:#5A3A22;font-size:150px;letter-spacing:-5px;line-height:1">Kindheit in Farbe</div>
  <div style="color:#E8702A;font:600 52px Fredoka;margin-top:24px">So sind wir in den 60ern &amp; 70ern aufgewachsen</div>
  <div style="color:#2E8C83;font:600 40px Fredoka;margin-top:14px">Neue Folge jeden Mittwoch &amp; Samstag</div></div><div class="grain"></div>""",
 cover=(1280, 720, """<div class="abs" style="inset:0;background:#F6E7C8"></div>
 <div class="abs" style="left:40px;top:40px;width:700px;height:640px;border:14px solid #fff;box-shadow:0 10px 30px rgba(0,0,0,.25);transform:rotate(-3deg);
  background:linear-gradient(135deg,#c9a77a,#8a6440);display:flex;align-items:center;justify-content:center;color:#fff;font:600 30px Fredoka;text-align:center">[KI-Bild:<br>Kinder auf der Straße, 1972,<br>Polaroid-Farben]</div>
 <div class="abs" style="left:780px;top:120px;color:#E8702A;font-size:150px;letter-spacing:-6px;line-height:.9">1972</div>
 <div class="abs" style="left:780px;top:300px;width:460px;color:#5A3A22;font-size:96px;line-height:.95;letter-spacing:-3px">HEUTE<br>VERBOTEN</div>
 <div class="abs" style="left:780px;top:540px;width:360px;height:24px;background:linear-gradient(90deg,#5A3A22 25%,#E8702A 25% 50%,#F2B33D 50% 75%,#2E8C83 75%)"></div>"""))

C["deathworld-dispatch"] = dict(
 css="""body{background:#05070F;font-family:Orbitron}
 .stars{position:absolute;inset:0;background-image:radial-gradient(1.5px 1.5px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 20%,#cfe,transparent),radial-gradient(2px 2px at 40% 70%,#fff,transparent),radial-gradient(1px 1px at 85% 60%,#fff,transparent),radial-gradient(1.5px 1.5px at 10% 85%,#9ff,transparent),radial-gradient(1px 1px at 55% 45%,#fff,transparent);background-size:400px 400px}
 .earth{position:absolute;border-radius:50%;background:radial-gradient(circle at 35% 30%,#7fe3ff 0%,#1a6fb0 35%,#0a2a55 65%,#020814 100%);box-shadow:0 0 120px 30px rgba(56,225,255,.35)}""",
 avatar="""<div class="stars"></div><div class="earth" style="left:170px;top:170px;width:460px;height:460px"></div>
 <div class="abs" style="left:110px;top:110px;width:580px;height:580px;border-radius:50%;border:16px solid #FF3B3B"></div>
 <div class="abs" style="left:392px;top:60px;width:16px;height:150px;background:#FF3B3B"></div><div class="abs" style="left:392px;top:590px;width:16px;height:150px;background:#FF3B3B"></div>
 <div class="abs" style="left:60px;top:392px;width:150px;height:16px;background:#FF3B3B"></div><div class="abs" style="left:590px;top:392px;width:150px;height:16px;background:#FF3B3B"></div>""",
 banner=f"""<div class="stars"></div><div class="earth" style="left:780px;top:1010px;width:1000px;height:1000px"></div>
 <div class="abs" style="{SAFE};display:flex;flex-direction:column;align-items:center;justify-content:center">
  <div style="color:#FF3B3B;font:500 34px Orbitron;letter-spacing:14px">// INCOMING TRANSMISSION //</div>
  <div style="color:#fff;font:800 118px Orbitron;letter-spacing:6px;text-shadow:0 0 40px rgba(56,225,255,.6)">DEATHWORLD</div>
  <div style="color:#38E1FF;font:800 72px Orbitron;letter-spacing:30px">DISPATCH</div>
  <div style="color:#cfe9ff;font:500 34px Inter;margin-top:16px">Humanity, as the galaxy sees it · New story every Mon, Wed, Fri</div></div>""",
 cover=(1280, 720, """<div class="stars"></div><div class="earth" style="left:-200px;top:360px;width:800px;height:800px"></div>
 <div class="abs" style="left:640px;top:60px;width:580px;height:420px;border:3px solid #38E1FF;display:flex;align-items:center;justify-content:center;color:#38E1FF;font:500 26px Inter;text-align:center;background:rgba(56,225,255,.06)">[AI image: alien council chamber,<br>one human in a medic uniform]</div>
 <div class="abs" style="left:60px;top:60px;color:#fff;font:800 92px Orbitron;line-height:1;text-shadow:0 6px 0 #000">EVERY<br>MARINE</div>
 <div class="abs" style="left:60px;top:270px;color:#FF3B3B;font:800 92px Orbitron;text-shadow:0 6px 0 #000">STOOD</div>
 <div class="abs" style="left:660px;top:520px;color:#05070F;background:#FF3B3B;font:800 40px Orbitron;padding:10px 24px">HFY</div>"""))

C["backlot-whispers"] = dict(
 css="""body{background:#0B0B0B;font-family:PlayfairDisplay}
 .rays{position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 50% 100%,rgba(212,175,55,.22) 0 4deg,transparent 4deg 10deg)}""",
 avatar="""<div class="rays" style="background:repeating-conic-gradient(from 0deg at 50% 50%,rgba(212,175,55,.35) 0 5deg,transparent 5deg 15deg)"></div>
 <div class="abs" style="left:150px;top:150px;width:500px;height:500px;border-radius:50%;background:#0B0B0B;border:14px solid #D4AF37;box-shadow:0 0 0 14px #0B0B0B,0 0 0 22px #D4AF37"></div>
 <div class="abs" style="left:0;top:250px;width:800px;text-align:center;color:#D4AF37;font:900 250px PlayfairDisplay;font-style:italic;line-height:1">BW</div>""",
 banner=f"""<div class="rays"></div>
 <div class="abs" style="{SAFE};display:flex;flex-direction:column;align-items:center;justify-content:center;border-top:6px double #D4AF37;border-bottom:6px double #D4AF37;background:rgba(11,11,11,.85)">
  <div style="color:#F3E9D2;font:700 36px Inter;letter-spacing:18px">HOLLYWOOD · 1930 – 1965</div>
  <div style="color:#D4AF37;font:900 140px PlayfairDisplay;font-style:italic;line-height:1.05">Backlot Whispers</div>
  <div style="color:#F3E9D2;font:700 italic 44px PlayfairDisplay">The stories the studios buried. New every Tuesday &amp; Saturday.</div></div>""",
 cover=(1280, 720, """<div class="abs" style="inset:0;background:#0B0B0B"></div><div class="rays"></div>
 <div class="abs" style="left:60px;top:60px;width:560px;height:600px;border:10px solid #D4AF37;background:radial-gradient(ellipse,#777 0%,#222 70%);display:flex;align-items:center;justify-content:center;color:#eee;font:500 26px Inter;text-align:center;filter:grayscale(1)">[AI portrait, b&amp;w:<br>1940s film star,<br>studio lighting]</div>
 <div class="abs" style="left:680px;top:150px;color:#D4AF37;font:900 120px PlayfairDisplay;font-style:italic;line-height:.95">She Said<br>No.</div>
 <div class="abs" style="left:690px;top:470px;color:#F3E9D2;font:700 44px Inter;letter-spacing:10px">MGM · 1947</div>"""))

C["die-ost-akte"] = dict(
 css="""body{background:#D9C9A3;font-family:SpecialElite}
 .paper{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(90,70,40,.06) 0 2px,transparent 2px 6px)}
 .stamp{position:absolute;border:12px solid #B3261E;color:#B3261E;font-family:CourierPrime;font-weight:700;text-align:center;transform:rotate(-12deg);opacity:.9}""",
 avatar="""<div class="paper"></div>
 <div class="stamp" style="left:90px;top:220px;width:620px;padding:30px 0;font-size:150px;line-height:1;border-radius:30px">OST<br>AKTE</div>""",
 banner=f"""<div class="paper"></div>
 <div class="abs" style="left:420px;top:420px;width:400px;height:90px;background:#CBB98F;border-radius:20px 20px 0 0"></div>
 <div class="abs" style="left:420px;top:500px;width:1720px;height:520px;background:#CBB98F;box-shadow:0 20px 40px rgba(0,0,0,.25)"></div>
 <div class="abs" style="{SAFE};padding:40px 90px">
  <div style="color:#3A2E1E;font:700 34px CourierPrime">AKTENZEICHEN 1949–1989 · VERTRAULICH</div>
  <div style="color:#1F1A12;font-size:150px;line-height:1.1">Die Ost-Akte</div>
  <div style="color:#3A2E1E;font-size:46px">Wahre Geschichten aus der DDR · Jeden Donnerstag</div></div>
 <div class="stamp" style="left:1650px;top:560px;padding:14px 30px;font-size:64px">WAHR</div>""",
 cover=(1280, 720, """<div class="paper"></div>
 <div class="abs" style="left:60px;top:70px;width:600px;height:580px;background:#bbb;border:16px solid #fff;transform:rotate(2deg);box-shadow:0 10px 30px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font:700 26px CourierPrime;text-align:center;filter:sepia(.4)">[Archivfoto / KI-Bild:<br>Ostsee bei Nacht,<br>Schlauchboot]</div>
 <div class="abs" style="left:300px;top:40px;width:30px;height:110px;border:6px solid #888;border-radius:15px"></div>
 <div class="abs" style="left:720px;top:150px;color:#1F1A12;font-size:120px;line-height:.95">25<br>Stunden</div>
 <div class="stamp" style="left:740px;top:440px;padding:10px 30px;font-size:84px">FLUCHT</div>"""))

C["veillees-de-france"] = dict(
 css="""body{background:#10231A;font-family:IMFellEnglishSC}
 .glow{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(255,181,71,.55) 0%,rgba(255,181,71,.12) 35%,transparent 70%)}
 .flame{position:absolute;background:radial-gradient(ellipse at 50% 70%,#fff6d0 0%,#FFB547 40%,#e0661b 75%,transparent 76%);border-radius:50% 50% 50% 50%/60% 60% 40% 40%}
 .trees{position:absolute;left:0;right:0;bottom:0;height:420px;background:repeating-linear-gradient(90deg,transparent 0 60px,#0a170f 60px 64px),linear-gradient(transparent,#06100a)}""",
 avatar="""<div class="glow" style="left:0;top:0;width:800px;height:800px"></div>
 <div class="flame" style="left:330px;top:150px;width:140px;height:260px"></div>
 <div class="abs" style="left:345px;top:400px;width:110px;height:300px;background:linear-gradient(90deg,#e9dcc0,#fff4dc,#d8c9a8);border-radius:10px"></div>
 <div class="abs" style="left:120px;top:110px;width:150px;height:150px;border-radius:50%;box-shadow:30px 0 0 0 #F3E6C8"></div>""",
 banner=f"""<div class="glow" style="left:780px;top:220px;width:1000px;height:1000px"></div><div class="trees"></div>
 <div class="abs" style="{SAFE};display:flex;flex-direction:column;align-items:center;justify-content:center">
  <div style="color:#F3E6C8;font-size:150px;line-height:1;text-shadow:0 0 30px rgba(255,181,71,.5)">Veillées de France</div>
  <div style="color:#FFB547;font:600 italic 54px CormorantGaramond;margin-top:16px">Légendes, mystères et contes des régions — à écouter le soir</div>
  <div style="color:#c9d6c9;font:600 40px CormorantGaramond;margin-top:8px">Nouvelle veillée chaque mercredi et dimanche</div></div>""",
 cover=(1280, 720, """<div class="abs" style="inset:0;background:#10231A"></div><div class="trees" style="height:300px"></div>
 <div class="abs" style="left:620px;top:40px;width:620px;height:640px;background:radial-gradient(ellipse,#3b4b33,#0c160f);display:flex;align-items:center;justify-content:center;color:#F3E6C8;font:600 30px CormorantGaramond;text-align:center">[Image IA : une bête immense<br>à la lisière d'une forêt,<br>Lozère, 1765, brume]</div>
 <div class="glow" style="left:-100px;top:200px;width:700px;height:700px"></div>
 <div class="abs" style="left:60px;top:130px;color:#F3E6C8;font-size:130px;line-height:.95;text-shadow:0 6px 0 #000">La Bête</div>
 <div class="abs" style="left:66px;top:300px;color:#FFB547;font-size:96px;text-shadow:0 6px 0 #000">1765</div>"""))

# ---------- SHORTS ----------
C["grim-why"] = dict(
 css="""body{background:#0A0A0A;font-family:BebasNeue}""",
 avatar="""<div class="abs" style="inset:0;background:radial-gradient(circle,#2a0606 0%,#0A0A0A 70%)"></div>
 <div class="abs" style="left:0;top:20px;width:800px;text-align:center;color:#8E0F0F;font:700 640px BebasNeue;line-height:1">?</div>
 <div class="abs" style="left:0;top:560px;width:800px;text-align:center;color:#EDE6D6;font:700 150px BebasNeue;letter-spacing:12px">GRIM WHY</div>""",
 banner=f"""<div class="abs" style="inset:0;background:radial-gradient(ellipse at 50% 50%,#2a0606 0%,#0A0A0A 60%)"></div>
 <div class="abs" style="left:300px;top:200px;color:#1a0505;font:700 1100px BebasNeue;line-height:1">?</div><div class="abs" style="right:300px;top:200px;color:#1a0505;font:700 1100px BebasNeue;line-height:1">?</div>
 <div class="abs" style="{SAFE};display:flex;flex-direction:column;align-items:center;justify-content:center">
  <div style="color:#EDE6D6;font:700 220px BebasNeue;letter-spacing:20px;line-height:.9">GRIM <span style="color:#8E0F0F">WHY?</span></div>
  <div style="color:#bdb5a5;font:600 italic 50px CormorantGaramond">One dark question from history. Answered in under a minute. Daily.</div></div>""",
 cover=(1080, 1920, """<div class="abs" style="inset:0;background:#0A0A0A"></div>
 <div class="abs" style="left:90px;top:420px;width:900px;height:1000px;background:radial-gradient(ellipse,#3a2a20,#0A0A0A 75%);display:flex;align-items:center;justify-content:center;color:#EDE6D6;font:600 40px CormorantGaramond;text-align:center">[AI image: plague doctor<br>in a foggy alley, 1656]</div>
 <div class="abs" style="left:0;top:160px;width:1080px;text-align:center;color:#EDE6D6;font:700 170px BebasNeue;line-height:.9">WHY THE<br><span style="color:#8E0F0F">BEAK?</span></div>"""))

C["lost-reels-1956"] = dict(
 css="""body{background:#0F3F46;font-family:Limelight}
 .strip{position:absolute;left:0;right:0;height:110px;background:#111;background-image:repeating-linear-gradient(90deg,transparent 0 30px,#F5E6C4 30px 70px,transparent 70px 100px);background-size:100px 50px;background-repeat:repeat-x;background-position:0 30px}""",
 avatar="""<div class="abs" style="inset:0;background:radial-gradient(circle,#13707c,#0F3F46)"></div>
 <div class="abs" style="left:100px;top:100px;width:600px;height:600px;border-radius:50%;background:#C1272D;border:24px solid #F5E6C4"></div>
 <div class="abs" style="left:350px;top:350px;width:100px;height:100px;border-radius:50%;background:#F5E6C4"></div>
 <div class="abs" style="left:345px;top:160px;width:110px;height:110px;border-radius:50%;background:#0F3F46"></div><div class="abs" style="left:345px;top:530px;width:110px;height:110px;border-radius:50%;background:#0F3F46"></div>
 <div class="abs" style="left:160px;top:345px;width:110px;height:110px;border-radius:50%;background:#0F3F46"></div><div class="abs" style="left:530px;top:345px;width:110px;height:110px;border-radius:50%;background:#0F3F46"></div>""",
 banner=f"""<div class="abs" style="inset:0;background:linear-gradient(180deg,#0F3F46,#13707c 50%,#0F3F46)"></div>
 <div class="strip" style="top:380px"></div><div class="strip" style="top:950px"></div>
 <div class="abs" style="{SAFE};display:flex;flex-direction:column;align-items:center;justify-content:center;background:#C1272D">
  <div style="color:#F5E6C4;font-size:160px;line-height:1;text-shadow:0 8px 0 #6b1014">LOST REELS 1956</div>
  <div style="color:#F5E6C4;font:700 44px Oswald;letter-spacing:8px">CLASSIC TALES · AS HOLLYWOOD NEVER FILMED THEM · IN SUPER PANAVISION</div></div>""",
 cover=(1080, 1920, """<div class="abs" style="inset:0;background:#000"></div>
 <div class="abs" style="left:0;top:560px;width:1080px;height:800px;background:linear-gradient(135deg,#13707c,#C1272D);display:flex;align-items:center;justify-content:center;color:#F5E6C4;font:500 40px Oswald;text-align:center">[AI still, 2.55:1 Technicolor:<br>Count Dracula on castle stairs]</div>
 <div class="abs" style="left:0;top:220px;width:1080px;text-align:center;color:#F5E6C4;font-size:130px;line-height:1">DRACULA</div>
 <div class="abs" style="left:0;top:380px;width:1080px;text-align:center;color:#C1272D;font:700 70px Oswald;letter-spacing:10px">1956</div>
 <div class="abs" style="left:0;top:1440px;width:1080px;text-align:center;color:#F5E6C4;font:700 50px Oswald;letter-spacing:8px">IN SUPER PANAVISION 70</div>"""))

C["hundred-yokai"] = dict(
 css="""body{background:#141432;font-family:Oswald}
 .lantern{position:absolute;border-radius:45%;background:radial-gradient(ellipse at 50% 40%,#ff8a7a,#E63946 55%,#8d1520);box-shadow:0 0 120px 30px rgba(230,57,70,.45)}""",
 avatar="""<div class="abs" style="inset:0;background:radial-gradient(circle,#24245a,#141432)"></div>
 <div class="abs" style="left:330px;top:90px;width:140px;height:60px;background:#111;border-radius:10px"></div>
 <div class="lantern" style="left:210px;top:140px;width:380px;height:520px"></div>
 <div class="abs" style="left:330px;top:650px;width:140px;height:60px;background:#111;border-radius:10px"></div>
 <div class="abs" style="left:0;top:290px;width:800px;text-align:center;color:#fff3e0;font:700 200px Oswald">100</div>""",
 banner=f"""<div class="abs" style="inset:0;background:radial-gradient(ellipse,#24245a,#141432 70%)"></div>
 <div class="lantern" style="left:300px;top:560px;width:220px;height:300px"></div><div class="lantern" style="left:2040px;top:560px;width:220px;height:300px"></div>
 <div class="abs" style="{SAFE};display:flex;flex-direction:column;align-items:center;justify-content:center">
  <div style="color:#E63946;font:500 40px Oswald;letter-spacing:20px">NIGHT PARADE · 1 OF 100</div>
  <div style="color:#fff3e0;font:700 170px Oswald;letter-spacing:8px;line-height:1">HUNDRED YOKAI</div>
  <div style="color:#c9c9f0;font:600 italic 48px CormorantGaramond">One Japanese spirit every day. Learn the rule. Survive the night.</div></div>""",
 cover=(1080, 1920, """<div class="abs" style="inset:0;background:#141432"></div>
 <div class="abs" style="left:90px;top:500px;width:900px;height:1050px;background:radial-gradient(ellipse,#3a2a50,#141432 75%);display:flex;align-items:center;justify-content:center;color:#fff3e0;font:500 40px Oswald;text-align:center">[AI image: woman in a surgical mask<br>under a streetlight, Japan, 1979]</div>
 <div class="abs" style="left:0;top:150px;width:1080px;text-align:center;color:#E63946;font:700 90px Oswald">No. 001</div>
 <div class="abs" style="left:0;top:270px;width:1080px;text-align:center;color:#fff3e0;font:700 120px Oswald">KUCHISAKE-ONNA</div>"""))

C["ti-ricordi"] = dict(
 css="""body{background:#FFF3D6;font-family:BebasNeue}
 .tv{position:absolute;background:#6b4a2b;border-radius:40px;box-shadow:inset 0 0 0 14px #4a321c}
 .scr{position:absolute;background:radial-gradient(ellipse,#2a9d8f,#1B6B60);border-radius:60px/40px}""",
 avatar="""<div class="abs" style="inset:0;background:repeating-linear-gradient(90deg,#FFF3D6 0 60px,#ffe6ad 60px 120px)"></div>
 <div class="tv" style="left:110px;top:170px;width:580px;height:480px"></div>
 <div class="scr" style="left:160px;top:220px;width:400px;height:380px"></div>
 <div class="abs" style="left:590px;top:260px;width:60px;height:60px;border-radius:50%;background:#D7263D"></div><div class="abs" style="left:590px;top:360px;width:60px;height:60px;border-radius:50%;background:#F2B33D"></div>
 <div class="abs" style="left:160px;top:230px;width:400px;text-align:center;color:#FFF3D6;font:700 340px BebasNeue;line-height:1">?</div>
 <div class="abs" style="left:250px;top:650px;width:40px;height:90px;background:#4a321c;transform:rotate(15deg)"></div><div class="abs" style="left:510px;top:650px;width:40px;height:90px;background:#4a321c;transform:rotate(-15deg)"></div>""",
 banner=f"""<div class="abs" style="inset:0;background:repeating-linear-gradient(90deg,#FFF3D6 0 120px,#ffe6ad 120px 240px)"></div>
 <div class="abs" style="left:0;top:0;width:2560px;height:60px;background:linear-gradient(90deg,#1B998B 33%,#FFF3D6 33% 66%,#D7263D 66%)"></div>
 <div class="abs" style="{SAFE};display:flex;flex-direction:column;align-items:center;justify-content:center;background:#D7263D;border-radius:30px">
  <div style="color:#FFF3D6;font:700 200px BebasNeue;letter-spacing:10px;line-height:.9">TI RICORDI?</div>
  <div style="color:#FFF3D6;font:600 50px Fredoka">Il quiz degli anni '60, '70 e '80 · ogni giorno</div></div>""",
 cover=(1080, 1920, """<div class="abs" style="inset:0;background:#FFF3D6"></div>
 <div class="abs" style="left:0;top:120px;width:1080px;text-align:center;color:#D7263D;font:700 160px BebasNeue">COS'È?</div>
 <div class="abs" style="left:140px;top:380px;width:800px;height:700px;background:#ddd;border:16px solid #6b4a2b;border-radius:30px;display:flex;align-items:center;justify-content:center;font:600 40px Fredoka;text-align:center;color:#555">[Immagine IA:<br>oggetto di casa anni '60]</div>
 <div class="abs" style="left:140px;top:1150px;width:800px;font:600 60px Fredoka;color:#1F1A12">A) Macinacaffè<br>B) Radio a valvole<br>C) Tritacarne</div>
 <div class="abs" style="left:0;top:1640px;width:1080px;text-align:center;color:#1B998B;font:700 90px BebasNeue">3 · 2 · 1</div>"""))

C["familie-schnurr"] = dict(
 css="""body{background:#FFD6BA;font-family:Fredoka}
 .face{position:absolute;border-radius:50%;background:#F4A259}
 .ear{position:absolute;width:0;height:0;border-left:90px solid transparent;border-right:90px solid transparent;border-bottom:170px solid #F4A259}""",
 avatar="""<div class="abs" style="inset:0;background:radial-gradient(circle,#FFE8D6,#FFD6BA)"></div>
 <div class="ear" style="left:150px;top:110px;transform:rotate(-18deg)"></div><div class="ear" style="left:470px;top:110px;transform:rotate(18deg)"></div>
 <div class="face" style="left:130px;top:200px;width:540px;height:470px"></div>
 <div class="abs" style="left:255px;top:360px;width:70px;height:90px;border-radius:50%;background:#2b2b2b"></div><div class="abs" style="left:475px;top:360px;width:70px;height:90px;border-radius:50%;background:#2b2b2b"></div>
 <div class="abs" style="left:375px;top:480px;width:50px;height:36px;border-radius:50%;background:#E5788A"></div>
 <div class="abs" style="left:250px;top:560px;width:300px;height:80px;border-radius:50%;background:#BDE0C4"></div>
 <div class="abs" style="left:0;top:565px;width:800px;text-align:center;color:#2b2b2b;font:600 56px Fredoka">Schnurr</div>""",
 banner=f"""<div class="abs" style="inset:0;background:repeating-linear-gradient(45deg,#FFD6BA 0 80px,#FFE3CF 80px 160px)"></div>
 <div class="abs" style="{SAFE};display:flex;flex-direction:column;align-items:center;justify-content:center;background:#BDE0C4;border-radius:60px">
  <div style="color:#2b2b2b;font:600 170px Fredoka;line-height:1">Familie Schnurr 🐾</div>
  <div style="color:#7a4a2a;font:600 50px Fredoka">Oma, Papa, Mama &amp; die Kleinen — jeden Tag eine neue Folge</div></div>""",
 cover=(1080, 1920, """<div class="abs" style="inset:0;background:#FFD6BA"></div>
 <div class="abs" style="left:90px;top:440px;width:900px;height:1050px;background:#FFE8D6;border-radius:50px;display:flex;align-items:center;justify-content:center;color:#7a4a2a;font:600 44px Fredoka;text-align:center">[KI-Bild: Oma-Katze mit Koffer<br>vor der Haustür, Kinder-Kätzchen<br>schauen aus dem Fenster]</div>
 <div class="abs" style="left:0;top:150px;width:1080px;text-align:center;color:#2b2b2b;font:600 110px Fredoka;line-height:1">Oma zieht ein!</div>
 <div class="abs" style="left:0;top:1560px;width:1080px;text-align:center;color:#fff;font:600 70px Fredoka"><span style="background:#E5788A;padding:10px 40px;border-radius:40px">Folge 1</span></div>"""))

def main():
    only = sys.argv[1:] or list(C)
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for slug in only:
            c = C[slug]; out = os.path.join(B, "..", slug, "brand"); os.makedirs(out, exist_ok=True)
            cw, ch, cbody = c["cover"]
            for name, w, h, body in (("avatar_800.png", 800, 800, c["avatar"]),
                                      ("banner_2560x1440.png", 2560, 1440, c["banner"]),
                                      (f"cover_sample_{cw}x{ch}.png", cw, ch, cbody)):
                html = page(w, h, c["css"], body)
                open(os.path.join(out, name.replace(".png", ".html")), "w").write(html)
                pg = br.new_page(viewport={"width": w, "height": h})
                pg.set_content(html); pg.wait_for_timeout(400)
                pg.screenshot(path=os.path.join(out, name)); pg.close()
            print("ok", slug)
        br.close()

if __name__ == "__main__":
    main()
