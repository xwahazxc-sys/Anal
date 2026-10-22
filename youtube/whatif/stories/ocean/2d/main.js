import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutCubic, lerp, rng} from '../kit/util.js';
import TL from './timeline.json';
import LINES from './lines.json';

// "What If At 2:14" — Knock at 4,000 Meters, drawn in 2D: black silhouettes with rim light,
// layered fog and light shafts, a cold night sky and one accent colour per beat.

const W = 1080, H = 1920, FPS = 30;
const DEFAULTS = {duration: TL.duration, fps: FPS, theme: 'dark', hud: {enabled: false, title: 'ocean2d', subtitle: ''}, director: {enabled: false}, watermark: '', seed: 7};
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

runSim(DEFAULTS, async ({cfg, canvas}) => {
  await Promise.all([900, 800, 700, 600].map((w) => document.fonts.load(F(w, 40)))).catch(() => {});
  canvas.style.display = 'none';
  const ov = document.createElement('canvas'); ov.id = 'ov'; ov.width = W; ov.height = H; document.getElementById('app').appendChild(ov);
  const c = ov.getContext('2d');

  function scene(x, t, sh) {
    const lt = t - sh.t0, dur = sh.t1 - sh.t0, k = ease(p01(lt, 0, dur));
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    if (sh.name === 'abyss' || sh.name === 'outside' || sh.name === 'end') {
      deep(x, t, sh.name === 'outside' ? 1 : 0.5);
      const s = sh.name === 'abyss' ? lerp(60, 80, k) : sh.name === 'outside' ? lerp(40, 28, k) : lerp(90, 110, k);
      const sx = sh.name === 'end' ? 560 : 560, sy = sh.name === 'outside' ? 900 : 960;
      sub(x, sx, sy, s, sh.name === 'outside' ? 1 : 0.5, t);
      if (sh.name === 'abyss') { const ping = (lt % 3.9) / 3.9; x.strokeStyle = `rgba(150,230,240,${0.4 * (1 - ping)})`; x.lineWidth = 3; x.beginPath(); x.arc(sx, sy, ping * 900, 0, 7); x.stroke(); }
      if (sh.name === 'end') {
        // close on one porthole from outside: warm cabin light, and a pale hand pressed on the glass
        x.fillStyle = '#05080c'; x.fillRect(0, 0, W, H); deep(x, t, 0.3); x.fillStyle = 'rgba(5,8,12,.9)'; x.fillRect(0, 500, W, 1100);
        const pz = lerp(1.0, 1.15, k), pr = 300 * pz, pcx = W / 2, pcy = 920;
        x.fillStyle = '#1b2228'; x.beginPath(); x.arc(pcx, pcy, pr + 40, 0, 7); x.fill();
        for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2; x.fillStyle = '#0c1014'; x.beginPath(); x.arc(pcx + Math.cos(an) * (pr + 20), pcy + Math.sin(an) * (pr + 20), 9, 0, 7); x.fill(); }
        const g = x.createRadialGradient(pcx, pcy, 20, pcx, pcy, pr); g.addColorStop(0, '#f2c27a'); g.addColorStop(1, '#8a5a2a'); x.fillStyle = g; x.beginPath(); x.arc(pcx, pcy, pr, 0, 7); x.fill();
        glowDot(x, pcx, pcy, pr * 2.2, C.warm, 0.3);
        x.fillStyle = C.ink; x.beginPath(); x.ellipse(pcx - 60, pcy + 120, 120, 140, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(pcx - 260, pcy + 400); x.quadraticCurveTo(pcx - 230, pcy + 250, pcx - 60, pcy + 245); x.quadraticCurveTo(pcx + 110, pcy + 250, pcx + 140, pcy + 400); x.fill();
        const a = ease(p01(lt, 0.4, 1.4)), hx = pcx + 90, hy = pcy - 40;
        x.save(); x.beginPath(); x.arc(pcx, pcy, pr, 0, 7); x.clip(); x.globalAlpha = a; x.fillStyle = 'rgba(214,224,232,.95)';
        x.beginPath(); x.ellipse(hx, hy + 60, 70, 85, 0, 0, 7); x.fill();
        for (let f = 0; f < 4; f++) { x.beginPath(); x.ellipse(hx - 55 + f * 37, hy - 50 - (f === 1 || f === 2 ? 25 : 0), 16, 62, -0.15 + f * 0.1, 0, 7); x.fill(); }
        x.beginPath(); x.ellipse(hx + 78, hy + 40, 16, 50, 0.9, 0, 7); x.fill(); x.restore();
      }
      if (false) {
        const a = ease(p01(lt, 0.6, 1.8)), px = sx - 2.4 * s + 2 * 0.75 * s, py = sy - 0.1 * s;
        x.save(); x.globalAlpha = a; x.fillStyle = 'rgba(205,215,225,.9)'; x.beginPath(); x.ellipse(px, py + 0.05 * s, 0.12 * s, 0.14 * s, 0, 0, 7); x.fill();
        for (let f = 0; f < 4; f++) { x.beginPath(); x.ellipse(px - 0.11 * s + f * 0.07 * s, py - 0.16 * s, 0.025 * s, 0.09 * s, -0.2 + f * 0.13, 0, 7); x.fill(); } x.restore();
      }
      x.textAlign = 'left'; x.fillStyle = 'rgba(160,220,235,.75)'; x.font = F(700, 30); x.letterSpacing = '4px'; x.fillText('DEPTH  4,012 m', 70, H - 140); if (sh.name === 'outside') x.fillText('PRESSURE  403 atm', 70, H - 95); x.letterSpacing = '0px';
    } else if (sh.name === 'inside') {
      // the control room: you on watch at the sonar console, green glow; the crew's bunks behind
      x.fillStyle = '#0a0607'; x.fillRect(0, 0, W, H); glowDot(x, W - 150, 160, 220, '255,60,50', 0.4);
      x.fillStyle = '#050304'; for (let i = 0; i < 3; i++) x.fillRect(60, 300 + i * 200, 360, 120);
      x.fillStyle = '#1a0d0d'; for (let i = 0; i < 3; i++) x.fillRect(80, 330 + i * 200, 320, 60);
      x.fillStyle = '#071a10'; x.fillRect(560, 820, 460, 320); glowDot(x, 790, 980, 600, '80,255,150', 0.35);
      x.strokeStyle = 'rgba(80,255,150,.6)'; x.lineWidth = 3; x.beginPath(); x.arc(790, 980, 120, 0, 7); x.stroke(); x.beginPath(); x.moveTo(790, 980); x.lineTo(790 + Math.cos(t * 2.2) * 120, 980 + Math.sin(t * 2.2) * 120); x.stroke();
      x.fillStyle = C.ink; x.beginPath(); x.ellipse(430, 1150, 150, 175, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(60, H); x.quadraticCurveTo(90, 1330, 430, 1310); x.quadraticCurveTo(770, 1330, 800, H); x.fill();
      x.fillStyle = '#060404'; x.fillRect(0, 1600, W, 320);
    } else if (sh.name === 'hull') { hullWall(x, t, TL.knocks); }
    else if (sh.name === 'hull2') {
      hullWall(x, t, TL.knocks2.concat([TL.morseLong]));
      // the rhythm, as it comes: dot dot dash
      const marks = [[TL.knocks2[2], '·'], [TL.knocks2[3], '·'], [TL.morseLong, '—']];
      x.textAlign = 'center'; x.fillStyle = 'rgba(255,230,210,.95)'; x.font = F(900, 200);
      marks.forEach(([at, m], i) => { const a = easeOutCubic(p01(t, at - 0.05, at + 0.2)); if (a > 0) { x.globalAlpha = a; x.fillText(m, W / 2 - 200 + i * 200, 820); } }); x.globalAlpha = 1;
    } else if (sh.name === 'sonar') { sonarScreen(x, t, 0); }
    else if (sh.name === 'paper') { paper(x, t, sh.t0); }
    else if (sh.name === 'title') { deep(x, t, 0.4); sub(x, 560, 960, 110, 0.4, t); }
  }

  return {
    render(t) {
      const sh = shotAt(t);
      scene(c, t, sh);
      const since = t - sh.t0; if (sh.i > 0 && since < 0.1) { c.fillStyle = `rgba(0,0,0,${1 - since / 0.1})`; c.fillRect(0, 0, W, H); }
      finish(c, t);
      if (['inside', 'hull', 'sonar'].includes(sh.name)) hud(c, t);
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
