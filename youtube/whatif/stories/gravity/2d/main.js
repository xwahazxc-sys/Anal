import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutCubic, lerp, rng} from '../kit/util.js';
import TL from './timeline.json';
import LINES from './lines.json';

// "What If At 2:14" — Five Seconds Without Gravity. 2D silhouettes, 30-40 s, the last shot loops into the first.

const W = 1080, H = 1920, FPS = 30;
const DEFAULTS = {duration: TL.duration, fps: FPS, theme: 'dark', hud: {enabled: false, title: 'gravity2d', subtitle: ''}, director: {enabled: false}, watermark: '', seed: 7};
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

// ---------- five seconds without gravity ----------
// a tiny person silhouette; wave: 0..1 arm up and waving; tumble: rotation
function person(c, x, y, s, wave = 0, rot = 0, t = 0, col = C.ink) {
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col;
  c.beginPath(); c.arc(0, -3.3 * s, 0.45 * s, 0, 7); c.fill();
  c.beginPath(); c.roundRect(-0.45 * s, -2.8 * s, 0.9 * s, 1.8 * s, 0.3 * s); c.fill();
  c.fillRect(-0.4 * s, -1.1 * s, 0.32 * s, 1.1 * s); c.fillRect(0.08 * s, -1.1 * s, 0.32 * s, 1.1 * s);
  c.save(); c.translate(-0.4 * s, -2.6 * s); c.rotate(0.25); c.fillRect(-0.12 * s, 0, 0.24 * s, 1.3 * s); c.restore();
  c.save(); c.translate(0.4 * s, -2.6 * s); c.rotate(Math.PI - 0.3 * wave - (wave > 0 ? Math.sin(t * 7 + x) * 0.35 * wave : 0) - (1 - wave) * 2.6); c.fillRect(-0.12 * s, 0, 0.24 * s, 1.3 * s); c.restore();
  c.restore();
}
const FLOATERS = (() => { const r = rng(77); return Array.from({length: 75}, () => [r(), r(), r()]).sort((a, b) => a[2] - b[2]); })();
// the sky full of people, all waving down at you
function floaters(c, t, z, alpha = 1, waveK = 1) {
  for (const [fx, fy, d] of FLOATERS) {
    const s = lerp(8, 30, d * d) * z, x = W / 2 + (fx - 0.5) * W * 1.3 * z, y = 200 + fy * 1050 * z + Math.sin(t * 0.6 + fx * 9) * 8, rot = Math.sin(t * 0.3 + fy * 7) * 0.2;
    c.globalAlpha = alpha * (0.55 + 0.45 * d);
    person(c, x - 0.12 * s, y - 0.15 * s, s, waveK, rot, t, 'rgba(200,215,255,.85)');
    person(c, x, y, s, waveK, rot, t);
  }
  c.globalAlpha = 1;
}
function nightSky(c, t, glow = 0) { skyGrad(c, 900, 1500, glow); stars(c, t, 0, 0.8, 1300); }
function upShot(c, t, z, waveK = 1) {
  nightSky(c, t, 1.0); glowDot(c, W / 2, 700, 1100, '150,170,220', 0.25);
  c.save(); c.translate(W / 2, H * 0.4); c.scale(z, z); c.translate(-W / 2, -H * 0.4);
  floaters(c, t, 1, 1, waveK);
  c.restore();
  // you, from behind, looking up, bottom of frame
  c.fillStyle = C.ink; c.beginPath(); c.ellipse(W / 2, 1640, 150, 175, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(W / 2, 1960, 330, 260, 0, Math.PI, 0); c.fill();
}
function street(c, t, k) {
  nightSky(c, t, 0.3);
  houses(c, ROWS[1], 1400, 1.1, '#05060a', t, 999);
  lamp(c, 170, 1450, 1.3, 1, 1); lamp(c, W - 150, 1450, 1.3, 1, -1);
  c.fillStyle = '#04050a'; c.fillRect(0, 1400, W, H);
  glowDot(c, 420, 1500, 420, C.sodium, 0.25);
  car(c, 760, 1560, 60, 0);
  person(c, 300, 1640, 62, 0, 0, t); person(c, 420, 1650, 58, 0, 0, t);
  c.fillStyle = C.ink; c.beginPath(); c.ellipse(560, 1555, 50, 24, 0, 0, 7); c.fill(); c.fillRect(530, 1555, 10, 30); c.fillRect(580, 1555, 10, 30); c.beginPath(); c.ellipse(515, 1535, 20, 16, 0, 0, 7); c.fill();   // dog
}
// everything lifts: u 0..1 how far up; tumbling as it rises
function lift(c, t, u, shake = 0) {
  c.save(); c.translate(Math.sin(t * 80) * 10 * shake, Math.cos(t * 70) * 8 * shake);
  nightSky(c, t, 0.3);
  houses(c, ROWS[1], 1400, 1.1, '#05060a', t, 999);
  lamp(c, 170, 1450, 1.3, 1, 1); lamp(c, W - 150, 1450, 1.3, 1, -1);
  c.fillStyle = '#04050a'; c.fillRect(0, 1400, W, H);
  const up = (base, amt, ph) => base - amt * u + Math.sin(t * 1.2 + ph) * 12 * u;
  c.save(); c.translate(760, up(1560, 520, 1)); c.rotate(0.5 * u); car(c, 0, 0, 60, 0); c.restore();
  glowDot(c, 420, 1500, 420, C.sodium, 0.25);
  person(c, 300, up(1640, 760, 2), 62, 0, -0.9 * u, t); person(c, 420, up(1650, 640, 3), 58, 0, 1.2 * u, t);
  c.save(); c.translate(560, up(1555, 880, 4)); c.rotate(2 * u); c.fillStyle = C.ink; c.beginPath(); c.ellipse(0, 0, 50, 24, 0, 0, 7); c.fill(); c.fillRect(-30, 0, 10, 30); c.fillRect(20, 0, 10, 30); c.beginPath(); c.ellipse(-45, -20, 20, 16, 0, 0, 7); c.fill(); c.restore();
  // cups, a trash can, leaves
  const r = rng(5); for (let i = 0; i < 18; i++) { const x = r() * W, y0 = 1420 + r() * 300; c.save(); c.translate(x, y0 - (300 + r() * 700) * u); c.rotate(t * (r() - 0.5) * 3); c.fillStyle = C.ink; c.fillRect(-8 - r() * 10, -10, 16 + r() * 20, 20); c.restore(); }
  c.restore();
  if (shake > 0.2) { c.fillStyle = `rgba(255,255,255,${0.08 * shake})`; c.fillRect(0, 0, W, H); }
}
// ---------- captions + HUD ----------
const KEY = new Set(['outside', 'gravity', 'five', 'lifted', 'fell', 'almost', 'floating', 'waving', 'thousands', 'up']);
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
    if (sh.name === 'up') upShot(x, t, sh.i === 0 ? lerp(1.0, 1.06, lin) : lerp(0.95, 1.0, lin), 1);
    else if (sh.name === 'street') street(x, t, k);
    else if (sh.name === 'lift') lift(x, t, ease(p01(t, TL.liftAt[0], TL.liftAt[1])), 0);
    else if (sh.name === 'fall') { const f = p01(t, TL.fallAt - 0.5, TL.fallAt); lift(x, t, 1 - f * f, t > TL.fallAt ? Math.exp(-(t - TL.fallAt) * 5) : 0); }
    else if (sh.name === 'almost') { lift(x, t, 0, 0); x.fillStyle = `rgba(0,0,0,${0.4 * k})`; x.fillRect(0, 0, W, H); }
    else if (sh.name === 'look') upShot(x, t, lerp(1.3, 1.1, k), ease(p01(t, TL.waveAt, TL.waveAt + 0.6)));
  }
  return {
    render(t) {
      const sh = shotAt(t);
      scene(c, t, sh);
      const since = t - sh.t0; if (sh.i > 0 && since < 0.1) { c.fillStyle = `rgba(0,0,0,${1 - since / 0.1})`; c.fillRect(0, 0, W, H); }
      finish(c, t);
      if (['street', 'lift'].includes(sh.name)) hud(c, t);
      if (!cfg.noCaptions) captions(c, t);
      return {};
    },
    resize() {},
  };
});
