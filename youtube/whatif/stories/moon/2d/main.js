import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutCubic, lerp, rng} from '../kit/util.js';
import TL from './timeline.json';
import LINES from './lines.json';

// "What If At 2:14" — The Moon Stopped Moving. 2D silhouettes, 30-40 s, the last shot loops into the first.

const W = 1080, H = 1920, FPS = 30;
const DEFAULTS = {duration: TL.duration, fps: FPS, theme: 'dark', hud: {enabled: false, title: 'moon2d', subtitle: ''}, director: {enabled: false}, watermark: '', seed: 7};
const C = {ink: '#030407', sky0: '#03050c', sky1: '#0b1630', haze: '#1d3d55', sodium: '255,170,90', phone: '125,175,255', red: '#e0484f', warm: '255,201,74', text: '#F3F4F8', dim: '#7C859C'};
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
function car(c, x, y, s, lights) {
  c.fillStyle = C.ink; c.beginPath(); c.moveTo(x - 2.2 * s, y - 0.35 * s); c.lineTo(x - 2.2 * s, y - 0.9 * s); c.lineTo(x - 1.2 * s, y - 1.0 * s); c.lineTo(x - 0.7 * s, y - 1.55 * s); c.lineTo(x + 0.9 * s, y - 1.55 * s); c.lineTo(x + 1.5 * s, y - 1.0 * s); c.lineTo(x + 2.2 * s, y - 0.9 * s); c.lineTo(x + 2.2 * s, y - 0.35 * s); c.closePath(); c.fill();
  for (const wx of [-1.4, 1.4]) { c.beginPath(); c.arc(x + wx * s, y - 0.35 * s, 0.38 * s, 0, 7); c.fill(); }
  if (lights > 0) { glowDot(c, x - 2.15 * s, y - 0.75 * s, 0.9 * s, '255,244,220', lights); shaft(c, x - 2.2 * s, y - 0.75 * s, y + 0.3 * s, 0.2 * s, 0.2 * s, 0, '255,244,220'); c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(x - 2.2 * s, 0, x - 9 * s, 0); g.addColorStop(0, `rgba(255,244,220,${0.25 * lights})`); g.addColorStop(1, 'rgba(255,244,220,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x - 2.2 * s, y - 0.85 * s); c.lineTo(x - 9 * s, y - 1.6 * s); c.lineTo(x - 9 * s, y + 0.4 * s); c.lineTo(x - 2.2 * s, y - 0.55 * s); c.fill(); c.restore(); glowDot(c, x + 2.15 * s, y - 0.8 * s, 0.4 * s, '224,72,79', lights); }
}

// ---------- the Moon ----------
const CRATERS = (() => { const r = rng(31); return Array.from({length: 14}, () => [r() * 1.5 - 0.75, r() * 1.5 - 0.75, 0.06 + r() * 0.12]).filter(([x, y]) => x * x + y * y < 0.55); })();
// eyes: the two biggest craters near the middle open like eyelids
const EYES = [[-0.28, -0.08, 0.14], [0.28, -0.08, 0.14]];
function moon(c, cx, cy, R, open = 0, t = 0) {
  glowDot(c, cx, cy, R * 2.6, '234,236,225', 0.35);
  const g = c.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R); g.addColorStop(0, '#f2efe2'); g.addColorStop(1, '#a9a596');
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
  for (const [x, y, s] of CRATERS) { c.fillStyle = 'rgba(110,105,95,.45)'; c.beginPath(); c.arc(cx + x * R, cy + y * R, s * R, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,245,.25)'; c.beginPath(); c.arc(cx + x * R - s * R * 0.2, cy + y * R - s * R * 0.2, s * R * 0.7, Math.PI, Math.PI * 1.5); c.fill(); }
  for (const [x, y, s] of EYES) {
    const ex = cx + x * R, ey = cy + y * R, rw = s * R * 1.35, rh = s * R * 0.62;
    c.fillStyle = 'rgba(95,90,80,.6)'; c.beginPath(); c.ellipse(ex, ey, rw, rh, 0, 0, 7); c.fill();
    if (open > 0) {
      // a slow blink every ~2.4 s once the eyes are open
      const blink = Math.pow(Math.abs(Math.sin(t * 1.3)), 0.15);
      const h = rh * open * blink;
      c.save(); c.beginPath(); c.ellipse(ex, ey, rw, Math.max(0.5, h), 0, 0, 7); c.clip();
      c.fillStyle = '#1a1206'; c.fillRect(ex - rw, ey - rh, rw * 2, rh * 2);
      const ig = c.createRadialGradient(ex, ey, 0, ex, ey, rh * 0.95); ig.addColorStop(0, '#ffe27a'); ig.addColorStop(0.7, '#c98a12'); ig.addColorStop(1, '#3a2205');
      c.fillStyle = ig; c.beginPath(); c.arc(ex, ey, rh * 0.95, 0, 7); c.fill();
      c.fillStyle = '#000'; c.beginPath(); c.ellipse(ex, ey, rh * 0.12, rh * 0.8, 0, 0, 7); c.fill();
      glowDot(c, ex, ey, rw * 1.8, '255,200,80', 0.35 * open);
      c.restore();
    }
  }
}
function nightSky(c, t, glow = 0) { skyGrad(c, 900, 1500, glow); stars(c, t, 0, 0.8, 1300); }
// the scariest frame: your street from below, the Moon huge and low right above your roof, eyes open
function over(c, t, z, open = 1) {
  nightSky(c, t, 0.5);
  c.save(); c.translate(W / 2, H * 0.55); c.scale(z, z); c.translate(-W / 2, -H * 0.55);
  moon(c, W / 2, 760, 560, open, t);
  houses(c, ROWS[1], 1760, 1.15, '#040509', t, 999);
  // your house: one lit window, right under the Moon
  c.fillStyle = '#020306'; c.beginPath(); c.moveTo(W / 2 - 240, 1820); c.lineTo(W / 2 - 240, 1460); c.lineTo(W / 2, 1280); c.lineTo(W / 2 + 240, 1460); c.lineTo(W / 2 + 240, 1820); c.fill();
  c.fillStyle = `rgba(${C.sodium},.9)`; c.fillRect(W / 2 - 50, 1530, 100, 120); glowDot(c, W / 2, 1590, 200, C.sodium, 0.3);
  c.fillStyle = '#020306'; c.fillRect(0, 1820, W, H);
  c.restore();
}
function news(c, t, lt) {
  c.fillStyle = '#05070c'; c.fillRect(0, 0, W, H);
  // a TV in a dark room: the lunar distance chart going down
  c.fillStyle = '#0d1018'; c.fillRect(70, 360, W - 140, 760); c.fillStyle = '#0a1f3a'; c.fillRect(100, 390, W - 200, 700);
  glowDot(c, W / 2, 740, 900, '90,140,220', 0.25);
  c.textAlign = 'left'; c.fillStyle = '#e0484f'; c.fillRect(100, 390, 240, 70); c.fillStyle = '#fff'; c.font = F(900, 40); c.fillText('LIVE', 130, 440);
  c.fillStyle = '#fff'; c.font = F(800, 46); c.fillText('MOON DISTANCE', 140, 540);
  const pts = 7; c.strokeStyle = `rgb(${C.warm})`; c.lineWidth = 8; c.beginPath();
  for (let i = 0; i < pts; i++) { const x = 160 + i * 115, y = 640 + i * i * 7 + i * 20; i ? c.lineTo(x, y) : c.moveTo(x, y); c.fillStyle = `rgb(${C.warm})`; c.fillRect(x - 8, y - 8, 16, 16); }
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,.75)'; c.font = F(700, 34); c.fillText('−1% EVERY NIGHT', 140, 1010);
  // ticker
  c.fillStyle = '#e0484f'; c.fillRect(100, 1050, W - 200, 40); c.fillStyle = '#fff'; c.font = F(800, 26); c.fillText('COASTAL TOWNS ORDERED TO EVACUATE  ·  TIDES AT RECORD HEIGHT  ·  ', 120 - (lt * 120) % 600, 1080);
  c.fillStyle = '#05070c'; c.fillRect(0, 1050, 100, 40); c.fillRect(W - 100, 1050, 100, 40);
  // silhouettes on the couch
  c.fillStyle = C.ink; for (const x of [330, 560, 770]) { c.beginPath(); c.ellipse(x, 1380, 85, 105, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(x, 1600, 150, 160, 0, Math.PI, 0); c.fill(); }
  c.fillRect(0, 1600, W, H);
}
function flood(c, t, lt, k) {
  nightSky(c, t, 0.35);
  moon(c, W * 0.7, 360, 200, 0, t);
  houses(c, ROWS[2], 1250, 1.0, '#05060a', t, 999);
  lamp(c, 160, 1300, 1.2, 1, 1); lamp(c, W - 140, 1300, 1.2, 1, -1);
  // water rising up the street
  const wl = lerp(1500, 1180, ease(p01(lt, 0, 3)));
  const g = c.createLinearGradient(0, wl, 0, H); g.addColorStop(0, 'rgba(70,90,120,.95)'); g.addColorStop(1, 'rgba(10,15,25,1)'); c.fillStyle = g; c.fillRect(0, wl, W, H - wl);
  c.strokeStyle = 'rgba(220,230,255,.35)'; c.lineWidth = 3; for (let i = 0; i < 6; i++) { c.beginPath(); for (let x = 0; x <= W; x += 30) { const y = wl + 10 + i * 40 + Math.sin(x * 0.02 + t * 2 + i) * 6; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
  // two cars floating, tilted
  c.save(); c.translate(330, wl + 10 + Math.sin(t * 1.4) * 8); c.rotate(-0.12 + Math.sin(t) * 0.05); car(c, 0, 0, 55, 0.6); c.restore();
  c.save(); c.translate(780, wl + 30 + Math.sin(t * 1.1 + 1) * 8); c.rotate(0.18); car(c, 0, 0, 45, 0); c.restore();
  // sirens
  const s = Math.sin(t * 10) > 0; glowDot(c, 560, 1150, 260, s ? '224,72,79' : '80,120,255', 0.35);
}
function skyArc(c, t, lt, k) {
  nightSky(c, t, 0.2);
  // the Moon crosses the sky, then stops above one house
  const p = ease(p01(lt, 0.2, 3.2));
  const mx = lerp(-80, W / 2, p), my = 520 - Math.sin(p * Math.PI * 0.5) * 120;
  for (let i = 1; i <= 6; i++) { const q = Math.max(0, p - i * 0.06); c.globalAlpha = 0.08 * (7 - i) / 6; c.fillStyle = '#efeadc'; c.beginPath(); c.arc(lerp(-80, W / 2, q), 520 - Math.sin(q * Math.PI * 0.5) * 120, 150, 0, 7); c.fill(); }
  c.globalAlpha = 1; moon(c, mx, my, 150, 0, t);
  houses(c, ROWS[0], 1450, 1.0, '#040509', t, 999);
  c.fillStyle = '#020306'; c.fillRect(0, 1450, W, H);
  // a thin line down from the Moon to your roof
  if (p > 0.95) { c.strokeStyle = 'rgba(255,90,90,.6)'; c.setLineDash([12, 12]); c.lineWidth = 3; c.beginPath(); c.moveTo(W / 2, my + 160); c.lineTo(W / 2, 1300); c.stroke(); c.setLineDash([]); }
}
function close(c, t, lt, k) {
  c.fillStyle = '#03040a'; c.fillRect(0, 0, W, H); stars(c, t, 0, 0.5, H);
  const open = ease(p01(t, TL.blinkAt, TL.blinkAt + 0.5));
  moon(c, W / 2, 800, lerp(560, 640, k), open, t);
}
// ---------- captions + HUD ----------
const KEY = new Set(['moon', 'house', 'closer', 'tide', 'floating', 'sirens', 'stopped', 'except', 'craters', 'blink']);
const CHUNKS = [];
for (const L of LINES) {
  const phrases = []; let cur = [];
  for (const w of L.words) { cur.push(w); if (/[.,?!…]["']?$/.test(w[0])) { phrases.push(cur); cur = []; } }
  if (cur.length) phrases.push(cur);
  for (const ph of phrases) { const n = Math.ceil(ph.length / 3), size = Math.ceil(ph.length / n); for (let i = 0; i < ph.length; i += size) { const g = ph.slice(i, i + size); CHUNKS.push({words: g.map((w) => w[0]), t0: g[0][1], t1: g[g.length - 1][2]}); } }
}
CHUNKS.forEach((ch, i) => { const nx = CHUNKS[i + 1]; ch.end = nx ? Math.min(nx.t0, ch.t1 + 0.6) : ch.t1 + 0.3; });
const clean = (w) => (/^a\.m/i.test(w) ? 'AM' : w.replace(/^["“]+/, '').replace(/\.\.\.$/, '').replace(/["”]$/, '').replace(/[.,?!:]$/, '').replace(/["”]$/, '').replace(/[.,?!:]$/, ''));
function captions(c, t) {
  const ch = CHUNKS.find((k) => t >= k.t0 - 0.04 && t < k.end); if (!ch) return;
  const a = easeOutCubic(p01(t, ch.t0 - 0.04, ch.t0 + 0.1)), out = 1 - p01(t, ch.end - 0.08, ch.end);
  const words = ch.words.map(clean).map((s) => s.toUpperCase());
  const hi = words.findIndex((w) => KEY.has(w.toLowerCase().replace(/[^a-z0-9]/g, '')));
  c.save(); c.globalAlpha = a * out;
  c.font = F(900, 76); c.textAlign = 'left'; c.letterSpacing = '1px';
  const sp = 22, ws = words.map((w) => c.measureText(w).width), total = ws.reduce((x, y) => x + y, 0) + sp * (words.length - 1);
  let x = W / 2 - total / 2; const y = 1400 + (1 - a) * 12;
  c.shadowColor = 'rgba(0,0,0,.95)'; c.shadowBlur = 28; c.shadowOffsetY = 4;
  words.forEach((w, i) => { c.fillStyle = i === hi ? `rgb(${C.warm})` : C.text; c.fillText(w, x, y); x += ws[i] + sp; });
  c.restore();
}
function hud(c, t) {
  c.save(); c.textAlign = 'left';
  c.fillStyle = C.red; c.beginPath(); c.arc(84, 196, 9, 0, 7); c.fill();
  c.fillStyle = 'rgba(233,236,244,.75)'; c.font = F(700, 24); c.letterSpacing = '5px'; c.fillText(TL.night, 104, 205);
  c.letterSpacing = '0px'; c.fillStyle = C.text; c.font = F(800, 72); const ct = '2:14', tw = c.measureText(ct).width; c.fillText(ct, 70, 288);
  c.font = F(700, 30); c.fillStyle = 'rgba(233,236,244,.7)'; c.fillText('AM', 70 + tw + 12, 288);
  c.restore();
}

const SHOTS = TL.shots.map(([name, t0], i) => ({name, t0, t1: (TL.shots[i + 1] || [0, TL.duration])[1], i}));
const shotAt = (t) => SHOTS.filter((s) => t >= s.t0).pop() || SHOTS[0];
const GRAIN = Array.from({length: 4}, (_, k) => { const g = off(256, 256), x = g.getContext('2d'), d = x.createImageData(256, 256), r = rng(100 + k); for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 22; } x.putImageData(d, 0, 0); return g; });
function finish(c, t) {
  const v = c.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.5, H * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  c.save(); c.globalCompositeOperation = 'overlay'; c.fillStyle = c.createPattern(GRAIN[Math.floor(t * FPS) % 4], 'repeat'); c.fillRect(0, 0, W, H); c.restore();
}


runSim(DEFAULTS, async ({cfg, canvas}) => {
  await Promise.all([900, 800, 700, 600].map((w) => document.fonts.load(F(w, 40)))).catch(() => {});
  canvas.style.display = 'none';
  const ov = document.createElement('canvas'); ov.id = 'ov'; ov.width = W; ov.height = H; document.getElementById('app').appendChild(ov);
  const c = ov.getContext('2d');
  function scene(x, t, sh) {
    const lt = t - sh.t0, dur = sh.t1 - sh.t0, k = ease(p01(lt, 0, dur)), lin = p01(lt, 0, dur);
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    if (sh.name === 'over') over(x, t, sh.i === 0 ? lerp(1.0, 1.06, lin) : lerp(0.95, 1.0, lin), 1);
    else if (sh.name === 'news') news(x, t, lt);
    else if (sh.name === 'flood') flood(x, t, lt, k);
    else if (sh.name === 'sky') skyArc(x, t, lt, k);
    else if (sh.name === 'close') close(x, t, lt, k);
  }
  return {
    render(t) {
      const sh = shotAt(t);
      scene(c, t, sh);
      const since = t - sh.t0; if (sh.i > 0 && since < 0.1) { c.fillStyle = `rgba(0,0,0,${1 - since / 0.1})`; c.fillRect(0, 0, W, H); }
      finish(c, t);
      if (['news', 'flood'].includes(sh.name)) hud(c, t);
      if (!cfg.noCaptions) captions(c, t);
      return {};
    },
    resize() {},
  };
});
