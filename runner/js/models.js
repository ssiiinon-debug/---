// Вся графика собрана из примитивов кодом: персонажи, поезда, барьеры, окружение.
// Статичные части сливаются в одну геометрию с цветами вершин → мало draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from './config.js';

// ---------- материалы ----------
export const gradTex = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter; gradTex.needsUpdate = true;
export const MAT = {
  toon: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex }),
  lambert: new THREE.MeshLambertMaterial({ vertexColors: true }),
  coin: new THREE.MeshToonMaterial({ color: 0xffc81e, emissive: 0x5a3a00, gradientMap: gradTex }),
  light: new THREE.MeshBasicMaterial({ color: 0xfff3b0 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
};

// ---------- базовые геометрии ----------
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(0.5, 12, 10),
  sphLo: new THREE.SphereGeometry(0.5, 7, 5),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cap: new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
  cone4: new THREE.ConeGeometry(0.5, 1, 4),
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(),
  _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

// Сборщик: добавляем примитивы с цветом и трансформом, на выходе одна геометрия.
export class B {
  constructor() { this.parts = []; }
  add(geo, color, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', src.getAttribute('position').clone());
    g.setAttribute('normal', src.getAttribute('normal').clone());
    const n = g.getAttribute('position').count, arr = new Float32Array(n * 3);
    _c.set(color);
    for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
    g.applyMatrix4(_m.compose(_p, _q, _s));
    this.parts.push(g);
    return this;
  }
  addQ(geo, color, pos, quat, sx, sy, sz) {
    this.add(geo, color, 0, 0, 0);
    this.parts[this.parts.length - 1].applyMatrix4(_m.compose(pos, quat, _s.set(sx, sy, sz)));
    return this;
  }
  box(c, x, y, z, w, h, d, rx, ry, rz) { return this.add(G.box, c, x, y, z, w, h, d, rx, ry, rz); }
  sph(c, x, y, z, w, h = w, d = w, lo = false) { return this.add(lo ? G.sphLo : G.sph, c, x, y, z, w, h, d); }
  cyl(c, x, y, z, r, h, rx = 0, ry = 0, rz = 0) { return this.add(G.cyl, c, x, y, z, r * 2, h, r * 2, rx, ry, rz); }
  geo() { const g = mergeGeometries(this.parts, false); this.parts.forEach(p => p.dispose()); return g; }
  mesh(mat = MAT.toon) { return new THREE.Mesh(this.geo(), mat); }
}

// Детерминированный рандом (чтобы кудри не «прыгали» между сборками)
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function darker(hex, k = 0.75) { return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString(); }

// ---------- поезда ----------
const TRAIN_PAL = [
  { body: '#8a1f2e', stripe: '#e8c06a', roof: '#4a3a44' },
  { body: '#4a2a6a', stripe: '#d6d0e6', roof: '#3a3346' },
  { body: '#1f4f5a', stripe: '#e05a5a', roof: '#33404a' },
  { body: '#2a2026', stripe: '#c8283a', roof: '#40343c' },
];
const WIN_LIT = '#ffcf6b';
const trainCache = new Map();
export function trainGeo(L, palIdx, moving) {
  const key = L + '|' + palIdx + '|' + (moving ? 1 : 0);
  if (trainCache.has(key)) return trainCache.get(key);
  const p = TRAIN_PAL[palIdx % TRAIN_PAL.length], b = new B(), gl = new B(), H = CFG.TRAIN_H;
  const len = L - 0.3, zc = -L / 2;
  b.box('#1e1a20', 0, 0.38, zc, 1.8, 0.5, len - 0.8);                 // тележки
  for (const z of [-1.4, -L + 1.4]) for (const x of [-0.8, 0.8]) {
    b.cyl('#141216', x, 0.42, z, 0.36, 0.2, 0, 0, Math.PI / 2);
    b.cyl('#141216', x, 0.42, z - 0.9, 0.36, 0.2, 0, 0, Math.PI / 2);
  }
  b.box(p.body, 0, 0.6 + (H - 0.9) / 2, zc, 2.2, H - 0.9, len);       // корпус
  b.box(p.roof, 0, H - 0.15, zc, 2.0, 0.3, len - 0.2);                // крыша
  for (let z = -2; z > -L + 1.5; z -= 4) b.box(darker(p.roof, 0.8), 0, H + 0.02, z, 0.9, 0.12, 1.2);
  b.box(p.stripe, 0, 1.35, zc, 2.24, 0.2, len - 0.1);                  // полоса
  b.box(darker(p.body, 0.6), 0, 0.68, zc, 2.22, 0.12, len - 0.1);
  b.box(darker(p.body, 0.7), 0, H - 0.4, zc, 2.22, 0.08, len - 0.1);
  for (let z = -1.6; z > -L + 1.2; z -= 2.6) {
    for (const x of [-1.11, 1.11]) {
      b.box('#120e14', x, 2.3, z, 0.045, 0.95, 1.7);
      gl.box(WIN_LIT, x * 1.005, 2.28, z, 0.04, 0.8, 1.55);
      b.box('#120e14', x * 1.01, 2.28, z, 0.04, 0.8, 0.06);
    }
  }
  for (let z = -3.0; z > -L + 2; z -= 7.8) for (const x of [-1.115, 1.115]) {
    b.box(darker(p.body, 0.75), x, 1.65, z, 0.03, 2.0, 1.3);
    gl.box(WIN_LIT, x * 1.003, 2.15, z, 0.03, 0.7, 0.45);
  }
  // морда
  const fz = -0.15;
  b.box('#120e14', 0, 2.3, fz + 0.02, 1.8, 1.0, 0.06);
  gl.box('#ffb36b', 0, 2.3, fz + 0.01, 1.6, 0.8, 0.06);
  b.box(p.stripe, 0, 1.35, fz + 0.02, 2.0, 0.2, 0.06);
  b.box('#1e1a20', 0, 0.75, fz + 0.1, 2.1, 0.3, 0.25);                // бампер
  b.box('#d8d0c0', 0, 1.0, fz + 0.03, 0.5, 0.2, 0.05);                 // номер
  gl.box('#ff5a5a', 0, 3.05, fz + 0.01, 0.9, 0.2, 0.05);               // табло
  if (!moving) for (const x of [-0.72, 0.72]) b.box('#a89a80', x, 1.0, fz + 0.04, 0.32, 0.2, 0.05);
  const g = { geo: b.geo(), glow: gl.geo() }; trainCache.set(key, g); return g;
}
export const TRAIN_PAL_COUNT = TRAIN_PAL.length;

export function makeTrain(L, palIdx, moving) {
  const g = new THREE.Group(), tg = trainGeo(L, palIdx, moving);
  g.add(new THREE.Mesh(tg.geo, MAT.toon), new THREE.Mesh(tg.glow, MAT.glow));
  if (moving) {
    for (const x of [-0.72, 0.72]) {
      const l = new THREE.Mesh(G.box, MAT.light); l.scale.set(0.34, 0.22, 0.06); l.position.set(x, 1.0, -0.1); g.add(l);
    }
  }
  return g;
}

// ---------- барьеры и рампы ----------
let lowGeo = null, highGeo = null, rampGeo = null;
export function makeLow() {
  if (!lowGeo) {
    const b = new B();
    for (const x of [-0.95, 0.95]) { b.box('#5a5a5a', x, 0.55, 0, 0.14, 1.1, 0.14); b.box('#3a3a3a', x, 0.03, 0, 0.5, 0.06, 0.5); }
    for (let i = 0; i < 6; i++) {
      const col = i % 2 ? '#ffffff' : '#e5322d';
      b.box(col, -0.95 + 0.317 * (i + 0.5), 0.9, 0, 0.317, 0.34, 0.12);
      b.box(col, -0.95 + 0.317 * (i + 0.5), 0.42, 0, 0.317, 0.18, 0.1);
    }
    lowGeo = b.geo();
  }
  return new THREE.Mesh(lowGeo, MAT.toon);
}
export function makeHigh() {
  if (!highGeo) {
    const b = new B();
    for (const x of [-1.0, 1.0]) b.box('#6a6a72', x, 1.45, 0, 0.16, 2.9, 0.16);
    b.box('#222222', 0, 2.08, 0, 2.12, 1.32, 0.12);
    for (let i = 0; i < 7; i++) b.box(i % 2 ? '#222222' : '#ffd21f', -0.9 + 0.3 * i, 2.08, -0.065, 0.16, 1.22, 0.02, 0, 0, 0.5);
    b.box('#ffd21f', 0, 2.78, 0, 2.14, 0.1, 0.14);
    b.box('#ffd21f', 0, 1.42, 0, 2.14, 0.1, 0.14);
    b.box('#e5322d', 0, 2.08, -0.08, 0.6, 0.6, 0.02, 0, 0, Math.PI / 4);  // знак
    b.box('#ffffff', 0, 2.08, -0.09, 0.42, 0.1, 0.02);
    highGeo = b.geo();
  }
  return new THREE.Mesh(highGeo, MAT.toon);
}
export function makeRamp() {
  if (!rampGeo) {
    const b = new B(), L = CFG.RAMP_LEN, H = CFG.TRAIN_H, a = Math.atan2(H, L), len = Math.hypot(L, H);
    b.box('#d8d8d8', 0, H / 2 - 0.12, -L / 2, 2.0, 0.24, len, a, 0, 0);
    for (let i = 1; i < 9; i++) {
      const f = i / 9;
      b.box(i % 2 ? '#ffd21f' : '#555555', 0, H * f + 0.02, -L * f, 2.02, 0.06, 0.4, a, 0, 0);
    }
    for (const x of [-1.0, 1.0]) {
      b.box('#8a8a90', x, H / 2 + 0.25, -L / 2, 0.08, 0.08, len, a, 0, 0);
      for (let i = 1; i <= 3; i++) { const f = i / 3.3; b.box('#6a6a72', x, H * f / 2, -L * f, 0.1, H * f, 0.1); }
    }
    rampGeo = b.geo();
  }
  return new THREE.Mesh(rampGeo, MAT.toon);
}

// ---------- окружение: кусок трассы 40 м (готический вечер) ----------
export const SEG_LEN = 40;
function deadTree(b, x, z, h, r) {
  const trunk = '#241a22';
  b.cyl(trunk, x, h / 2, z, 0.18, h);
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2, y = h * (0.55 + r() * 0.4), l = 1 + r() * 1.2;
    b.cyl(trunk, x + Math.cos(a) * l * 0.4, y + l * 0.3, z + Math.sin(a) * l * 0.4, 0.07, l, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
  }
}
function house(b, gl, x, z, side, r) {
  const W = 4 + r() * 2, D = 4 + r() * 2, H = 4.5 + r() * 3.5;
  const walls = ['#3d2a4a', '#2a3346', '#4a2a36', '#2f2a3a'][Math.floor(r() * 4)];
  const roof = ['#1c1420', '#241a2c', '#2a1a1f'][Math.floor(r() * 3)];
  b.box(walls, x, H / 2, z, W, H, D);
  b.add(G.cone4, roof, x, H + 1.6, z, W * 0.8, 3.2, D * 0.8, 0, Math.PI / 4, 0);
  if (r() < 0.6) b.add(G.cone4, roof, x - side * W * 0.25, H + 0.3 + 1.2, z - D / 2 + 0.2, 1.6, 2.4, 1.6, 0, Math.PI / 4, 0);
  b.box('#1a1218', x + W * 0.25, H + 1.4, z + 0.5, 0.5, 2.2, 0.5);    // труба
  const fx = x - side * (W / 2 + 0.03);
  for (let fy = 1.4; fy < H - 0.6; fy += 1.6) for (let k = -1; k <= 1; k += 2) {
    const lit = r() < 0.65;
    (lit ? gl : b).box(lit ? (r() < 0.5 ? '#ffcf6b' : '#ff9a4a') : '#120e14', fx, fy, z + k * D * 0.22, 0.06, 0.8, 0.55);
    b.box('#120e14', fx, fy + 0.45, z + k * D * 0.22, 0.08, 0.1, 0.7);
  }
}
export function makeSegmentGeo(variant) {
  const b = new B(), gl = new B(), L = SEG_LEN, zc = -L / 2, r = rng(11 + variant * 5);
  b.box('#55474f', 0, -0.1, zc, 15, 0.2, L);
  for (const x of CFG.LANES) {
    b.box('#43363e', x, 0.005, zc, 2.4, 0.02, L);
    for (let z = -0.5; z > -L; z -= 1.0) b.box('#3a2a28', x, 0.06, z, 2.2, 0.1, 0.34);
    for (const dx of [-0.72, 0.72]) {
      b.box('#6a6c78', x + dx, 0.15, zc, 0.12, 0.14, L);
      b.box('#c8ccd6', x + dx, 0.225, zc, 0.07, 0.02, L);
    }
  }
  for (const sx of [-1, 1]) b.box('#2c3a36', sx * 16, -0.05, zc, 17, 0.1, L);
  if (variant === 0) {
    // каменный виадук с арками
    for (const sx of [-1, 1]) {
      const x = sx * 6.6;
      for (let z = 0; z > -L; z -= 8) {
        b.box('#4b3b5a', x, 3, z - 0.5, 1.2, 6, 1.4);
        b.box('#3a2d48', x, 0.3, z - 0.5, 1.35, 0.6, 1.55);
        for (let k = 0; k < 4; k++) {
          const w = 6.6 - k * 1.65 - 0.3;
          b.box(k % 2 ? '#4b3b5a' : '#433452', x, 4.4 + k * 0.35, z - 4.5, 1.2, 0.36, Math.max(w, 0.6));
        }
        // фонарь на колонне
        b.box('#141016', x - sx * 0.7, 3.6, z - 0.5, 0.12, 0.6, 0.12);
        gl.box('#ffb347', x - sx * 0.7, 3.2, z - 0.5, 0.26, 0.34, 0.26);
      }
      b.box('#4b3b5a', x, 6.0, zc, 1.3, 0.9, L);
      b.box('#2f2440', x, 6.55, zc, 1.5, 0.2, L);
      for (let i = 0; i < 4; i++) deadTree(b, sx * (9 + r() * 4), -r() * L, 3 + r() * 2.5, r);
      for (let i = 0; i < 7; i++) {
        const s = 1.2 + r() * 1.4;
        b.sph(r() < 0.5 ? '#2a3a34' : '#3a2f48', sx * (8.6 + r() * 3), s * 0.35, -r() * L, s * 1.3, s, s * 1.3, true);
      }
      // надгробия и тыквы
      for (let i = 0; i < 3; i++) {
        const gx = sx * (8.4 + r() * 3), gz = -r() * L;
        b.box('#5a5560', gx, 0.45, gz, 0.6, 0.9, 0.18);
        b.cyl('#5a5560', gx, 0.9, gz, 0.3, 0.18, Math.PI / 2, 0, 0);
      }
      const px = sx * (8 + r() * 2), pz = -r() * L;
      b.sph('#e0661a', px, 0.35, pz, 0.8, 0.6, 0.8);
      b.box('#2f4a1f', px, 0.72, pz, 0.08, 0.18, 0.08);
      gl.box('#ffd04a', px - sx * 0.01, 0.4, pz - 0.39, 0.3, 0.08, 0.02);
    }
  } else {
    // улица с готическими домами, кованый забор, фонари
    for (const sx of [-1, 1]) {
      const x = sx * 5.6;
      for (let z = -0.5; z > -L; z -= 0.8) {
        b.box('#141016', x, 0.65, z, 0.06, 1.3, 0.06);
        b.add(G.cone4, '#141016', x, 1.38, z, 0.12, 0.18, 0.12);
      }
      b.box('#141016', x, 1.1, zc, 0.05, 0.06, L);
      b.box('#141016', x, 0.3, zc, 0.05, 0.06, L);
      for (let z = -6; z > -L; z -= 20) {
        b.box('#141016', x + sx * 0.4, 2.2, z, 0.14, 4.4, 0.14);
        b.box('#141016', x + sx * 0.1, 4.4, z, 0.7, 0.1, 0.1);
        gl.box('#ffb347', x - sx * 0.15, 4.1, z, 0.3, 0.42, 0.3);
      }
      for (let z = -3; z > -L; z -= 9 + r() * 4) house(b, gl, sx * (11 + r() * 2.5), z, sx, r);
      for (let i = 0; i < 3; i++) deadTree(b, sx * (7.5 + r() * 1.5), -r() * L, 2.5 + r() * 2, r);
    }
  }
  return { geo: b.geo(), glow: gl.geo() };
}

// ---------- небо: багровый закат, луна, тучи ----------
export function makeSky() {
  const g = new THREE.SphereGeometry(400, 24, 16), pos = g.getAttribute('position'), col = [];
  const top = new THREE.Color('#1a0a26'), mid = new THREE.Color('#5a1838'), hor = new THREE.Color('#d8405a'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = Math.max(0, pos.getY(i) / 400);
    if (y < 0.18) c.copy(hor).lerp(mid, y / 0.18); else c.copy(mid).lerp(top, Math.min(1, (y - 0.18) / 0.5));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(11, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe9d6, fog: false }));
  moon.position.set(-90, 120, -330); m.add(moon);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(19, 20, 14), new THREE.MeshBasicMaterial({ color: 0xff9aa8, fog: false, transparent: true, opacity: 0.18, depthWrite: false }));
  halo.position.copy(moon.position); m.add(halo);
  const cb = new B(), r = rng(3);
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = 300, y = 50 + r() * 80;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    for (let k = 0; k < 4; k++) cb.sph(r() < 0.5 ? '#3a1a3f' : '#4a2040', x + (k - 1.5) * 14, y + (k % 2) * 6, z, 28, 12, 18, true);
  }
  m.add(new THREE.Mesh(cb.geo(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.85 })));
  // далёкие силуэты холмов и шпилей
  const hb = new B(), r2 = rng(21);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2, d = 320, x = Math.cos(a) * d, z = Math.sin(a) * d;
    hb.sph('#2a1028', x, 0, z, 70 + r2() * 40, 30 + r2() * 30, 70, true);
    if (r2() < 0.35) hb.add(G.cone4, '#1e0c1e', x * 0.97, 30 + r2() * 15, z * 0.97, 6, 40 + r2() * 20, 6);
  }
  m.add(new THREE.Mesh(hb.geo(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
  m.renderOrder = -1;
  return m;
}

// ---------- монеты, бонусы, тень ----------
export function coinGeo() {
  const g = new THREE.CylinderGeometry(0.38, 0.38, 0.09, 18); g.rotateX(Math.PI / 2); return g;
}

export function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const powerTex = {};
export function makePowerSprite(kind) {
  if (!powerTex[kind]) {
    const p = CFG.POWERS[kind];
    powerTex[kind] = canvasTex(128, 128, (x) => {
      const g = x.createRadialGradient(64, 64, 10, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, p.color); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
      x.fillStyle = p.color; x.strokeStyle = '#fff'; x.lineWidth = 6;
      x.beginPath(); x.arc(64, 64, 40, 0, Math.PI * 2); x.fill(); x.stroke();
      x.fillStyle = '#fff'; x.font = 'bold 44px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(p.label, 64, 67);
    });
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: powerTex[kind], depthWrite: false }));
  s.scale.set(1.5, 1.5, 1);
  return s;
}

let shadowTex = null;
export function makeBlob(size = 1.3) {
  if (!shadowTex) shadowTex = canvasTex(64, 64, (x) => {
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
  return m;
}
