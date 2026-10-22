import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutCubic, lerp, rng} from '../kit/util.js';
import TL from './timeline.json';
import LINES from './lines.json';

// "What If At 2:14" — Do Not Look Up, part 1, drawn in 2D: black silhouettes with rim light,
// layered fog and light shafts, a cold night sky and one accent colour per beat.

const W = 1080, H = 1920, FPS = 30;
const DEFAULTS = {duration: TL.duration, fps: FPS, theme: 'dark', hud: {enabled: false, title: 'lookup2d', subtitle: ''}, director: {enabled: false}, watermark: '', seed: 7};
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
const KEY = new Set(['phone', 'earth', 'message', 'billion', 'look', 'up', 'neighbor', 'quiet', 'white', 'light', 'looked', 'sky', 'eyes', 'toward', 'buzzes']);
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
  c.letterSpacing = '0px'; c.fillStyle = C.text; c.font = F(800, 72); const ct = t < 30 ? '2:14' : t < 44 ? '2:15' : '2:16', tw = c.measureText(ct).width; c.fillText(ct, 70, 288);
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

runSim(DEFAULTS, async ({cfg, canvas}) => {
  await Promise.all([900, 800, 700, 600].map((w) => document.fonts.load(F(w, 40)))).catch(() => {});
  canvas.style.display = 'none';
  const ov = document.createElement('canvas'); ov.id = 'ov'; ov.width = W; ov.height = H; document.getElementById('app').appendChild(ov);
  const c = ov.getContext('2d');
  const bg = off(W, H), bc = bg.getContext('2d');
  const scr = off(SW, SH), sc = scr.getContext('2d');

  // lamps die left -> right during lightsDie; car lights die at the end of it
  const lampOn = (t, i, n) => 1 - p01(t, TL.lightsDie[0] + (i / n) * (TL.lightsDie[1] - TL.lightsDie[0]), TL.lightsDie[0] + (i / n) * (TL.lightsDie[1] - TL.lightsDie[0]) + 0.12);
  const beamA = (t) => ease(p01(t, TL.beamUp[0], TL.beamUp[1]));

  // the street seen from our balcony: neighbour's house, yard, him, lamps, our rail in front
  function balconyView(x, t, zoom, cx, cy) {
    x.save(); x.translate(cx, cy); x.scale(zoom, zoom); x.translate(-cx, -cy);
    skyGrad(x, 0, 900, beamA(t) * 0.35); stars(x, t, 0, 1, 900);
    houses(x, ROWS[0], 980, 0.8, '#090c14', t, TL.glowAt - 3);
    fog(x, 960, 140, 0.35);
    // neighbour's house: big silhouette, porch light, door, two windows
    x.fillStyle = '#05070b'; x.beginPath(); x.moveTo(140, 1260); x.lineTo(140, 760); x.lineTo(540, 560); x.lineTo(940, 760); x.lineTo(940, 1260); x.fill();
    const porch = 1 - p01(t, TL.lightsDie[1] - 0.3, TL.lightsDie[1]);
    glowDot(x, 690, 930, 260, C.sodium, 0.35 * porch); x.fillStyle = `rgba(${C.sodium},${0.9 * porch})`; x.fillRect(680, 915, 16, 20);
    x.fillStyle = '#020305'; x.fillRect(720, 950, 110, 230);
    for (const wx of [250, 430]) { x.fillStyle = `rgba(${C.phone},${0.15 + 0.6 * easeOutCubic(p01(t, TL.glowAt, TL.glowAt + 0.4))})`; x.fillRect(wx, 900, 120, 120); x.fillStyle = '#05070b'; x.fillRect(wx + 57, 900, 6, 120); x.fillRect(wx, 957, 120, 6); }
    // yard, fence
    x.fillStyle = '#04050a'; x.fillRect(0, 1250, W, 400);
    for (let fx = 100; fx < 1000; fx += 26) x.fillRect(fx, 1265, 8, 70); x.fillRect(100, 1280, 900, 7);
    // white light from above on him
    const b = beamA(t) + (t > 16 && t < TL.beamUp[0] ? 0.25 : 0);
    if (b > 0) { shaft(x, 560, -200, 1390, 60, 260, 0.22 * b); glowDot(x, 560, 1390, 260, '234,242,255', 0.35 * b); }
    const turn = ease(p01(t, ...TL.headTurn));
    robeMan(x, 560, 1395, 62, 1 - turn, b > 0.05 ? `rgba(234,242,255,${0.9 * b})` : null, turn);
    // street + lamps
    x.fillStyle = '#020306'; x.fillRect(0, 1400, W, 600);
    const n = 3; [[-20, 1], [1040, -1], [330, 1]].forEach(([lx, side], i) => lamp(x, lx, 1560, 0.95, lampOn(t, i, n), side));
    fog(x, 1420, 110, 0.25);
    x.restore();
  }
  const rail = (x, t) => { x.fillStyle = C.ink; x.fillRect(0, 1640, W, 30); for (let rx = -10; rx < W; rx += 46) x.fillRect(rx, 1660, 12, 300); x.fillRect(0, 1900, W, 40); };

  function scene(x, t, sh) {
    const lt = t - sh.t0, dur = sh.t1 - sh.t0, k = ease(p01(lt, 0, dur));
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    if (sh.name === 'city') {
      // rooftops from above our block; the phone wave runs across the town; a woman with a dog below
      const dy = lerp(-120, 60, k), zoom = lerp(1.0, 1.12, k);
      x.save(); x.translate(W / 2, H / 2); x.scale(zoom, zoom); x.translate(-W / 2, -H / 2);
      skyGrad(x, 0, 820); stars(x, t, -dy * 0.2, 1, 820);
      glowDot(x, W * 0.75, 260, 60, '220,230,255', 0.9); x.fillStyle = '#dfe6f5'; x.beginPath(); x.arc(W * 0.75, 260, 26, 0, 7); x.fill();
      houses(x, ROWS[0], 860 + dy * 0.3, 0.9, '#0a0e18', t, TL.glowAt);
      fog(x, 860 + dy * 0.3, 160, 0.4);
      houses(x, ROWS[1], 1150 + dy * 0.55, 1.15, '#06080f', t, TL.glowAt + 0.1);
      fog(x, 1160 + dy * 0.55, 120, 0.25);
      houses(x, ROWS[2], 1560 + dy * 0.9, 1.5, '#030409', t, TL.glowAt + 0.2);
      x.restore();
      // street strip at the bottom: lamp + the woman and her dog
      x.fillStyle = '#020306'; x.fillRect(0, 1640, W, 400);
      lamp(x, 1010, 1790, 1.15, 1, -1);
      fog(x, 1640, 140, 0.55, '40,70,95');
      womanDog(x, lerp(800, 760, k), 1790, 92, easeOutCubic(p01(t, TL.glowAt, TL.glowAt + 0.3)));
      fog(x, 1660, 80, 0.3);
    } else if (sh.name === 'balcony' || sh.name === 'turn') {
      const z = sh.name === 'turn' ? lerp(1.6, 2.3, k) : lerp(1.0, 1.35, k);
      balconyView(x, t, z, 560, 1250);
      if (sh.name === 'balcony') rail(x, t);
    } else if (sh.name === 'neighbor') {
      // low angle, side: his house wall lit by the porch, sky above, him looking up
      skyGrad(x, 0, 1250, 0.25); stars(x, t, 0, 1, 1250);
      // his house wall behind him, warm from the porch light; the white light already falling from above
      const wg = x.createLinearGradient(0, 1150, 0, H); wg.addColorStop(0, '#2a1d14'); wg.addColorStop(1, '#0b0806'); x.fillStyle = wg; x.fillRect(0, 1150, W, 800);
      x.fillStyle = '#120c08'; x.fillRect(0, 1130, W, 30);
      glowDot(x, 860, 1300, 520, C.sodium, 0.45);
      shaft(x, 430, -100, 1950, 120, 420, 0.12);
      robeMan(x, lerp(430, 410, k), 2040, 165, 1, `rgba(234,242,255,.85)`);
    } else if (sh.name === 'street') {
      // street level: lamps die one by one, the car's lights go out, trees don't move
      const dx = lerp(0, -80, k);
      skyGrad(x, 0, 1000); stars(x, t, 0, 1, 1000);
      houses(x, ROWS[1], 1150, 0.9, '#080b13', t, TL.glowAt - 30, dx * 0.3);
      fog(x, 1130, 160, 0.4);
      x.save(); x.translate(dx, 0);
      for (const tx of [120, 520, 860, 1180]) tree(x, tx, 1330, 1.3, '#040509');
      x.fillStyle = '#030408'; x.fillRect(-200, 1320, W + 400, 700);
      for (let i = 0; i < 9; i++) x.fillStyle = 'rgba(140,130,110,.25)', x.fillRect(i * 160 - 60, 1600 + i * 0, 80, 8);
      const n = 4; [[40, 1], [440, 1], [840, 1], [1240, 1]].forEach(([lx, side], i) => lamp(x, lx, 1520, 1.2, lampOn(t, i, n), side));
      car(x, 760, 1700, 95, 1 - p01(t, TL.lightsDie[1] - 0.6, TL.lightsDie[1] - 0.4));
      x.restore();
      fog(x, 1520, 140, 0.25);
    } else if (sh.name === 'face') {
      // extreme close-up: his profile tipped back, white light pouring from the top of frame
      const b = beamA(t);
      x.fillStyle = '#05060a'; x.fillRect(0, 0, W, H);
      shaft(x, 600, -100, H, 300, 900, 0.18 * b);
      for (let i = 0; i < 70; i++) { const r = rng(i + 1), px = 300 + r() * 600, py = ((r() * H + t * (40 + r() * 60)) % H); x.fillStyle = `rgba(234,242,255,${0.35 * b * r()})`; x.fillRect(px, py, 2, 2); }
      const s = lerp(330, 370, k), hx = 470, hy = 1080;
      for (const [dx, dy, a] of [[-7, -7, 0.35], [-3, -4, 0.95]]) { x.save(); x.translate(dx, dy); x.fillStyle = `rgba(234,242,255,${a * b})`; headProfile(x, hx, hy, s, 0.7); x.fill(); x.restore(); }
      x.fillStyle = C.ink; headProfile(x, hx, hy, s, 0.7); x.fill();
      // robe collar and shoulder below the head
      x.fillStyle = C.ink; x.beginPath(); x.moveTo(hx - 1.4 * s, H); x.quadraticCurveTo(hx - 1.2 * s, hy + 1.6 * s, hx - 0.1 * s, hy + 1.45 * s); x.quadraticCurveTo(hx + 1.0 * s, hy + 1.5 * s, hx + 1.6 * s, H); x.fill();
      
    } else if (sh.name === 'eyes') {
      x.fillStyle = '#05060a'; x.fillRect(0, 0, W, H);
      shaft(x, W / 2, -100, H, 400, 1100, 0.12);
      frontBust(x, W / 2, lerp(900, 860, k), lerp(230, 270, k), easeOutCubic(p01(t, TL.eyesOn - 0.3, TL.eyesOn + 0.4)), 0.8);
    } else if (sh.name === 'sky' || sh.name === 'title') {
      const tilt = ease(p01(t, SHOTS.find((s2) => s2.name === 'sky').t0, TL.shipReveal[1]));
      skyGrad(x, 0, H, 0.15); stars(x, t, lerp(-600, 300, tilt), 1, H);
      const sr = ease(p01(t, ...TL.shipReveal));
      ship(x, W / 2, lerp(-500, 650, tilt), 180, sr, t);
      shaft(x, W / 2, lerp(-400, 760, tilt), H + 200, 160, 900, 0.2 * sr);
      x.fillStyle = C.ink; x.fillRect(0, lerp(1500, 2400, tilt), W, 600);
    }
  }

  return {
    render(t) {
      const sh = shotAt(t);
      if (['phone', 'msg', 'phone2'].includes(sh.name)) {
        // the phone in your hand over the blurred street
        bc.clearRect(0, 0, W, H); balconyView(bc, t, 1.15, 560, 1250);
        c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.save(); c.filter = 'blur(14px) brightness(.7)'; c.drawImage(bg, 0, 0); c.restore();
        sc.clearRect(0, 0, SW, SH); drawPhone(sc, t, sh.name);
        const lt = t - sh.t0;
        let z = sh.name === 'msg' ? lerp(1.0, 1.55, ease(p01(lt, 0, 2.4))) : sh.name === 'phone2' ? lerp(1.0, 1.4, ease(p01(t, TL.newLineAt - 3, TL.newLineAt - 0.6))) : lerp(0.94, 1.0, ease(p01(lt, 0, 6)));
        const pw = 640 * z, ph = pw * SH / SW, px = W / 2 - pw / 2 + Math.sin(t * 0.8) * 6, py = (sh.name === 'phone' ? 330 : 300) - (z - 1) * 700 + Math.sin(t * 0.6) * 5;
        c.save(); c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowBlur = 60; c.fillStyle = '#111521'; c.beginPath(); c.roundRect(px - 16 * z, py - 16 * z, pw + 32 * z, ph + 32 * z, 90 * z); c.fill(); c.restore();
        c.save(); c.beginPath(); c.roundRect(px, py, pw, ph, 78 * z); c.clip(); c.drawImage(scr, px, py, pw, ph); c.restore();
        glowDot(c, W / 2, py + ph * 0.3, 700, C.phone, 0.12);
        // a thumb on the edge of the phone
        c.fillStyle = C.ink; c.beginPath(); c.ellipse(px + pw + 10 * z, py + ph * 0.62, 70 * z, 150 * z, -0.3, 0, 7); c.fill();
      } else scene(c, t, sh);
      // cut dip + flash on "He looked."
      const since = t - sh.t0; if (sh.i > 0 && since < 0.1) { c.fillStyle = `rgba(0,0,0,${1 - since / 0.1})`; c.fillRect(0, 0, W, H); }
      const fl = Math.max(0, 1 - Math.abs(t - TL.newLineAt) / 0.25); if (fl > 0 && sh.name === 'phone2') { c.fillStyle = `rgba(255,255,255,${fl * 0.2})`; c.fillRect(0, 0, W, H); }
      finish(c, t);
      if (['balcony', 'street', 'turn', 'city'].includes(sh.name)) hud(c, t);
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
