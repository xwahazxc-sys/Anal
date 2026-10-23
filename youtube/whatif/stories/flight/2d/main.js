import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutCubic, lerp, rng} from '../kit/util.js';
import TL from './timeline.json';
import LINES from './lines.json';

// "What If At 2:14" — Flight 214, part 1. 2D silhouettes, 30-40 s, the last shot loops into the first.

const W = 1080, H = 1920, FPS = 30;
const DEFAULTS = {duration: TL.duration, fps: FPS, theme: 'dark', hud: {enabled: false, title: 'flight2d', subtitle: ''}, director: {enabled: false}, watermark: '', seed: 7};
const C = {ink: '#030407', warm: '255,201,74', sodium: '255,170,90', red: '#e0484f', text: '#F3F4F8', dim: '#7C859C', screen: '120,200,255'};
const p01 = (t, a, b) => clamp01((t - a) / (b - a));
const ease = easeInOutCubic;
const F = (w, s) => `${w} ${s}px Inter, sans-serif`;
const off = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function glowDot(c, x, y, r, col, a) { if (a <= 0) return; c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }

// ---------- seatback map ----------
function plane(c, x, y, s, rot) {
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = '#ffffff';
  c.beginPath(); c.moveTo(0, -1.0 * s); c.quadraticCurveTo(0.12 * s, -0.8 * s, 0.1 * s, -0.2 * s); c.lineTo(0.9 * s, 0.2 * s); c.lineTo(0.9 * s, 0.35 * s); c.lineTo(0.1 * s, 0.15 * s); c.lineTo(0.08 * s, 0.7 * s); c.lineTo(0.35 * s, 0.9 * s); c.lineTo(0.35 * s, 1.0 * s); c.lineTo(0, 0.92 * s);
  c.lineTo(-0.35 * s, 1.0 * s); c.lineTo(-0.35 * s, 0.9 * s); c.lineTo(-0.08 * s, 0.7 * s); c.lineTo(-0.1 * s, 0.15 * s); c.lineTo(-0.9 * s, 0.35 * s); c.lineTo(-0.9 * s, 0.2 * s); c.lineTo(-0.1 * s, -0.2 * s); c.quadraticCurveTo(-0.12 * s, -0.8 * s, 0, -1.0 * s); c.fill();
  c.restore();
}
function seatMap(c, t, z) {
  c.fillStyle = '#050608'; c.fillRect(0, 0, W, H);
  c.save(); c.translate(W / 2, H * 0.48); c.scale(z, z); c.translate(-W / 2, -H * 0.48);
  // seat back + screen bezel
  c.fillStyle = '#0d0f13'; c.beginPath(); c.roundRect(40, 120, W - 80, 1700, 60); c.fill();
  c.fillStyle = '#000'; c.beginPath(); c.roundRect(90, 170, W - 180, 1480, 26); c.fill();
  const sx = 110, sy = 190, sw = W - 220, sh = 1440;
  c.save(); c.beginPath(); c.roundRect(sx, sy, sw, sh, 16); c.clip();
  const g = c.createLinearGradient(0, sy, 0, sy + sh); g.addColorStop(0, '#0a2c52'); g.addColorStop(1, '#04162c'); c.fillStyle = g; c.fillRect(sx, sy, sw, sh);
  c.strokeStyle = 'rgba(120,180,255,.13)'; c.lineWidth = 2;
  for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(sx, sy + i * 180 + 40); c.lineTo(sx + sw, sy + i * 180 + 40); c.stroke(); }
  for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(sx + i * 180 + 30, sy); c.lineTo(sx + i * 180 + 30, sy + sh); c.stroke(); }
  // flown route: dashed arc from the lower left, ends at the plane in the middle of the ocean
  const px = W / 2 + 40, py = 1060;
  c.setLineDash([18, 14]); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 6; c.beginPath(); c.moveTo(sx - 20, sy + sh - 120); c.quadraticCurveTo(300, 1250, px - 30, py + 40); c.stroke();
  c.setLineDash([6, 18]); c.strokeStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.moveTo(px + 30, py - 40); c.quadraticCurveTo(820, 820, sx + sw + 20, 560); c.stroke(); c.setLineDash([]);
  glowDot(c, px, py, 120, '255,255,255', 0.18 + 0.08 * Math.sin(t * 4));
  plane(c, px, py, 60, 0.75);
  // info panel
  c.fillStyle = 'rgba(2,10,22,.82)'; c.fillRect(sx, sy, sw, 380);
  c.textAlign = 'left'; c.fillStyle = 'rgba(160,200,240,.85)'; c.font = F(700, 30); c.letterSpacing = '4px';
  c.fillText('TIME TO DESTINATION', sx + 50, sy + 80); c.fillText('DISTANCE TO DESTINATION', sx + 50, sy + 230);
  c.letterSpacing = '0px'; c.fillStyle = '#fff'; c.font = F(800, 92); c.fillText('0:20', sx + 50, sy + 175);
  c.fillStyle = `rgb(${C.warm})`; c.fillText('2,014 mi', sx + 50, sy + 325);
  c.textAlign = 'right'; c.fillStyle = 'rgba(160,200,240,.7)'; c.font = F(700, 28); c.letterSpacing = '3px'; c.fillText('FLIGHT 214', sx + sw - 50, sy + 80); c.fillText('2:14 AM', sx + sw - 50, sy + 125); c.letterSpacing = '0px';
  c.fillStyle = 'rgba(160,200,240,.45)'; c.font = F(700, 30); c.letterSpacing = '8px'; c.textAlign = 'center'; c.fillText('PACIFIC OCEAN', W / 2, 1530); c.letterSpacing = '0px';
  c.restore();
  glowDot(c, W / 2, H * 0.45, 800, C.screen, 0.12);
  c.restore();
}

// ---------- cabin ----------
function seatRow(c, x, y, s, heads, lean) {
  for (let i = 0; i < heads; i++) {
    const hx = x + i * 1.25 * s, tilt = lean[i % lean.length];
    c.fillStyle = '#07080b'; c.beginPath(); c.roundRect(hx - 0.55 * s, y - 1.3 * s, 1.1 * s, 2.6 * s, 0.25 * s); c.fill();   // seat back
    c.fillStyle = C.ink; c.save(); c.translate(hx, y - 1.45 * s); c.rotate(tilt); c.beginPath(); c.ellipse(0, 0, 0.32 * s, 0.4 * s, 0, 0, 7); c.fill(); c.restore();
  }
}
function cabin(c, t, k) {
  c.fillStyle = '#04060a'; c.fillRect(0, 0, W, H);
  const z = lerp(1, 1.12, k);
  c.save(); c.translate(W / 2, H * 0.45); c.scale(z, z); c.translate(-W / 2, -H * 0.45);
  // vanishing aisle: ceiling, bins, floor
  const vx = W / 2, vy = 820;
  const g = c.createRadialGradient(vx, vy, 0, vx, vy, 700); g.addColorStop(0, 'rgba(60,80,120,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#090b10'; c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(vx + 120, vy - 140); c.lineTo(vx - 120, vy - 140); c.fill();
  c.fillStyle = '#0c0f15'; c.beginPath(); c.moveTo(0, 120); c.lineTo(vx - 120, vy - 140); c.lineTo(vx - 130, vy - 60); c.lineTo(0, 520); c.fill();
  c.beginPath(); c.moveTo(W, 120); c.lineTo(vx + 120, vy - 140); c.lineTo(vx + 130, vy - 60); c.lineTo(W, 520); c.fill();
  // dim floor strip lights
  for (let i = 0; i < 9; i++) { const f = i / 9, y = lerp(H, vy + 40, f), w = lerp(260, 30, f); glowDot(c, vx - w, y, lerp(30, 6, f), '255,180,110', 0.5); glowDot(c, vx + w, y, lerp(30, 6, f), '255,180,110', 0.5); }
  // rows of sleeping heads, far to near
  const r = rng(3);
  for (let row = 7; row >= 0; row--) {
    const f = row / 8, s = lerp(110, 22, f), y = lerp(1500, vy + 30, f), gap = lerp(330, 70, f);
    const lean = [0.25 * (r() - 0.5) + 0.35, -0.3, 0.4, -0.2];
    seatRow(c, vx - gap - 2.5 * 1.25 * s + 0.6 * s, y, s, 3, lean);
    seatRow(c, vx + gap - 0.6 * s, y, s, 3, lean.map((v) => -v));
  }
  // one reading light on, far back
  glowDot(c, vx + 160, vy - 40, 60, '200,220,255', 0.5);
  c.restore();
}

// ---------- attendant ----------
function attendant(c, t, lt, k) {
  c.fillStyle = '#04050a'; c.fillRect(0, 0, W, H);
  const gx = W / 2, gy = 700;
  glowDot(c, gx, gy, 900, '200,215,240', 0.35);
  c.fillStyle = '#0a0c12'; c.fillRect(0, 0, 220, H); c.fillRect(W - 220, 0, 220, H);
  const z = lerp(1, 1.18, k), s = 230 * z, x = W / 2, y = 1880;
  c.save();
  const body = () => {
    c.beginPath();
    c.moveTo(x - 0.9 * s, y); c.lineTo(x - 0.75 * s, y - 2.4 * s); c.quadraticCurveTo(x - 0.95 * s, y - 3.6 * s, x - 0.55 * s, y - 3.9 * s);
    c.lineTo(x - 0.2 * s, y - 4.05 * s); c.lineTo(x + 0.2 * s, y - 4.05 * s); c.lineTo(x + 0.55 * s, y - 3.9 * s); c.quadraticCurveTo(x + 0.95 * s, y - 3.6 * s, x + 0.75 * s, y - 2.4 * s); c.lineTo(x + 0.9 * s, y); c.closePath();
    c.ellipse(x, y - 4.55 * s, 0.42 * s, 0.52 * s, 0, 0, 7);
    c.moveTo(x + 0.3 * s, y - 5.0 * s); c.ellipse(x, y - 5.05 * s, 0.3 * s, 0.24 * s, 0, 0, 7);   // hair bun
  };
  c.save(); c.translate(0, -5); c.fillStyle = 'rgba(200,215,240,.6)'; body(); c.fill(); c.restore();
  c.fillStyle = C.ink; body(); c.fill();
  // scarf: the one warm colour
  c.fillStyle = 'rgba(201,60,60,.9)'; c.beginPath(); c.moveTo(x - 0.3 * s, y - 3.95 * s); c.lineTo(x + 0.3 * s, y - 3.95 * s); c.lineTo(x + 0.05 * s, y - 3.5 * s); c.lineTo(x + 0.2 * s, y - 3.1 * s); c.lineTo(x, y - 3.2 * s); c.lineTo(x - 0.1 * s, y - 3.55 * s); c.closePath(); c.fill();
  // the smile: too wide, too white
  const sm = easeOutCubic(p01(t, TL.smileAt, TL.smileAt + 0.6));
  if (sm > 0) {
    const fx = x, fy = y - 4.35 * s, wv = 0.3 * s * (0.5 + 0.5 * sm);
    glowDot(c, fx, fy, 0.6 * s, '255,255,255', 0.25 * sm);
    c.fillStyle = `rgba(248,248,250,${sm})`; c.beginPath(); c.moveTo(fx - wv, fy - 0.03 * s); c.quadraticCurveTo(fx, fy + 0.22 * s, fx + wv, fy - 0.03 * s); c.quadraticCurveTo(fx, fy + 0.08 * s, fx - wv, fy - 0.03 * s); c.fill();
    c.fillStyle = `rgba(248,248,250,${0.85 * sm})`; for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(fx + sx * 0.15 * s, fy - 0.27 * s, 0.06 * s, 0.025 * s, 0, 0, 7); c.fill(); }
  }
  c.restore();
}

// ---------- window + clouds ----------
const CLOUDS = (() => { const r = rng(5); return Array.from({length: 60}, () => [r() * 1.6 - 0.3, r(), 60 + r() * 140, r()]); })();
const CITY = (() => { const r = rng(9), out = []; for (let i = 0; i < 2600; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()); const gx = Math.round(Math.cos(a) * d * 40), gy = Math.round(Math.sin(a) * d * 40); out.push([gx + (r() - 0.5) * 0.5, gy + (r() - 0.5) * 0.5, r()]); } return out; })();
function cityLights(c, cx, cy, s, a, t) {
  if (a <= 0) return;
  glowDot(c, cx, cy, 46 * s, C.sodium, 0.35 * a);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const [gx, gy, v] of CITY) { const fl = 0.75 + 0.25 * Math.sin(t * 3 + v * 40); c.fillStyle = v < 0.15 ? `rgba(255,240,220,${a * fl})` : `rgba(${C.sodium},${0.8 * a * fl})`; c.fillRect(cx + gx * s, cy + gy * s, Math.max(1.5, 0.45 * s), Math.max(1.5, 0.45 * s)); }
  c.restore();
}
function windowView(c, t, lt, k) {
  c.fillStyle = '#05070b'; c.fillRect(0, 0, W, H);
  const cx = W / 2, cy = 900, rw = 330, rh = 470;
  c.save(); c.beginPath(); c.ellipse(cx, cy, rw, rh, 0, 0, 7); c.clip();
  const g = c.createLinearGradient(0, cy - rh, 0, cy + rh); g.addColorStop(0, '#0a1430'); g.addColorStop(1, '#1a2238'); c.fillStyle = g; c.fillRect(cx - rw, cy - rh, rw * 2, rh * 2);
  const lights = ease(p01(t, TL.lightsAt - 1.2, TL.lightsAt + 0.6));
  // glow from below the clouds
  glowDot(c, cx + 60, cy + 380, 520, C.sodium, 0.5 * lights);
  for (const [fx, fy, r, v] of CLOUDS) {
    const x = cx - rw + ((fx * rw * 2 + t * 30 * (0.5 + v)) % (rw * 3)) - rw * 0.5, y = cy - rh * 0.1 + fy * rh * 1.2;
    c.fillStyle = `rgba(${Math.round(lerp(90, 200, lights * fy))},${Math.round(lerp(100, 150, lights * fy))},${Math.round(lerp(130, 110, lights * fy))},${0.35 + 0.3 * v})`;
    c.beginPath(); c.ellipse(x, y, r * 1.6, r * 0.5, 0, 0, 7); c.fill();
  }
  // gaps in the clouds show the lights
  if (lights > 0) { cityLights(c, cx + 40, cy + 330, 5.5, lights * 0.9, t); }
  c.restore();
  // window bezel
  c.lineWidth = 70; c.strokeStyle = '#0f1218'; c.beginPath(); c.ellipse(cx, cy, rw + 35, rh + 35, 0, 0, 7); c.stroke();
  c.lineWidth = 4; c.strokeStyle = 'rgba(160,180,210,.25)'; c.beginPath(); c.ellipse(cx, cy, rw + 3, rh + 3, 0, 0, 7); c.stroke();
  c.fillStyle = '#0b0d12'; c.fillRect(cx - rw + 10, cy - rh - 10, rw * 2 - 20, lerp(120, 40, k));   // half-open shade
  // your reflection: a dark head in the lower left of the glass
  c.save(); c.globalAlpha = 0.5; c.fillStyle = C.ink; c.beginPath(); c.ellipse(cx - 260, cy + 520, 170, 210, 0, 0, 7); c.fill(); c.restore();
}

// ---------- city from above, then the island ----------
function oceanBG(c, t) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#02040a'); g.addColorStop(1, '#040912'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = rng(2); c.strokeStyle = 'rgba(80,110,150,.08)'; c.lineWidth = 2; for (let i = 0; i < 40; i++) { const y = (r() * H + t * 6) % H, x = r() * W; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 80 + r() * 120, y); c.stroke(); }
}
function wing(c, t) {
  c.fillStyle = '#010204'; c.beginPath(); c.moveTo(-40, 120); c.lineTo(620, 380); c.lineTo(640, 430); c.lineTo(-40, 330); c.fill();
  if (Math.floor(t * 1.2) % 2 === 0) glowDot(c, 625, 400, 60, '224,72,79', 0.9);
}
function cityShot(c, t, lt, k) {
  oceanBG(c, t);
  const s = lerp(17, 14, k), cx = W / 2 + lerp(40, -20, k), cy = 1000;
  cityLights(c, cx, cy, s, 1, t);
  // thin cloud layer drifting across the top
  for (const [fx, fy, r, v] of CLOUDS.slice(0, 20)) { const x = ((fx * W * 1.5 + t * 50 * (0.5 + v)) % (W * 1.6)) - W * 0.3, y = fy * 700; c.fillStyle = `rgba(120,110,120,${0.12 + 0.12 * v})`; c.beginPath(); c.ellipse(x, y, r * 2.4, r * 0.7, 0, 0, 7); c.fill(); }
  wing(c, t);
}
function islandShot(c, t, lt, k) {
  oceanBG(c, t);
  const s = lerp(9, 6, k), cx = W / 2, cy = 900;
  cityLights(c, cx, cy, s, 1, t);
  // where the roads should be: a dashed ring and a label
  const a = ease(p01(lt, 0.8, 1.6));
  c.save(); c.globalAlpha = a; c.setLineDash([14, 14]); c.strokeStyle = 'rgba(255,90,90,.75)'; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, 46 * s, 0, 7); c.stroke(); c.setLineDash([]);
  c.textAlign = 'center'; c.fillStyle = 'rgba(255,120,120,.9)'; c.font = F(800, 34); c.letterSpacing = '6px'; c.fillText('NOT ON MAP', cx, cy - 46 * s - 40); c.letterSpacing = '0px'; c.restore();
}

// ---------- captions + HUD ----------
const KEY = new Set(['twenty', 'ocean', 'asleep', 'smiles', 'lights', 'city', 'lit', 'land', 'roads', 'window', 'map', 'pilot']);
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
    const lt = t - sh.t0, dur = sh.t1 - sh.t0, k = ease(p01(lt, 0, dur));
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    // the first and the last shot are the same map; the last one ends exactly on the first frame
    if (sh.name === 'map') seatMap(x, t, sh.i === 0 ? lerp(1.0, 1.1, k) : lerp(0.94, 1.0, p01(lt, 0, dur)));
    else if (sh.name === 'cabin') cabin(x, t, k);
    else if (sh.name === 'attendant') attendant(x, t, lt, k);
    else if (sh.name === 'window') windowView(x, t, lt, k);
    else if (sh.name === 'city') cityShot(x, t, lt, k);
    else if (sh.name === 'island') islandShot(x, t, lt, k);
  }

  return {
    render(t) {
      const sh = shotAt(t);
      scene(c, t, sh);
      const since = t - sh.t0; if (sh.i > 0 && since < 0.1) { c.fillStyle = `rgba(0,0,0,${1 - since / 0.1})`; c.fillRect(0, 0, W, H); }
      finish(c, t);
      if (['cabin', 'attendant'].includes(sh.name)) hud(c, t);
      if (!cfg.noCaptions) captions(c, t);
      return {};
    },
    resize() {},
  };
});
