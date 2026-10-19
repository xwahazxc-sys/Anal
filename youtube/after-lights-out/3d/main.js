import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {runSim} from '../kit/runtime.js';
import {createStage} from '../kit/stage3d.js';
import {clamp01, easeInOutCubic, easeOutCubic, keyed, lerp, prog, rng} from '../kit/util.js';
import {drawScreen, SW, SH, clockText} from './chat.js';
import TL from './timeline.json';
import LINES from './lines.json';

// "After Lights Out", ep.1 "The Group Chat": a 9:16 horror short in one small
// 3D apartment (4B) and the hallway outside it. Moonlight through the blinds,
// a phone, a group chat that sees someone you can't. Voice and sound are
// ElevenLabs files mixed separately on the same timeline (see README).

const W = 1080, H = 1920, FPS = 30;
const GL_SCALE = 0.8;   // 3D renders at 864x1536 and is upscaled; titles and captions are drawn at full 1080x1920
const DEFAULTS = {duration: TL.duration, fps: FPS, theme: 'dark', hud: {enabled: false, title: 'lightsout', subtitle: ''}, director: {enabled: false}, watermark: '', seed: 4};

// palette: everything on screen comes from here
const P = {
  night: '#07090f', wall: '#2a2d37', ceil: '#1e2029', floor: '#17161b', fabric: '#262a37', duvet: '#2e3446', pillow: '#3c4256',
  wood: '#1a1d29', door: '#141927', hallWall: '#3b423e', hallFloor: '#2b302d', hallDoor: '#202624',
  hoodie: '#0b0d12', him: '#020203', screen: '#0A0D16',
  moon: '#aebde8', cool: '#cbd7f5', warm: '#ffc94a', tube: '#dfe8dc', red: '#d9484e',
  text: '#F3F4F8', dim: '#7C859C',
};
const WARM = '255,201,74', COOL = '170,195,255';

// ---------- small builders ----------
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
function radialTex(inner = 'rgba(255,255,255,1)') { return textTex((x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, inner); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }, 256, 256); }

// seated hooded figure, hips at origin, facing -z
function hooded(m) {
  const g = new THREE.Group(), up = new THREE.Group(); g.add(up);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.3, 6, 16), m); torso.scale.set(1.15, 1, 0.78); torso.position.y = 0.33; torso.castShadow = true; up.add(torso);
  limb(up, [-0.17, 0.56, 0], [0.17, 0.56, 0], 0.085, m);                                     // shoulders
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 18), m); hood.scale.set(1, 1.12, 1.15); hood.position.set(0, 0.79, 0.02); hood.castShadow = true; up.add(hood);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.085, 24), new THREE.MeshBasicMaterial({color: '#000'})); face.position.set(0, 0.77, -0.142); face.rotation.y = Math.PI; up.add(face);
  for (const s of [-1, 1]) {
    limb(up, [s * 0.2, 0.54, 0], [s * 0.17, 0.3, -0.16], 0.055, m);                           // upper arm
    limb(up, [s * 0.17, 0.3, -0.16], [s * 0.05, 0.42, -0.32], 0.045, m);                      // forearm to phone
    limb(g, [s * 0.1, 0.06, 0], [s * 0.1, 0.06, -0.42], 0.08, m);                              // thigh
    limb(g, [s * 0.1, 0.06, -0.42], [s * 0.1, -0.4, -0.46], 0.06, m);                          // shin
  }
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.15, 0.008), new THREE.MeshBasicMaterial({color: P.cool}));
  phone.position.set(0, 0.45, -0.33); phone.rotation.x = -0.9; up.add(phone);
  g.userData = {up, phone};
  return g;
}

// the tall one: standing, facing -z, feet at origin
function tall(m) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    limb(g, [s * 0.09, 1.05, 0], [s * 0.1, 0.05, 0.02], 0.048, m);                             // legs
    limb(g, [s * 0.2, 1.7, 0], [s * 0.25, 1.12, 0.03], 0.036, m);                              // upper arms
    limb(g, [s * 0.25, 1.12, 0.03], [s * 0.24, 0.58, 0.0], 0.03, m);                           // too-long forearms
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 6, 16), m); torso.scale.set(1.3, 1, 0.66); torso.position.y = 1.38; g.add(torso);
  limb(g, [-0.2, 1.71, 0], [0.2, 1.71, 0], 0.06, m);
  limb(g, [0, 1.74, 0], [0, 1.86, 0.01], 0.04, m);                                              // neck
  const head = new THREE.Group(); head.position.set(0, 1.86, 0.01); g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), m); skull.scale.set(0.92, 1.32, 1); skull.position.y = 0.12; head.add(skull);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = {head};
  return g;
}

// ---------- world ----------
function buildWorld(scene) {
  const M = {
    wall: mat(P.wall), ceil: mat(P.ceil), floor: null, fabric: mat(P.fabric, 0.95), duvet: mat(P.duvet, 0.95), pillow: mat(P.pillow, 0.95),
    wood: mat(P.wood, 0.7), door: mat(P.door, 0.6), metal: mat('#6d7280', 0.35, 0.8), hallWall: mat(P.hallWall, 0.9), hallDoor: mat(P.hallDoor, 0.6),
    hoodie: mat(P.hoodie, 0.85), him: new THREE.MeshBasicMaterial({color: P.him}), black: mat('#05070c', 0.6),
  };
  // floor planks
  const planks = textTex((x, w, h) => {
    x.fillStyle = P.floor; x.fillRect(0, 0, w, h); const r = rng(9);
    for (let i = 0; i < 16; i++) { x.fillStyle = `rgba(${40 + r() * 20},${36 + r() * 16},${44 + r() * 18},.55)`; x.fillRect(0, i * h / 16, w, h / 16 - 2); x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(0, (i + 1) * h / 16 - 2, w, 2); x.fillRect(((i * 0.37) % 1) * w, i * h / 16, 2, h / 16); }
  }, 1024, 1024);
  planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(2, 2);
  M.floor = mat('#ffffff', 0.62, 0, {map: planks});
  const room = new THREE.Group(); scene.add(room);
  box(room, 6, 0.1, 7, M.floor, 0, -0.05, 0);                                       // floor
  box(room, 6.2, 0.1, 7.2, M.ceil, 0, 2.75, 0);                                     // ceiling
  box(room, 0.1, 2.8, 7.2, M.wall, 3.05, 1.35, 0);                                  // east
  box(room, 6.2, 2.8, 0.1, M.wall, 0, 1.35, 3.55);                                  // south
  // north wall with the front door opening (x 0.6..1.55, y 0..2.1)
  box(room, 3.65, 2.8, 0.1, M.wall, -1.225, 1.35, -3.55); box(room, 1.5, 2.8, 0.1, M.wall, 2.3, 1.35, -3.55); box(room, 0.95, 0.65, 0.1, M.wall, 1.075, 2.425, -3.55);
  // west wall with the window opening (z -0.6..1.0, y 0.95..2.25)
  box(room, 0.1, 2.8, 3.8, M.wall, -3.05, 1.35, -1.7); box(room, 0.1, 2.8, 1.2, M.wall, -3.05, 1.35, 3.0);
  box(room, 0.1, 0.95, 2.2, M.wall, -3.05, 0.475, 1.3); box(room, 0.1, 0.5, 2.2, M.wall, -3.05, 2.5, 1.3);
  // blinds: tilted slats the moon falls through
  const slat = mat('#2b3245', 0.8);
  for (let y = 0.99; y < 2.24; y += 0.07) { const s = box(room, 0.045, 0.006, 2.18, slat, -2.98, y, 1.3); s.rotation.z = 0.5; }
  // outside: night city backdrop
  const city = textTex((x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1230'); g.addColorStop(1, '#141b38'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const r = rng(3); x.fillStyle = '#05070f';
    for (let i = 0; i < 14; i++) { const bw = 40 + r() * 90, bh = 120 + r() * 300, bx = r() * w; x.fillRect(bx, h - bh, bw, bh); for (let j = 0; j < 24; j++) if (r() < 0.25) { x.fillStyle = r() < 0.5 ? `rgba(${WARM},.7)` : `rgba(${COOL},.5)`; x.fillRect(bx + 6 + (j % 4) * (bw / 4.3), h - bh + 10 + Math.floor(j / 4) * 22, 6, 9); x.fillStyle = '#05070f'; } }
    x.fillStyle = 'rgba(210,222,255,.9)'; x.beginPath(); x.arc(w * 0.3, h * 0.2, 22, 0, 7); x.fill();
  }, 1024, 512);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({map: city, color: '#8090b0'})); sky.position.set(-7, 2.2, 1.3); sky.rotation.y = Math.PI / 2; scene.add(sky);
  // front door from inside; 1.5 cm gap at the bottom
  box(room, 0.95, 2.085, 0.05, M.door, 1.075, 1.0575, -3.55);
  box(room, 0.03, 0.03, 0.12, M.metal, 1.45, 1.0, -3.5);
  const peep = new THREE.Mesh(new THREE.CircleGeometry(0.008, 16), new THREE.MeshBasicMaterial({color: P.warm})); peep.position.set(1.075, 1.55, -3.52); room.add(peep);
  const gap = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.016), new THREE.MeshBasicMaterial({color: new THREE.Color(P.warm).multiplyScalar(1.7), toneMapped: false})); gap.position.set(1.075, 0.008, -3.52); room.add(gap);
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.6), new THREE.MeshBasicMaterial({map: radialTex(), color: new THREE.Color(P.warm).multiplyScalar(0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false}));
  spill.rotation.x = -Math.PI / 2; spill.position.set(1.075, 0.004, -3.0); room.add(spill);
  // bed (head at south wall), nightstand, couch facing the door, TV
  box(room, 1.55, 0.32, 2.15, M.wood, -2.2, 0.16, 2.4, 0.03);
  box(room, 1.5, 0.2, 2.05, M.duvet, -2.2, 0.42, 2.4, 0.08);
  box(room, 1.55, 0.95, 0.08, M.wood, -2.2, 0.48, 3.47, 0.02);
  box(room, 0.55, 0.12, 0.38, M.pillow, -2.5, 0.57, 3.2, 0.05); box(room, 0.55, 0.12, 0.38, M.pillow, -1.9, 0.57, 3.2, 0.05);
  box(room, 0.5, 0.55, 0.45, M.wood, -1.15, 0.275, 3.2, 0.02);
  box(room, 2.1, 0.42, 0.95, M.fabric, -0.2, 0.21, 0.75, 0.06);
  box(room, 2.1, 0.55, 0.22, M.fabric, -0.2, 0.62, 1.12, 0.08);
  box(room, 0.22, 0.62, 0.95, M.fabric, -1.25, 0.31, 0.75, 0.08); box(room, 0.22, 0.62, 0.95, M.fabric, 0.85, 0.31, 0.75, 0.08);
  box(room, 1.4, 0.8, 0.05, M.black, -1.0, 1.3, -3.47, 0.01);
  box(room, 1.6, 0.45, 0.4, M.wood, -1.0, 0.225, -3.25, 0.02);
  box(room, 1.6, 0.03, 0.9, mat('#2a2f45', 0.98), -0.2, 0.015, -0.3);                                        // rug
  // sleeper (shot 1): body under the duvet + head on the pillow
  const sleeper = new THREE.Group(); room.add(sleeper);
  const lump = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.1, 6, 16), M.duvet); lump.rotation.x = Math.PI / 2; lump.scale.set(1.4, 1, 0.6); lump.position.set(-2.1, 0.52, 2.2); lump.castShadow = lump.receiveShadow = true; sleeper.add(lump);
  const sh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), M.hoodie); sh.position.set(-2.05, 0.7, 3.0); sh.castShadow = true; sleeper.add(sh);

  // hallway (z -5.7..-3.6)
  const hall = new THREE.Group(); scene.add(hall);
  const tiles = textTex((x, w, h) => { x.fillStyle = P.hallFloor; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * w / 8, 0); x.lineTo(i * w / 8, h); x.stroke(); x.beginPath(); x.moveTo(0, i * h / 8); x.lineTo(w, i * h / 8); x.stroke(); } }, 512, 512);
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(8, 1);
  box(hall, 16, 0.1, 2.1, mat('#ffffff', 0.82, 0, {map: tiles}), 0, -0.05, -4.65);
  box(hall, 16, 0.1, 2.1, mat('#2b302e', 0.9), 0, 2.75, -4.65);
  box(hall, 16, 2.8, 0.1, M.hallWall, 0, 1.35, -5.75);
  box(hall, 5, 2.8, 0.1, M.hallWall, -5.5, 1.35, -3.6); box(hall, 5, 2.8, 0.1, M.hallWall, 5.5, 1.35, -3.6);
  box(hall, 0.1, 2.8, 2.1, M.hallWall, -8, 1.35, -4.65); box(hall, 0.1, 2.8, 2.1, M.hallWall, 8, 1.35, -4.65);
  // our wall seen from the hallway: same plaster, door number, other doors
  const hallSkin = mat(P.hallWall, 0.9);
  box(hall, 3.6, 2.8, 0.02, hallSkin, -1.2, 1.35, -3.615); box(hall, 1.45, 2.8, 0.02, hallSkin, 2.28, 1.35, -3.615); box(hall, 0.95, 0.65, 0.02, hallSkin, 1.075, 2.425, -3.615);
  const plate = (label) => new THREE.MeshBasicMaterial({map: textTex((x, w, h) => { x.fillStyle = '#c9cfc9'; x.fillRect(0, 0, w, h); x.fillStyle = '#1a1d1b'; x.font = '800 150px Inter'; x.textAlign = 'center'; x.fillText(label, w / 2, h * 0.75); }, 256, 192), color: '#9aa09a'});
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), plate('4B')); num.position.set(1.075, 1.62, -3.63); num.rotation.y = Math.PI; hall.add(num);
  for (const [x, z, ry, label] of [[-4.6, -3.63, Math.PI, '4A'], [4.2, -5.68, 0, '4C']]) {
    const d = box(hall, 0.95, 2.08, 0.04, M.hallDoor, x, 1.04, z); d.rotation.y = ry;
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), plate(label)); n.position.set(x, 1.62, z + (ry ? -0.03 : 0.03)); n.rotation.y = ry; hall.add(n);
  }
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshBasicMaterial({map: textTex((x, w, h) => { x.fillStyle = '#3a0d10'; x.fillRect(0, 0, w, h); x.fillStyle = '#ff6a6a'; x.font = '800 90px Inter'; x.textAlign = 'center'; x.fillText('EXIT', w / 2, h * 0.72); }, 256, 100), toneMapped: false}));
  exit.position.set(-7.94, 2.35, -4.65); exit.rotation.y = Math.PI / 2; hall.add(exit);
  const tubes = [], tubeLights = [];
  for (const x of [-5, 0, 5]) {
    const tm = new THREE.MeshBasicMaterial({color: new THREE.Color(P.tube).multiplyScalar(1.4), toneMapped: false});
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.035, 0.11), tm); t.position.set(x, 2.69, -4.65); hall.add(t); tubes.push(tm);
    const L = new THREE.PointLight(P.tube, 6, 7, 1.6); L.position.set(x, 2.4, -4.65); hall.add(L); tubeLights.push(L);
  }
  return {M, room, hall, sleeper, gap, spill, peep, tubes, tubeLights};
}

// volumetric moon beam through the blinds: a prism extruded from the window
// along the light direction; the shader re-projects each point onto the
// window plane to get the slat pattern, fades with depth and near the edges.
function moonBeam(dir) {
  const L = 7, y0 = 0.98, y1 = 2.24, z0 = 0.22, z1 = 2.38, x = -2.96;
  const c = [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]];
  const far = c.map((p) => [p[0] + dir.x * L, p[1] + dir.y * L, p[2] + dir.z * L]);
  const v = [...c, ...far].flat();
  const idx = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    uniforms: {uDir: {value: dir}, uCol: {value: new THREE.Color(P.moon)}, uI: {value: 1}},
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uDir; uniform vec3 uCol; uniform float uI; varying vec3 vW;
      void main(){
        float s = (vW.x - (${x.toFixed(2)})) / uDir.x;
        vec3 p = vW - uDir * s;
        float slat = fract((p.y - ${y0.toFixed(2)}) / 0.07);
        float open = smoothstep(0.30, 0.42, slat) * smoothstep(0.98, 0.86, slat);
        float edge = smoothstep(${y0.toFixed(2)}, ${(y0 + 0.12).toFixed(2)}, p.y) * smoothstep(${y1.toFixed(2)}, ${(y1 - 0.12).toFixed(2)}, p.y) * smoothstep(${z0.toFixed(2)}, ${(z0 + 0.15).toFixed(2)}, p.z) * smoothstep(${z1.toFixed(2)}, ${(z1 - 0.15).toFixed(2)}, p.z);
        float fall = exp(-s * 0.55) * smoothstep(0.0, 0.25, s);
        float floorFade = smoothstep(0.0, 0.25, vW.y);
        gl_FragColor = vec4(uCol * open * edge * fall * floorFade * 0.075 * uI, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  return new THREE.Mesh(g, m);
}

// dust: seeded points inside the beam, drifting as a pure function of t, lit only in the open stripes
function dust(dir, n = 700) {
  const r = rng(77), pos = [], seed = [];
  for (let i = 0; i < n; i++) { const s = 0.3 + r() * 4.2, y = 0.98 + r() * 1.26, z = 0.22 + r() * 2.16; pos.push(-2.96 + dir.x * s, y + dir.y * s, z + dir.z * s); seed.push(r(), r(), r()); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 3));
  const m = new THREE.ShaderMaterial({
    uniforms: {uT: {value: 0}, uDir: {value: dir}, uCol: {value: new THREE.Color(P.moon)}, uI: {value: 1}, uScale: {value: H}},
    vertexShader: `attribute vec3 seed; uniform float uT; uniform float uScale; uniform vec3 uDir; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uT*0.21+seed.x*40.0), sin(uT*0.17+seed.y*40.0)*0.6 - 0.02*uT*seed.z, sin(uT*0.19+seed.z*40.0)) * 0.08;
        float s = (p.x + 2.96) / uDir.x; vec3 w = p - uDir * s;
        float slat = fract((w.y - 0.98) / 0.07);
        vA = smoothstep(0.30, 0.42, slat) * smoothstep(0.98, 0.86, slat) * exp(-s*0.4) * (0.5 + 0.5*sin(uT*1.3 + seed.x*20.0));
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        gl_PointSize = (2.0 + seed.y * 5.0) * uScale / 1920.0 * (1.6 / max(0.4, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'uniform vec3 uCol; uniform float uI; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(uCol * a * vA * 0.9 * uI, 1.0); }',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return new THREE.Points(g, m);
}

// grade after tone mapping: split tone, CA, vignette, grain; CCTV mode adds barrel, mono-green, scanlines
const GRADE = {
  uniforms: {tDiffuse: {value: null}, uCctv: {value: 0}, uT: {value: 0}, uRes: {value: new THREE.Vector2(W, H)}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uCctv; uniform float uT; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv, c = uv - 0.5;
      if (uCctv > 0.5) uv = 0.5 + c * (1.0 - 0.09 * dot(c, c) * 4.0);
      vec2 d = (uv - 0.5) * (0.0016 + uCctv * 0.0022);
      vec3 col = vec3(texture2D(tDiffuse, uv + d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d).b);
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col *= mix(vec3(0.95, 0.98, 1.05), vec3(1.0), smoothstep(0.0, 0.45, l));
      col *= mix(vec3(1.0), vec3(1.06, 1.0, 0.92), smoothstep(0.45, 1.0, l));
      if (uCctv > 0.5) {
        col = vec3(l) * vec3(0.78, 0.94, 0.82) * 1.25 + 0.035;
        col *= 0.93 + 0.07 * sin(uv.y * uRes.y * 1.5 + uT * 40.0);
        col += (h(floor(uv * uRes / 2.0) + floor(uT * 30.0)) - 0.5) * 0.06;
      }
      float v = smoothstep(1.0, 0.28, length(c * vec2(1.05, 0.92)));
      col *= mix(0.32, 1.0, v);
      col += (h(vUv * uRes + floor(uT * 30.0) * 17.0) - 0.5) * 0.045;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// ---------- captions, HUD, OSD (2D overlay) ----------
const KEY = new Set(['alone', 'empty', 'door', 'peephole', 'camera', 'still', 'word', 'tuesday', 'watching', 'silent', 'screenshot', 'living', 'room', 'couch', 'him', 'thirteen', '4b', 'turn', 'two', 'man', 'members']);
const CHUNKS = [];
for (const L of LINES) {
  const phrases = []; let cur = [];
  for (const w of L.words) { cur.push(w); if (/[.,?!…]["']?$/.test(w[0])) { phrases.push(cur); cur = []; } }
  if (cur.length) phrases.push(cur);
  for (const ph of phrases) { const n = Math.ceil(ph.length / 3), size = Math.ceil(ph.length / n); for (let i = 0; i < ph.length; i += size) { const g = ph.slice(i, i + size); CHUNKS.push({words: g.map((w) => w[0]), t0: g[0][1], t1: g[g.length - 1][2]}); } }
}
CHUNKS.forEach((ch, i) => { const nx = CHUNKS[i + 1]; ch.end = nx ? Math.min(nx.t0, ch.t1 + 0.6) : ch.t1 + 0.8; });
const clean = (w) => (/^a\.m/i.test(w) ? 'AM' : w.replace(/^["“]+/, '').replace(/\.\.\.$/, '').replace(/["”]$/, '').replace(/[.,]$/, '').replace(/["”]$/, '').replace(/[.,]$/, ''));
const F = (w, s) => `${w} ${s}px Inter, sans-serif`;
const p01 = (t, a, b) => clamp01((t - a) / (b - a));

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
  c.fillStyle = 'rgba(233,236,244,.75)'; c.font = F(700, 24); c.letterSpacing = '5px'; c.fillText('NIGHT 1', 104, 205);
  c.letterSpacing = '0px'; c.fillStyle = P.text; c.font = F(800, 72); const ct = clockText(t), tw = c.measureText(ct).width; c.fillText(ct, 70, 288);
  c.font = F(700, 30); c.fillStyle = 'rgba(233,236,244,.7)'; c.fillText('AM', 70 + tw + 12, 288);
  c.fillStyle = 'rgba(233,236,244,.5)'; c.font = F(600, 24); c.letterSpacing = '4px'; c.fillText('APT 4B', 72, 330);
  c.restore();
}
function osd(c, t) {
  c.save(); c.font = F(700, 34); c.fillStyle = 'rgba(235,240,232,.85)'; c.textAlign = 'left';
  c.fillText('CAM 04 · 4F HALLWAY', 70, 420);
  const s = Math.floor(t) % 60; c.fillText(`2026-10-16  02:${clockText(t).slice(2)}:${String(s).padStart(2, '0')}`, 70, 466);
  if (Math.floor(t * 1.5) % 2 === 0) { c.fillStyle = P.red; c.beginPath(); c.arc(W - 200, 408, 13, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(235,240,232,.85)'; c.textAlign = 'right'; c.fillText('REC', W - 70, 420);
  c.strokeStyle = 'rgba(235,240,232,.35)'; c.lineWidth = 4; const m = 50, L = 70;
  [[m, 330], [W - m, 330], [m, H - 330], [W - m, H - 330]].forEach(([x, y], i) => { const sx = i % 2 ? -1 : 1, sy = i > 1 ? -1 : 1; c.beginPath(); c.moveTo(x, y + sy * L); c.lineTo(x, y); c.lineTo(x + sx * L, y); c.stroke(); });
  c.restore();
}

// ---------- shots ----------
const SHOTS = TL.shots.map(([name, t0], i) => ({name, t0, t1: (TL.shots[i + 1] || [0, TL.duration])[1], i}));
const shotAt = (t) => SHOTS.filter((s) => t >= s.t0).pop() || SHOTS[0];
// slow handheld breathing (never shaky); the CCTV views get none
const breathe = (t, a = 1) => [(Math.sin(t * 0.53) * 0.006 + Math.sin(t * 1.21 + 1.3) * 0.0025) * a, (Math.sin(t * 0.41 + 0.7) * 0.005 + Math.sin(t * 1.07 + 2.1) * 0.002) * a, Math.sin(t * 0.37 + 0.4) * 0.004 * a];

runSim(DEFAULTS, async ({cfg, canvas, hud: hudKit, capture}) => {
  await Promise.all([900, 800, 700, 600, 500].map((w) => document.fonts.load(F(w, 40)))).catch(() => {});
  const st = createStage(canvas, hudKit, {bg: P.night, capture, fov: 40, exposure: 1.55, bloom: {strength: 0.36, radius: 0.5, threshold: 0.86}});
  const {renderer, scene, camera, composer} = st;
  composer.renderTarget1.samples = composer.renderTarget2.samples = 2;
  camera.near = 0.02; camera.far = 60;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.fog = new THREE.FogExp2(P.night, 0.03);
  const bokeh = new BokehPass(scene, camera, {focus: 0.26, aperture: 0.012, maxblur: 0.012});
  composer.insertPass(bokeh, 1);
  const grade = new ShaderPass(GRADE); composer.addPass(grade);

  const world = buildWorld(scene);
  scene.add(new THREE.HemisphereLight('#3b4560', '#0b0c10', 0.5));
  const dir = new THREE.Vector3(1, -0.52, 0.12).normalize();
  const moon = new THREE.DirectionalLight(P.moon, 3.4);
  moon.position.set(-2.96 - dir.x * 10, 1.6 - dir.y * 10, 1.3 - dir.z * 10); moon.target.position.set(-2.96, 1.6, 1.3); scene.add(moon, moon.target);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, {left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30}); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.02;
  const beam = moonBeam(dir); scene.add(beam);
  const motes = dust(dir); scene.add(motes);
  const doorLight = new THREE.PointLight(P.warm, 1.4, 3.4, 2); doorLight.position.set(1.075, 0.06, -3.25); scene.add(doorLight);
  const phoneLight = new THREE.PointLight(P.cool, 0, 2.6, 2); scene.add(phoneLight);
  // IR illuminator next to each security camera lens: the room reads grey, the black figure stays black
  const ir = new THREE.SpotLight('#ffffff', 0, 14, 1.2, 1.0, 1.2); scene.add(ir, ir.target);

  // characters
  const youBed = hooded(world.M.hoodie); youBed.position.set(-1.75, 0.5, 2.15); youBed.rotation.y = -Math.PI / 2 - 0.35; scene.add(youBed);
  const youCouch = hooded(world.M.hoodie); youCouch.position.set(-0.4, 0.48, 0.75); scene.add(youCouch);
  const him = tall(world.M.him); him.position.set(0.32, 0, 1.62); scene.add(him);

  // the hand-held phone lives on the camera; the desk phone on the nightstand
  const phone = new THREE.Group(); camera.add(phone); scene.add(camera);
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.0715, 0.1545, 0.0078, 4, 0.0035), mat('#1b1f28', 0.35, 0.85));
  phone.add(body);
  const scr = document.createElement('canvas'); scr.width = SW; scr.height = SH; const sc = scr.getContext('2d');
  const scrTex = new THREE.CanvasTexture(scr); scrTex.colorSpace = THREE.SRGBColorSpace; scrTex.anisotropy = 8;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.0655, 0.15), new THREE.MeshBasicMaterial({map: scrTex, toneMapped: false, transparent: true, color: '#e8ecf6'}));
  screen.position.z = 0.0041; phone.add(screen);
  const desk = new THREE.Group(); desk.position.set(-1.15, 0.555, 3.16); desk.rotation.x = -Math.PI / 2; desk.rotation.z = Math.PI; scene.add(desk);
  const deskBody = body.clone(); desk.add(deskBody);
  const dscr = document.createElement('canvas'); dscr.width = SW; dscr.height = SH; const dc = dscr.getContext('2d');
  const dTex = new THREE.CanvasTexture(dscr); dTex.colorSpace = THREE.SRGBColorSpace; dTex.anisotropy = 8;
  const deskScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.0655, 0.15), new THREE.MeshBasicMaterial({map: dTex, toneMapped: false, transparent: true, color: '#e8ecf6'}));
  deskScreen.position.z = 0.0041; desk.add(deskScreen);
  const maskScreen = (c) => { c.save(); c.globalCompositeOperation = 'destination-in'; c.beginPath(); c.roundRect(0, 0, SW, SH, 90); c.fill(); c.restore(); };

  // overlay canvas: the GL frame (accumulated for motion blur) + 2D titles
  const ov = document.createElement('canvas'); ov.id = 'ov'; ov.width = W; ov.height = H; document.getElementById('app').appendChild(ov);
  const oc = ov.getContext('2d');
  let thumb = null;

  const look = (pos, tgt, fov) => { camera.position.set(...pos); camera.up.set(0, 1, 0); camera.lookAt(...tgt); camera.fov = fov; camera.updateProjectionMatrix(); };
  const seatEye = (t) => (t < TL.shots.find((s) => s[0] === 'living')[1] ? {pos: [-1.72, 1.2, 2.12], tgt: [1.07, 0.5, -3.5]} : {pos: [-0.4, 1.17, 0.76], tgt: [1.07, 0.55, -3.5]});

  // set every object for time t (pure: everything is reset each call)
  function apply(t) {
    const sh = shotAt(t), lt = t - sh.t0;
    const lightOff = 1 - easeInOutCubic(p01(t, ...TL.lightOff));
    world.sleeper.visible = sh.name === 'bedroom';
    world.hall.visible = sh.name === 'cctv';                     // the hallway only exists when a camera looks at it
    youBed.visible = sh.name === 'sitting'; youCouch.visible = sh.name === 'living' || sh.name === 'reveal'; him.visible = sh.name === 'reveal';
    phone.visible = sh.name === 'phone' || sh.name === 'members';
    desk.visible = true; desk.position.x = -1.15 + (lt > 0.25 && lt < 1.1 && sh.name === 'bedroom' ? Math.sin(t * 90) * 0.0015 : 0);
    bokeh.enabled = phone.visible; grade.uniforms.uCctv.value = sh.name === 'cctv' || sh.name === 'reveal' ? 1 : 0; grade.uniforms.uT.value = t;
    beam.material.uniforms.uI.value = 1; motes.material.uniforms.uT.value = t;
    world.gap.material.color.set(P.warm).multiplyScalar((sh.name === 'door' ? 1.15 : 1.7) * lightOff); world.spill.material.color.set(P.warm).multiplyScalar(0.3 * lightOff);
    world.peep.material.color.set(P.warm).multiplyScalar(lightOff); doorLight.intensity = 1.4 * lightOff;
    world.tubeLights.forEach((L, i) => { let f = lightOff; if (i === 1 && sh.name === 'cctv') { const s = Math.sin(t * 23) + Math.sin(t * 37.7); f *= s > 1.4 ? 0.2 : 1; } L.intensity = 6 * f; world.tubes[i].color.set(P.tube).multiplyScalar(1.4 * f); });
    youBed.userData.up.rotation.x = -0.5 * (1 - easeOutCubic(p01(lt, 0, 1.1)));
    him.userData.head.rotation.z = 0.12 + Math.sin(t * 0.35) * 0.02;
    phoneLight.intensity = 0; ir.intensity = 0;
    const [bx, by, br] = breathe(t);

    if (sh.name === 'bedroom') {
      const on = p01(lt, TL.phoneOn, TL.phoneOn + 0.2);
      dc.clearRect(0, 0, SW, SH); if (on > 0) { dc.globalAlpha = on; drawScreen(dc, t, 'lock'); dc.globalAlpha = 1; maskScreen(dc); } dTex.needsUpdate = true;
      deskScreen.visible = on > 0; phoneLight.position.set(-1.15, 0.75, 3.12); phoneLight.intensity = 0.9 * on;
      const k = (keys) => keyed(keys, lt);
      const pos = k([[0, [1.4, 1.7, 0.1]], [3.0, [-0.4, 1.25, 2.0]], [6.6, [-1.15, 0.79, 2.99]]]);
      const tgt = k([[0, [-1.6, 0.55, 2.6]], [3.0, [-1.2, 0.56, 3.05]], [6.6, [-1.15, 0.555, 3.17]]]);
      look([pos[0] + bx, pos[1] + by, pos[2]], tgt, keyed([[0, 42], [6.6, 34]], lt));
    } else if (sh.name === 'sitting') {
      look([0.55 + bx, 1.32 + by, 0.75], [-1.85, 0.85, 2.3], lerp(40, 36, easeInOutCubic(p01(lt, 0, 3))));
      const hp = new THREE.Vector3(); youBed.userData.phone.getWorldPosition(hp); phoneLight.position.copy(hp).add(new THREE.Vector3(0.05, 0.08, 0)); phoneLight.intensity = 0.5;
    } else if (sh.name === 'phone' || sh.name === 'members') {
      const e = seatEye(t);
      look([e.pos[0] + bx, e.pos[1] + by, e.pos[2]], e.tgt, 40);
      camera.rotateZ(br);
      const dur = sh.t1 - sh.t0, k = easeInOutCubic(p01(lt, 0, dur));
      let z = lerp(-0.272, -0.252, k), y = -0.006, x = 0;
      const dive = (a, b, tx, ty, tz) => { const d = easeInOutCubic(p01(t, a, b)); x = lerp(x, tx, d); y = lerp(y, ty, d); z = lerp(z, tz, d); };
      if (sh.i === 4) dive(...TL.diveCam, 0, -0.0495, -0.07);
      if (sh.i === 10) dive(...TL.diveShot, 0, 0.033, -0.062);
      if (sh.name === 'members') dive(...TL.listPush, 0, 0.072, -0.16);
      if (sh.i === 13) dive(...TL.ghostPush, 0, 0.068, -0.155);
      phone.position.set(x + Math.sin(t * 0.8) * 0.0015, y + Math.sin(t * 0.6 + 1) * 0.001, z);
      phone.rotation.set(-0.06 + Math.sin(t * 0.5) * 0.008, Math.sin(t * 0.43) * 0.01, 0);
      sc.clearRect(0, 0, SW, SH); drawScreen(sc, t, sh.name === 'members' ? 'members' : 'chat', thumb); maskScreen(sc); scrTex.needsUpdate = true;
      bokeh.uniforms.focus.value = -z; bokeh.uniforms.aperture.value = 0.012;
      const wp = new THREE.Vector3(); phone.getWorldPosition(wp); phoneLight.position.copy(wp); phoneLight.intensity = 0.35;
    } else if (sh.name === 'cctv') {
      const second = sh.i === 7, z = second ? easeInOutCubic(p01(lt, 0, 3.2)) : 0;
      look([7.45, 2.52, -4.62], [lerp(-2.5, 1.07, z * 0.8), lerp(0.8, 1.05, z), lerp(-4.55, -3.65, z * 0.8)], second ? lerp(64, 36, z) : lerp(68, 64, easeOutCubic(p01(lt, 0, 0.8))));
    } else if (sh.name === 'living') {
      const k = easeInOutCubic(p01(lt, 0, sh.t1 - sh.t0));
      look([lerp(0.75, 0.45, k) + bx, 1.65 + by, lerp(3.1, 2.6, k)], [-0.75, 0.8, -0.6], 46);
      phoneLight.position.set(-0.4, 1.0, 0.35); phoneLight.intensity = 0.7;
    } else if (sh.name === 'reveal') {
      const push = easeInOutCubic(p01(t, ...TL.revealPush)), pan = easeInOutCubic(p01(t, ...TL.revealPan)), fill = easeOutCubic(p01(lt, 0, 0.8));
      const tgt = [lerp(lerp(-0.1, -0.4, push), 0.32, pan), lerp(lerp(0.9, 1.0, push), 1.75, pan), lerp(lerp(0.0, 0.75, push), 1.62, pan)];
      look([2.78, 2.55, 3.32], tgt, lerp(lerp(lerp(74, 62, fill), 46, push), 38, pan));
      ir.position.set(2.7, 2.5, 3.25); ir.target.position.set(-0.2, 0.5, 0.6); ir.intensity = 34;
      phoneLight.position.set(-0.4, 1.0, 0.35); phoneLight.intensity = 0.7;
    } else if (sh.name === 'door') {
      const k = easeInOutCubic(p01(lt, 0, sh.t1 - sh.t0));
      look([1.075 + bx, lerp(1.0, 0.85, k) + by, lerp(-0.4, -1.3, k)], [1.075, 0.9, -3.5], 46);
    }
  }

  // screenshot thumbnail = a real frame of the reveal camera, blurred (built on first render, once the canvas has its size)
  const makeThumb = () => {
    apply(lerp(...TL.revealPush, 0.8)); composer.render();
    const c = document.createElement('canvas'); c.width = 492; c.height = 442; const x = c.getContext('2d');
    x.filter = 'blur(7px) brightness(.9) grayscale(.6)'; x.drawImage(canvas, 0, canvas.height * 0.18, canvas.width, canvas.width * 442 / 492 * 0.9, -12, -12, 516, 466);
    thumb = c;
  };

  return {
    render(t) {
      if (!thumb) makeThumb();
      const sh = shotAt(t);
      oc.globalAlpha = 1; oc.fillStyle = '#000'; oc.fillRect(0, 0, W, H);
      if (sh.name !== 'black') {
        const fast = TL.fast.some(([a, b]) => t >= a && t <= b), n = fast ? 6 : 1;
        for (let i = 0; i < n; i++) {
          const ts = Math.min(sh.t1 - 1e-4, Math.max(sh.t0, t + (n > 1 ? (i / (n - 1) - 0.5) / (2 * FPS) : 0)));
          apply(ts); composer.render();
          oc.globalAlpha = 1 / (i + 1); oc.imageSmoothingQuality = 'high'; oc.drawImage(canvas, 0, 0, W, H);
        }
        oc.globalAlpha = 1;
      }
      if (sh.name === 'cctv' || sh.name === 'reveal') osd(oc, t);
      if (sh.i === 5) { const a = 1 - p01(t - sh.t0, 0, 0.35); if (a > 0) { oc.fillStyle = `rgba(200,210,200,${a * 0.5})`; oc.fillRect(0, 0, W, H); } }
      if (sh.name === 'reveal') { const f = Math.max(0, 1 - Math.abs(t - TL.impact) / 0.5); if (f > 0) { oc.fillStyle = `rgba(0,0,0,${f * 0.35})`; oc.fillRect(0, 0, W, H); } }
      if (['bedroom', 'sitting', 'living'].includes(sh.name)) hud(oc, t);
      if (sh.i === 13) { const a = easeInOutCubic(p01(t, ...TL.toBlack)); if (a > 0) { oc.fillStyle = `rgba(0,0,0,${a})`; oc.fillRect(0, 0, W, H); } }
      if (sh.name === 'door') {
        const a = 1 - p01(t - sh.t0, 0.1, 1.3); if (a > 0) { oc.fillStyle = `rgba(0,0,0,${a})`; oc.fillRect(0, 0, W, H); }
        const tt = easeOutCubic(p01(t, TL.title, TL.title + 1.2));
        if (tt > 0) { oc.save(); oc.globalAlpha = tt; oc.textAlign = 'center'; oc.fillStyle = P.text; oc.font = F(800, 110); oc.letterSpacing = '18px'; oc.fillText('NIGHT 2', W / 2 + 9, 900 + (1 - tt) * 16); oc.letterSpacing = '10px'; oc.fillStyle = `rgb(${WARM})`; oc.font = F(600, 32); oc.fillText('AFTER LIGHTS OUT', W / 2 + 5, 990); oc.restore(); }
      }
      captions(oc, t);
      return {};
    },
    resize() { st.resize(); renderer.setPixelRatio(GL_SCALE); renderer.setSize(W, H, false); composer.setPixelRatio(GL_SCALE); composer.setSize(W, H); },
  };
});
