import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {runSim} from '../kit/runtime.js';
import {createStage} from '../kit/stage3d.js';
import {clamp01, easeInOutCubic, easeOutCubic, keyed, lerp, rng} from '../kit/util.js';
import TL from './timeline.json';
import LINES from './lines.json';

// "What If At 2:14" — Do Not Look Up, part 1: a 9:16 short. A quiet suburban street at night,
// every phone on Earth gets the same message, the neighbour across the street looks up.
// Voice and sound are mixed separately on the same timeline (mix.py).

const W = 1080, H = 1920, FPS = 30;
const GL_SCALE = 0.8;
const DEFAULTS = {duration: TL.duration, fps: FPS, theme: 'dark', hud: {enabled: false, title: 'lookup', subtitle: ''}, director: {enabled: false}, watermark: '', seed: 7};

const P = {
  night: '#05070d', asphalt: '#15171c', walk: '#24262b', grass: '#0f1611', house: '#2a2c33', house2: '#33302e', roof: '#16171b',
  trunk: '#1a1512', leaf: '#0d1610', man: '#7b818d', car: '#2b3550', metal: '#6d7280',
  sodium: '#ffb066', white: '#eef3ff', phone: '#8fb4ff', text: '#F3F4F8', dim: '#7C859C', red: '#e0484f',
};
const WARM = '255,201,74';

const mat = (color, rough = 0.9, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal, ...extra});
function box(parent, w, h, d, m, x, y, z, round = 0) {
  const g = round ? new RoundedBoxGeometry(w, h, d, 3, round) : new THREE.BoxGeometry(w, h, d);
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o;
}
const UP = new THREE.Vector3(0, 1, 0);
function limb(parent, a, b, r, m) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 12), m);
  o.position.copy(A).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(UP, d.normalize()); o.castShadow = true; parent.add(o); return o;
}
function textTex(draw, w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
const p01 = (t, a, b) => clamp01((t - a) / (b - a));
const F = (w, s) => `${w} ${s}px Inter, sans-serif`;

// window grid textures: `lit` = phone glow (cold blue rectangles low in the window) + a few warm lamps
function facadeTex(seed, cols, rows, mode) {
  return textTex((x, w, h) => {
    const r = rng(seed); x.clearRect(0, 0, w, h);
    if (mode === 'base') { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); }
    const cw = w / cols, ch = h / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const wx = i * cw + cw * 0.22, wy = j * ch + ch * 0.25, ww = cw * 0.56, wh = ch * 0.5;
      const v = r();
      if (mode === 'base') {
        x.fillStyle = v < 0.12 ? 'rgba(255,190,110,.75)' : '#0c0e14'; x.fillRect(wx, wy, ww, wh);
        x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(wx, wy, ww, 3);
      } else if (v > 0.12) {
        // the room lit by a phone screen: a soft blue glow, brighter near the bottom where the phone is
        const g = x.createRadialGradient(wx + ww * (0.3 + r() * 0.4), wy + wh * 0.85, 2, wx + ww / 2, wy + wh * 0.8, ww * 0.8);
        g.addColorStop(0, 'rgba(170,205,255,.95)'); g.addColorStop(1, 'rgba(60,100,200,.25)');
        x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
        // someone in the room, bent over the phone: head + shoulders against the glow
        if (r() < 0.7) { const cx = wx + ww * (0.3 + r() * 0.4), by = wy + wh; x.fillStyle = 'rgba(6,8,14,.92)';
          x.beginPath(); x.ellipse(cx, by - wh * 0.42, ww * 0.11, wh * 0.14, 0, 0, 7); x.fill();
          x.beginPath(); x.ellipse(cx, by - wh * 0.05, ww * 0.26, wh * 0.26, 0, Math.PI, 0); x.fill(); }
      }
    }
  }, 512, 512);
}

// ---------- people ----------
// A stylised but human figure: proportions, clothes, hair, glasses, hands, a face that can catch light.
// opts: {skin, top, bottom, shoes, hair: 'bald'|'short'|'bun'|'beanie'|'pony', hairCol, robe, glasses, belly, h (height scale), phone, mug, female}
const stripeTex = (a, b) => { const t = textTex((x, w, h) => { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(i * w / 16, 0, w / 16, h); } }, 256, 64); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); return t; };
function human(o = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const H = o.h || 1;
  const skin = mat(o.skin || '#d9dce2', 0.55), top = o.robe ? mat('#ffffff', 0.9, 0, {map: stripeTex(o.robe[0], o.robe[1])}) : mat(o.top || '#3b4252', 0.85);
  const bottom = mat(o.bottom || '#23262d', 0.85), shoes = mat(o.shoes || '#141414', 0.6);
  const W2 = o.female ? 0.92 : 1;
  // legs (trousers or bare shins under a robe) + shoes/slippers
  for (const s of [-1, 1]) {
    limb(body, [s * 0.09 * W2, 0.86, 0], [s * 0.1 * W2, 0.47, 0.01], o.robe ? 0.05 : 0.072, o.robe ? skin : bottom);
    limb(body, [s * 0.1 * W2, 0.47, 0.01], [s * 0.1 * W2, 0.08, -0.01], o.robe ? 0.042 : 0.062, o.robe ? skin : bottom);
    const f = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.07, 0.25, 3, 0.03), shoes); f.position.set(s * 0.1 * W2, 0.035, 0.05); body.add(f);
  }
  // torso: lathe profile (hips -> waist -> chest -> shoulders); a robe flares down to the knees
  const prof = o.robe
    ? [[0.001, 0.42], [0.25, 0.42], [0.22, 0.7], [0.19 + (o.belly ? 0.05 : 0), 0.98], [0.2, 1.22], [0.19, 1.4], [0.12, 1.47], [0.06, 1.5], [0.001, 1.5]]
    : [[0.001, 0.82], [0.17 * W2, 0.82], [0.16 * W2 + (o.belly ? 0.04 : 0), 0.98], [0.15 * W2 + (o.belly ? 0.05 : 0), 1.1], [0.18 * W2, 1.3], [0.18 * W2, 1.4], [0.12, 1.47], [0.06, 1.5], [0.001, 1.5]];
  const torso = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28), top); torso.scale.set(1, 1, 0.72); body.add(torso);
  if (o.robe) { const belt = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 8, 28), mat(o.robe[0], 0.9)); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.74, 1); belt.position.y = 0.98; body.add(belt); }
  // arms with hands; the right forearm can hold a phone in front of the chest, the left a mug
  const arm = (s, bent, item) => {
    const sh = [s * 0.21 * W2, 1.4, 0], el = bent ? [s * 0.23, 1.12, 0.06] : [s * 0.25 * W2, 1.1, 0.0], wr = bent ? [s * 0.08, 1.2, 0.27] : [s * 0.26 * W2, 0.84, 0.03];
    limb(body, sh, el, 0.055, top); limb(body, el, wr, 0.045, o.robe ? top : top);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), skin); hand.position.set(...wr); hand.scale.set(0.9, 1.1, 0.7); body.add(hand);
    if (item === 'phone') {
      const ph = new THREE.Group(); ph.position.set(wr[0] - s * 0.01, wr[1] + 0.06, wr[2] + 0.01); ph.rotation.x = -0.75; body.add(ph);
      ph.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.008), mat('#111', 0.4)));
      const scrM = new THREE.MeshBasicMaterial({color: new THREE.Color(P.phone).multiplyScalar(0.05), toneMapped: false});
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.13), scrM); scr.position.z = 0.005; scr.rotation.y = Math.PI; ph.add(scr);
      g.userData.screen = scrM; g.userData.phonePos = new THREE.Vector3(ph.position.x, ph.position.y + 0.12, ph.position.z - 0.05);
    }
    if (item === 'mug') { const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 18), mat('#b8442f', 0.5)); mug.position.set(wr[0], wr[1] + 0.02, wr[2] + 0.03); body.add(mug); }
  };
  arm(1, !!o.phone, o.phone ? 'phone' : null); arm(-1, false, o.mug ? 'mug' : null);
  limb(body, [0, 1.47, 0], [0, 1.55, 0.01], 0.052, skin);
  // head: a smooth faceless mannequin head; only clothing-type headwear (beanie, cap) and glasses
  const neck = new THREE.Group(); neck.position.set(0, 1.55, 0.01); body.add(neck);
  const head = new THREE.Group(); head.position.y = 0.115; neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.118, 28, 20), skin); skull.scale.set(0.9, 1.15, 1.0); head.add(skull);
  const hairM = mat(o.hatCol || '#7a2b2b', 0.9);
  if (o.hat === 'beanie') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.124, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM); b.position.y = 0.025; head.add(b); const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.016, 8, 28), hairM); cuff.rotation.x = Math.PI / 2; cuff.position.y = 0.03; head.add(cuff); }
  if (o.hat === 'cap') { const c = new THREE.Mesh(new THREE.SphereGeometry(0.122, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), hairM); c.position.y = 0.03; head.add(c); const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.01, 20, 1, false, -Math.PI / 2, Math.PI), hairM); brim.position.set(0, 0.05, 0.1); brim.scale.set(1, 1, 0.9); head.add(brim); }
  if (o.scarf) { const sc = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.035, 10, 24), mat(o.scarf, 0.95)); sc.rotation.x = Math.PI / 2; sc.position.y = 1.5; body.add(sc); }
  if (o.glasses) { const gm = mat('#111214', 0.3, 0.6); for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0045, 6, 20), gm); r.position.set(s * 0.042, 0.02, 0.112); head.add(r); } const br = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.004), gm); br.position.set(0, 0.025, 0.117); head.add(br); for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.11), gm); arm.position.set(s * 0.1, 0.022, 0.06); head.add(arm); } }
  // eyes rolled up to the sky, glowing (only the neighbour uses them)
  const eyes = new THREE.Group(); head.add(eyes);
  const em = new THREE.MeshBasicMaterial({color: new THREE.Color(P.white).multiplyScalar(1.5), toneMapped: false});
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 12, 10), em); e.position.set(s * 0.04, 0.03, 0.106); eyes.add(e); }
  eyes.visible = false;
  body.scale.setScalar(H);
  g.traverse((x) => { if (x.isMesh) x.castShadow = true; });
  Object.assign(g.userData, {neck, head, eyes, body});
  return g;
}
// a dog on a leash: body, head, ears, legs, tail
function dog(col = '#8a6a48') {
  const g = new THREE.Group(), m = mat(col, 0.85);
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.42, 6, 14), m); b.rotation.z = Math.PI / 2; b.position.y = 0.42; g.add(b);
  for (const [x, z] of [[0.2, 0.08], [0.2, -0.08], [-0.2, 0.08], [-0.2, -0.08]]) limb(g, [x, 0.38, z], [x, 0.02, z], 0.035, m);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), m); hd.position.set(0.42, 0.6, 0); g.add(hd);
  const sn = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.08, 4, 10), m); sn.rotation.z = Math.PI / 2; sn.position.set(0.53, 0.56, 0); g.add(sn);
  for (const z of [-0.06, 0.06]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 8), m); e.position.set(0.4, 0.71, z); g.add(e); }
  limb(g, [-0.32, 0.48, 0], [-0.46, 0.62, 0], 0.025, m);
  g.traverse((x) => { if (x.isMesh) x.castShadow = true; });
  return g;
}

function buildWorld(scene) {
  const M = {
    asphalt: mat(P.asphalt, 0.75), walk: mat(P.walk, 0.95), grass: mat(P.grass, 1), roof: mat(P.roof, 0.9),
    trunk: mat(P.trunk, 0.95), leaf: mat(P.leaf, 1), man: mat(P.man, 0.85), car: mat(P.car, 0.35, 0.6), metal: mat(P.metal, 0.4, 0.7),
    rail: mat('#101216', 0.5, 0.6), glass: mat('#0b0f18', 0.15, 0.3),
  };
  const world = new THREE.Group(); scene.add(world);
  box(world, 400, 0.1, 9, M.asphalt, 0, -0.05, 0);
  // lane markings
  for (let x = -100; x < 100; x += 6) box(world, 2.6, 0.012, 0.14, mat('#8a8470', 0.8), x, 0.01, 0);
  box(world, 400, 0.18, 3, M.walk, 0, 0.09, 6); box(world, 400, 0.18, 3, M.walk, 0, 0.09, -6);
  box(world, 400, 0.05, 60, M.grass, 0, -0.06, -37.5); box(world, 400, 0.05, 60, M.grass, 0, -0.06, 37.5);
  box(world, 2000, 0.05, 2000, mat('#0b0d0f', 1), 0, -0.12, 0);

  // houses on both sides: a box, a roof, a window texture and a phone-glow layer above it
  const glow = [];
  const r = rng(21);
  const house = (x, z, w, h, d, face, seed) => {
    const hm = mat(r() < 0.5 ? P.house : P.house2, 0.92);
    box(world, w, h, d, hm, x, h / 2, z);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.7072, 1, 4), M.roof); roof.rotation.y = Math.PI / 4; const rs = new THREE.Group(); rs.add(roof); rs.scale.set(w * 1.02, 2.2, d * 1.02); rs.position.set(x, h + 1.1, z); world.add(rs);
    const cols = Math.max(2, Math.round(w / 2.6)), rows = Math.max(1, Math.round(h / 3));
    const fz = z + face * (d / 2 + 0.02);
    const base = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.8), new THREE.MeshBasicMaterial({map: facadeTex(seed, cols, rows, 'base'), transparent: true}));
    base.position.set(x, h * 0.48, fz); if (face < 0) base.rotation.y = Math.PI; world.add(base);
    const gm = new THREE.MeshBasicMaterial({map: facadeTex(seed, cols, rows, 'glow'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color('#ffffff').multiplyScalar(1.6)});
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.8), gm); gl.position.set(x, h * 0.48, fz + face * 0.01); if (face < 0) gl.rotation.y = Math.PI; world.add(gl);
    glow.push({m: gm, d: Math.hypot(x, z)});
  };
  for (let x = -90; x <= 90; x += 11) {
    if (Math.abs(x) > 3) house(x + r() * 2, -14, 8 + r() * 2, 5 + r() * 3, 7, 1, 100 + x);
    house(x + 4 + r() * 2, 14.5, 8 + r() * 2, 5 + r() * 4, 7, -1, 300 + x);
  }
  // further blocks for the city view
  for (let i = 0; i < 70; i++) { const x = (r() - 0.5) * 220, z = (r() < 0.5 ? -1 : 1) * (28 + r() * 70); house(x, z, 8 + r() * 4, 4 + r() * 6, 8, z < 0 ? 1 : -1, 600 + i); }

  // the neighbour's house straight across (x=0), with a yard, a low fence and a porch light
  const nh = mat('#3a3633', 0.9); box(world, 10, 6.5, 7, nh, -0.5, 3.25, -15);
  const nroof = new THREE.Mesh(new THREE.ConeGeometry(8.4, 2.4, 4), M.roof); nroof.rotation.y = Math.PI / 4; nroof.scale.set(1, 1, 0.7); nroof.position.set(-0.5, 7.7, -15); world.add(nroof);
  box(world, 1.1, 2.2, 0.08, mat('#1c1a19', 0.6), 1.2, 1.1, -11.46);
  for (const wx of [-3.2, -0.6]) box(world, 1.3, 1.2, 0.06, mat('#0c0e14', 0.3), wx, 1.7, -11.46);
  for (let x = -5.5; x <= 4.5; x += 0.35) box(world, 0.06, 0.8, 0.06, mat('#3b3a37', 0.9), x, 0.4, -7.6);
  box(world, 10.2, 0.06, 0.05, mat('#3b3a37', 0.9), -0.5, 0.75, -7.6);
  const porch = new THREE.PointLight('#ffcf8a', 3, 7, 1.8); porch.position.set(1.2, 2.5, -10.8); world.add(porch);

  // our building's balcony (we stand on it): slab + rail in the foreground of the POV shots
  const balc = new THREE.Group(); world.add(balc);
  box(balc, 3.2, 0.18, 1.6, mat('#2b2d33', 0.9), 0.6, 3.9, 8.5);
  box(balc, 3.2, 0.05, 0.05, M.rail, 0.6, 4.95, 7.72);
  for (let x = -0.95; x <= 2.15; x += 0.12) box(balc, 0.02, 1.0, 0.02, M.rail, x, 4.45, 7.72);
  box(balc, 6, 4, 0.2, mat('#2a2c33', 0.92), 0.6, 6.0, 9.4);

  // trees and street lights along the sidewalks
  const lamps = [], lampHeads = [];
  for (let x = -66; x <= 66; x += 12) {
    for (const z of [-6.2, 6.2]) {
      const tx0 = x + 5 + r() * 2; if (r() < 0.75 && Math.abs(tx0) > 8 && !(tx0 > -22 && tx0 < -5)) { const tx = tx0; box(world, 0.25, 2.6, 0.25, M.trunk, tx, 1.3, z); const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.5 + r() * 0.5, 14, 10), M.leaf); leaf.position.set(tx, 3.6, z); leaf.castShadow = true; world.add(leaf); }
    }
    const z = (x + 66) % 24 === 0 ? -7.2 : 7.2;
    box(world, 0.12, 6, 0.12, M.metal, x, 3, z); box(world, 0.12, 0.1, 1.4, M.metal, x, 6, z - Math.sign(z) * 0.7);
    const hm = new THREE.MeshBasicMaterial({color: new THREE.Color(P.sodium).multiplyScalar(2.2), toneMapped: false});
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.25), hm); head.position.set(x, 5.94, z - Math.sign(z) * 1.3); world.add(head); lampHeads.push(hm);
    const L = new THREE.PointLight(P.sodium, 26, 16, 1.7); L.position.set(x, 5.6, z - Math.sign(z) * 1.3); world.add(L); lamps.push({L, x});
  }
  // a car stopped in the lane, lights on, driver frozen
  const car = new THREE.Group(); car.position.set(7, 0, 1.8); world.add(car);
  box(car, 4.2, 0.75, 1.8, M.car, 0, 0.62, 0, 0.12); box(car, 2.2, 0.6, 1.6, M.glass, -0.3, 1.25, 0, 0.12);
  for (const [x, z] of [[-1.4, 0.85], [1.35, 0.85], [-1.4, -0.85], [1.35, -0.85]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 18), mat('#0a0a0c', 0.8)); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.34, z); car.add(wh); }
  const hlm = new THREE.MeshBasicMaterial({color: new THREE.Color('#fff4dc').multiplyScalar(2.5), toneMapped: false});
  for (const z of [-0.6, 0.6]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.32), hlm); h.position.set(-2.11, 0.7, z); car.add(h); }
  const hl = new THREE.SpotLight('#fff1d6', 40, 30, 0.45, 0.6, 1.4); hl.position.set(5, 0.75, 1.8); hl.target.position.set(-10, 0, 1.8); world.add(hl, hl.target);
  const tl = new THREE.MeshBasicMaterial({color: new THREE.Color(P.red).multiplyScalar(2), toneMapped: false});
  for (const z of [-0.6, 0.6]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.28), tl); h.position.set(2.11, 0.72, z); car.add(h); }

  // the neighbour, in his yard, facing the street (+z) and us
  // the neighbour: retired, bald, glasses, striped bathrobe, slippers, a mug of tea at 2 a.m.
  const man = human({skin: '#e3e5ea', robe: ['#7a2531', '#e6dbc4'], glasses: true, belly: true, mug: true, shoes: '#6b5640'});
  man.position.set(0.3, 0, -9.4); man.rotation.y = Math.PI / 2; man.userData.neck.rotation.order = 'YXZ'; world.add(man);   // faces down the street (+x)
  // people out on the street when the message lands (opening shot)
  const crowd = [];
  const add = (o, x, z, ry) => { const p = human({phone: true, ...o}); p.position.set(x, 0.18, z); p.rotation.y = ry; world.add(p); const L = new THREE.PointLight(P.phone, 0, 1.4, 2); world.add(L); crowd.push({p, L}); return p; };
  add({female: true, skin: '#16171b', top: '#6b7f5a', bottom: '#1f2430', scarf: '#c9a227'}, -12, 6.1, -2.0);
  const d = dog(); d.position.set(-11.3, 0.18, 6.9); d.rotation.y = 2.6; world.add(d);
  limb(world, [-11.85, 1.0, 6.3], [-11.55, 0.62, 6.8], 0.006, mat('#b33', 0.6));
  add({hat: 'beanie', hatCol: '#c23b2f', top: '#2b3b5c', bottom: '#111317', skin: '#e3e5ea', h: 1.04}, -8.6, -5.9, Math.PI * 0.85);
  add({hat: 'cap', hatCol: '#22324a', top: '#5a4636', bottom: '#2a2d36', skin: '#16171b'}, -15.2, -6.2, 0.2);
  add({female: true, top: '#8a3c4f', bottom: '#23262d', skin: '#e3e5ea', h: 0.95, glasses: true}, -14.6, -6.3, -0.3);
  return {M, world, glow, lamps, lampHeads, man, car, hl, porch, crowd};
}

// sky: gradient dome + stars; the ship: a dark disc that blots out the stars, rim-lit
function buildSky(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0); vec3 c = mix(vec3(0.07,0.08,0.14), vec3(0.012,0.016,0.035), pow(h, 0.45)); gl_FragColor = vec4(c, 1.0); }',
  }));
  scene.add(sky);
  const r = rng(5), pos = [], sz = [];
  for (let i = 0; i < 2200; i++) { const th = r() * Math.PI * 2, ph = Math.acos(0.15 + r() * 0.85); pos.push(Math.sin(ph) * Math.cos(th) * 450, Math.cos(ph) * 450, Math.sin(ph) * Math.sin(th) * 450); sz.push(r()); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('sz', new THREE.Float32BufferAttribute(sz, 1));
  const stars = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: {uT: {value: 0}, uScale: {value: H}}, transparent: true, depthWrite: false,
    vertexShader: 'attribute float sz; uniform float uT; uniform float uScale; varying float vA; void main(){ vA = 0.45 + 0.55 * sin(uT * (0.6 + sz) + sz * 50.0); vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = (1.0 + sz * 2.2) * uScale / 1920.0; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.85,0.9,1.0) * smoothstep(0.5, 0.0, d) * vA, 1.0); }',
    blending: THREE.AdditiveBlending,
  }));
  scene.add(stars);
  const ship = new THREE.Group(); ship.position.set(0, 70, -20); scene.add(ship);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(80, 92, 5, 96, 1), new THREE.MeshBasicMaterial({color: '#020205'})); ship.add(disc);
  const under = new THREE.Mesh(new THREE.CircleGeometry(80, 96), new THREE.MeshBasicMaterial({color: '#05060c'})); under.rotation.x = Math.PI / 2; under.position.y = -2.6; ship.add(under);
  const rimM = new THREE.MeshBasicMaterial({color: new THREE.Color('#dfe8ff').multiplyScalar(1.3), toneMapped: false, transparent: true, opacity: 0});
  const rim = new THREE.Mesh(new THREE.TorusGeometry(91, 0.6, 8, 160), rimM); rim.rotation.x = Math.PI / 2; rim.position.y = -1.8; ship.add(rim);
  for (const [rad, n] of [[70, 64], [52, 48], [34, 32], [18, 16]]) for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const l = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10), rimM); l.rotation.x = Math.PI / 2; l.position.set(Math.cos(a) * rad, -2.7, Math.sin(a) * rad); ship.add(l); }
  const coreM = new THREE.MeshBasicMaterial({color: new THREE.Color(P.white).multiplyScalar(2.5), toneMapped: false, transparent: true, opacity: 0});
  const core = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), coreM); core.rotation.x = Math.PI / 2; core.position.set(0.3, -2.8, 10.6); ship.add(core);
  return {sky, stars, ship, rimM, coreM};
}

// the white light falling on the neighbour: an additive cone (no shadows) + a spot that does the lighting
function beam() {
  const g = new THREE.CylinderGeometry(0.6, 3.2, 120, 48, 1, true); g.translate(0, 60, 0);
  const m = new THREE.ShaderMaterial({
    uniforms: {uI: {value: 0}, uT: {value: 0}}, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vL; varying vec3 vN; varying vec3 vV; void main(){ vL = position; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform float uI; uniform float uT; varying vec3 vL; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(1.0 - abs(dot(vN, vV)), 1.6); float fall = smoothstep(0.0, 6.0, vL.y) * exp(-vL.y * 0.012) + smoothstep(2.0, 0.0, vL.y) * 0.3; float shim = 0.85 + 0.15 * sin(vL.y * 0.8 - uT * 3.0); gl_FragColor = vec4(vec3(0.85,0.9,1.0) * (1.0 - edge * 0.85) * fall * shim * 0.11 * uI, 1.0); }',
  });
  return new THREE.Mesh(g, m);
}

// phone screen (lock screen + the notification)
const SW = 760, SH = 1640;
function drawPhone(c, t, mode) {
  const g = c.createLinearGradient(0, 0, SW, SH); g.addColorStop(0, '#16203e'); g.addColorStop(1, '#070a14'); c.fillStyle = g; c.fillRect(0, 0, SW, SH);
  c.fillStyle = '#000'; c.beginPath(); c.roundRect(SW / 2 - 110, 26, 220, 60, 30); c.fill();
  c.textAlign = 'center'; c.fillStyle = 'rgba(233,236,244,.75)'; c.font = F(600, 34); c.fillText('Friday', SW / 2, 230);
  c.fillStyle = P.text; c.font = F(700, 190); c.fillText(t < 30 ? '2:14' : '2:16', SW / 2, 420);
  const k = easeOutCubic(p01(t, TL.notifAt, TL.notifAt + 0.5));
  if (mode === 'phone' && k <= 0) return;
  const card = (y, title, body, col, kk) => {
    c.save(); c.globalAlpha = kk; c.translate(0, (1 - kk) * 40);
    c.fillStyle = 'rgba(28,32,48,.94)'; c.beginPath(); c.roundRect(36, y, SW - 72, 230, 40); c.fill();
    c.fillStyle = '#0a0b10'; c.beginPath(); c.roundRect(66, y + 34, 72, 72, 18); c.fill();
    c.strokeStyle = 'rgba(233,236,244,.5)'; c.lineWidth = 3; c.beginPath(); c.arc(102, y + 70, 18, 0, 7); c.stroke();
    c.textAlign = 'left'; c.fillStyle = P.dim; c.font = F(600, 26); c.fillText(title, 162, y + 62); c.textAlign = 'right'; c.fillText('now', SW - 70, y + 62);
    c.textAlign = 'left'; c.fillStyle = col; c.font = F(800, 56); c.fillText(body, 162, y + 150);
    c.restore();
  };
  if (mode === 'phone2') {
    const k2 = easeOutCubic(p01(t, TL.newLineAt, TL.newLineAt + 0.45));
    card(560 + 250 * k2, 'NO CALLER ID', 'Do not look up.', P.text, 1);
    if (k2 > 0) card(560, 'NO CALLER ID', 'He looked.', P.red, k2);
  } else card(560, 'NO CALLER ID', 'Do not look up.', P.text, mode === 'msg' ? 1 : k);
}

// grade: split tone, CA, vignette, grain
const GRADE = {
  uniforms: {tDiffuse: {value: null}, uT: {value: 0}, uRes: {value: new THREE.Vector2(W, H)}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uT; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5, d = c * 0.0018;
      vec3 col = vec3(texture2D(tDiffuse, vUv + d).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d).b);
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col *= mix(vec3(0.92, 0.98, 1.08), vec3(1.0), smoothstep(0.0, 0.5, l));
      col *= mix(vec3(1.0), vec3(1.05, 1.0, 0.95), smoothstep(0.5, 1.0, l));
      float v = smoothstep(1.0, 0.3, length(c * vec2(1.05, 0.9)));
      col *= mix(0.3, 1.0, v);
      col += (h(vUv * uRes + floor(uT * 30.0) * 17.0) - 0.5) * 0.045;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// captions: 1–3 word chunks, one key word in warm yellow
const KEY = new Set(['phone', 'earth', 'message', 'billion', 'look', 'up', 'neighbor', 'quiet', 'white', 'light', 'looked', 'sky', 'eyes', 'toward', 'buzzes']);
const CHUNKS = [];
for (const L of LINES) {
  const phrases = []; let cur = [];
  for (const w of L.words) { cur.push(w); if (/[.,?!…]["']?$/.test(w[0])) { phrases.push(cur); cur = []; } }
  if (cur.length) phrases.push(cur);
  for (const ph of phrases) { const n = Math.ceil(ph.length / 3), size = Math.ceil(ph.length / n); for (let i = 0; i < ph.length; i += size) { const g = ph.slice(i, i + size); CHUNKS.push({words: g.map((w) => w[0]), t0: g[0][1], t1: g[g.length - 1][2]}); } }
}
CHUNKS.forEach((ch, i) => { const nx = CHUNKS[i + 1]; ch.end = nx ? Math.min(nx.t0, ch.t1 + 0.6) : ch.t1 + 0.8; });
const clean = (w) => (/^a\.m/i.test(w) ? 'AM' : w.replace(/^["“]+/, '').replace(/\.\.\.$/, '').replace(/["”]$/, '').replace(/[.,?!]$/, '').replace(/["”]$/, '').replace(/[.,?!]$/, ''));
function captions(c, t) {
  const ch = CHUNKS.find((k) => t >= k.t0 - 0.04 && t < k.end); if (!ch) return;
  const a = easeOutCubic(p01(t, ch.t0 - 0.04, ch.t0 + 0.1)), out = 1 - p01(t, ch.end - 0.08, ch.end);
  const words = ch.words.map(clean).map((s) => s.toUpperCase());
  const hi = words.findIndex((w) => KEY.has(w.toLowerCase().replace(/[^a-z0-9]/g, '')));
  c.save(); c.globalAlpha = a * out;
  const y0 = 1330, sg = c.createRadialGradient(W / 2, y0, 0, W / 2, y0, 560); sg.addColorStop(0, 'rgba(2,3,8,.62)'); sg.addColorStop(1, 'rgba(2,3,8,0)');
  c.save(); c.translate(W / 2, y0); c.scale(1, 0.26); c.translate(-W / 2, -y0); c.fillStyle = sg; c.fillRect(0, y0 - 560, W, 1120); c.restore();
  c.font = F(900, 76); c.textAlign = 'left'; c.letterSpacing = '1px';
  const sp = 22, ws = words.map((w) => c.measureText(w).width), total = ws.reduce((x, y) => x + y, 0) + sp * (words.length - 1);
  let x = W / 2 - total / 2; const y = y0 + 25 + (1 - a) * 12;
  c.shadowColor = 'rgba(0,0,0,.85)'; c.shadowBlur = 24; c.shadowOffsetY = 4;
  words.forEach((w, i) => { c.fillStyle = i === hi ? `rgb(${WARM})` : P.text; c.fillText(w, x, y); x += ws[i] + sp; });
  c.restore();
}
function hud(c, t) {
  c.save(); c.globalAlpha = p01(t, 0.4, 1.2); c.textAlign = 'left';
  c.fillStyle = P.red; c.beginPath(); c.arc(84, 196, 9, 0, 7); c.fill();
  c.fillStyle = 'rgba(233,236,244,.75)'; c.font = F(700, 24); c.letterSpacing = '5px'; c.fillText(TL.night, 104, 205);
  c.letterSpacing = '0px'; c.fillStyle = P.text; c.font = F(800, 72); const ct = t < 30 ? '2:14' : t < 44 ? '2:15' : '2:16', tw = c.measureText(ct).width; c.fillText(ct, 70, 288);
  c.font = F(700, 30); c.fillStyle = 'rgba(233,236,244,.7)'; c.fillText('AM', 70 + tw + 12, 288);
  c.restore();
}

const SHOTS = TL.shots.map(([name, t0], i) => ({name, t0, t1: (TL.shots[i + 1] || [0, TL.duration])[1], i}));
const shotAt = (t) => SHOTS.filter((s) => t >= s.t0).pop() || SHOTS[0];
const breathe = (t, a = 1) => [(Math.sin(t * 0.53) * 0.01 + Math.sin(t * 1.21 + 1.3) * 0.004) * a, (Math.sin(t * 0.41 + 0.7) * 0.008 + Math.sin(t * 1.07 + 2.1) * 0.003) * a, Math.sin(t * 0.37 + 0.4) * 0.004 * a];

runSim(DEFAULTS, async ({cfg, canvas, hud: hudKit, capture}) => {
  await Promise.all([900, 800, 700, 600, 500].map((w) => document.fonts.load(F(w, 40)))).catch(() => {});
  const st = createStage(canvas, hudKit, {bg: P.night, capture, fov: 40, exposure: 1.5, bloom: {strength: 0.42, radius: 0.55, threshold: 0.8}});
  const {renderer, scene, camera, composer} = st;
  composer.renderTarget1.samples = composer.renderTarget2.samples = 2;
  camera.near = 0.02; camera.far = 1200;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.fog = new THREE.FogExp2(P.night, 0.012);
  const bokeh = new BokehPass(scene, camera, {focus: 0.26, aperture: 0.01, maxblur: 0.012});
  composer.insertPass(bokeh, 1);
  const grade = new ShaderPass(GRADE); composer.addPass(grade);

  const world = buildWorld(scene);
  const sky = buildSky(scene);
  const hemi = new THREE.HemisphereLight('#2c3550', '#0a0b0d', 0.55); scene.add(hemi);
  const moon = new THREE.DirectionalLight('#9fb2e0', 0.7); moon.position.set(-30, 50, 20); scene.add(moon);
  const top = new THREE.SpotLight(P.white, 0, 60, 0.12, 0.5, 1.0); top.position.set(0.3, 45, -9.4); top.target.position.set(0.3, 0, -9.4); top.castShadow = true; top.shadow.mapSize.set(1024, 1024); scene.add(top, top.target);
  const cone = beam(); cone.position.set(0.3, 0, -9.4); scene.add(cone);
  const phoneLight = new THREE.PointLight(P.phone, 0, 2.5, 2); scene.add(phoneLight);

  // phone on the camera (for the phone shots); street blurred behind it
  const phone = new THREE.Group(); camera.add(phone); scene.add(camera);
  phone.add(new THREE.Mesh(new RoundedBoxGeometry(0.0715, 0.1545, 0.0078, 4, 0.0035), mat('#1b1f28', 0.35, 0.85)));
  const scr = document.createElement('canvas'); scr.width = SW; scr.height = SH; const sc = scr.getContext('2d');
  const scrTex = new THREE.CanvasTexture(scr); scrTex.colorSpace = THREE.SRGBColorSpace; scrTex.anisotropy = 8;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.0655, 0.142), new THREE.MeshBasicMaterial({map: scrTex, toneMapped: false, transparent: true, color: '#e8ecf6'}));
  screen.position.z = 0.0041; phone.add(screen);

  const ov = document.createElement('canvas'); ov.id = 'ov'; ov.width = W; ov.height = H; document.getElementById('app').appendChild(ov);
  const oc = ov.getContext('2d');
  const look = (pos, tgt, fov) => { camera.position.set(...pos); camera.up.set(0, 1, 0); camera.lookAt(...tgt); camera.fov = fov; camera.updateProjectionMatrix(); };
  const EYE = [0.5, 5.55, 8.15];          // standing on our balcony
  const HEAD = [0.3, 1.7, -9.4];          // the neighbour's head

  function apply(t) {
    const sh = shotAt(t), lt = t - sh.t0, dur = sh.t1 - sh.t0, k = easeInOutCubic(p01(lt, 0, dur));
    const [bx, by, br] = breathe(t);
    // phones light up across the city: a wave from the centre outwards
    for (const g of world.glow) g.m.opacity = 0.9 * easeOutCubic(p01(t, TL.glowAt + g.d * 0.012, TL.glowAt + 0.35 + g.d * 0.012));
    // the street goes dead: lamps die one by one, the car's lights go out
    world.lamps.forEach(({L, x}, i) => { const off = p01(t, TL.lightsDie[0] + (x + 60) / 120 * (TL.lightsDie[1] - TL.lightsDie[0]) - 0.15, TL.lightsDie[0] + (x + 60) / 120 * (TL.lightsDie[1] - TL.lightsDie[0])); const f = 1 - off; L.intensity = 26 * f; world.lampHeads[i].color.set(P.sodium).multiplyScalar(2.2 * f + 0.05); });
    world.crowd.forEach(({p, L}, i) => { const on = easeOutCubic(p01(t, TL.glowAt + 0.15 * i, TL.glowAt + 0.15 * i + 0.3)); p.userData.screen.color.set(P.phone).multiplyScalar(0.05 + 1.3 * on); const wp = p.localToWorld(p.userData.phonePos.clone()); L.position.copy(wp); L.intensity = 0.45 * on; });
    const carOff = p01(t, TL.lightsDie[1] - 0.6, TL.lightsDie[1] - 0.4); world.hl.intensity = 40 * (1 - carOff);
    world.porch.intensity = 3 * (1 - p01(t, TL.lightsDie[1] - 0.3, TL.lightsDie[1]));
    // white light from above on the neighbour
    const b = easeInOutCubic(p01(t, TL.beamUp[0], TL.beamUp[1])) * (t > TL.shipReveal[0] ? 1.3 : 1) + (t > 16 && t < TL.beamUp[0] ? 0.35 : 0);
    cone.material.uniforms.uI.value = b * (['face', 'eyes'].includes(sh.name) ? 0.45 : 1); cone.material.uniforms.uT.value = t; top.intensity = (['face', 'eyes'].includes(sh.name) ? 260 : 700) * b;
    // neighbour: head tipped back; at headTurn the head turns to us while the eyes stay pointed at the sky
    const turn = easeInOutCubic(p01(t, ...TL.headTurn));
    const {neck, eyes} = world.man.userData;
    neck.rotation.x = -0.75 * (1 - turn) + 0.05 * turn; neck.rotation.y = -Math.PI / 2 * turn;
    eyes.visible = t > TL.eyesOn - 1.5;
    eyes.children.forEach((e) => (e.scale.setScalar(easeOutCubic(p01(t, TL.eyesOn - 1.5, TL.eyesOn)))));
    world.man.visible = t > 15;
    // ship: invisible against the black until the last shot, then its rim and core light
    const sr = easeInOutCubic(p01(t, ...TL.shipReveal));
    sky.rimM.opacity = sr; sky.coreM.opacity = Math.max(sr, b * 0.6);
    sky.stars.material.uniforms.uT.value = t;
    grade.uniforms.uT.value = t;
    scene.fog.density = 0.012;
    phone.visible = ['phone', 'msg', 'phone2'].includes(sh.name); bokeh.enabled = phone.visible;
    phoneLight.intensity = 0;

    if (sh.name === 'city') {
      const kc = easeInOutCubic(p01(lt, 0, dur * 0.95)); look([lerp(-36, -15.6, kc), lerp(19, 1.75, kc), lerp(-1.5, 4.3, kc)], [lerp(-10, -12.1, kc), lerp(0.5, 1.5, kc), lerp(-1, 6.0, kc)], lerp(50, 34, kc)); scene.fog.density = 0.006;
    } else if (sh.name === 'phone' || sh.name === 'msg' || sh.name === 'phone2') {
      look([EYE[0] + bx, EYE[1] + by - 0.05, EYE[2]], HEAD, 40); camera.rotateZ(br);
      let z = lerp(-0.27, -0.25, k), y = -0.004;
      if (sh.name === 'msg') { const d = easeInOutCubic(p01(lt, 0, 2.4)); z = lerp(-0.25, -0.15, d); y = lerp(-0.004, 0.035, d); }
      if (sh.name === 'phone2') { const d = easeInOutCubic(p01(t, TL.newLineAt - 3.0, TL.newLineAt - 0.6)); z = lerp(-0.26, -0.17, d); y = lerp(-0.004, 0.03, d); }
      phone.position.set(Math.sin(t * 0.8) * 0.0015, y + Math.sin(t * 0.6 + 1) * 0.001, z);
      phone.rotation.set(-0.08 + Math.sin(t * 0.5) * 0.008, Math.sin(t * 0.43) * 0.01, 0);
      sc.clearRect(0, 0, SW, SH); drawPhone(sc, t, sh.name);
      sc.save(); sc.globalCompositeOperation = 'destination-in'; sc.beginPath(); sc.roundRect(0, 0, SW, SH, 90); sc.fill(); sc.restore(); scrTex.needsUpdate = true;
      bokeh.uniforms.focus.value = -z; bokeh.uniforms.aperture.value = 0.012;
      const wp = new THREE.Vector3(); phone.getWorldPosition(wp); phoneLight.position.copy(wp); phoneLight.intensity = 0.5 * (sh.name === 'phone' ? easeOutCubic(p01(t, TL.notifAt - 0.2, TL.notifAt)) : 1);
    } else if (sh.name === 'balcony') {
      look([lerp(1.4, 0.8, k) + bx, 5.45 + by, lerp(9.15, 8.75, k)], [0.3, 1.6, -9.4], lerp(40, 30, k));
    } else if (sh.name === 'neighbor') {
      look([lerp(2.9, 2.6, k) + bx * 0.5, 0.95 + by * 0.5, lerp(-8.0, -8.3, k)], [0.3, 1.95, -9.4], 30);
    } else if (sh.name === 'street') {
      look([lerp(-14, -9, k) + bx, 1.5 + by, 3.6], [6, 1.4, -2], 44);
    } else if (sh.name === 'face') {
      look([lerp(1.9, 1.5, k) + bx * 0.5, lerp(1.75, 1.85, k) + by * 0.5, lerp(-8.3, -8.7, k)], [0.3, 1.88, -9.4], lerp(30, 20, k));
    } else if (sh.name === 'turn') {
      look([EYE[0] + bx * 0.3, EYE[1] + by * 0.3, EYE[2]], [0.3, 1.5, -9.4], lerp(9, 5.5, k)); camera.rotateZ(br);
    } else if (sh.name === 'eyes') {
      look([lerp(0.4, 0.35, k) + bx * 0.3, lerp(1.95, 1.9, k), lerp(-7.0, -7.7, k)], [0.3, 1.8, -9.4], lerp(26, 18, k));
    } else if (sh.name === 'sky' || sh.name === 'title') {
      const tilt = easeInOutCubic(p01(t, SHOTS.find((s) => s.name === 'sky').t0, TL.shipReveal[1]));
      look([EYE[0] + bx, EYE[1] + by, EYE[2]], [lerp(0.3, 0.2, tilt), lerp(1.7, 120, tilt), lerp(-9.4, -14, tilt)], lerp(34, 70, tilt));
    }
  }

  return {
    render(t) {
      const sh = shotAt(t);
      oc.globalAlpha = 1; oc.fillStyle = '#000'; oc.fillRect(0, 0, W, H);
      apply(t); composer.render();
      oc.imageSmoothingQuality = 'high'; oc.drawImage(canvas, 0, 0, W, H);
      // short dip to black between shots (cut feel without a hard pop)
      const since = t - sh.t0; if (sh.i > 0 && since < 0.12) { oc.fillStyle = `rgba(0,0,0,${1 - since / 0.12})`; oc.fillRect(0, 0, W, H); }
      // flash on "He looked."
      const fl = Math.max(0, 1 - Math.abs(t - TL.newLineAt) / 0.25); if (fl > 0 && sh.name === 'phone2') { oc.fillStyle = `rgba(255,255,255,${fl * 0.18})`; oc.fillRect(0, 0, W, H); }
      if (['balcony', 'street', 'turn'].includes(sh.name)) hud(oc, t);
      if (sh.name === 'title') {
        const a = easeInOutCubic(p01(t, sh.t0, sh.t0 + 0.6)); oc.fillStyle = `rgba(0,0,0,${0.75 * a})`; oc.fillRect(0, 0, W, H);
        const tt = easeOutCubic(p01(t, sh.t0 + 0.2, sh.t0 + 1.2));
        oc.save(); oc.globalAlpha = tt; oc.textAlign = 'center'; oc.fillStyle = P.text; oc.font = F(800, 70); oc.letterSpacing = '10px'; oc.fillText(TL.endTitle, W / 2 + 5, 900 + (1 - tt) * 16);
        oc.letterSpacing = '10px'; oc.fillStyle = `rgb(${WARM})`; oc.font = F(600, 32); oc.fillText('WHAT IF AT 2:14', W / 2 + 5, 990); oc.restore();
      }
      if (!cfg.noCaptions && sh.name !== 'title') captions(oc, t);
      return {};
    },
    resize() { st.resize(); renderer.setPixelRatio(GL_SCALE); renderer.setSize(W, H, false); composer.setPixelRatio(GL_SCALE); composer.setSize(W, H); },
  };
});
