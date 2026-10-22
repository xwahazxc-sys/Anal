import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutCubic, lerp, rng} from '../kit/util.js';
import TL from './timeline.json';
import LINES from './lines.json';

// "What If At 2:14" — Do Not Look Up, part 2, drawn in 2D: black silhouettes with rim light,
// layered fog and light shafts, a cold night sky and one accent colour per beat.

const W = 1080, H = 1920, FPS = 30;
const DEFAULTS = {duration: TL.duration, fps: FPS, theme: 'dark', hud: {enabled: false, title: 'lookup2d2', subtitle: ''}, director: {enabled: false}, watermark: '', seed: 7};
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
  c.fillStyle = C.text; c.font = F(700, 190); c.fillText('2:31', SW / 2, 420);
  const k = easeOutCubic(p01(t, TL.notifAt, TL.notifAt + 0.5));
  const card = (y, body, col, kk) => {
    c.save(); c.globalAlpha = kk; c.translate(0, (1 - kk) * 40);
    c.fillStyle = 'rgba(28,32,48,.94)'; c.beginPath(); c.roundRect(36, y, SW - 72, 230, 40); c.fill();
    c.fillStyle = '#0a0b10'; c.beginPath(); c.roundRect(66, y + 34, 72, 72, 18); c.fill();
    c.strokeStyle = 'rgba(233,236,244,.5)'; c.lineWidth = 3; c.beginPath(); c.arc(102, y + 70, 18, 0, 7); c.stroke();
    c.textAlign = 'left'; c.fillStyle = C.dim; c.font = F(600, 26); c.fillText('NO CALLER ID', 162, y + 62); c.textAlign = 'right'; c.fillText('now', SW - 70, y + 62);
    c.textAlign = 'left'; c.fillStyle = col; let fs = 56; c.font = F(800, fs); while (c.measureText(body).width > SW - 230 && fs > 30) { fs -= 2; c.font = F(800, fs); } c.fillText(body, 162, y + 150);
    c.restore();
  };
  const k2 = easeOutCubic(p01(t, TL.notifAt, TL.notifAt + 0.45));
  card(560 + 250 * k2, 'Do not look up.', C.text, 1);
  if (k2 > 0) card(560, 'Good. Now look down.', C.red, k2);
}

// ---------- captions + HUD ----------
const KEY = new Set(['looked', 'neighbor', 'sky', 'eyes', 'lock', 'blind', 'news', 'shut', 'million', 'walking', 'didn', 'down', 'light', 'door', 'white', 'feet', 'ground', 'open']);
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
  c.letterSpacing = '0px'; c.fillStyle = C.text; c.font = F(800, 72); const ct = t < 20 ? '2:29' : '2:31', tw = c.measureText(ct).width; c.fillText(ct, 70, 288);
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

// the neighbour walking straight at you: front view, robe, mug gone, eyes on the sky
function robeManFront(c, x, y, s, step, eyes, rimA) {
  const sw = Math.sin(step) * 0.08 * s, bob = Math.abs(Math.sin(step)) * 0.05 * s;
  const fig = () => {
    c.beginPath();
    c.moveTo(x - 0.45 * s, y - 3.25 * s - bob); c.quadraticCurveTo(x, y - 3.5 * s - bob, x + 0.45 * s, y - 3.25 * s - bob);
    c.lineTo(x + 0.55 * s, y - 2.0 * s - bob); c.lineTo(x + 0.62 * s, y - 0.65 * s); c.lineTo(x - 0.62 * s, y - 0.65 * s); c.lineTo(x - 0.55 * s, y - 2.0 * s - bob); c.closePath();
    // legs and slippers
    c.rect(x - 0.24 * s + sw, y - 0.7 * s, 0.14 * s, 0.62 * s); c.rect(x + 0.1 * s - sw, y - 0.7 * s, 0.14 * s, 0.62 * s);
    c.ellipse(x - 0.17 * s + sw, y - 0.05 * s, 0.13 * s, 0.07 * s, 0, 0, 7); c.moveTo(x + 0.3 * s - sw, y); c.ellipse(x + 0.17 * s - sw, y - 0.05 * s, 0.13 * s, 0.07 * s, 0, 0, 7);
    // arms hanging
    c.moveTo(x - 0.5 * s, y - 3.1 * s - bob); c.lineTo(x - 0.72 * s, y - 1.6 * s); c.lineTo(x - 0.58 * s, y - 1.55 * s); c.lineTo(x - 0.42 * s, y - 2.8 * s); c.closePath();
    c.moveTo(x + 0.5 * s, y - 3.1 * s - bob); c.lineTo(x + 0.72 * s, y - 1.6 * s); c.lineTo(x + 0.58 * s, y - 1.55 * s); c.lineTo(x + 0.42 * s, y - 2.8 * s); c.closePath();
    // neck + head
    c.rect(x - 0.1 * s, y - 3.65 * s - bob, 0.2 * s, 0.25 * s);
    c.moveTo(x + 0.3 * s, y - 3.95 * s - bob); c.ellipse(x, y - 3.95 * s - bob, 0.3 * s, 0.37 * s, 0, 0, 7);
  };
  if (rimA > 0) { c.save(); c.translate(0, -4); c.fillStyle = `rgba(234,242,255,${rimA})`; fig(); c.fill(); c.restore(); }
  c.fillStyle = C.ink; fig(); c.fill();
  c.strokeStyle = 'rgba(150,60,70,.45)'; c.lineWidth = 0.05 * s; c.beginPath(); c.moveTo(x - 0.3 * s, y - 3.3 * s - bob); c.lineTo(x, y - 2.5 * s - bob); c.lineTo(x + 0.3 * s, y - 3.3 * s - bob); c.stroke();
  c.strokeStyle = 'rgba(170,180,200,.6)'; c.lineWidth = 0.025 * s; const hy = y - 3.98 * s - bob;
  for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(x + sx * 0.12 * s, hy, 0.09 * s, 0.07 * s, 0, 0, 7); c.stroke(); }
  for (const sx of [-1, 1]) { glowDot(c, x + sx * 0.12 * s, hy - 0.03 * s, 0.3 * s, '234,242,255', 0.6 * eyes); c.fillStyle = `rgba(245,248,255,${eyes})`; c.beginPath(); c.ellipse(x + sx * 0.12 * s, hy - 0.03 * s, 0.05 * s, 0.022 * s, 0, Math.PI, 0); c.fill(); }
}
// a small walking silhouette for the news footage
function walker(c, x, y, s, step, eyes) {
  const sw = Math.sin(step) * 0.12 * s;
  c.fillStyle = C.ink; c.beginPath(); c.ellipse(x, y - 1.75 * s, 0.13 * s, 0.16 * s, 0, 0, 7); c.fill();
  c.fillRect(x - 0.17 * s, y - 1.55 * s, 0.34 * s, 0.75 * s); c.fillRect(x - 0.13 * s + sw, y - 0.85 * s, 0.1 * s, 0.85 * s); c.fillRect(x + 0.03 * s - sw, y - 0.85 * s, 0.1 * s, 0.85 * s);
  if (eyes) for (const sx of [-1, 1]) { c.fillStyle = 'rgba(240,246,255,.95)'; c.fillRect(x + sx * 0.05 * s - 0.02 * s, y - 1.82 * s, 0.04 * s, 0.015 * s); }
}

runSim(DEFAULTS, async ({cfg, canvas}) => {
  await Promise.all([900, 800, 700, 600].map((w) => document.fonts.load(F(w, 40)))).catch(() => {});
  canvas.style.display = 'none';
  const ov = document.createElement('canvas'); ov.id = 'ov'; ov.width = W; ov.height = H; document.getElementById('app').appendChild(ov);
  const c = ov.getContext('2d');
  const bg = off(W, H), bc = bg.getContext('2d');
  const scr = off(SW, SH), sc = scr.getContext('2d');
  const crowdR = rng(42), CROWD = Array.from({length: 90}, () => ({x: crowdR(), d: crowdR(), ph: crowdR() * 6}));

  // the street from the balcony, lamps dead, the neighbour crossing toward you
  function crossView(x, t, k) {
    skyGrad(x, 0, 900, 0.35); stars(x, t, 0, 1, 900);
    houses(x, ROWS[0], 980, 0.8, '#090c14', t, -10);
    fog(x, 960, 140, 0.35);
    x.fillStyle = '#05070b'; x.beginPath(); x.moveTo(140, 1260); x.lineTo(140, 760); x.lineTo(540, 560); x.lineTo(940, 760); x.lineTo(940, 1260); x.fill();
    for (const wx of [250, 430]) { x.fillStyle = `rgba(${C.phone},.6)`; x.fillRect(wx, 900, 120, 120); x.fillStyle = '#05070b'; x.fillRect(wx + 57, 900, 6, 120); x.fillRect(wx, 957, 120, 6); }
    x.fillStyle = '#04050a'; x.fillRect(0, 1250, W, 800);
    for (let fx = 100; fx < 1000; fx += 26) if (fx < 500 || fx > 640) x.fillRect(fx, 1265, 8, 70); x.fillRect(100, 1280, 400, 7); x.fillRect(640, 1280, 360, 7);
    x.fillStyle = '#020306'; x.fillRect(0, 1420, W, 600);
    for (const [lx, side] of [[-20, 1], [1040, -1], [330, 1]]) lamp(x, lx, 1560, 0.95, 0, side);
    // he walks: yard -> gate -> across the street, getting bigger
    const w = ease(p01(t, TL.crossStart, TL.crossStart + 4.2));
    const fy = lerp(1395, 1700, w), fs = lerp(62, 105, w), fx = lerp(560, 540, w);
    shaft(x, fx, -200, fy, 60, 240, 0.22); glowDot(x, fx, fy, 260, '234,242,255', 0.3);
    robeManFront(x, fx, fy, fs, t * 3.2 * (w > 0 && w < 1 ? 1 : 0), 1, 0.85);
    fog(x, 1440, 110, 0.25);
  }
  const rail = (x) => { x.fillStyle = C.ink; x.fillRect(0, 1640, W, 30); for (let rx = -10; rx < W; rx += 46) x.fillRect(rx, 1660, 12, 300); x.fillRect(0, 1900, W, 40); };

  function scene(x, t, sh) {
    const lt = t - sh.t0, dur = sh.t1 - sh.t0, k = ease(p01(lt, 0, dur));
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    if (sh.name === 'cross') {
      x.save(); const z = lerp(1.0, 1.25, k); x.translate(540, 1500); x.scale(z, z); x.translate(-540, -1500); crossView(x, t, k); x.restore(); rail(x);
    } else if (sh.name === 'inside') {
      // your room: the window with white light outside, the blinds dropping; the door chain/lock in front
      x.fillStyle = '#06070b'; x.fillRect(0, 0, W, H);
      const wx = 170, wy = 380, ww = 740, wh = 900;
      const g = x.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#e8efff'); g.addColorStop(1, '#8fa3c9'); x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
      // the neighbour's silhouette out there, small, standing under your window
      robeManFront(x, 560, wy + wh - 40, 60, 0, 1, 0);
      x.fillStyle = '#06070b'; x.fillRect(wx + ww / 2 - 8, wy, 16, wh); x.fillRect(wx, wy + wh / 2 - 8, ww, 16);
      const bl = ease(p01(t, ...TL.blinds));
      for (let i = 0; i < 26; i++) { const sy = wy + i * (wh / 26) * bl; x.fillStyle = '#14161d'; x.fillRect(wx - 20, sy, ww + 40, (wh / 26) * 0.8 * bl + 2); }
      x.fillStyle = '#14161d'; x.fillRect(wx - 30, wy - 30, ww + 60, 34);
      // light through the slats onto the floor
      if (bl < 1) shaft(x, 540, wy + wh, H, ww, ww * 1.6, 0.12 * (1 - bl));
      // hand turning the lock (bottom), the bolt slides at TL.lock
      x.fillStyle = '#0c0d12'; x.fillRect(0, 1500, W, 420);
      // you, from behind, at the window, pulling the cord
      x.fillStyle = C.ink; x.beginPath(); x.ellipse(330, 1420, 120, 145, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(40, H); x.quadraticCurveTo(70, 1560, 330, 1550); x.quadraticCurveTo(590, 1560, 620, H); x.fill();
      x.beginPath(); x.moveTo(520, 1600); x.lineTo(870, lerp(1150, 1300, bl)); x.lineTo(900, lerp(1180, 1330, bl)); x.lineTo(560, 1660); x.fill();
      x.strokeStyle = '#1d2029'; x.lineWidth = 4; x.beginPath(); x.moveTo(890, wy - 10); x.lineTo(890, lerp(1170, 1320, bl)); x.stroke();
    } else if (sh.name === 'tv' || sh.name === 'crowd') {
      // a dark living room, the TV is the only light; the anchor reads with her eyes shut, then the footage
      x.fillStyle = '#05060a'; x.fillRect(0, 0, W, H);
      const tx = 90, ty = 520, tw = 900, th = 520;
      glowDot(x, 540, 780, 900, '160,190,240', 0.18);
      x.fillStyle = '#0d1018'; x.fillRect(tx - 18, ty - 18, tw + 36, th + 36);
      x.save(); x.beginPath(); x.rect(tx, ty, tw, th); x.clip();
      if (sh.name === 'tv') {
        const g = x.createLinearGradient(0, ty, 0, ty + th); g.addColorStop(0, '#1b2b4f'); g.addColorStop(1, '#0c1428'); x.fillStyle = g; x.fillRect(tx, ty, tw, th);
        const z = lerp(1, 1.08, k), ax = 540, ay = ty + th + 20;
        x.fillStyle = '#0a0b10'; x.beginPath(); x.ellipse(ax, ay - 300 * z, 70 * z, 88 * z, 0, 0, 7); x.fill();
        x.beginPath(); x.moveTo(ax - 230 * z, ay); x.quadraticCurveTo(ax - 210 * z, ay - 190 * z, ax - 40 * z, ay - 205 * z); x.lineTo(ax + 40 * z, ay - 205 * z); x.quadraticCurveTo(ax + 210 * z, ay - 190 * z, ax + 230 * z, ay); x.fill();
        x.beginPath(); x.moveTo(ax - 75 * z, ay - 300 * z); x.quadraticCurveTo(ax - 95 * z, ay - 180 * z, ax - 120 * z, ay - 140 * z); x.lineTo(ax + 120 * z, ay - 140 * z); x.quadraticCurveTo(ax + 95 * z, ay - 180 * z, ax + 75 * z, ay - 300 * z); x.fill();   // hair
        // shut eyes: two thin curved lines that catch the studio light
        x.strokeStyle = 'rgba(200,215,240,.75)'; x.lineWidth = 4; for (const sx of [-1, 1]) { x.beginPath(); x.arc(ax + sx * 26 * z, ay - 305 * z, 14 * z, 0.2, Math.PI - 0.2); x.stroke(); }
        x.fillStyle = '#c62e33'; x.fillRect(tx, ty + th - 86, tw, 50); x.fillStyle = '#fff'; x.font = F(800, 30); x.textAlign = 'left'; x.fillText('BREAKING', tx + 24, ty + th - 50);
        x.fillStyle = '#0d0f16'; x.fillRect(tx, ty + th - 36, tw, 36); x.fillStyle = '#e8ecf6'; x.font = F(700, 24); x.fillText('"DO NOT LOOK UP" MESSAGE RECEIVED WORLDWIDE', tx + 24, ty + th - 10);
      } else {
        // footage: thousands of people walking in one direction at night, eyes glowing
        const g = x.createLinearGradient(0, ty, 0, ty + th); g.addColorStop(0, '#24324f'); g.addColorStop(0.55, '#0f1626'); g.addColorStop(1, '#090c14'); x.fillStyle = g; x.fillRect(tx, ty, tw, th);
        houses(x, ROWS[1], ty + 300, 0.55, '#0a0d16', 0, -99);
        for (const p of CROWD) { const depth = 0.4 + p.d * 1.1, py = ty + 260 + p.d * 160, px = tx + ((p.x * tw * 1.3 + lt * 22 * depth) % (tw * 1.3)) - 60; walker(x, px, py, 70 * depth, t * 5 + p.ph, true); }
        const lt2 = t > 21.4 ? ease(p01(t, 21.4, 22.2)) : 0;
        if (lt2 > 0) { x.fillStyle = `rgba(234,242,255,${0.35 * lt2})`; x.fillRect(tx + tw - 160, ty + 120, 120, 180); }
        x.fillStyle = '#c62e33'; x.fillRect(tx, ty + th - 86, tw, 50); x.fillStyle = '#fff'; x.font = F(800, 30); x.textAlign = 'left'; x.fillText('LIVE', tx + 24, ty + th - 50);
        x.fillStyle = '#0d0f16'; x.fillRect(tx, ty + th - 36, tw, 36); x.fillStyle = '#e8ecf6'; x.font = F(700, 24); x.fillText('400 MILLION WHO "LOOKED UP" ARE WALKING', tx + 24, ty + th - 10);
      }
      // scanlines
      x.fillStyle = 'rgba(0,0,0,.18)'; for (let yy = ty; yy < ty + th; yy += 4) x.fillRect(tx, yy, tw, 2);
      x.restore();
      // the back of your head and shoulders in front of the TV
      x.fillStyle = C.ink; x.beginPath(); x.ellipse(300, 1560, 150, 175, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(-40, H); x.quadraticCurveTo(0, 1700, 300, 1690); x.quadraticCurveTo(600, 1700, 640, H); x.fill();
    } else if (sh.name === 'floor' || sh.name === 'feet') {
      // the bottom of your front door from the floor: a line of white light under it, spreading on the boards
      x.fillStyle = '#05060a'; x.fillRect(0, 0, W, H);
      const z = sh.name === 'feet' ? lerp(1.5, 1.9, k) : lerp(1.0, 1.25, k);
      x.save(); x.translate(540, 1150); x.scale(z, z); x.translate(-540, -1150);
      x.fillStyle = '#0c0e14'; x.fillRect(140, 300, 800, 850);                               // door
      x.fillStyle = '#090a10'; x.fillRect(120, 280, 840, 20); x.fillRect(120, 280, 20, 870); x.fillRect(940, 280, 20, 870);
      x.fillStyle = '#5c616e'; x.beginPath(); x.arc(860, 760, 18, 0, 7); x.fill();
      const lightA = 0.6 + 0.4 * Math.sin(t * 2.3) * 0.15;
      x.save(); x.globalCompositeOperation = 'lighter';
      const g = x.createLinearGradient(0, 1150, 0, 1600); g.addColorStop(0, `rgba(234,242,255,${0.55 * lightA})`); g.addColorStop(1, 'rgba(234,242,255,0)');
      x.fillStyle = g; x.beginPath(); x.moveTo(140, 1150); x.lineTo(940, 1150); x.lineTo(1200, 1650); x.lineTo(-120, 1650); x.fill();
      x.fillStyle = `rgba(245,248,255,${lightA})`; x.fillRect(140, 1140, 800, 12);
      x.restore();
      // floor boards
      x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 3; for (let i = 0; i < 10; i++) { x.beginPath(); x.moveTo(540 + (i - 4.5) * 90, 1152); x.lineTo(540 + (i - 4.5) * 260, 2000); x.stroke(); }
      // two feet outside, hovering: their shadows break the light strip but light shows beneath them
      const f = ease(p01(t, ...TL.feetIn));
      if (f > 0) for (const fx of [430, 610]) {
        x.fillStyle = `rgba(3,4,7,${f})`; x.fillRect(fx, 1140, 90, 6);
        x.beginPath(); x.moveTo(fx, 1150); x.lineTo(fx + 90, 1150); x.lineTo(fx + 90 + 70, 1600); x.lineTo(fx - 40, 1600); x.closePath();
        const sg = x.createLinearGradient(0, 1150, 0, 1600); sg.addColorStop(0, `rgba(3,4,7,${0.85 * f})`); sg.addColorStop(1, 'rgba(3,4,7,0)'); x.fillStyle = sg; x.fill();
      }
      if (f > 0) { x.fillStyle = `rgba(245,248,255,${lightA})`; x.fillRect(430, 1146, 90, 6); x.fillRect(610, 1146, 90, 6); }   // the light still runs under them: they're not standing
      x.restore();
    } else if (sh.name === 'door' || sh.name === 'title') {
      // you, from behind, facing the door; the white light around its edges
      x.fillStyle = '#05060a'; x.fillRect(0, 0, W, H);
      x.save(); x.globalCompositeOperation = 'lighter';
      x.fillStyle = 'rgba(234,242,255,.8)'; x.fillRect(250, 1500, 580, 8); x.fillRect(250, 400, 4, 1100); x.fillRect(826, 400, 4, 1100); x.fillRect(250, 400, 580, 4);
      glowDot(x, 540, 1504, 500, '234,242,255', 0.35); x.fillStyle = 'rgba(234,242,255,.9)'; x.beginPath(); x.arc(760, 980, 6, 0, 7); x.fill(); glowDot(x, 760, 980, 60, '234,242,255', 0.5);
      x.restore();
      x.fillStyle = '#090a10'; x.fillRect(254, 404, 572, 1096);
      const z = lerp(1.0, 1.08, k);
      x.fillStyle = C.ink; x.beginPath(); x.ellipse(540, 1330 / z + 200, 150 * z, 180 * z, 0, 0, 7); x.fill();
      x.beginPath(); x.moveTo(140, H); x.quadraticCurveTo(170, 1560, 540, 1540); x.quadraticCurveTo(910, 1560, 940, H); x.fill();
    }
  }

  return {
    render(t) {
      const sh = shotAt(t);
      if (sh.name === 'phone') {
        bc.clearRect(0, 0, W, H); scene(bc, 5, SHOTS[0]);
        c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.save(); c.filter = 'blur(14px) brightness(.6)'; c.drawImage(bg, 0, 0); c.restore();
        sc.clearRect(0, 0, SW, SH); drawPhone(sc, t, 'phone');
        const z = lerp(1.0, 1.4, ease(p01(t, TL.notifAt + 0.6, TL.notifAt + 2.6)));
        const pw = 640 * z, ph = pw * SH / SW, px = W / 2 - pw / 2 + Math.sin(t * 0.8) * 6, py = 300 - (z - 1) * 700 + Math.sin(t * 0.6) * 5;
        c.save(); c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowBlur = 60; c.fillStyle = '#111521'; c.beginPath(); c.roundRect(px - 16 * z, py - 16 * z, pw + 32 * z, ph + 32 * z, 90 * z); c.fill(); c.restore();
        c.save(); c.beginPath(); c.roundRect(px, py, pw, ph, 78 * z); c.clip(); c.drawImage(scr, px, py, pw, ph); c.restore();
        glowDot(c, W / 2, py + ph * 0.3, 700, C.phone, 0.12);
        c.fillStyle = C.ink; c.beginPath(); c.ellipse(px + pw + 10 * z, py + ph * 0.62, 70 * z, 150 * z, -0.3, 0, 7); c.fill();
      } else scene(c, t, sh);
      const since = t - sh.t0; if (sh.i > 0 && since < 0.1) { c.fillStyle = `rgba(0,0,0,${1 - since / 0.1})`; c.fillRect(0, 0, W, H); }
      finish(c, t);
      if (['cross', 'inside'].includes(sh.name)) hud(c, t);
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
