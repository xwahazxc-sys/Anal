// Phone screen UI drawn into a 2D canvas that becomes the screen texture.
// Pure function of t: lock screen, group chat, member list.
import TL from './timeline.json';

export const SW = 760, SH = 1740;
const C = {text: '#E9ECF4', dim: '#7C859C', red: '#D9484E', warm: '255,201,74', cool: '170,195,255'};
const F = (w, s) => `${w} ${s}px Inter, sans-serif`;
const clamp = (x) => Math.min(1, Math.max(0, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const lerp = (a, b, k) => a + (b - a) * k;
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

export const PEOPLE = {
  park: {name: 'Mrs. Park · 2A', ini: 'P', col: '#C9A27A'},
  dev: {name: 'Dev · 3C', ini: 'D', col: '#7FA6C9'},
  lena: {name: 'Lena · 1B', ini: 'L', col: '#9BB59A'},
  mgr: {name: 'Building Manager', ini: 'EC', col: '#B7B0C9'},
  ghost: {name: '4B', ini: '', col: '#8A3B3F'},
  self: {name: 'You · 4B', ini: 'Y', col: '#9BB59A'},
  tenant: {name: '4B', ini: '4B', col: '#8FA0B8'},
  me: {name: 'You', ini: 'Y', col: '#9BB59A'},
};
const ALL = [['Lena Ortiz', '1A'], ['Sam Reyes', '1B'], ['The Kowalskis', '1C'], ['Mrs. Park', '2A'], ['Omar Haddad', '2B'], ['June & Theo', '2C'], ['Ruth Klein', '3A'], ['Marco B.', '3B'], ['Dev Patel', '3C'], ['Nadia S.', '4A'], ['You', '4B'], ['Ivy Chen', '4C'], ['4B', '']];
const MEMBERS = TL.ghostInList === false ? ALL.slice(0, -1) : ALL;

export const clockText = (t) => String(TL.clock.filter(([at]) => t >= at).pop()[1]);

function wrap(c, text, maxW) {
  const out = []; let cur = '';
  for (const w of text.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (c.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
  if (cur) out.push(cur);
  return out;
}

function avatar(c, who, x, y, r) {
  const p = PEOPLE[who];
  c.fillStyle = who === 'ghost' ? '#000' : p.col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  if (who === 'ghost') { c.strokeStyle = 'rgba(140,60,64,.7)'; c.lineWidth = 2; c.stroke(); return; }
  c.fillStyle = '#0A0D16'; c.font = F(800, r * 0.8); c.textAlign = 'center'; c.fillText(p.ini, x, y + r * 0.29);
}
const building = (c, x, y, s) => {
  c.fillStyle = '#2A3148'; c.beginPath(); c.arc(x, y, 40 * s, 0, 7); c.fill();
  c.fillStyle = '#9AA6C8'; c.fillRect(x - 18 * s, y - 20 * s, 36 * s, 40 * s);
  c.fillStyle = '#2A3148'; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) c.fillRect(x - 13 * s + j * 16 * s, y - 14 * s + i * 12 * s, 9 * s, 7 * s);
};
const camIcon = (c, x, y, col) => { c.fillStyle = col; rr(c, x, y, 34, 24, 5); c.fill(); c.beginPath(); c.moveTo(x + 36, y + 12); c.lineTo(x + 48, y + 4); c.lineTo(x + 48, y + 20); c.fill(); };

function statusBar(c, t, light) {
  c.fillStyle = light ? 'rgba(233,236,244,.9)' : C.text; c.font = F(600, 30); c.textAlign = 'left'; c.fillText(clockText(t), 64, 66);
  c.fillStyle = '#000'; rr(c, SW / 2 - 110, 26, 220, 60, 30); c.fill();
  c.fillStyle = C.text; for (let i = 0; i < 4; i++) c.fillRect(SW - 172 + i * 13, 60 - i * 7, 8, 8 + i * 7);
  c.strokeStyle = C.text; c.lineWidth = 2.5; rr(c, SW - 100, 40, 48, 24, 7); c.stroke(); c.fillRect(SW - 96, 44, 26, 16);
}

function lock(c, t) {
  const g = c.createLinearGradient(0, 0, SW, SH); g.addColorStop(0, '#1A2140'); g.addColorStop(1, '#0A0D18');
  c.fillStyle = g; c.fillRect(0, 0, SW, SH);
  statusBar(c, t, true);
  c.textAlign = 'center'; c.fillStyle = 'rgba(233,236,244,.75)'; c.font = F(600, 34); c.fillText('Friday, October 16', SW / 2, 250);
  c.fillStyle = C.text; c.font = F(700, 190); c.fillText(clockText(t), SW / 2, 440);
  const k = easeOut(prog(t, TL.lockCard, TL.lockCard + 0.5));
  if (k > 0) {
    c.save(); c.globalAlpha = k; c.translate(0, (1 - k) * 40);
    c.fillStyle = 'rgba(30,36,56,.92)'; rr(c, 40, 560, SW - 80, 200, 40); c.fill();
    building(c, 110, 640, 0.9);
    c.textAlign = 'left'; c.fillStyle = C.text; c.font = F(700, 32); c.fillText('Elm Court Residents', 170, 625);
    c.fillStyle = C.dim; c.font = F(500, 24); c.textAlign = 'right'; c.fillText('now', SW - 70, 625); c.textAlign = 'left';
    c.fillStyle = '#C5CBDA'; c.font = F(500, 30); c.fillText('Mrs. Park: 4B — there\'s a man…', 170, 672);
    c.fillStyle = C.dim; c.font = F(500, 26); c.fillText('3 new messages', 170, 716);
    c.restore();
  }
}

function drawMsg(c, m, y0, lines, bh, k, thumb) {
  c.save(); c.globalAlpha = k; c.translate(0, (1 - k) * 26);
  const bx = 124, by = y0 + 40, p = PEOPLE[m.who];
  avatar(c, m.who, 70, by + bh - 34, 30);
  c.textAlign = 'left'; c.font = F(700, 25); c.fillStyle = m.who === 'ghost' ? '#B4555B' : p.col; c.fillText(p.name, bx + 22, y0 + 28);
  c.font = F(500, 34);
  const bw = Math.min(m.img ? 520 : Math.max(...lines.map((l) => c.measureText(l).width)) + 166, SW - 170);
  c.fillStyle = m.who === 'ghost' ? '#1A0E12' : m.who === 'mgr' ? '#1E2236' : '#1A2030';
  rr(c, bx, by, bw, bh, 34); c.fill();
  if (m.who === 'ghost') { c.strokeStyle = 'rgba(140,60,64,.5)'; c.lineWidth = 2; c.stroke(); }
  if (m.img) { c.save(); rr(c, bx + 14, by + 14, 492, bh - 28, 24); c.clip(); if (thumb) c.drawImage(thumb, bx + 14, by + 14, 492, bh - 28); c.restore(); }
  else { c.fillStyle = C.text; lines.forEach((l, i) => c.fillText(l, bx + 28, by + 54 + i * 46)); }
  c.font = F(500, 21); c.fillStyle = C.dim; c.textAlign = 'right'; c.fillText(m.time, bx + bw - 22, by + bh - 16);
  c.restore();
}

function typing(c, t, y0, who, k) {
  c.save(); c.globalAlpha = k;
  avatar(c, who, 70, y0 + 50, 30);
  c.fillStyle = who === 'ghost' ? '#1A0E12' : '#1A2030'; rr(c, 124, y0 + 14, 150, 72, 36); c.fill();
  for (let i = 0; i < 3; i++) { const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 7 - i * 0.9)); c.fillStyle = `rgba(200,208,230,${a})`; c.beginPath(); c.arc(168 + i * 32, y0 + 50, 9, 0, 7); c.fill(); }
  c.restore();
}

function chat(c, t, thumb) {
  c.fillStyle = '#0A0D16'; c.fillRect(0, 0, SW, SH);
  c.fillStyle = '#0F131E'; c.fillRect(0, 0, SW, 250);
  c.strokeStyle = C.text; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(66, 150); c.lineTo(48, 170); c.lineTo(66, 190); c.stroke();
  building(c, 130, 170, 1);
  c.textAlign = 'left'; c.fillStyle = C.text; c.font = F(700, 36); c.fillText('Elm Court Residents', 190, 162);
  c.fillStyle = C.dim; c.font = F(500, 26); c.fillText(`${TL.memberCount ?? 13} members`, 190, 200);
  const tap = Math.max(0, 1 - Math.abs(t - TL.tap) / 0.35);
  c.fillStyle = '#1E2436'; c.fillRect(0, 250, SW, 92);
  if (tap > 0) { c.fillStyle = `rgba(${C.cool},${tap * 0.2})`; c.fillRect(0, 250, SW, 92); }
  camIcon(c, 44, 284, '#AEB8D6');
  c.fillStyle = C.text; c.font = F(600, 30); c.fillText('Hallway Cam', 112, 307);
  c.fillStyle = C.red; c.beginPath(); c.arc(320, 297, 8, 0, 7); c.fill();
  c.fillStyle = C.dim; c.font = F(600, 24); c.fillText('LIVE · pinned', 338, 306);
  // messages stack upward from the input bar; each grows in with its own progress => natural scroll
  const inputY = SH - 150, top = 342;
  c.save(); c.beginPath(); c.rect(0, top, SW, inputY - top); c.clip();
  let yb = inputY - 26;
  const ty = TL.typing.find(([a, b]) => t >= a && t < b);
  if (ty) { const k = easeOut(prog(t, ty[0], ty[0] + 0.3)); yb -= 96 * k; typing(c, t, yb, ty[2], k); yb -= 10 * k; }
  const vis = TL.msgs.filter((m) => t >= m.t);
  c.font = F(500, 34);
  for (let i = vis.length - 1; i >= 0 && yb > top - 500; i--) {
    const m = vis[i], k = easeOut(prog(t, m.t, m.t + 0.45));
    if (m.who === 'me') {
      c.font = F(500, 34); const lines = wrap(c, m.text, SW - 250), bh = 64 + lines.length * 46, bw = Math.max(...lines.map((l) => c.measureText(l).width)) + 120;
      yb -= (bh + 24) * k; c.save(); c.globalAlpha = k; c.translate(0, (1 - k) * 26);
      c.fillStyle = '#2B4C8C'; rr(c, SW - 40 - bw, yb + 12, bw, bh, 34); c.fill();
      c.fillStyle = C.text; c.textAlign = 'left'; lines.forEach((l, j) => c.fillText(l, SW - 40 - bw + 28, yb + 66 + j * 46));
      c.font = F(500, 21); c.fillStyle = 'rgba(233,236,244,.6)'; c.textAlign = 'right'; c.fillText(m.time + '  ✓✓', SW - 62, yb + bh - 4); c.restore();
      yb -= 10 * k; continue;
    }
    if (m.sys) {
      yb -= 70 * k; c.save(); c.globalAlpha = k; c.font = F(500, 24); const w = c.measureText(m.text).width + 44;
      c.fillStyle = '#151A28'; rr(c, SW / 2 - w / 2, yb + 12, w, 46, 23); c.fill(); c.fillStyle = C.dim; c.textAlign = 'center'; c.fillText(m.text, SW / 2, yb + 43); c.restore();
      yb -= 10 * k; continue;
    }
    c.font = F(500, 34);
    const lines = m.img ? [] : wrap(c, m.text, SW - 250);
    const bh = m.img ? 470 : 64 + lines.length * 46;
    yb -= (bh + 50) * k;
    drawMsg(c, m, yb, lines, bh, k, thumb);
    yb -= 14 * k;
  }
  c.restore();
  c.fillStyle = '#0F131E'; c.fillRect(0, inputY, SW, 150);
  c.fillStyle = '#1B2133'; rr(c, 40, inputY + 30, SW - 160, 76, 38); c.fill();
  c.fillStyle = C.dim; c.font = F(500, 30); c.textAlign = 'left'; c.fillText('Message', 80, inputY + 79);
  c.fillStyle = '#2A3148'; c.beginPath(); c.arc(SW - 70, inputY + 68, 36, 0, 7); c.fill();
  statusBar(c, t);
}

function members(c, t) {
  c.fillStyle = '#0A0D16'; c.fillRect(0, 0, SW, SH);
  c.fillStyle = '#0F131E'; c.fillRect(0, 0, SW, 430);
  building(c, SW / 2, 200, 1.7);
  c.textAlign = 'center'; c.fillStyle = C.text; c.font = F(700, 40); c.fillText('Elm Court Residents', SW / 2, 330);
  const hk = easeOut(prog(t, TL.count, TL.count + 0.6));
  c.font = F(600, 30); c.fillStyle = C.dim; c.textAlign = 'right'; c.fillText('12 apartments  ·  ', SW / 2 + 30, 382);
  c.textAlign = 'left'; c.fillStyle = hk > 0 ? `rgb(${lerp(124, 255, hk)},${lerp(133, 201, hk)},${lerp(156, 74, hk)})` : C.dim; c.fillText(`${MEMBERS.length} members`, SW / 2 + 30, 382);
  if (hk > 0) { c.fillStyle = `rgba(${C.warm},${hk})`; c.fillRect(SW / 2 + 30, 394, 168 * hk, 3); }
  const rowH = 104, listTop = 440, [s0, s1] = TL.listScroll;
  const scroll = ease(prog(t, s0, s1)) * (MEMBERS.length * rowH - (SH - 480));
  c.save(); c.beginPath(); c.rect(0, listTop, SW, SH - listTop); c.clip();
  const cols = ['#C9A27A', '#7FA6C9', '#9BB59A', '#B7B0C9'];
  MEMBERS.forEach(([n, apt], i) => {
    const y = listTop + i * rowH - scroll, ghost = TL.ghostInList !== false && i === MEMBERS.length - 1;
    if (ghost) { const g = easeOut(prog(t, TL.ghostRow, TL.ghostRow + 0.8)); c.fillStyle = `rgba(90,30,36,${0.4 * g})`; c.fillRect(0, y, SW, rowH); }
    if (n === 'You' && TL.youRow) { const g = easeOut(prog(t, TL.youRow, TL.youRow + 0.8)); c.fillStyle = `rgba(90,30,36,${0.45 * g})`; c.fillRect(0, y, SW, rowH); }
    if (ghost) avatar(c, 'ghost', 80, y + 52, 34);
    else { c.fillStyle = cols[i % 4]; c.beginPath(); c.arc(80, y + 52, 34, 0, 7); c.fill(); c.fillStyle = '#0A0D16'; c.font = F(800, 26); c.textAlign = 'center'; c.fillText(n[0], 80, y + 62); }
    c.textAlign = 'left'; c.fillStyle = ghost ? '#C46A70' : C.text; c.font = F(600, 32); c.fillText(n, 140, y + 50);
    c.fillStyle = C.dim; c.font = F(500, 24);
    const sub = ghost ? (t > TL.ghostRow + 0.2 ? 'typing' + '...'.slice(0, 1 + (Math.floor(t * 3) % 3)) : 'online') : n === 'You' ? (TL.youSub || 'Apartment 4B · you') : 'Apartment ' + apt;
    c.fillText(sub, 140, y + 84);
    c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(140, y + rowH - 1, SW - 140, 1);
  });
  c.restore();
  statusBar(c, t);
}

export function drawScreen(c, t, mode, thumb) {
  c.save();
  if (mode === 'lock') lock(c, t);
  else if (mode === 'members') members(c, t);
  else chat(c, t, thumb);
  c.restore();
}
