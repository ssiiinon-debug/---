// Вся графика собрана из примитивов кодом: персонажи, поезда, барьеры, окружение.
// Статичные части сливаются в одну геометрию с цветами вершин → мало draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from './config.js';

// ---------- материалы ----------
const gradTex = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter; gradTex.needsUpdate = true;
export const MAT = {
  toon: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex }),
  lambert: new THREE.MeshLambertMaterial({ vertexColors: true }),
  coin: new THREE.MeshToonMaterial({ color: 0xffc81e, emissive: 0x5a3a00, gradientMap: gradTex }),
  light: new THREE.MeshBasicMaterial({ color: 0xfff3b0 }),
};

// ---------- базовые геометрии ----------
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(0.5, 12, 10),
  sphLo: new THREE.SphereGeometry(0.5, 7, 5),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cap: new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(),
  _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

// Сборщик: добавляем примитивы с цветом и трансформом, на выходе одна геометрия.
class B {
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
  box(c, x, y, z, w, h, d, rx, ry, rz) { return this.add(G.box, c, x, y, z, w, h, d, rx, ry, rz); }
  sph(c, x, y, z, w, h = w, d = w, lo = false) { return this.add(lo ? G.sphLo : G.sph, c, x, y, z, w, h, d); }
  cyl(c, x, y, z, r, h, rx = 0, ry = 0, rz = 0) { return this.add(G.cyl, c, x, y, z, r * 2, h, r * 2, rx, ry, rz); }
  geo() { const g = mergeGeometries(this.parts, false); this.parts.forEach(p => p.dispose()); return g; }
  mesh(mat = MAT.toon) { return new THREE.Mesh(this.geo(), mat); }
}

// Детерминированный рандом (чтобы кудри не «прыгали» между сборками)
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------- персонажи ----------
function darker(hex, k = 0.75) { return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString(); }

function buildHead(sk) {
  const b = new B();
  const skin = sk.skin;
  b.sph(skin, 0, 0, 0, 0.62, 0.64, 0.58);                       // голова
  b.sph(skin, -0.31, -0.02, 0.02, 0.1, 0.16, 0.1);              // уши
  b.sph(skin, 0.31, -0.02, 0.02, 0.1, 0.16, 0.1);
  for (const sx of [-1, 1]) {
    b.sph('#ffffff', sx * 0.11, 0.0, -0.255, 0.12, 0.14, 0.06);  // белок
    b.sph('#3a2516', sx * 0.11, -0.01, -0.282, 0.075, 0.095, 0.04);   // зрачок
    b.sph('#ffffff', sx * 0.11 + 0.02, 0.025, -0.3, 0.025, 0.025, 0.01); // блик
    b.box(darker(sk.hair, 0.6), sx * 0.115, 0.115, -0.27, 0.13, 0.03, 0.04, 0, 0, sx * -0.12); // бровь
  }
  b.sph(darker(skin, 0.88), 0, -0.065, -0.29, 0.07, 0.06, 0.06); // нос
  b.box('#8a2a2a', 0, -0.15, -0.262, 0.11, 0.025, 0.02, 0, 0, 0.08); // ухмылка
  if (sk.mustache) b.box(sk.hair, 0, -0.11, -0.285, 0.2, 0.05, 0.04);
  if (sk.glasses) {
    for (const sx of [-1, 1]) b.box('#0b0b0f', sx * 0.115, 0.0, -0.3, 0.17, 0.1, 0.03);
    b.box('#0b0b0f', 0, 0.02, -0.3, 0.08, 0.025, 0.03);
    b.box('#0b0b0f', -0.25, 0.02, -0.17, 0.02, 0.025, 0.25);
    b.box('#0b0b0f', 0.25, 0.02, -0.17, 0.02, 0.025, 0.25);
  }

  const st = sk.hairStyle;
  if (st === 'curly') {
    const r = rng(7), N = 90;
    for (let i = 0; i < N; i++) {
      // точки Фибоначчи на сфере
      const y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - y * y), th = i * 2.39996;
      const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
      if (y < -0.15) continue;
      if (z < -0.45 && y < 0.45) continue;            // лицо открыто
      if (Math.abs(x) > 0.8 && y < 0.1 && z < 0.2) continue; // уши видны
      const R = 0.35 + r() * 0.04, sz = 0.13 + r() * 0.07;
      b.sph(r() < 0.5 ? sk.hair : sk.hair2, x * R * 1.05, y * R + 0.05, z * R, sz, sz, sz, true);
    }
    // пушистая чёлка
    for (let i = 0; i < 7; i++) b.sph(i % 2 ? sk.hair2 : sk.hair, -0.24 + i * 0.08, 0.2 + (i % 2) * 0.03, -0.27, 0.15, 0.13, 0.12, true);
    // кудри сзади до шеи
    for (let i = 0; i < 6; i++) b.sph(i % 2 ? sk.hair : sk.hair2, -0.2 + i * 0.08, -0.12, 0.22, 0.15, 0.15, 0.15, true);
  } else if (st === 'long' || st === 'bun' || st === 'cap' || st === 'guard') {
    b.add(G.cap, sk.hair, 0, 0.03, 0.01, 0.68, 0.7, 0.64);           // «шапка» волос
    if (st === 'long') {
      for (let i = 0; i < 6; i++) b.box(i % 2 ? sk.hair2 : sk.hair, -0.22 + i * 0.088, 0.17 - Math.abs(i - 2.5) * 0.012, -0.27, 0.1, 0.16, 0.06, 0.25, 0, 0);
      b.box(sk.hair, 0, -0.14, 0.2, 0.6, 0.48, 0.2);
      b.box(sk.hair, -0.3, -0.08, 0.02, 0.07, 0.36, 0.34);
      b.box(sk.hair, 0.3, -0.08, 0.02, 0.07, 0.36, 0.34);
    } else if (st === 'bun') {
      b.sph(sk.hair2, 0, 0.38, 0.1, 0.3, 0.28, 0.3);
      b.box(sk.hair, 0, 0.16, -0.27, 0.5, 0.08, 0.06, 0.3, 0, 0);
    } else if (st === 'cap' || st === 'guard') {
      const cc = sk.cap || '#1d2b5a';
      b.add(G.cap, cc, 0, 0.07, 0.0, 0.7, 0.62, 0.66);
      b.box(cc, 0, 0.1, -0.38, 0.46, 0.04, 0.24, -0.15, 0, 0);       // козырёк
      if (st === 'guard') {
        b.cyl(cc, 0, 0.27, 0.0, 0.37, 0.16);                        // фуражка
        b.cyl('#f2c230', 0, 0.2, 0.0, 0.355, 0.05);
        b.box('#f2c230', 0, 0.23, -0.35, 0.12, 0.1, 0.03);           // кокарда
      } else b.sph('#ffffff', 0, 0.39, 0.0, 0.08);
    }
  }
  return b.mesh();
}

function buildTorso(sk) {
  const b = new B();
  const belly = sk.belly ? 1.15 : 1;
  b.box(sk.pants, 0, 0.98, 0, 0.58 * belly, 0.24, 0.34 * belly);                  // таз
  b.box('#1a1a1a', 0, 1.09, 0, 0.6 * belly, 0.06, 0.36 * belly);                  // ремень
  b.box(sk.jacket, 0, 1.36, 0, 0.66 * belly, 0.6, 0.38 * belly);                  // корпус
  b.box(sk.inner, 0, 1.38, -0.19 * belly, 0.22, 0.56, 0.03);                     // худи под бомбером
  b.box(sk.trim, 0, 1.09, 0, 0.67 * belly, 0.07, 0.39 * belly);                  // резинка снизу
  b.box(sk.sleeve, 0, 1.03, 0, 0.665 * belly, 0.04, 0.392 * belly);
  b.box(sk.trim, 0, 1.66, 0, 0.5, 0.08, 0.4);                                    // воротник
  b.box(sk.letter, 0.18, 1.47, -0.195 * belly, 0.15, 0.17, 0.02);               // нашивка
  b.box(sk.jacket, 0.18, 1.47, -0.2 * belly, 0.07, 0.09, 0.02);
  b.box(sk.inner, 0, 1.6, 0.21, 0.42, 0.24, 0.12);                               // капюшон
  b.box(sk.skin, 0, 1.72, 0, 0.17, 0.1, 0.17);                                   // шея
  if (sk.vest) {
    b.box(sk.vest, 0, 1.36, 0, 0.68 * belly, 0.5, 0.4 * belly);
    b.box('#e8e8e8', 0, 1.28, 0, 0.69 * belly, 0.06, 0.41 * belly);
  }
  return b.mesh();
}

function buildArm(sk, side) {
  const b = new B();
  b.sph(sk.jacket, 0, -0.02, 0, 0.26);                     // плечо
  b.box(sk.sleeve, 0, -0.28, 0, 0.2, 0.52, 0.22);
  b.box(sk.trim, 0, -0.38, 0, 0.205, 0.04, 0.225);
  b.box(sk.trim, 0, -0.53, 0, 0.21, 0.07, 0.23);           // манжет
  b.sph(sk.skin, 0, -0.64, 0, 0.2, 0.2, 0.2);              // кисть
  if (sk.flashlight && side > 0) {
    b.cyl('#444444', 0, -0.68, -0.18, 0.06, 0.34, Math.PI / 2, 0, 0);
    b.cyl('#ffe680', 0, -0.68, -0.36, 0.075, 0.04, Math.PI / 2, 0, 0);
  }
  return b.mesh();
}

function buildLeg(sk) {
  const b = new B();
  b.box(sk.pants, 0, -0.4, 0, 0.26, 0.8, 0.29);
  if (sk.ripped) {
    b.box(sk.pants2, 0, -0.42, -0.148, 0.17, 0.07, 0.02);
    b.box(sk.pants2, 0.02, -0.2, -0.148, 0.1, 0.04, 0.02);
  } else if (sk.stripe) b.box(sk.pants2, 0.135, -0.4, 0, 0.02, 0.8, 0.06);
  b.box(sk.shoes, 0, -0.83, -0.06, 0.32, 0.2, 0.46);
  b.box(sk.sole, 0, -0.92, -0.06, 0.33, 0.06, 0.48);
  b.box(sk.sole, 0, -0.78, -0.28, 0.2, 0.04, 0.03);
  return b.mesh();
}

// Персонаж: root (ступни в 0) → pivot (центр масс, для кувырка) → части.
export function makeCharacter(sk) {
  sk = Object.assign({ ripped: sk.id === 'ginger', stripe: sk.id === 'sport' }, sk);
  const root = new THREE.Group(), pivot = new THREE.Group();
  pivot.position.y = 0.9; root.add(pivot);
  const body = new THREE.Group(); body.position.y = -0.9; pivot.add(body);
  const torso = buildTorso(sk); body.add(torso);
  const head = buildHead(sk); head.position.y = 1.98; body.add(head);
  const aL = buildArm(sk, -1), aR = buildArm(sk, 1);
  // плечевые шарниры
  const shL = new THREE.Group(), shR = new THREE.Group();
  shL.position.set(-0.43 * (sk.belly ? 1.12 : 1), 1.6, 0); shR.position.set(0.43 * (sk.belly ? 1.12 : 1), 1.6, 0);
  aL.position.set(0, 0, 0); aR.position.set(0, 0, 0);
  shL.add(aL); shR.add(aR); body.add(shL, shR);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.15, 0.92, 0); legR.position.set(0.15, 0.92, 0);
  legL.add(buildLeg(sk)); legR.add(buildLeg(sk)); body.add(legL, legR);
  root.userData.parts = { pivot, body, torso, head, armL: shL, armR: shR, legL, legR };
  root.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return root;
}

export const GUARD_SKIN = {
  id: 'guard', skin: '#eab48f', hair: '#4a3020', hair2: '#4a3020', hairStyle: 'guard', mustache: true,
  jacket: '#22356e', sleeve: '#22356e', trim: '#f2c230', inner: '#e8e8e8', letter: '#f2c230',
  pants: '#1b2a57', pants2: '#1b2a57', shoes: '#111111', sole: '#2a2a2a', vest: '#ff7a1a',
  cap: '#1b2a57', belly: true, flashlight: true,
};

// Анимация бега/прыжка/кувырка. t — время, mode: run|jump|roll|idle|fall|stumble
export function animateCharacter(ch, t, mode, k = 0) {
  const P = ch.userData.parts;
  const s = Math.sin(t), c = Math.cos(t);
  P.pivot.rotation.set(0, 0, 0); P.pivot.position.y = 0.9; P.pivot.scale.setScalar(1);
  P.body.position.y = -0.9; P.head.rotation.set(0, 0, 0); P.torso.rotation.set(0, 0, 0);
  if (mode === 'run') {
    P.legL.rotation.x = s * 0.95; P.legR.rotation.x = -s * 0.95;
    P.armL.rotation.set(-s * 0.9, 0, -0.12); P.armR.rotation.set(s * 0.9, 0, 0.12);
    P.body.position.y = -0.9 + Math.abs(c) * 0.09;
    P.pivot.rotation.x = -0.12;
    P.head.rotation.y = s * 0.06;
  } else if (mode === 'jump') {
    P.legL.rotation.x = -0.9; P.legR.rotation.x = 0.35;
    P.armL.rotation.set(-2.5, 0, -0.3); P.armR.rotation.set(-0.4, 0, 0.6);
    P.pivot.rotation.x = -0.15;
  } else if (mode === 'roll') {
    P.pivot.position.y = 0.48; P.pivot.scale.setScalar(0.85);
    P.pivot.rotation.x = -k * Math.PI * 2;
    P.legL.rotation.x = -1.6; P.legR.rotation.x = -1.6;
    P.armL.rotation.set(-1.2, 0, 0); P.armR.rotation.set(-1.2, 0, 0);
  } else if (mode === 'idle') {
    P.legL.rotation.x = 0; P.legR.rotation.x = 0;
    P.armL.rotation.set(0.05, 0, -0.12 - s * 0.02); P.armR.rotation.set(0.05, 0, 0.12 + s * 0.02);
    P.body.position.y = -0.9 + s * 0.015;
    P.head.rotation.y = Math.sin(t * 0.35) * 0.25;
  } else if (mode === 'fall') {
    P.pivot.rotation.x = Math.min(1, k) * 1.45; P.pivot.position.y = 0.9 - Math.min(1, k) * 0.6;
    P.legL.rotation.x = -0.4; P.legR.rotation.x = 0.2;
    P.armL.rotation.set(-2.6, 0, -0.5); P.armR.rotation.set(-2.6, 0, 0.5);
  } else if (mode === 'catch') {
    P.legL.rotation.x = 0; P.legR.rotation.x = 0;
    P.armL.rotation.set(-1.4, 0, -0.2); P.armR.rotation.set(-0.6 + s * 0.4, 0, 0.3);
  }
}

// ---------- поезда ----------
const TRAIN_PAL = [
  { body: '#e8c33a', stripe: '#2d7dd2', roof: '#d9d9d9' },
  { body: '#2d7dd2', stripe: '#ffffff', roof: '#cfd6de' },
  { body: '#e04a3a', stripe: '#ffffff', roof: '#d9d9d9' },
  { body: '#3aa35a', stripe: '#f2e14b', roof: '#cfd6de' },
];
const trainCache = new Map();
export function trainGeo(L, palIdx, moving) {
  const key = L + '|' + palIdx + '|' + (moving ? 1 : 0);
  if (trainCache.has(key)) return trainCache.get(key);
  const p = TRAIN_PAL[palIdx % TRAIN_PAL.length], b = new B(), H = CFG.TRAIN_H;
  const len = L - 0.3, zc = -L / 2;
  b.box('#3a3a40', 0, 0.38, zc, 1.8, 0.5, len - 0.8);                 // тележки
  for (const z of [-1.4, -L + 1.4]) for (const x of [-0.8, 0.8]) {
    b.cyl('#222226', x, 0.42, z, 0.36, 0.2, 0, 0, Math.PI / 2);
    b.cyl('#222226', x, 0.42, z - 0.9, 0.36, 0.2, 0, 0, Math.PI / 2);
  }
  b.box(p.body, 0, 0.6 + (H - 0.9) / 2, zc, 2.2, H - 0.9, len);       // корпус
  b.box(p.roof, 0, H - 0.15, zc, 2.0, 0.3, len - 0.2);                // крыша
  b.box(p.stripe, 0, 1.35, zc, 2.24, 0.26, len - 0.1);                 // полоса
  b.box(darker(p.body, 0.7), 0, 0.68, zc, 2.22, 0.12, len - 0.1);
  for (let z = -1.6; z > -L + 1.2; z -= 2.6) {
    for (const x of [-1.11, 1.11]) b.box('#1d2d50', x, 2.3, z, 0.04, 0.85, 1.6);
  }
  for (let z = -3.0; z > -L + 2; z -= 7.8) for (const x of [-1.115, 1.115]) {
    b.box(darker(p.body, 0.8), x, 1.65, z, 0.03, 2.0, 1.3);
    b.box('#1d2d50', x * 1.002, 2.15, z, 0.03, 0.7, 0.45);
  }
  // морда
  const fz = -0.15;
  b.box('#1d2d50', 0, 2.3, fz + 0.02, 1.7, 0.9, 0.06);
  b.box(p.stripe, 0, 1.35, fz + 0.02, 2.0, 0.26, 0.06);
  b.box('#333338', 0, 0.75, fz + 0.1, 2.1, 0.3, 0.25);                // бампер
  b.box('#f2f2f2', 0, 1.0, fz + 0.03, 0.5, 0.2, 0.05);                 // номер
  b.box('#e8e8e8', 0, 3.05, fz + 0.02, 0.9, 0.2, 0.05);                // табло
  if (!moving) for (const x of [-0.72, 0.72]) b.box('#c8c8a0', x, 1.0, fz + 0.04, 0.32, 0.2, 0.05);
  const g = b.geo(); trainCache.set(key, g); return g;
}
export const TRAIN_PAL_COUNT = TRAIN_PAL.length;

export function makeTrain(L, palIdx, moving) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(trainGeo(L, palIdx, moving), MAT.toon));
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

// ---------- окружение: кусок трассы 40 м ----------
export const SEG_LEN = 40;
export function makeSegmentGeo(variant) {
  const b = new B(), L = SEG_LEN, zc = -L / 2, r = rng(11 + variant * 5);
  b.box('#9b8a76', 0, -0.1, zc, 15, 0.2, L);
  for (const x of CFG.LANES) {
    b.box('#7a6a5a', x, 0.005, zc, 2.4, 0.02, L);
    for (let z = -0.5; z > -L; z -= 1.0) b.box('#6b4a2e', x, 0.06, z, 2.2, 0.1, 0.34);
    for (const dx of [-0.72, 0.72]) {
      b.box('#7d858f', x + dx, 0.15, zc, 0.12, 0.14, L);
      b.box('#d3dae2', x + dx, 0.225, zc, 0.07, 0.02, L);
    }
  }
  // трава за путями
  for (const sx of [-1, 1]) b.box('#5cbf3e', sx * 16, -0.05, zc, 17, 0.1, L);
  if (variant === 0) {
    // кирпичные арки (как у виадука)
    for (const sx of [-1, 1]) {
      const x = sx * 6.6;
      for (let z = 0; z > -L; z -= 8) {
        b.box('#c2412d', x, 3, z - 0.5, 1.2, 6, 1.4);
        b.box('#a8341f', x, 0.3, z - 0.5, 1.35, 0.6, 1.55);
        // свод арки ступеньками
        for (let k = 0; k < 4; k++) {
          const w = 6.6 - k * 1.65 - 0.3;
          b.box(k % 2 ? '#c2412d' : '#b83a27', x, 4.4 + k * 0.35, z - 4.5, 1.2, 0.36, Math.max(w, 0.6));
        }
      }
      b.box('#c2412d', x, 6.0, zc, 1.3, 0.9, L);
      b.box('#9c2f20', x, 6.55, zc, 1.5, 0.2, L);
      // кусты за аркой
      for (let i = 0; i < 9; i++) {
        const s = 1.4 + r() * 1.6;
        b.sph(r() < 0.5 ? '#3d9140' : '#4caf50', sx * (8.6 + r() * 3), s * 0.35, -r() * L, s * 1.3, s, s * 1.3, true);
      }
    }
  } else {
    // открытый участок: заборчик, деревья, опоры контактной сети
    for (const sx of [-1, 1]) {
      const x = sx * 5.6;
      for (let z = -1; z > -L; z -= 2.5) b.box('#e9e4d4', x, 0.5, z, 0.12, 1.0, 0.12);
      b.box('#e9e4d4', x, 0.8, zc, 0.08, 0.1, L);
      b.box('#e9e4d4', x, 0.4, zc, 0.08, 0.1, L);
      for (let i = 0; i < 5; i++) {
        const tx = sx * (8 + r() * 5), tz = -r() * L, h = 1.6 + r() * 1.2;
        b.cyl('#7a4b2a', tx, h / 2, tz, 0.22, h);
        b.sph(r() < 0.5 ? '#3d9140' : '#58b84a', tx, h + 1.0, tz, 2.6, 2.4, 2.6, true);
        b.sph('#4caf50', tx + 0.5, h + 1.8, tz - 0.3, 1.8, 1.6, 1.8, true);
      }
      for (let i = 0; i < 6; i++) { const s = 1 + r(); b.sph('#4caf50', sx * (6.6 + r() * 2), s * 0.3, -r() * L, s * 1.4, s, s * 1.4, true); }
    }
    for (let z = -10; z > -L; z -= 20) {
      for (const sx of [-1, 1]) b.box('#6d7480', sx * 4.6, 3.6, z, 0.25, 7.2, 0.25);
      b.box('#6d7480', 0, 7.0, z, 9.4, 0.22, 0.22);
    }
    for (const x of CFG.LANES) b.box('#3a3a40', x, 6.5, zc, 0.04, 0.04, L);
  }
  return b.geo();
}

// ---------- небо ----------
export function makeSky() {
  const g = new THREE.SphereGeometry(400, 24, 16), pos = g.getAttribute('position'), col = [];
  const top = new THREE.Color('#2f8fe0'), hor = new THREE.Color('#cdeeff'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 400;
    c.copy(hor).lerp(top, Math.min(1, Math.max(0, y * 2.2)));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  // облака
  const cb = new B(), r = rng(3);
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = 300, y = 70 + r() * 70;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    for (let k = 0; k < 4; k++) cb.sph('#ffffff', x + (k - 1.5) * 14, y + (k % 2) * 6, z, 26, 16, 18, true);
  }
  const clouds = new THREE.Mesh(cb.geo(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.9 }));
  m.add(clouds);
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
