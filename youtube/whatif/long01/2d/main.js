import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutCubic, lerp, rng} from '../kit/util.js';
import {drawScreen, setTL, SW, SH} from './chat.js';
import T_INTRO from './data/intro.timeline.json';
import L_INTRO from './data/intro.lines.json';
import T1 from './data/n1.timeline.json';
import L1 from './data/n1.lines.json';
import T2 from './data/n2.timeline.json';
import L2 from './data/n2.lines.json';
import T3 from './data/n3.timeline.json';
import L3 from './data/n3.lines.json';
import T4 from './data/n4.timeline.json';
import L4 from './data/n4.lines.json';

// "What If At 2:14" — The Group Chat, long version (16:9), drawn in 2D: black silhouettes, rim light,
// fog and light shafts. One sim renders every part; pick it with ?config {"part": "n1"} (intro, n1..n4).

const W = 1920, H = 1080, FPS = 30;
const PARTS = {intro: [T_INTRO, L_INTRO], n1: [T1, L1], n2: [T2, L2], n3: [T3, L3], n4: [T4, L4]};
const C = {ink: '#030407', wall0: '#1b2438', wall1: '#0e1424', sky0: '#03050c', sky1: '#0b1630', haze: '#1d3d55', moon: '170,195,255', warm: '255,201,74', sodium: '255,170,90', phone: '125,175,255', alien: '234,242,255', red: '#e0484f', text: '#F3F4F8', dim: '#7C859C'};
const p01 = (t, a, b) => clamp01((t - a) / (b - a));
const ease = easeInOutCubic;
const F = (w, s) => `${w} ${s}px Inter, sans-serif`;
const off = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ---------- light + atmosphere ----------
function glowDot(c, x, y, r, col, a) { if (a <= 0) return; c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
function quad(c, pts, fill) { c.fillStyle = fill; c.beginPath(); c.moveTo(...pts[0]); for (const p of pts.slice(1)) c.lineTo(...p); c.closePath(); c.fill(); }
function shaftQ(c, pts, col, a0, a1, y0, y1) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, `rgba(${col},${a0})`); g.addColorStop(1, `rgba(${col},${a1})`); quad(c, pts, g); c.restore(); }
function fog(c, y, h, a, col = '29,61,85') { const g = c.createLinearGradient(0, y - h, 0, y + h); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(0, y - h, W, h * 2); }
const STARS = (() => { const r = rng(11); return Array.from({length: 500}, () => [r() * W, r() * H, 0.6 + r() * 1.6, r() * 6]); })();
function sky(c, t, x0, y0, w, h) {
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  const g = c.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, C.sky0); g.addColorStop(0.7, C.sky1); g.addColorStop(1, C.haze); c.fillStyle = g; c.fillRect(x0, y0, w, h);
  for (const [x, y, s, ph] of STARS) { if (x < x0 || x > x0 + w || y < y0 || y > y0 + h * 0.8) continue; c.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(t * 0.7 + ph)); c.fillStyle = '#dfe8ff'; c.fillRect(x, y, s, s); }
  c.restore();
}
function skyline(c, x0, baseY, w, scale, shade, seed, phoneWins = 0) {
  const r = rng(seed); let x = x0 - 40;
  while (x < x0 + w) { const bw = (70 + r() * 120) * scale, bh = (80 + r() * 200) * scale; c.fillStyle = shade; c.fillRect(x, baseY - bh, bw, bh); if (r() < 0.5) { c.beginPath(); c.moveTo(x, baseY - bh); c.lineTo(x + bw / 2, baseY - bh - bh * 0.25); c.lineTo(x + bw, baseY - bh); c.fill(); }
    for (let i = 0; i < 6; i++) if (r() < 0.3) { c.fillStyle = r() < phoneWins ? `rgba(${C.phone},.8)` : `rgba(${C.sodium},.7)`; c.fillRect(x + r() * (bw - 10), baseY - bh + 10 + r() * (bh - 30), 8 * scale, 10 * scale); }
    x += bw + 6 * scale; }
}

// ---------- characters (all silhouettes) ----------
// you on the couch, side view facing right (toward the door), hood up, phone in both hands
function youSitting(c, x, y, s, a = 1, phone = 1) {
  c.save(); c.globalAlpha = a; c.fillStyle = C.ink;
  c.beginPath();
  c.moveTo(x - 0.35 * s, y); c.lineTo(x - 0.4 * s, y - 1.25 * s); c.quadraticCurveTo(x - 0.35 * s, y - 1.7 * s, x - 0.05 * s, y - 1.75 * s);
  c.quadraticCurveTo(x + 0.3 * s, y - 1.7 * s, x + 0.35 * s, y - 1.3 * s); c.lineTo(x + 0.55 * s, y - 0.95 * s); c.lineTo(x + 0.62 * s, y - 0.85 * s);
  c.lineTo(x + 0.25 * s, y - 0.8 * s); c.lineTo(x + 0.3 * s, y - 0.45 * s); c.lineTo(x + 1.0 * s, y - 0.42 * s); c.lineTo(x + 1.05 * s, y + 0.55 * s); c.lineTo(x + 0.85 * s, y + 0.58 * s); c.lineTo(x + 0.8 * s, y - 0.05 * s); c.lineTo(x - 0.3 * s, y + 0.05 * s); c.closePath(); c.fill();
  // head in a hood, tipped down to the phone
  c.beginPath(); c.ellipse(x + 0.05 * s, y - 1.98 * s, 0.3 * s, 0.33 * s, 0.35, 0, 7); c.fill();
  c.beginPath(); c.moveTo(x - 0.28 * s, y - 2.05 * s); c.quadraticCurveTo(x - 0.1 * s, y - 2.45 * s, x + 0.3 * s, y - 2.2 * s); c.lineTo(x + 0.15 * s, y - 1.75 * s); c.fill();
  c.restore();
  if (phone > 0) { c.save(); c.globalAlpha = a; c.fillStyle = `rgba(${C.phone},${phone})`; c.fillRect(x + 0.52 * s, y - 1.0 * s, 0.1 * s, 0.17 * s); c.restore(); glowDot(c, x + 0.45 * s, y - 1.5 * s, 1.3 * s, C.phone, 0.35 * phone * a); }
}
// the tall one: thin, too-long arms, standing, facing right
function tall(c, x, y, s) {
  c.fillStyle = C.ink; c.beginPath();
  c.ellipse(x, y - 2.62 * s, 0.13 * s, 0.19 * s, 0.1, 0, 7); c.rect(x - 0.04 * s, y - 2.47 * s, 0.08 * s, 0.15 * s);
  c.moveTo(x - 0.24 * s, y - 2.33 * s); c.lineTo(x + 0.22 * s, y - 2.33 * s); c.lineTo(x + 0.15 * s, y - 1.45 * s); c.lineTo(x - 0.17 * s, y - 1.45 * s); c.closePath();
  c.rect(x - 0.15 * s, y - 1.5 * s, 0.09 * s, 1.5 * s); c.rect(x + 0.05 * s, y - 1.5 * s, 0.09 * s, 1.5 * s);
  c.rect(x - 0.27 * s, y - 2.3 * s, 0.06 * s, 1.55 * s); c.rect(x + 0.21 * s, y - 2.3 * s, 0.06 * s, 1.55 * s);
  c.fill();
}
// a standing person, side or back view; opts: hood, coat (colour), bike, boxes, armUp (0..1), key
function stander(c, x, y, s, o = {}) {
  const coat = o.coat || C.ink;
  c.fillStyle = C.ink; c.beginPath();
  c.rect(x - 0.17 * s, y - 0.95 * s, 0.13 * s, 0.95 * s); c.rect(x + 0.04 * s, y - 0.95 * s, 0.13 * s, 0.95 * s); c.fill();
  c.fillStyle = coat; c.beginPath(); c.moveTo(x - 0.3 * s, y - (o.coat ? 0.55 : 0.9) * s); c.lineTo(x - 0.27 * s, y - 2.05 * s); c.quadraticCurveTo(x, y - 2.22 * s, x + 0.27 * s, y - 2.05 * s); c.lineTo(x + 0.3 * s, y - (o.coat ? 0.55 : 0.9) * s); c.closePath(); c.fill();
  c.fillStyle = C.ink; c.beginPath(); c.ellipse(x, y - 2.38 * s, 0.17 * s, 0.21 * s, 0, 0, 7); c.fill();
  if (o.hood) { c.beginPath(); c.ellipse(x, y - 2.36 * s, 0.22 * s, 0.26 * s, 0, 0, 7); c.fill(); }
  // arms; the right one can rise (knock / wave)
  c.fillStyle = coat; c.fillRect(x - 0.36 * s, y - 2.0 * s, 0.08 * s, 0.95 * s);
  c.save(); c.translate(x + 0.32 * s, y - 2.0 * s); c.rotate(-Math.PI * 0.85 * (o.armUp || 0)); c.fillRect(-0.04 * s, 0, 0.08 * s, 0.95 * s); if (o.key) { c.fillStyle = 'rgba(220,220,200,.9)'; c.fillRect(-0.03 * s, 0.95 * s, 0.06 * s, 0.1 * s); } c.restore();
  if (o.boxes) { c.fillStyle = '#2b2620'; c.fillRect(x - 0.45 * s, y - 1.75 * s, 0.9 * s, 0.6 * s); c.fillRect(x - 0.38 * s, y - 2.15 * s, 0.75 * s, 0.42 * s); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2; c.strokeRect(x - 0.45 * s, y - 1.75 * s, 0.9 * s, 0.6 * s); }
  if (o.bike) { c.strokeStyle = C.ink; c.lineWidth = 0.05 * s; for (const bx of [-0.9, 0.55]) { c.beginPath(); c.arc(x + bx * s, y - 0.35 * s, 0.35 * s, 0, 7); c.stroke(); } c.beginPath(); c.moveTo(x - 0.9 * s, y - 0.35 * s); c.lineTo(x - 0.3 * s, y - 0.8 * s); c.lineTo(x + 0.4 * s, y - 0.8 * s); c.lineTo(x + 0.55 * s, y - 0.35 * s); c.moveTo(x - 0.3 * s, y - 0.8 * s); c.lineTo(x - 0.1 * s, y - 0.35 * s); c.lineTo(x + 0.4 * s, y - 0.8 * s); c.stroke(); }
}
// someone sitting on the couch facing the door (the old tenants), side view
function sitter(c, x, y, s, coat) {
  c.fillStyle = coat || C.ink; c.beginPath();
  c.moveTo(x - 0.3 * s, y); c.lineTo(x - 0.32 * s, y - 1.3 * s); c.quadraticCurveTo(x, y - 1.5 * s, x + 0.28 * s, y - 1.3 * s); c.lineTo(x + 0.3 * s, y - 0.45 * s); c.lineTo(x + 1.0 * s, y - 0.42 * s); c.lineTo(x + 1.0 * s, y + 0.55 * s); c.lineTo(x + 0.82 * s, y + 0.55 * s); c.lineTo(x + 0.8 * s, y - 0.02 * s); c.lineTo(x - 0.3 * s, y + 0.05 * s); c.closePath(); c.fill();
  c.fillStyle = C.ink; c.beginPath(); c.ellipse(x, y - 1.7 * s, 0.17 * s, 0.21 * s, 0, 0, 7); c.fill();
}

// ---------- places ----------
const FLOOR = 900;
// apartment 4B, side view: window + blinds + moon on the left, couch facing the door on the right
function room(c, t, o = {}) {
  const ir = !!o.ir;
  const wg = c.createLinearGradient(0, 0, 0, FLOOR); wg.addColorStop(0, ir ? '#6c7672' : C.wall1); wg.addColorStop(1, ir ? '#4a524e' : C.wall0); c.fillStyle = wg; c.fillRect(0, 0, W, FLOOR);
  c.fillStyle = ir ? '#323834' : '#090c14'; c.fillRect(0, FLOOR, W, H - FLOOR);
  // backlight on the wall behind the couch so the silhouettes read
  if (!ir) glowDot(c, 820, 560, 620, '90,120,190', 0.22);
  // window
  const wx = 150, wy = 210, ww = 360, wh = 420;
  if (ir) { c.fillStyle = '#b9c4bf'; c.fillRect(wx, wy, ww, wh); } else { sky(c, t, wx, wy, ww, wh); skyline(c, wx, wy + wh, ww, 0.9, '#080b14', 4, o.phoneWins || 0); }
  const dawn = o.dawn || 0;
  if (dawn > 0) { c.save(); c.globalAlpha = dawn; const g = c.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#3a4a7a'); g.addColorStop(1, '#f2a35e'); c.fillStyle = g; c.fillRect(wx, wy, ww, wh); c.restore(); }
  c.fillStyle = ir ? '#59615d' : '#0d1018'; for (let i = 0; i < 24; i++) c.fillRect(wx, wy + i * (wh / 24), ww, (wh / 24) * 0.42);
  c.fillStyle = '#04050a'; c.fillRect(wx - 16, wy - 16, ww + 32, 16); c.fillRect(wx - 16, wy + wh, ww + 32, 18); c.fillRect(wx + ww / 2 - 5, wy, 10, wh);
  // light through the slats onto the floor: cold moon, or warm sunrise
  const col = dawn > 0.5 ? '255,190,130' : C.moon, slide = dawn * 260;
  if (!ir) for (let i = 0; i < 9; i++) { const y0 = wy + 30 + i * 44, y1 = y0 + 18; shaftQ(c, [[wx + ww, y0], [wx + ww, y1], [900 + slide + i * 60, FLOOR + 40 + i * 6], [820 + slide + i * 60, FLOOR + 40 + i * 6]], col, 0.09 + 0.06 * dawn, 0.03, y0, FLOOR); }
  // door (right): frame, slab, peephole, warm gap under it
  const dx = 1480, dw = 240, dy = 330;
  c.fillStyle = ir ? '#262b28' : '#04050a'; c.fillRect(dx - 18, dy - 18, dw + 36, FLOOR - dy + 18);
  c.save(); if (o.doorShake) c.translate(o.doorShake, 0); c.fillStyle = ir ? '#3c433f' : '#090b12'; c.fillRect(dx, dy, dw, FLOOR - dy); c.fillStyle = '#5a5f6b'; c.beginPath(); c.arc(dx + 30, 620, 8, 0, 7); c.fill(); c.restore();
  const gap = o.gap ?? 1;
  if (gap > 0) { c.fillStyle = `rgba(${C.warm},${0.9 * gap})`; c.fillRect(dx, FLOOR - 6, dw, 6); glowDot(c, dx + dw / 2, FLOOR, 220, C.warm, 0.35 * gap); glowDot(c, dx + dw / 2, 560, 8, C.warm, 0.9 * gap);
    if (o.feet) for (const fx of [dx + 80, dx + 150]) { c.fillStyle = C.ink; c.fillRect(fx, FLOOR - 7, 30, 8); shaftQ(c, [[fx, FLOOR], [fx + 30, FLOOR], [fx + 10, FLOOR + 120], [fx - 30, FLOOR + 120]], '0,0,0', 0.6, 0, FLOOR, FLOOR + 120); } }
  // couch, side view, facing the door
  c.fillStyle = ir ? '#1d2120' : '#07080d'; c.fillRect(640, 760, 480, 140); c.fillRect(620, 560, 90, 340); c.fillRect(1090, 700, 60, 200); c.fillRect(640, 890, 20, 20); c.fillRect(1100, 890, 20, 20);
  if (o.you !== false) youSitting(c, 810, 780, 120, o.youA ?? 1, o.phone ?? 1);
  if (o.tall) tall(c, 560, FLOOR, 180);
  if (o.tenant) stander(c, 520, FLOOR, 150, {hood: true});
  if (o.sitter) sitter(c, 820, 780, 120, o.sitter);
  fog(c, FLOOR, 60, 0.18);
}
// security-camera look: render into an offscreen, then tint + scanlines + OSD
function cctvLook(c, src, t, label, date, clock, colour = false) {
  c.save(); c.filter = colour ? 'saturate(.55) contrast(1.15) brightness(1.15) sepia(.15)' : 'grayscale(1) contrast(1.15) brightness(1.15)'; c.drawImage(src, 0, 0); c.restore();
  if (!colour) { c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgb(200,240,210)'; c.fillRect(0, 0, W, H); c.restore(); }
  c.fillStyle = 'rgba(0,0,0,.16)'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2);
  c.font = F(700, 30); c.fillStyle = 'rgba(235,240,232,.9)'; c.textAlign = 'left'; c.fillText(label, 60, 80);
  const s = Math.floor(t) % 60; c.fillText(`${date}  ${clock}:${String(s).padStart(2, '0')}`, 60, 120);
  if (Math.floor(t * 1.5) % 2 === 0) { c.fillStyle = C.red; c.beginPath(); c.arc(W - 150, 70, 11, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(235,240,232,.9)'; c.textAlign = 'right'; c.fillText('REC', W - 60, 80);
  c.strokeStyle = 'rgba(235,240,232,.35)'; c.lineWidth = 4; const m = 30, L = 60;
  [[m, m], [W - m, m], [m, H - m], [W - m, H - m]].forEach(([x, y], i) => { const sx = i % 2 ? -1 : 1, sy = i > 1 ? -1 : 1; c.beginPath(); c.moveTo(x, y + sy * L); c.lineTo(x, y); c.lineTo(x + sx * L, y); c.stroke(); });
}
// 4th-floor hallway from the ceiling camera at the stairwell end: one-point perspective
const VP = [960, 420];
const persp = (x, y, z) => [VP[0] + (x - VP[0]) / z, VP[1] + (y - VP[1]) / z];
function hallway(c, t, o = {}) {
  c.fillStyle = '#2d332f'; c.fillRect(0, 0, W, H);
  const zf = 6;
  quad(c, [persp(0, 0, 1), persp(W, 0, 1), persp(W, 0, zf), persp(0, 0, zf)], '#262b28');                         // ceiling
  quad(c, [persp(0, H, 1), persp(W, H, 1), persp(W, H, zf), persp(0, H, zf)], '#3a403b');                         // floor
  quad(c, [persp(0, 0, 1), persp(0, 0, zf), persp(0, H, zf), persp(0, H, 1)], '#323834');                         // left wall
  quad(c, [persp(W, 0, 1), persp(W, 0, zf), persp(W, H, zf), persp(W, H, 1)], '#2f3531');                         // right wall
  // floor tiles
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; for (let z = 1.2; z < zf; z *= 1.25) { const [a, b] = [persp(0, H, z), persp(W, H, z)]; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); }
  // end wall: the elevator
  const [ex0, ey0] = persp(0, 0, zf), [ex1, ey1] = persp(W, H, zf);
  c.fillStyle = '#2a2f2c'; c.fillRect(ex0, ey0, ex1 - ex0, ey1 - ey0);
  const el = o.elevOpen || 0, ecx = (ex0 + ex1) / 2, ew = (ex1 - ex0) * 0.36, eh = (ey1 - ey0) * 0.72, ey = ey1 - eh;
  c.fillStyle = '#585f5a'; c.fillRect(ecx - ew / 2 - 6, ey - 6, ew + 12, eh + 6);
  if (el > 0) { c.fillStyle = '#e8efe4'; c.fillRect(ecx - ew / 2 * el, ey, ew * el, eh); glowDot(c, ecx, ey + eh, 160, '230,240,230', 0.45 * el); }
  c.fillStyle = '#454b47'; c.fillRect(ecx - ew / 2, ey, ew / 2 * (1 - el), eh); c.fillRect(ecx + ew / 2 * el, ey, ew / 2 * (1 - el), eh);
  if (o.inElev) o.inElev(c, ecx, ey + eh, eh / 2.6);
  // doors on the side walls: 4A left near, 4B right (ours), 4C left far
  const door = (side, z0, z1, label, open = 0) => {
    const x = side < 0 ? 0 : W, top = H * 0.2, bot = H;
    const p = [persp(x, top, z0), persp(x, top, z1), persp(x, bot, z1), persp(x, bot, z0)];
    quad(c, p, '#1d211f'); c.fillStyle = '#c9cfc9'; const [nx, ny] = persp(x, top + 90, (z0 + z1) / 2); c.font = F(800, 46 / ((z0 + z1) / 2)); c.textAlign = 'center'; c.fillText(label, nx + (side < 0 ? 40 : -40) / ((z0 + z1) / 2), ny);
    return p;
  };
  door(-1, 1.25, 1.55, '4A'); door(-1, 3.0, 3.4, '4C'); const p4b = door(1, 1.9, 2.3, '4B');
  // tube lights on the ceiling (one flickers)
  for (const z of [1.5, 2.6, 4.2]) { const [a, b] = [persp(W * 0.42, 0, z), persp(W * 0.58, 0, z)]; const fl = z === 2.6 && (Math.sin(t * 23) + Math.sin(t * 37.7)) > 1.4 ? 0.3 : 1; c.fillStyle = `rgba(235,245,235,${fl})`; c.fillRect(a[0], a[1] + 4, b[0] - a[0], 10 / z); glowDot(c, (a[0] + b[0]) / 2, a[1] + 40 / z, 300 / z, '230,240,230', 0.3 * fl); }
  c.save(); c.font = F(800, 22); c.fillStyle = '#ff6a6a'; c.textAlign = 'center'; const [xx, xy] = persp(W / 2, 40, zf); c.fillText('EXIT', xx, xy - 6); c.restore();
  return {p4b};
}
// Elm Court from the street: four floors, three windows each, the entrance light
function building(c, t, zoom, phone4b) {
  c.save(); const cx = 1060, cy = 470; c.translate(cx, cy); c.scale(zoom, zoom); c.translate(-cx, -cy);
  sky(c, t, -400, -400, W + 800, H + 800);
  c.fillStyle = '#dfe6f5'; c.beginPath(); c.arc(1600, 160, 34, 0, 7); c.fill(); glowDot(c, 1600, 160, 120, '220,230,255', 0.5);
  skyline(c, -200, 980, W + 400, 1.5, '#070a12', 9, 0.3); fog(c, 960, 140, 0.4);
  c.fillStyle = '#05070c'; c.fillRect(760, 160, 600, 840); c.fillRect(740, 140, 640, 30);
  for (let f = 0; f < 4; f++) for (let i = 0; i < 3; i++) {
    const x = 810 + i * 180, y = 210 + f * 190, is4b = f === 0 && i === 1;
    const lit = is4b ? 0.55 : [0.12, 0, 0.5, 0.08, 0, 0, 0.3, 0, 0.1, 0, 0.4, 0][f * 3 + i];
    c.fillStyle = is4b ? `rgba(${C.phone},${0.15 + 0.6 * phone4b})` : lit > 0.2 ? `rgba(${C.sodium},${lit})` : '#0b0e16'; c.fillRect(x, y, 140, 130);
    c.fillStyle = '#05070c'; c.fillRect(x + 66, y, 8, 130);
    if (is4b && phone4b > 0) { youSitting(c, x + 52, y + 125, 34, 1, phone4b); glowDot(c, x + 70, y + 60, 160, C.phone, 0.25 * phone4b); }
  }
  c.fillStyle = `rgba(${C.warm},.85)`; c.fillRect(1030, 900, 60, 100); glowDot(c, 1060, 900, 200, C.warm, 0.4);
  c.fillStyle = C.red; c.beginPath(); c.arc(1395, 175, 6, 0, 7); c.fill(); glowDot(c, 1395, 175, 30, '224,72,79', 0.7);
  c.fillStyle = '#020306'; c.fillRect(-400, 1000, W + 800, 400);
  c.restore();
}

// ---------- captions, HUD ----------
let CHUNKS = [];
function buildChunks(lines) {
  CHUNKS = [];
  for (const L of lines) {
    const phrases = []; let cur = [];
    for (const w of L.words) { cur.push(w); if (/[.,?!…]["']?$/.test(w[0])) { phrases.push(cur); cur = []; } }
    if (cur.length) phrases.push(cur);
    for (const ph of phrases) { const n = Math.ceil(ph.length / 4), size = Math.ceil(ph.length / n); for (let i = 0; i < ph.length; i += size) { const g = ph.slice(i, i + size); CHUNKS.push({words: g.map((w) => w[0]), t0: g[0][1], t1: g[g.length - 1][2]}); } }
  }
  CHUNKS.forEach((ch, i) => { const nx = CHUNKS[i + 1]; ch.end = nx ? Math.min(nx.t0, ch.t1 + 0.6) : ch.t1 + 0.8; });
}
const KEY = new Set(['alone', 'empty', 'door', 'camera', 'still', 'tuesday', 'watching', 'living', 'couch', 'him', 'thirteen', '4b', 'turn', 'hoodie', 'key', 'knocks', 'nobody', 'two', 'died', 'october', 'haunting', 'zero', 'first', 'yellow', 'five', 'you']);
const clean = (w) => (/^a\.m/i.test(w) ? 'AM' : w.replace(/^["“(]+/, '').replace(/\.\.\.$/, '').replace(/[)"”]+$/, '').replace(/[.,?!:]$/, '').replace(/["”]$/, ''));
function captions(c, t, cx = W / 2) {
  const ch = CHUNKS.find((k) => t >= k.t0 - 0.04 && t < k.end); if (!ch) return;
  const a = easeOutCubic(p01(t, ch.t0 - 0.04, ch.t0 + 0.1)), out = 1 - p01(t, ch.end - 0.08, ch.end);
  const words = ch.words.map(clean).map((s) => s.toUpperCase());
  const hi = words.findIndex((w) => KEY.has(w.toLowerCase().replace(/[^a-z0-9]/g, '')));
  c.save(); c.globalAlpha = a * out; c.font = F(900, 60); c.textAlign = 'left'; c.letterSpacing = '1px';
  const sp = 18, ws = words.map((w) => c.measureText(w).width), total = ws.reduce((x, y) => x + y, 0) + sp * (words.length - 1);
  let x = cx - total / 2; const y = (cx === W / 2 ? 985 : 560) + (1 - a) * 10;
  c.shadowColor = 'rgba(0,0,0,.9)'; c.shadowBlur = 22; c.shadowOffsetY = 4;
  words.forEach((w, i) => { c.fillStyle = i === hi ? `rgb(${C.warm})` : C.text; c.fillText(w, x, y); x += ws[i] + sp; });
  c.restore();
}
function hud(c, t, TL, night) {
  const ct = String(TL.clock.filter(([at]) => t >= at).pop()[1]);
  c.save(); c.textAlign = 'left'; c.fillStyle = C.red; c.beginPath(); c.arc(70, 70, 8, 0, 7); c.fill();
  c.fillStyle = 'rgba(233,236,244,.75)'; c.font = F(700, 20); c.letterSpacing = '5px'; c.fillText(night, 88, 77);
  c.letterSpacing = '0px'; c.fillStyle = C.text; c.font = F(800, 56); const tw = c.measureText(ct).width; c.fillText(ct, 58, 140); c.font = F(700, 24); c.fillStyle = 'rgba(233,236,244,.7)'; c.fillText('AM', 58 + tw + 10, 140);
  c.restore();
}
const GRAIN = Array.from({length: 4}, (_, k) => { const g = off(256, 256), x = g.getContext('2d'), d = x.createImageData(256, 256), r = rng(100 + k); for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 22; } x.putImageData(d, 0, 0); return g; });
function finish(c, t) {
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  c.save(); c.globalCompositeOperation = 'overlay'; c.fillStyle = c.createPattern(GRAIN[Math.floor(t * FPS) % 4], 'repeat'); c.fillRect(0, 0, W, H); c.restore();
}

runSim({duration: 130, fps: FPS, theme: 'dark', hud: {enabled: false, title: 'gc2d', subtitle: ''}, director: {enabled: false}, watermark: '', seed: 3}, async ({cfg, canvas}) => {
  await Promise.all([900, 800, 700, 600, 500].map((w) => document.fonts.load(F(w, 40)))).catch(() => {});
  canvas.style.display = 'none';
  const part = cfg.part || 'n1';
  const [TL, LINES] = PARTS[part];
  setTL(TL); buildChunks(LINES);
  const NIGHT = {intro: 'ELM COURT', n1: 'NIGHT 1', n2: 'NIGHT 2', n3: 'NIGHT 3', n4: 'NIGHT 4'}[part];
  const ov = off(W, H); ov.id = 'ov'; document.getElementById('app').appendChild(ov);
  const c = ov.getContext('2d');
  const buf = off(W, H), b = buf.getContext('2d');
  const scr = off(SW, SH), sc = scr.getContext('2d');
  const SHOTS = TL.shots.map(([name, t0], i) => ({name, t0, t1: (TL.shots[i + 1] || [0, TL.duration])[1], i}));
  const shotAt = (t) => SHOTS.filter((s) => t >= s.t0).pop() || SHOTS[0];
  const lightOff = (t) => (TL.lightOff ? 1 - ease(p01(t, ...TL.lightOff)) : 1);
  const knock = (t) => (TL.knockAt || []).reduce((a, k) => a + Math.max(0, 1 - Math.abs(t - k) / 0.12), 0);
  const shake = (t) => (TL.doorShake || []).reduce((a, k) => a + (t > k ? 5 * Math.exp(-(t - k) * 22) * Math.sin((t - k) * 90) : 0), 0);
  const osdDate = (t) => (TL.osdDays ? TL.osdDays.filter(([a]) => t >= a).pop()[1] : '2026-10-16');
  const clockAt = (t) => '0' + String(TL.clock.filter(([at]) => t >= at).pop()[1]);

  function phoneShot(t, sh, mode) {
    // the phone over the blurred room, a little to the right; pushes in on key messages
    b.clearRect(0, 0, W, H); room(b, t, {gap: lightOff(t)});
    c.save(); c.filter = 'blur(16px) brightness(.55)'; c.drawImage(buf, 0, 0); c.restore();
    sc.clearRect(0, 0, SW, SH); drawScreen(sc, t, mode); sc.save(); sc.globalCompositeOperation = 'destination-in'; sc.beginPath(); sc.roundRect(0, 0, SW, SH, 90); sc.fill(); sc.restore();
    let z = 1, fy = 0;
    for (const key of ['meMsgPush', 'listPush', 'selfPush']) if (TL[key]) { const d = ease(p01(t, TL[key][0], TL[key][1])) * (1 - ease(p01(t, TL[key][1] + 1.2, TL[key][1] + 1.8))); if (d > 0) { z = lerp(1, 1.45, d); fy = d; } }
    const ph = 1280 * z, pw = ph * SW / SH, px = 1400 - pw / 2 + Math.sin(t * 0.8) * 6, py = H - ph + 140 - fy * 260 + Math.sin(t * 0.6) * 4;
    c.save(); c.shadowColor = 'rgba(0,0,0,.85)'; c.shadowBlur = 70; c.fillStyle = '#111521'; c.beginPath(); c.roundRect(px - 14, py - 14, pw + 28, ph + 28, 70 * z); c.fill(); c.restore();
    c.drawImage(scr, px, py, pw, ph);
    glowDot(c, px + pw / 2, py + ph * 0.4, 800, C.phone, 0.1);
    c.fillStyle = C.ink; c.beginPath(); c.ellipse(px + pw + 8, py + ph * 0.66, 55 * z, 120 * z, -0.3, 0, 7); c.fill(); c.beginPath(); c.ellipse(px - 6, py + ph * 0.72, 45 * z, 130 * z, 0.3, 0, 7); c.fill();
  }

  function draw(t, sh) {
    const lt = t - sh.t0, dur = sh.t1 - sh.t0, k = ease(p01(lt, 0, dur));
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    const cam = (z, fx = W / 2, fy = H / 2) => { c.translate(fx, fy); c.scale(z, z); c.translate(-fx, -fy); };
    switch (sh.name) {
      case 'building': case 'building2': {
        c.save();
        if (sh.name === 'building') building(c, t, lerp(1.0, 1.15, k), 0);
        else { const z = lerp(1.0, 3.4, k), fx = lerp(1060, 1060, k), fy = lerp(470, 275, k); c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-fx, -fy); building(c, t, 1.0, 1); }
        c.restore();
        break;
      }
      case 'card': {
        const a = ease(p01(lt, 0, 0.5)) * (1 - ease(p01(lt, dur - 0.4, dur)));
        c.save(); c.globalAlpha = a; c.textAlign = 'center'; c.fillStyle = C.text; c.font = F(800, 110); c.letterSpacing = '22px'; c.fillText(TL.cardText || NIGHT, W / 2 + 11, H / 2 + 20);
        c.fillStyle = `rgb(${C.warm})`; c.font = F(600, 30); c.letterSpacing = '10px'; c.fillText('WHAT IF AT 2:14', W / 2 + 5, H / 2 + 90); c.restore();
        break;
      }
      case 'bedroom': case 'sitting': {
        // bed + nightstand side view; your phone lights up on the nightstand
        const wg = c.createLinearGradient(0, 0, 0, FLOOR); wg.addColorStop(0, C.wall1); wg.addColorStop(1, C.wall0); c.save();
        const on = p01(lt, TL.phoneOn ?? 2, (TL.phoneOn ?? 2) + 0.2);
        if (sh.name === 'bedroom') cam(lerp(1, 2.4, ease(p01(lt, 2.5, dur))), 1340, 700);
        c.fillStyle = wg; c.fillRect(0, 0, W, FLOOR); c.fillStyle = '#05060a'; c.fillRect(0, FLOOR, W, H);
        sky(c, t, 260, 180, 420, 380); c.fillStyle = '#0d1018'; for (let i = 0; i < 22; i++) c.fillRect(260, 180 + i * 17.3, 420, 7);
        for (let i = 0; i < 8; i++) shaftQ(c, [[680, 210 + i * 40], [680, 225 + i * 40], [1100 + i * 50, FLOOR], [1020 + i * 50, FLOOR]], C.moon, 0.06, 0.015, 200, FLOOR);
        c.fillStyle = '#07080d'; c.fillRect(380, 700, 840, 200); c.fillRect(360, 560, 40, 340);
        if (sh.name === 'bedroom') { c.fillStyle = '#0b0d14'; c.beginPath(); c.ellipse(820, 700, 330, 60, 0, Math.PI, 0); c.fill(); c.fillStyle = C.ink; c.beginPath(); c.ellipse(470, 665, 60, 50, 0, 0, 7); c.fill(); }
        else youSitting(c, 900, 760, 130, 1, 1);
        c.fillStyle = '#08090e'; c.fillRect(1260, 720, 170, 180);
        if (sh.name === 'bedroom') {
          sc.clearRect(0, 0, SW, SH); if (on > 0) { drawScreen(sc, t, 'lock'); }
          c.save(); c.translate(1345, 712); c.transform(1, 0, -0.6, 0.35, 0, 0); c.fillStyle = '#111521'; c.fillRect(-48, -100, 96, 205); if (on > 0) { c.globalAlpha = on; c.drawImage(scr, -44, -96, 88, 197); } c.restore();
          glowDot(c, 1345, 690, 260, C.phone, 0.45 * on);
        }
        c.restore();
        break;
      }
      case 'phone': phoneShot(t, sh, 'chat'); break;
      case 'members': phoneShot(t, sh, 'members'); break;
      case 'living': case 'dawn': {
        c.save(); cam(lerp(1.0, 1.08, k), 1200, 640);
        const dawn = sh.name === 'dawn' ? ease(p01(lt, 0, dur)) : 0;
        room(c, t, {gap: lightOff(t), dawn, youA: TL.ghostFade ? 1 - 0.7 * ease(p01(t, ...TL.ghostFade)) : 1, phone: TL.phoneOn && t < TL.phoneOn + 0.3 ? p01(t, TL.phoneOn, TL.phoneOn + 0.25) : 1});
        c.restore(); break;
      }
      case 'revealW': case 'revealM': case 'reveal': case 'recap': {
        // the room from the security camera up in the corner
        b.fillStyle = '#000'; b.fillRect(0, 0, W, H); b.save();
        const push = TL.revealPush && sh.name === 'reveal' ? ease(p01(t, ...TL.revealPush)) : k;
        b.translate(W / 2, H / 2); b.scale(lerp(1.05, 1.3, push), lerp(1.05, 1.3, push)); b.translate(-W / 2 - lerp(0, 120, push), -H / 2 + lerp(0, 60, push));
        const n3 = part === 'n3';
        if (sh.name === 'revealW') room(b, t, {you: false, sitter: '#b38a1e', gap: 1, ir: true});
        else if (sh.name === 'revealM') room(b, t, {you: false, sitter: '#2e3340', gap: 1, ir: true});
        else if (n3 && sh.name === 'reveal') room(b, t, {youA: 1 - 0.7 * ease(p01(t, ...(TL.ghostFade || [0, 0.1]))), tenant: true, gap: lightOff(t), ir: true});
        else room(b, t, {tall: true, gap: 1, ir: true});
        b.restore();
        cctvLook(c, buf, t, 'CAM 02 · APT 4B', sh.name === 'revealW' ? '2019-03-30' : sh.name === 'revealM' ? '2020-07-09' : '2026-10-16', clockAt(t), sh.name === 'revealW' || sh.name === 'revealM');
        if (sh.name === 'reveal' && TL.impact) { const f = Math.max(0, 1 - Math.abs(t - TL.impact) / 0.5); if (f > 0) { c.fillStyle = `rgba(0,0,0,${f * 0.35})`; c.fillRect(0, 0, W, H); } }
        break;
      }
      case 'cctv': case 'clip': case 'elev': case 'floors': {
        if (sh.name === 'floors') {
          // the floor indicator above the elevator, close: 4 3 2 1 ... 0
          c.fillStyle = '#1b1f1c'; c.fillRect(0, 0, W, H);
          const f = TL.floorsAt.filter(([a]) => t >= a).pop()[1];
          c.fillStyle = '#0a0b0a'; c.fillRect(W / 2 - 260, H / 2 - 200, 520, 400);
          c.font = F(800, 300); c.textAlign = 'center'; c.fillStyle = f === '0' ? '#fff3f3' : '#ff3b3b'; c.fillText(f, W / 2, H / 2 + 110);
          glowDot(c, W / 2, H / 2, 380, f === '0' ? '255,240,240' : '255,60,60', f === '0' ? 0.5 : 0.25);
          b.drawImage(ov, 0, 0); cctvLook(c, buf, t, 'CAM 04 · ELEVATOR', '2026-10-19', clockAt(t));
          const dark = ease(p01(t, TL.camDark, TL.camDark + 0.4)); if (dark > 0) { c.fillStyle = `rgba(0,0,0,${dark})`; c.fillRect(0, 0, W, H); if (dark > 0.9) { c.font = F(700, 34); c.fillStyle = 'rgba(200,200,200,.6)'; c.textAlign = 'center'; c.fillText('NO SIGNAL', W / 2, H / 2); } }
          break;
        }
        b.save();
        const zoomTo = sh.name === 'cctv' && TL.figZoom ? ease(p01(t, ...TL.figZoom)) : 0;
        b.translate(W / 2, H / 2); b.scale(1 + 0.5 * zoomTo, 1 + 0.5 * zoomTo); b.translate(-W / 2 - 330 * zoomTo, -H / 2 - 60 * zoomTo);
        const clip = sh.name === 'clip' ? TL.clips[String(sh.t0)] : null;
        let elevOpen = 0, inElev = null;
        if (sh.name === 'elev') { elevOpen = ease(p01(t, 99.0, 100.3)) * (1 - ease(p01(t, 101.5, 102.0))); }
        const hw = hallway(b, t, {elevOpen, inElev});
        const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = hw.p4b, doorX = (x0 + x1) / 2 - 120, doorY = (y2 + y3) / 2;
        // who is in the hallway
        if (sh.name === 'cctv') {
          if (part === 'n2') stander(b, doorX, doorY, 120, {hood: true, armUp: lerp(0, 0.55, ease(p01(t, ...(TL.armUp || [999, 1000])))) - 0.08 * knock(t)});
          if (part === 'n3' || part === 'n4') stander(b, doorX - 20, doorY, 120, {hood: true, key: part === 'n4', armUp: part === 'n4' ? 0.25 : 0});
        }
        if (sh.name === 'elev') {
          // the tenant walks from 4B to the elevator and steps in
          const w = ease(p01(t, 94.5, 100.6)), fx = lerp(doorX - 20, W / 2, w), fz = lerp(1, 5.2, w), [px, py] = persp(fx, H + 0 * fz, 1), sx = VP[0] + (fx - VP[0]) / fz, sy = VP[1] + (doorY - VP[1]) / fz;
          if (t < 101.4) stander(b, sx, sy, 120 / fz, {hood: true});
        }
        if (clip) {
          const a = clip.act, prog_ = ease(p01(lt, 0.3, dur - 0.3));
          if (clip.who === 'coat') stander(b, doorX - (a === 'wave' ? 0 : 40), doorY, 120, {coat: '#c9a227', armUp: a === 'wave' && lt > 2.0 ? 0.8 + 0.08 * Math.sin(t * 10) : 0});
          if (clip.who === 'bike') stander(b, lerp(doorX - 500, doorX - 60, prog_), doorY + 10, 115, {bike: true, coat: '#3a4152'});
          if (clip.who === 'boxes') stander(b, lerp(doorX - 600, doorX - 30, prog_), doorY + 10, 118, {boxes: true, coat: '#4a4f5a'});
        }
        b.restore();
        const colour = !!clip;
        const label = sh.name === 'elev' ? 'CAM 04 · 4F HALLWAY' : 'CAM 04 · 4F HALLWAY';
        cctvLook(c, buf, t, label, clip ? clip.date : sh.name === 'cctv' ? osdDate(t) : '2026-10-19', clockAt(t), colour);
        if (lt < 0.35) { const a = 1 - lt / 0.35; c.fillStyle = `rgba(210,220,210,${a * 0.45})`; c.fillRect(0, 0, W, H); }
        break;
      }
      case 'doorKnock': {
        c.save(); cam(lerp(1.0, 1.1, k), 1600, 860); room(c, t, {doorShake: shake(t), feet: true, you: false}); c.restore();
        c.save(); c.translate(-1150, -560); c.scale(1.9, 1.9); c.restore();
        break;
      }
      case 'doorLock': {
        // the deadbolt in phone light, turning
        c.fillStyle = '#0a0c12'; c.fillRect(0, 0, W, H); glowDot(c, 1100, 520, 700, C.phone, 0.18);
        c.fillStyle = '#3d424e'; c.beginPath(); c.roundRect(W / 2 - 150, H / 2 - 190, 300, 380, 30); c.fill();
        const r = (Math.PI / 2) * ease(p01(t, ...(TL.boltTurn || [0, 0.1])));
        c.save(); c.translate(W / 2, H / 2); c.rotate(r); c.fillStyle = '#8b92a3'; c.beginPath(); c.roundRect(-28, -110, 56, 220, 20); c.fill(); c.restore();
        c.fillStyle = C.ink; c.beginPath(); c.ellipse(W / 2 + 260, H / 2 + 260, 260, 150, -0.5, 0, 7); c.fill();
        break;
      }
      case 'doorOpen': {
        // the door swings open: warm hallway light, nobody there
        c.save(); cam(lerp(1.0, 1.12, k), 1600, 620);
        room(c, t, {gap: 0, you: part !== 'n3' ? true : true, youA: part === 'n3' ? 0.85 : 1});
        const open = ease(p01(t, ...(TL.doorSwing || [sh.t0 + 0.6, sh.t0 + 2.5])));
        const dx = 1480, dw = 240, dy = 330;
        c.fillStyle = '#d9b46a'; c.fillRect(dx, dy, dw, FLOOR - dy); const g = c.createLinearGradient(dx, 0, dx + dw, 0); g.addColorStop(0, 'rgba(255,220,150,.9)'); g.addColorStop(1, 'rgba(160,120,70,.9)'); c.fillStyle = g; c.fillRect(dx, dy, dw, FLOOR - dy);
        c.fillStyle = '#7a6440'; c.fillRect(dx, FLOOR - 60, dw, 60);
        quad(c, [[dx, dy], [dx + dw * (1 - open * 0.8), dy - 30 * open], [dx + dw * (1 - open * 0.8), FLOOR + 30 * open], [dx, FLOOR]], '#090b12');
        shaftQ(c, [[dx, dy], [dx + dw, dy], [dx - 300, FLOOR + 180], [dx - 900, FLOOR + 180]], C.warm, 0.12 * open, 0.02, dy, FLOOR + 180);
        glowDot(c, dx + dw / 2, 620, 500, C.warm, 0.25 * open);
        c.restore(); break;
      }
      case 'door': case 'black': {
        if (sh.name === 'door') { c.save(); cam(lerp(1.4, 1.6, k), 1600, 760); room(c, t, {gap: lightOff(t), you: false}); c.restore(); }
        break;
      }
      default: break;
    }
  }

  return {
    render(t) {
      const sh = shotAt(t);
      draw(t, sh);
      const since = t - sh.t0; if (sh.i > 0 && since < 0.1) { c.fillStyle = `rgba(0,0,0,${1 - since / 0.1})`; c.fillRect(0, 0, W, H); }
      if (TL.toBlack) { const a = ease(p01(t, ...TL.toBlack)); if (a > 0 && sh.name !== 'door') { c.fillStyle = `rgba(0,0,0,${a})`; c.fillRect(0, 0, W, H); } }
      finish(c, t);
      if (['living', 'dawn', 'doorKnock', 'doorOpen', 'sitting'].includes(sh.name)) hud(c, t, TL, NIGHT);
      if (!cfg.noCaptions && sh.name !== 'card') captions(c, t, ['phone', 'members'].includes(sh.name) ? 640 : W / 2);
      return {};
    },
    resize() {},
  };
});
