import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutCubic, lerp, rng} from '../kit/util.js';
import TL from './timeline.json';
import LINES from './lines.json';

// "What If At 2:14" — Knock at 4,000 Meters, drawn in 2D: black silhouettes with rim light,
// layered fog and light shafts, a cold night sky and one accent colour per beat.

const W = 1080, H = 1920, FPS = 30;
const DEFAULTS = {duration: TL.duration, fps: FPS, theme: 'dark', hud: {enabled: false, title: 'ocean2d2', subtitle: ''}, director: {enabled: false}, watermark: '', seed: 7};
const C = {ink: '#030407', sky0: '#03050c', sky1: '#0b1630', haze: '#1d3d55', alien: '#eaf2ff', sodium: '255,170,90', phone: '125,175,255', red: '#e0484f', warm: '255,201,74', text: '#F3F4F8', dim: '#7C859C'};
const p01 = (t, a, b) => clamp01((t - a) / (b - a));
const ease = easeInOutCubic;
const F = (w, s) => `${w} ${s}px Inter, sans-serif`;

// ---------- drawing helpers ----------
const off = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function skyGrad(c, y0, y1, glow = 0) {
  const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, C.sky0); g.addColorStop(0.65, C.sky1); g.addColorStop(1, C.haze);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (glow > 0) { const r = c.createRadialGradient(W / 2, y0 - 200, 0, W / 2, y0 - 200, 1300); r.addColorStop(0, `rgba(234,242,255,${0.55 * glow})`); r.addColorStop(1, 'rgba(234,242,255,0)'); c.fillStyle = r; c.fillRect(0, 0, W, H); }
}
const STARS = (() => { const r = rng(11); return Array.from({length: 420}, () => [r() * W * 1.4 - W * 0.2, r() * H, 0.5 + r() * 1.6, r() * 6]); })();
function stars(c, t, dy = 0, alpha = 1, maxY = H) {
  c.save(); for (const [x, y, s, ph] of STARS) { const yy = y + dy; if (yy > maxY || yy < -10) continue; c.globalAlpha = alpha * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.7 + ph))) * (1 - yy / maxY * 0.7); c.fillStyle = '#dfe8ff'; c.fillRect(x, yy, s, s); } c.restore();
}
function fog(c, y, h, a, col = '29,61,85') {
  const g = c.createLinearGradient(0, y - h, 0, y + h); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(0, y - h, W, h * 2);
}
function shaft(c, x, y0, y1, w0, w1, a, col = '234,242,255') {
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},${a * 0.15})`);
  c.fillStyle = g; c.beginPath(); c.moveTo(x - w0 / 2, y0); c.lineTo(x + w0 / 2, y0); c.lineTo(x + w1 / 2, y1); c.lineTo(x - w1 / 2, y1); c.closePath(); c.fill();
  c.restore();
}
function glowDot(c, x, y, r, col, a) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
// a path drawn twice: once offset in the light colour (rim), then black on top
function rim(c, path, col, dx, dy, fill = C.ink) {
  c.save(); c.translate(dx, dy); c.fillStyle = col; path(); c.fill(); c.restore();
  c.fillStyle = fill; path(); c.fill();
}

// ---------- houses: a row of silhouettes; windows light up blue (phones) as the wave passes ----------
function makeRow(seed, n, minH, maxH, wMin, wMax) {
  const r = rng(seed), out = []; let x = -200;
  while (x < W + 400) {
    const w = wMin + r() * (wMax - wMin), h = minH + r() * (maxH - minH), roof = r() < 0.6 ? 'gable' : 'flat', chim = r() < 0.4;
    const wins = []; const cols = Math.max(2, Math.floor(w / 70)), rows = Math.max(1, Math.floor(h / 110));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) wins.push({x: (i + 0.5) / cols, y: 0.25 + j * 0.6 / rows, lit: r() < 0.12, phone: r() < 0.8, who: r() < 0.7, d: r()});
    out.push({x, w, h, roof, chim, wins, gap: 10 + r() * 50}); x += w + 10 + r() * 50;
  }
  return out;
}
const ROWS = [makeRow(3, 0, 180, 330, 160, 300), makeRow(5, 0, 260, 460, 220, 380), makeRow(9, 0, 360, 560, 300, 460)];
function houses(c, row, baseY, scale, shade, t, wave, dx = 0) {
  c.save(); c.translate(dx, 0);
  for (const b of row) {
    const x = b.x * scale - (scale - 1) * W / 2, w = b.w * scale, h = b.h * scale, top = baseY - h;
    c.fillStyle = shade; c.beginPath();
    if (b.roof === 'gable') { c.moveTo(x, baseY); c.lineTo(x, top); c.lineTo(x + w / 2, top - h * 0.28); c.lineTo(x + w, top); c.lineTo(x + w, baseY); }
    else { c.rect(x, top, w, h); }
    c.fill();
    if (b.chim) c.fillRect(x + w * 0.72, top - h * 0.22, w * 0.08, h * 0.22);
    for (const wn of b.wins) {
      const wx = x + wn.x * w - 14 * scale, wy = top + wn.y * h, ww = 28 * scale, wh = 36 * scale;
      const on = wn.phone ? easeOutCubic(p01(t, wave + (x + w / 2) / W * 0.8 + wn.d * 0.25, wave + (x + w / 2) / W * 0.8 + wn.d * 0.25 + 0.3)) : 0;
      if (wn.lit) { c.fillStyle = `rgba(${C.sodium},.75)`; c.fillRect(wx, wy, ww, wh); }
      if (on > 0) {
        const g = c.createLinearGradient(0, wy + wh, 0, wy); g.addColorStop(0, `rgba(${C.phone},${0.95 * on})`); g.addColorStop(1, `rgba(60,100,190,${0.35 * on})`);
        c.fillStyle = g; c.fillRect(wx, wy, ww, wh);
        if (wn.who) { c.fillStyle = shade; c.beginPath(); c.ellipse(wx + ww / 2, wy + wh * 0.55, ww * 0.16, wh * 0.15, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(wx + ww / 2, wy + wh, ww * 0.38, wh * 0.3, 0, Math.PI, 0); c.fill(); }
        glowDot(c, wx + ww / 2, wy + wh / 2, ww * 1.6, C.phone, 0.12 * on);
      }
    }
  }
  c.restore();
}
function tree(c, x, y, s, shade) { c.fillStyle = shade; c.fillRect(x - 5 * s, y - 120 * s, 10 * s, 120 * s); const r = rng(Math.floor(x)); for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(x + (r() - 0.5) * 120 * s, y - 150 * s - r() * 90 * s, (40 + r() * 35) * s, 0, 7); c.fill(); } }
function lamp(c, x, y, s, on, side = 1) {
  c.fillStyle = C.ink; c.fillRect(x - 3 * s, y - 330 * s, 6 * s, 330 * s); c.fillRect(x, y - 330 * s, side * 60 * s, 6 * s); c.fillRect(x + side * 50 * s, y - 333 * s, side * 26 * s, 10 * s);
  if (on > 0) { shaft(c, x + side * 63 * s, y - 322 * s, y + 10 * s, 24 * s, 260 * s, 0.13 * on, C.sodium); glowDot(c, x + side * 63 * s, y - 322 * s, 70 * s, C.sodium, 0.9 * on); glowDot(c, x + side * 63 * s, y, 150 * s, C.sodium, 0.18 * on); }
}

// ---------- people (black silhouettes) ----------
// profile head facing right; tilt: 0 level .. 1 looking straight up; with glasses
function headProfile(c, x, y, s, tilt) {
  c.save(); c.translate(x, y); c.rotate(-tilt * 1.0);
  c.beginPath();
  c.moveTo(-0.6 * s, 0.9 * s); c.bezierCurveTo(-1.05 * s, 0.4 * s, -1.05 * s, -0.75 * s, -0.25 * s, -1.0 * s);                 // back of the skull
  c.bezierCurveTo(0.35 * s, -1.15 * s, 0.85 * s, -0.75 * s, 0.82 * s, -0.25 * s);                                                  // crown to brow (bald)
  c.lineTo(0.9 * s, -0.12 * s); c.lineTo(1.12 * s, 0.22 * s); c.lineTo(0.9 * s, 0.32 * s);                                      // nose
  c.lineTo(0.92 * s, 0.45 * s); c.lineTo(0.84 * s, 0.52 * s); c.lineTo(0.9 * s, 0.6 * s);                                       // lips
  c.bezierCurveTo(0.85 * s, 0.85 * s, 0.6 * s, 0.98 * s, 0.25 * s, 0.95 * s);                                                     // chin
  c.lineTo(0.1 * s, 1.35 * s); c.lineTo(-0.5 * s, 1.35 * s); c.closePath();                                                       // neck
  c.restore();
}
function glassesProfile(c, x, y, s, tilt, col) {
  c.save(); c.translate(x, y); c.rotate(-tilt * 1.0); c.strokeStyle = col; c.lineWidth = 0.07 * s;
  c.beginPath(); c.moveTo(0.98 * s, -0.12 * s); c.lineTo(0.98 * s, 0.12 * s); c.stroke();                                         // lens edge-on
  c.beginPath(); c.moveTo(0.95 * s, -0.08 * s); c.lineTo(0.05 * s, -0.12 * s); c.stroke();                                         // arm
  c.restore();
}
// the neighbour, side view facing right: bathrobe to the shins, belt tie, slippers, a mug
function robeMan(c, x, y, s, tilt, rimCol, front = 0) {
  const body = () => {
    c.beginPath();
    c.moveTo(x - 0.32 * s, y - 1.0 * s); c.lineTo(x - 0.36 * s, y - 3.05 * s); c.quadraticCurveTo(x - 0.25 * s, y - 3.45 * s, x + 0.05 * s, y - 3.45 * s);   // back + shoulder
    c.quadraticCurveTo(x + 0.38 * s, y - 3.3 * s, x + 0.42 * s, y - 2.6 * s); c.quadraticCurveTo(x + 0.62 * s, y - 2.1 * s, x + 0.5 * s, y - 1.0 * s);        // chest + belly
    c.lineTo(x + 0.62 * s, y - 0.62 * s); c.lineTo(x - 0.45 * s, y - 0.6 * s); c.closePath();                                                              // flared hem
    // legs + slippers
    c.rect(x - 0.18 * s, y - 0.65 * s, 0.12 * s, 0.6 * s); c.rect(x + 0.08 * s, y - 0.65 * s, 0.12 * s, 0.6 * s);
    c.moveTo(x - 0.26 * s, y); c.lineTo(x - 0.26 * s, y - 0.1 * s); c.lineTo(x + 0.04 * s, y - 0.12 * s); c.lineTo(x + 0.12 * s, y); c.closePath();
    c.moveTo(x + 0.0 * s, y); c.lineTo(x + 0.0 * s, y - 0.1 * s); c.lineTo(x + 0.3 * s, y - 0.12 * s); c.lineTo(x + 0.4 * s, y); c.closePath();
    // arm bent, holding a mug in front of the belly
    c.moveTo(x - 0.05 * s, y - 3.1 * s); c.lineTo(x + 0.12 * s, y - 2.15 * s); c.lineTo(x + 0.62 * s, y - 2.05 * s); c.lineTo(x + 0.62 * s, y - 1.85 * s); c.lineTo(x - 0.02 * s, y - 1.95 * s); c.closePath();
    c.rect(x + 0.6 * s, y - 2.25 * s, 0.24 * s, 0.32 * s);
    // belt tie hanging
    c.rect(x + 0.42 * s, y - 1.75 * s, 0.05 * s, 0.4 * s);
  };
  const neckX = x + 0.02 * s, neckY = y - 3.7 * s;
  const headF = () => { c.beginPath(); c.ellipse(neckX, neckY - 0.05 * s, 0.3 * s, 0.37 * s, 0, 0, 7); c.rect(neckX - 0.1 * s, neckY + 0.2 * s, 0.2 * s, 0.25 * s); };
  const headP = () => headProfile(c, neckX, neckY, 0.36 * s, tilt);
  const head = front > 0.5 ? headF : headP;
  if (rimCol) { c.save(); c.translate(0, -4); c.fillStyle = rimCol; body(); c.fill(); head(); c.fill(); c.restore(); }
  c.fillStyle = C.ink; body(); c.fill(); head(); c.fill();
  if (front > 0.5) { c.strokeStyle = 'rgba(170,180,200,.6)'; c.lineWidth = 0.025 * s; for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(neckX + sx * 0.12 * s, neckY - 0.05 * s, 0.09 * s, 0.07 * s, 0, 0, 7); c.stroke(); }
    const e = clamp01((front - 0.5) * 2); for (const sx of [-1, 1]) { glowDot(c, neckX + sx * 0.12 * s, neckY - 0.08 * s, 0.25 * s, '234,242,255', 0.6 * e); c.fillStyle = `rgba(245,248,255,${e})`; c.beginPath(); c.ellipse(neckX + sx * 0.12 * s, neckY - 0.08 * s, 0.05 * s, 0.02 * s, 0, Math.PI, 0); c.fill(); } }
  else glassesProfile(c, neckX, neckY, 0.36 * s, tilt, 'rgba(160,170,190,.55)');
}
// front view head + shoulders, for the turn and the eyes; eyes: 0..1 glow (rolled up)
function frontBust(c, x, y, s, eyes, light) {
  c.save();
  const bust = () => {
    c.beginPath(); c.ellipse(x, y, 0.8 * s, 1.0 * s, 0, 0, 7);                                                          // head
    c.moveTo(x - 0.32 * s, y + 0.8 * s); c.lineTo(x - 0.3 * s, y + 1.35 * s); c.quadraticCurveTo(x - 1.9 * s, y + 1.5 * s, x - 2.1 * s, y + 3.6 * s); c.lineTo(x + 2.1 * s, y + 3.6 * s); c.quadraticCurveTo(x + 1.9 * s, y + 1.5 * s, x + 0.3 * s, y + 1.35 * s); c.lineTo(x + 0.32 * s, y + 0.8 * s); c.closePath();
    c.moveTo(x - 0.84 * s, y + 0.05 * s); c.ellipse(x - 0.82 * s, y + 0.05 * s, 0.12 * s, 0.22 * s, 0, 0, 7); c.moveTo(x + 0.94 * s, y + 0.05 * s); c.ellipse(x + 0.82 * s, y + 0.05 * s, 0.12 * s, 0.22 * s, 0, 0, 7);   // ears
  };
  if (light > 0) { c.save(); c.translate(0, -0.05 * s); c.fillStyle = `rgba(234,242,255,${0.9 * light})`; bust(); c.fill(); c.restore(); }
  c.fillStyle = C.ink; bust(); c.fill();
  // robe collar V (the stripes catch a little light)
  c.strokeStyle = `rgba(150,60,70,${0.5 * light + 0.15})`; c.lineWidth = 0.08 * s; c.beginPath(); c.moveTo(x - 0.9 * s, y + 1.45 * s); c.lineTo(x, y + 2.6 * s); c.lineTo(x + 0.9 * s, y + 1.45 * s); c.stroke();
  // glasses
  c.strokeStyle = `rgba(170,180,200,${0.35 + 0.4 * light})`; c.lineWidth = 0.05 * s;
  for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(x + sx * 0.33 * s, y + 0.02 * s, 0.24 * s, 0.19 * s, 0, 0, 7); c.stroke(); }
  c.beginPath(); c.moveTo(x - 0.09 * s, y); c.lineTo(x + 0.09 * s, y); c.stroke();
  // eyes rolled up: thin white crescents at the top of each lens
  if (eyes > 0) for (const sx of [-1, 1]) {
    glowDot(c, x + sx * 0.33 * s, y - 0.08 * s, 0.5 * s, '234,242,255', 0.55 * eyes);
    c.fillStyle = `rgba(245,248,255,${eyes})`; c.beginPath(); c.ellipse(x + sx * 0.33 * s, y - 0.06 * s, 0.14 * s, 0.05 * s, 0, Math.PI, 0); c.fill();
  }
  c.restore();
}
// a woman walking a dog, side view facing left, phone glowing in her hand
function womanDog(c, x, y, s, phoneOn) {
  c.fillStyle = C.ink; c.beginPath();
  c.moveTo(x + 0.3 * s, y - 1.0 * s); c.lineTo(x + 0.32 * s, y - 2.9 * s); c.quadraticCurveTo(x + 0.2 * s, y - 3.4 * s, x - 0.1 * s, y - 3.35 * s); c.quadraticCurveTo(x - 0.4 * s, y - 3.1 * s, x - 0.38 * s, y - 2.4 * s); c.lineTo(x - 0.45 * s, y - 1.05 * s); c.closePath();   // coat
  c.rect(x - 0.2 * s, y - 1.1 * s, 0.13 * s, 1.1 * s); c.rect(x + 0.05 * s, y - 1.1 * s, 0.13 * s, 1.05 * s);
  c.fill();
  c.beginPath(); c.ellipse(x - 0.05 * s, y - 3.75 * s, 0.3 * s, 0.36 * s, 0, 0, 7); c.fill();                                // head
  c.beginPath(); c.moveTo(x + 0.18 * s, y - 3.85 * s); c.quadraticCurveTo(x + 0.6 * s, y - 3.6 * s, x + 0.42 * s, y - 3.0 * s); c.lineTo(x + 0.3 * s, y - 3.05 * s); c.quadraticCurveTo(x + 0.4 * s, y - 3.5 * s, x + 0.12 * s, y - 3.6 * s); c.fill();   // ponytail
  c.fillStyle = 'rgba(201,162,39,.95)'; c.fillRect(x - 0.32 * s, y - 3.38 * s, 0.6 * s, 0.14 * s); c.fillRect(x + 0.12 * s, y - 3.3 * s, 0.12 * s, 0.5 * s);   // yellow scarf (the one colour)
  c.fillStyle = C.ink; c.beginPath(); c.moveTo(x - 0.2 * s, y - 2.9 * s); c.lineTo(x - 0.62 * s, y - 2.35 * s); c.lineTo(x - 0.55 * s, y - 2.25 * s); c.lineTo(x - 0.1 * s, y - 2.6 * s); c.fill();   // arm with phone
  if (phoneOn > 0) { c.fillStyle = `rgba(${C.phone},${phoneOn})`; c.fillRect(x - 0.72 * s, y - 2.48 * s, 0.14 * s, 0.24 * s); glowDot(c, x - 0.6 * s, y - 2.8 * s, 1.4 * s, C.phone, 0.4 * phoneOn); }
  // leash + dog
  c.fillStyle = C.ink; c.strokeStyle = C.ink; c.lineWidth = 0.04 * s; c.beginPath(); c.moveTo(x + 0.3 * s, y - 1.9 * s); c.quadraticCurveTo(x - 0.4 * s, y - 0.9 * s, x - 1.2 * s, y - 1.05 * s); c.stroke();
  const dx = x - 1.7 * s; c.beginPath(); c.ellipse(dx, y - 0.75 * s, 0.6 * s, 0.25 * s, 0, 0, 7); c.fill();
  for (const lx of [-0.45, -0.25, 0.3, 0.5]) c.fillRect(dx + lx * s, y - 0.75 * s, 0.09 * s, 0.75 * s);
  c.beginPath(); c.ellipse(dx - 0.65 * s, y - 1.05 * s, 0.22 * s, 0.2 * s, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(dx - 0.65 * s, y - 1.2 * s); c.lineTo(dx - 0.55 * s, y - 1.48 * s); c.lineTo(dx - 0.5 * s, y - 1.15 * s); c.fill();
  c.beginPath(); c.moveTo(dx + 0.55 * s, y - 0.85 * s); c.quadraticCurveTo(dx + 0.85 * s, y - 1.2 * s, dx + 0.9 * s, y - 1.3 * s); c.lineWidth = 0.07 * s; c.stroke();
}
function car(c, x, y, s, lights) {
  c.fillStyle = C.ink; c.beginPath(); c.moveTo(x - 2.2 * s, y - 0.35 * s); c.lineTo(x - 2.2 * s, y - 0.9 * s); c.lineTo(x - 1.2 * s, y - 1.0 * s); c.lineTo(x - 0.7 * s, y - 1.55 * s); c.lineTo(x + 0.9 * s, y - 1.55 * s); c.lineTo(x + 1.5 * s, y - 1.0 * s); c.lineTo(x + 2.2 * s, y - 0.9 * s); c.lineTo(x + 2.2 * s, y - 0.35 * s); c.closePath(); c.fill();
  for (const wx of [-1.4, 1.4]) { c.beginPath(); c.arc(x + wx * s, y - 0.35 * s, 0.38 * s, 0, 7); c.fill(); }
  if (lights > 0) { glowDot(c, x - 2.15 * s, y - 0.75 * s, 0.9 * s, '255,244,220', lights); shaft(c, x - 2.2 * s, y - 0.75 * s, y + 0.3 * s, 0.2 * s, 0.2 * s, 0, '255,244,220'); c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(x - 2.2 * s, 0, x - 9 * s, 0); g.addColorStop(0, `rgba(255,244,220,${0.25 * lights})`); g.addColorStop(1, 'rgba(255,244,220,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x - 2.2 * s, y - 0.85 * s); c.lineTo(x - 9 * s, y - 1.6 * s); c.lineTo(x - 9 * s, y + 0.4 * s); c.lineTo(x - 2.2 * s, y - 0.55 * s); c.fill(); c.restore(); glowDot(c, x + 2.15 * s, y - 0.8 * s, 0.4 * s, '224,72,79', lights); }
}
function ship(c, cx, cy, s, a, t) {
  c.save();
  c.fillStyle = '#010103'; c.beginPath(); c.ellipse(cx, cy, 6 * s, 1.1 * s, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(cx, cy - 0.4 * s, 2.2 * s, 0.9 * s, 0, Math.PI, 0); c.fill();
  for (let ring = 0; ring < 3; ring++) { const rx = (5.4 - ring * 1.6) * s, ry = (0.9 - ring * 0.25) * s, n = 40 - ring * 10; for (let i = 0; i < n; i++) { const ang = i / n * Math.PI * 2 + t * 0.15 * (ring % 2 ? -1 : 1); const px = cx + Math.cos(ang) * rx, py = cy + 0.2 * s + Math.sin(ang) * ry; if (Math.sin(ang) < -0.2) continue; glowDot(c, px, py, 0.18 * s, '234,242,255', a * 0.9); } }
  glowDot(c, cx, cy + 0.6 * s, 2.4 * s, '234,242,255', a);
  c.restore();
}

// ---------- phone UI ----------
const SW = 760, SH = 1640;
function drawPhone(c, t, mode) {
  const g = c.createLinearGradient(0, 0, SW, SH); g.addColorStop(0, '#16203e'); g.addColorStop(1, '#070a14'); c.fillStyle = g; c.fillRect(0, 0, SW, SH);
  c.fillStyle = '#000'; c.beginPath(); c.roundRect(SW / 2 - 110, 26, 220, 60, 30); c.fill();
  c.textAlign = 'center'; c.fillStyle = 'rgba(233,236,244,.75)'; c.font = F(600, 34); c.fillText('Friday', SW / 2, 230);
  c.fillStyle = C.text; c.font = F(700, 190); c.fillText(t < 30 ? '2:14' : '2:16', SW / 2, 420);
  const k = easeOutCubic(p01(t, TL.notifAt, TL.notifAt + 0.5));
  const card = (y, body, col, kk) => {
    c.save(); c.globalAlpha = kk; c.translate(0, (1 - kk) * 40);
    c.fillStyle = 'rgba(28,32,48,.94)'; c.beginPath(); c.roundRect(36, y, SW - 72, 230, 40); c.fill();
    c.fillStyle = '#0a0b10'; c.beginPath(); c.roundRect(66, y + 34, 72, 72, 18); c.fill();
    c.strokeStyle = 'rgba(233,236,244,.5)'; c.lineWidth = 3; c.beginPath(); c.arc(102, y + 70, 18, 0, 7); c.stroke();
    c.textAlign = 'left'; c.fillStyle = C.dim; c.font = F(600, 26); c.fillText('NO CALLER ID', 162, y + 62); c.textAlign = 'right'; c.fillText('now', SW - 70, y + 62);
    c.textAlign = 'left'; c.fillStyle = col; c.font = F(800, 56); c.fillText(body, 162, y + 150);
    c.restore();
  };
  if (mode === 'phone2') { const k2 = easeOutCubic(p01(t, TL.newLineAt, TL.newLineAt + 0.45)); card(560 + 250 * k2, 'Do not look up.', C.text, 1); if (k2 > 0) card(560, 'He looked.', C.red, k2); }
  else if (mode === 'msg' || k > 0) card(560, 'Do not look up.', C.text, mode === 'msg' ? 1 : k);
}

// ---------- captions + HUD ----------
const KEY = new Set(['knocked', 'knocks', 'four', 'thousand', 'outside', 'hull', 'nothing', 'black', 'morse', 'name', 'sonar', 'hatch', 'voice', 'inside', 'white', 'open', 'back', 'turn']);
const CHUNKS = [];
for (const L of LINES) {
  const phrases = []; let cur = [];
  for (const w of L.words) { cur.push(w); if (/[.,?!…]["']?$/.test(w[0])) { phrases.push(cur); cur = []; } }
  if (cur.length) phrases.push(cur);
  for (const ph of phrases) { const n = Math.ceil(ph.length / 3), size = Math.ceil(ph.length / n); for (let i = 0; i < ph.length; i += size) { const g = ph.slice(i, i + size); CHUNKS.push({words: g.map((w) => w[0]), t0: g[0][1], t1: g[g.length - 1][2]}); } }
}
CHUNKS.forEach((ch, i) => { const nx = CHUNKS[i + 1]; ch.end = nx ? Math.min(nx.t0, ch.t1 + 0.6) : ch.t1 + 0.8; });
const clean = (w) => (/^a\.m/i.test(w) ? 'AM' : w.replace(/^["“]+/, '').replace(/\.\.\.$/, '').replace(/["”]$/, '').replace(/[.,?!:]$/, '').replace(/["”]$/, '').replace(/[.,?!:]$/, ''));
function captions(c, t) {
  const ch = CHUNKS.find((k) => t >= k.t0 - 0.04 && t < k.end); if (!ch) return;
  const a = easeOutCubic(p01(t, ch.t0 - 0.04, ch.t0 + 0.1)), out = 1 - p01(t, ch.end - 0.08, ch.end);
  const words = ch.words.map(clean).map((s) => s.toUpperCase());
  const hi = words.findIndex((w) => KEY.has(w.toLowerCase().replace(/[^a-z0-9]/g, '')));
  c.save(); c.globalAlpha = a * out;
  c.font = F(900, 76); c.textAlign = 'left'; c.letterSpacing = '1px';
  const sp = 22, ws = words.map((w) => c.measureText(w).width), total = ws.reduce((x, y) => x + y, 0) + sp * (words.length - 1);
  let x = W / 2 - total / 2; const y = 1355 + (1 - a) * 12;
  c.shadowColor = 'rgba(0,0,0,.9)'; c.shadowBlur = 26; c.shadowOffsetY = 4;
  words.forEach((w, i) => { c.fillStyle = i === hi ? `rgb(${C.warm})` : C.text; c.fillText(w, x, y); x += ws[i] + sp; });
  c.restore();
}
function hud(c, t) {
  c.save(); c.globalAlpha = p01(t, 0.4, 1.2); c.textAlign = 'left';
  c.fillStyle = C.red; c.beginPath(); c.arc(84, 196, 9, 0, 7); c.fill();
  c.fillStyle = 'rgba(233,236,244,.75)'; c.font = F(700, 24); c.letterSpacing = '5px'; c.fillText(TL.night, 104, 205);
  c.letterSpacing = '0px'; c.fillStyle = C.text; c.font = F(800, 72); const ct = TL.clockAt.filter(([a]) => t >= a).pop()[1], tw = c.measureText(ct).width; c.fillText(ct, 70, 288);
  c.font = F(700, 30); c.fillStyle = 'rgba(233,236,244,.7)'; c.fillText('AM', 70 + tw + 12, 288);
  c.restore();
}

const SHOTS = TL.shots.map(([name, t0], i) => ({name, t0, t1: (TL.shots[i + 1] || [0, TL.duration])[1], i}));
const shotAt = (t) => SHOTS.filter((s) => t >= s.t0).pop() || SHOTS[0];

// grain: a few pre-made noise tiles cycled per frame
const GRAIN = Array.from({length: 4}, (_, k) => { const g = off(256, 256), x = g.getContext('2d'), d = x.createImageData(256, 256), r = rng(100 + k); for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 22; } x.putImageData(d, 0, 0); return g; });
function finish(c, t) {
  const v = c.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.5, H * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  c.save(); c.globalCompositeOperation = 'overlay'; const pat = c.createPattern(GRAIN[Math.floor(t * FPS) % 4], 'repeat'); c.fillStyle = pat; c.fillRect(0, 0, W, H); c.restore();
}

// ---------- the deep ----------
const SNOW = (() => { const r = rng(21); return Array.from({length: 260}, () => [r() * W, r() * H, 0.8 + r() * 2.4, 0.2 + r() * 0.8]); })();
function deep(c, t, light = 0) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#04131f'); g.addColorStop(0.5, '#020a12'); g.addColorStop(1, '#010306'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (const [x, y, s, v] of SNOW) { const yy = (y + t * 18 * v) % H, xx = x + Math.sin(t * 0.4 + y) * 8; c.fillStyle = `rgba(190,215,225,${(0.12 + 0.25 * v) * (0.4 + 0.6 * light)})`; c.fillRect(xx, yy, s, s); }
}
// the submarine, side view, nose to the left; portholes lit warm
function sub(c, x, y, s, lamp = 0, t = 0) {
  glowDot(c, x, y - 0.3 * s, 6 * s, '40,110,130', 0.35);
  c.save(); c.translate(0, -3); c.fillStyle = 'rgba(120,190,210,.55)'; c.beginPath(); c.ellipse(x, y, 4.2 * s, 0.9 * s, 0, 0, 7); c.fill(); c.beginPath(); c.roundRect(x - 0.8 * s, y - 1.75 * s, 1.5 * s, 1.0 * s, 0.2 * s); c.fill(); c.restore();
  c.fillStyle = '#05080c';
  c.beginPath(); c.ellipse(x, y, 4.2 * s, 0.9 * s, 0, 0, 7); c.fill();
  c.beginPath(); c.roundRect(x - 0.8 * s, y - 1.75 * s, 1.5 * s, 1.0 * s, 0.2 * s); c.fill();
  c.fillRect(x - 0.2 * s, y - 2.3 * s, 0.12 * s, 0.6 * s);
  c.beginPath(); c.moveTo(x + 4.0 * s, y); c.lineTo(x + 4.9 * s, y - 0.8 * s); c.lineTo(x + 4.9 * s, y + 0.8 * s); c.fill();
  for (let i = 0; i < 6; i++) { const px = x - 2.4 * s + i * 0.75 * s; c.fillStyle = `rgba(${C.warm},.85)`; c.beginPath(); c.arc(px, y - 0.1 * s, 0.09 * s, 0, 7); c.fill(); glowDot(c, px, y - 0.1 * s, 0.4 * s, C.warm, 0.25); }
  if (lamp > 0) { shaft(c, x - 4.2 * s, y, y, 0, 0, 0); c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(x - 4.2 * s, 0, x - 14 * s, 0); g.addColorStop(0, `rgba(180,215,230,${0.28 * lamp})`); g.addColorStop(1, 'rgba(180,215,230,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x - 4.1 * s, y - 0.2 * s); c.lineTo(x - 14 * s, y - 3 * s); c.lineTo(x - 14 * s, y + 3 * s); c.lineTo(x - 4.1 * s, y + 0.2 * s); c.fill(); c.restore(); }
}
// inside the hull: a curved riveted wall, pipes, a red night lamp; shake on each knock
function hullWall(c, t, knocks) {
  const sh = knocks.reduce((a, k) => a + (t > k ? Math.exp(-(t - k) * 14) : 0), 0);
  c.save(); c.translate(Math.sin(t * 90) * 6 * sh, Math.cos(t * 70) * 4 * sh);
  const g = c.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H * 0.45, 1300); g.addColorStop(0, '#3a1d1d'); g.addColorStop(1, '#0a0607'); c.fillStyle = g; c.fillRect(-40, -40, W + 80, H + 80);
  c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 10; for (let i = -2; i < 8; i++) { c.beginPath(); c.ellipse(W / 2, H * 0.45, 900 + i * 40, 1500, 0, Math.PI * 0.7, Math.PI * 1.3); c.stroke(); }
  for (let ring = 0; ring < 6; ring++) for (let j = 0; j < 14; j++) { const y = 200 + j * 120, x = 120 + ring * 170 + Math.sin(j) * 6; c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); c.fillStyle = 'rgba(255,140,120,.15)'; c.beginPath(); c.arc(x - 2, y - 2, 4, 0, 7); c.fill(); }
  c.fillStyle = '#120a0a'; c.fillRect(0, 1600, W, 40); c.fillRect(0, 1660, W, 26);
  glowDot(c, W - 150, 160, 220, '255,60,50', 0.5); c.fillStyle = '#ff4a3a'; c.fillRect(W - 180, 150, 60, 22);
  // dust shaken loose
  if (sh > 0.05) for (let i = 0; i < 40; i++) { const r = rng(i + Math.floor(t * 3)), dx = r() * W, dy = (r() * H + (t % 1) * 300) % H; c.fillStyle = `rgba(255,220,200,${0.4 * sh * r()})`; c.fillRect(dx, dy, 3, 3); }
  c.restore();
  if (sh > 0.1) { c.fillStyle = `rgba(255,255,255,${0.06 * Math.min(1, sh)})`; c.fillRect(0, 0, W, H); }
}
function sonarScreen(c, t, contact = 0) {
  c.fillStyle = '#020806'; c.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H * 0.3, R = 400;
  c.strokeStyle = 'rgba(80,255,150,.35)'; c.lineWidth = 3; for (let i = 1; i <= 4; i++) { c.beginPath(); c.arc(cx, cy, R * i / 4, 0, 7); c.stroke(); }
  c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx + R, cy); c.moveTo(cx, cy - R); c.lineTo(cx, cy + R); c.stroke();
  const a = t * 2.2; c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 30; i++) { c.strokeStyle = `rgba(80,255,150,${0.5 * (1 - i / 30)})`; c.lineWidth = 6; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a - i * 0.025) * R, cy + Math.sin(a - i * 0.025) * R); c.stroke(); } c.restore();
  c.fillStyle = 'rgba(80,255,150,.9)'; c.font = F(700, 40); c.textAlign = 'center'; c.fillText(contact ? 'CONTACT' : 'NO CONTACT', cx, cy + R + 90); c.font = F(600, 28); c.fillStyle = 'rgba(80,255,150,.6)'; c.fillText('DEPTH 4,012 m  ·  RANGE 2 km', cx, cy + R + 140);
  glowDot(c, cx, cy, 700, '80,255,150', 0.08);
}
// the note: Morse marks as they come in, then the letters; your hand holds the pencil
function paper(c, t, t0) {
  c.fillStyle = '#0a0708'; c.fillRect(0, 0, W, H); glowDot(c, W / 2, H * 0.45, 900, '255,90,70', 0.15);
  c.save(); c.translate(W / 2, H * 0.48); c.rotate(-0.06);
  c.fillStyle = '#c9b9a4'; c.fillRect(-380, -520, 760, 1040); c.fillStyle = 'rgba(80,40,30,.15)'; for (let i = 0; i < 14; i++) c.fillRect(-380, -440 + i * 70, 760, 3);
  c.fillStyle = '#2a2220'; c.font = '700 64px "Courier New", monospace'; c.textAlign = 'left';
  const marks = ['· · —', '— · · ·', '· · · ·', '— —  ·', '· —  ·'], shown = Math.floor(p01(t, t0, t0 + 3.6) * marks.length + 0.001);
  for (let i = 0; i < shown; i++) c.fillText(marks[i], -320, -380 + i * 90);
  // the decoded word: written, then circled hard
  const w = p01(t, 46.1, 46.6);
  if (w > 0) { c.globalAlpha = w; c.font = '800 92px "Courier New", monospace'; c.fillText('= MY NAME', -330, 230); c.strokeStyle = '#7a1c1c'; c.lineWidth = 7; c.beginPath(); c.ellipse(20, 200, 380 * w, 90, 0, 0, Math.PI * 2 * w); c.stroke(); c.globalAlpha = 1; }
  c.restore();
  c.fillStyle = C.ink; c.beginPath(); c.ellipse(W - 140, H * 0.78, 220, 120, -0.7, 0, 7); c.fill(); c.save(); c.translate(W - 260, H * 0.7); c.rotate(-0.9); c.fillStyle = '#d8b04a'; c.fillRect(-10, -180, 20, 180); c.restore();
}

// the escape hatch from below: a round door in the ceiling with a wheel; seam light 0..1
function hatchView(c, t, rot, seam, z = 1) {
  c.save(); c.translate(W / 2, H * 0.42); c.scale(z, z); c.translate(-W / 2, -H * 0.42);
  const g = c.createRadialGradient(W / 2, H * 0.42, 50, W / 2, H * 0.42, 1100); g.addColorStop(0, '#3b1c1c'); g.addColorStop(1, '#080505'); c.fillStyle = g; c.fillRect(-200, -200, W + 400, H + 400);
  const cx = W / 2, cy = H * 0.42, R = 330;
  c.fillStyle = '#140b0b'; c.beginPath(); c.arc(cx, cy, R + 60, 0, 7); c.fill();
  c.fillStyle = '#2a1616'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
  if (seam > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(200,230,240,${seam})`; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, R + 4, 0, 7); c.stroke(); c.restore(); glowDot(c, cx, cy, R * 1.8, '180,220,235', 0.25 * seam); }
  for (let i = 0; i < 16; i++) { const an = i / 16 * Math.PI * 2; c.fillStyle = '#0a0606'; c.beginPath(); c.arc(cx + Math.cos(an) * (R + 30), cy + Math.sin(an) * (R + 30), 10, 0, 7); c.fill(); }
  c.save(); c.translate(cx, cy); c.rotate(rot);
  c.strokeStyle = '#6b3d35'; c.lineWidth = 34; c.beginPath(); c.arc(0, 0, 200, 0, 7); c.stroke();
  for (let i = 0; i < 5; i++) { c.save(); c.rotate(i / 5 * Math.PI * 2); c.fillStyle = '#5a332d'; c.fillRect(-12, 0, 24, 200); c.restore(); }
  c.fillStyle = '#7a4a40'; c.beginPath(); c.arc(0, 0, 50, 0, 7); c.fill();
  c.restore();
  glowDot(c, W - 140, 140, 220, '255,60,50', 0.4);
  c.restore();
}

runSim(DEFAULTS, async ({cfg, canvas}) => {
  await Promise.all([900, 800, 700, 600].map((w) => document.fonts.load(F(w, 40)))).catch(() => {});
  canvas.style.display = 'none';
  const ov = document.createElement('canvas'); ov.id = 'ov'; ov.width = W; ov.height = H; document.getElementById('app').appendChild(ov);
  const c = ov.getContext('2d');
  const rotAt = (t) => ease(p01(t, ...TL.turn)) * Math.PI * 1.4;

  function scene(x, t, sh) {
    const lt = t - sh.t0, dur = sh.t1 - sh.t0, k = ease(p01(lt, 0, dur));
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    if (sh.name === 'knockback' || sh.name === 'silence') {
      hullWall(x, t, TL.myKnocks);
      // your fist against the hull
      const hit = TL.myKnocks.reduce((a, kk) => a + Math.max(0, 1 - Math.abs(t - kk) / 0.12), 0), fx = 700, fy = lerp(1250, 1150, Math.min(1, hit));
      if (sh.name === 'knockback') { x.fillStyle = C.ink; x.beginPath(); x.roundRect(fx - 110, fy - 90, 220, 180, 60); x.fill(); x.beginPath(); x.moveTo(fx - 80, fy + 60); x.lineTo(fx + 40, H); x.lineTo(fx + 300, H); x.lineTo(fx + 80, fy + 60); x.fill(); }
    } else if (sh.name === 'move') {
      // outside: the knocks walk along the hull toward the stern, each one a pale ring
      deep(x, t, 0.4); sub(x, 540, 960, 105, 0.3, t);
      TL.moveKnocks.forEach((kk, i) => { if (t < kk) return; const a = 1 - p01(t, kk, kk + 1.2), px = 540 - 1.6 * 105 + i * 0.95 * 105, py = 960; x.strokeStyle = `rgba(200,230,240,${0.8 * a})`; x.lineWidth = 4; x.beginPath(); x.arc(px, py, (1 - a) * 160 + 10, 0, 7); x.stroke(); glowDot(x, px, py, 80, '200,230,240', 0.5 * a); });
      x.fillStyle = 'rgba(160,220,235,.7)'; x.font = F(700, 26); x.textAlign = 'center'; x.letterSpacing = '4px'; x.fillText('ESCAPE HATCH ▼', 540 + 2.6 * 105, 960 - 1.4 * 105); x.letterSpacing = '0px';
    } else if (sh.name === 'hatch') { hatchView(x, t, 0, 0, lerp(0.8, 1.0, k)); }
    else if (sh.name === 'captain') {
      // you and the captain at the hull, listening; his face goes white
      hullWall(x, t, []);
      const wa = ease(p01(t, TL.white - 0.3, TL.white + 0.6));
      x.fillStyle = C.ink; x.beginPath(); x.ellipse(330, 1180, 140, 165, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(-40, H); x.quadraticCurveTo(0, 1360, 330, 1340); x.quadraticCurveTo(650, 1360, 690, H); x.fill();
      // captain in profile, facing left (toward the hull), cap on
      const cx2 = 760, cy2 = 1020;
      x.fillStyle = C.ink; x.beginPath(); x.moveTo(cx2 + 300, H); x.quadraticCurveTo(cx2 + 300, cy2 + 260, cx2 + 70, cy2 + 230); x.quadraticCurveTo(cx2 - 190, cy2 + 260, cx2 - 220, H); x.fill();
      x.beginPath(); x.ellipse(cx2, cy2, 120, 145, 0, 0, 7); x.fill();
      x.beginPath(); x.moveTo(cx2 - 140, cy2 - 90); x.lineTo(cx2 + 130, cy2 - 110); x.lineTo(cx2 + 120, cy2 - 170); x.quadraticCurveTo(cx2, cy2 - 210, cx2 - 100, cy2 - 150); x.lineTo(cx2 - 210, cy2 - 95); x.closePath(); x.fill();
      if (wa > 0) { x.save(); x.beginPath(); x.ellipse(cx2, cy2, 120, 145, 0, 0, 7); x.clip(); x.fillStyle = `rgba(225,228,232,${0.92 * wa})`; x.beginPath(); x.ellipse(cx2 - 60, cy2 + 10, 85, 130, 0, 0, 7); x.fill(); x.fillStyle = `rgba(20,10,10,${wa})`; x.beginPath(); x.ellipse(cx2 - 85, cy2 - 15, 11, 15, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(cx2 - 95, cy2 + 70, 18, 10, 0, 0, 7); x.fill(); x.restore(); }
    } else if (sh.name === 'wheel' || sh.name === 'voice' || sh.name === 'end' || sh.name === 'title') {
      const z = sh.name === 'wheel' ? lerp(1.0, 1.25, k) : sh.name === 'voice' ? lerp(1.25, 1.5, k) : 1.5;
      const seam = sh.name === 'voice' ? ease(p01(t, 33.0, 34.3)) : sh.name === 'end' || sh.name === 'title' ? 1 : 0;
      hatchView(x, t, rotAt(t), seam, z);
      if (sh.name === 'voice' && t > 34.3) { x.textAlign = 'center'; x.fillStyle = '#ffffff'; x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 24; x.font = 'italic 700 74px Inter, sans-serif'; x.globalAlpha = ease(p01(t, 34.3, 34.6)); x.fillText('"It\'s me. Let me in."', W / 2, 240); x.shadowBlur = 0; x.globalAlpha = 1; }
    }
  }

  return {
    render(t) {
      const sh = shotAt(t);
      scene(c, t, sh);
      const since = t - sh.t0; if (sh.i > 0 && since < 0.1) { c.fillStyle = `rgba(0,0,0,${1 - since / 0.1})`; c.fillRect(0, 0, W, H); }
      finish(c, t);
      if (['knockback', 'captain'].includes(sh.name)) hud(c, t);
      if (sh.name === 'title') {
        const a = ease(p01(t, sh.t0, sh.t0 + 0.6)); c.fillStyle = `rgba(0,0,0,${0.75 * a})`; c.fillRect(0, 0, W, H);
        const tt = easeOutCubic(p01(t, sh.t0 + 0.2, sh.t0 + 1.2));
        c.save(); c.globalAlpha = tt; c.textAlign = 'center'; c.fillStyle = C.text; c.font = F(800, 70); c.letterSpacing = '10px'; c.fillText(TL.endTitle, W / 2 + 5, 900 + (1 - tt) * 16);
        c.fillStyle = `rgb(${C.warm})`; c.font = F(600, 32); c.fillText('WHAT IF AT 2:14', W / 2 + 5, 990); c.restore();
      }
      if (!cfg.noCaptions && sh.name !== 'title') captions(c, t);
      return {};
    },
    resize() {},
  };
});
