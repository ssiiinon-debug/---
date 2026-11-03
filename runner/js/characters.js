// Детализированные персонажи: Тригот (бегун) и Охранник (догоняет).
// Всё собрано кодом: геометрия из примитивов, принты/джинса/резинки нарисованы на canvas.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { B, rng, gradTex } from './models.js';

// ---------- материалы ----------
const toon = (o) => new THREE.MeshToonMaterial(Object.assign({ gradientMap: gradTex }, o));
const leatherMat = (color) => new THREE.MeshPhongMaterial({ color, shininess: 70, specular: 0x6a6a78 });
const MATS = {
  vc: toon({ vertexColors: true }),
  vcShiny: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 80, specular: 0x777788 }),
  metal: new THREE.MeshPhongMaterial({ color: 0xd4dae2, shininess: 140, specular: 0xffffff }),
};

// ---------- canvas-текстуры ----------
const texCache = new Map();
function tex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}
function speckle(x, w, h, base, amt, n, seed = 1) {
  const r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const l = r() < 0.5;
    x.fillStyle = l ? `rgba(255,255,255,${amt * r()})` : `rgba(0,0,0,${amt * r()})`;
    x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

function arcText(x, text, cx, cy, R, font, layers) {
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  const widths = [...text].map(ch => x.measureText(ch).width * 1.02);
  const total = widths.reduce((a, b) => a + b, 0) / R;
  for (const L of layers) {
    let a = -total / 2;
    [...text].forEach((ch, i) => {
      const ang = a + widths[i] / 2 / R;
      x.save(); x.translate(cx + R * Math.sin(ang), cy - R * Math.cos(ang)); x.rotate(ang);
      if (L.stroke) { x.lineJoin = 'round'; x.lineWidth = L.w; x.strokeStyle = L.stroke; x.strokeText(ch, 0, 0); }
      else { x.fillStyle = L.fill; x.fillText(ch, 0, 0); }
      x.restore();
      a += widths[i] / R;
    });
  }
}

function drawBone(x, cx, cy, len, rot, s, outline = '#141418') {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s);
  const shape = (pad) => {
    x.beginPath();
    x.rect(-len / 2, -9 - pad, len, 18 + pad * 2);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { x.moveTo(sx * len / 2 + 12 + pad, sy * 10); x.arc(sx * len / 2, sy * 10, 12 + pad, 0, Math.PI * 2); }
  };
  shape(6); x.fillStyle = outline; x.fill();
  shape(0); x.fillStyle = '#f6f3ea'; x.fill();
  x.restore();
}

function printTex(sk, back) {
  return tex(`print|${sk.id}|${back}`, 512, 512, (x, w, h) => {
    speckle(x, w, h, sk.jacket, 0.12, 9000, 3);
    const fill = sk.textFill || '#141418', edge = sk.textEdge || '#ffffff';
    const layers = [{ stroke: fill, w: 30 }, { stroke: edge, w: 16 }, { fill }];
    if (!back) {
      // планка с кнопками
      x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(w / 2 - 14, 0, 28, h);
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(w / 2 - 1, 0, 2, h);
      for (let i = 0; i < 5; i++) {
        const y = 60 + i * 95;
        x.fillStyle = '#d9d9de'; x.beginPath(); x.arc(w / 2, y, 11, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#9a9aa4'; x.beginPath(); x.arc(w / 2, y, 5, 0, Math.PI * 2); x.fill();
      }
      arcText(x, sk.text || 'SUPREME', w / 2, 560, 420, `900 ${sk.textSize || 92}px "Arial Black", Impact, sans-serif`, layers);
      drawBone(x, 120, 370, 110, -0.6, 1.0);
      drawBone(x, 392, 370, 110, 0.6, 1.0);
    } else {
      arcText(x, sk.backText || '3GOTH', w / 2, 600, 430, '900 120px "Arial Black", Impact, sans-serif', layers);
      x.font = '900 86px "Arial Black", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineJoin = 'round'; x.lineWidth = 26; x.strokeStyle = fill; x.strokeText(sk.backSub || '2002', w / 2, 330);
      x.lineWidth = 13; x.strokeStyle = edge; x.strokeText(sk.backSub || '2002', w / 2, 330);
      x.fillStyle = fill; x.fillText(sk.backSub || '2002', w / 2, 330);
    }
  });
}

function ribTex(cols) {
  return tex('rib|' + cols.join(), 32, 64, (x, w, h) => {
    const seq = [cols[0], cols[1], cols[2], cols[1], cols[0], cols[0], cols[1], cols[2]];
    const sh = h / seq.length;
    seq.forEach((c, i) => { x.fillStyle = c; x.fillRect(0, i * sh, w, sh + 1); });
    for (let i = 0; i < w; i += 3) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(i, 0, 1, h); }
  });
}
function woolTex(color) { return tex('wool|' + color, 128, 128, (x, w, h) => speckle(x, w, h, color, 0.12, 2500, 5)); }
function boneTex() {
  return tex('bone', 64, 192, (x) => { drawBone(x, 32, 96, 120, Math.PI / 2, 0.42); });
}

function denimTex(sk) {
  return tex('denim|' + sk.id, 256, 512, (x, w, h) => {
    const r = rng(17);
    speckle(x, w, h, sk.pants, 0.18, 7000, 9);
    for (let i = 0; i < w; i += 2) { x.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.05})`; x.fillRect(i, 0, 1, h); }
    // потёртости
    for (let i = 0; i < 14; i++) {
      x.fillStyle = 'rgba(255,255,255,0.10)';
      x.beginPath(); x.ellipse(r() * w, r() * h, 20 + r() * 40, 6 + r() * 10, 0, 0, Math.PI * 2); x.fill();
    }
    // заплатки
    const patches = sk.patch || [];
    for (let i = 0; i < 9 && patches.length; i++) {
      const pw = 50 + r() * 70, ph = 50 + r() * 90, px = r() * (w - pw), py = r() * (h - ph);
      x.save(); x.translate(px + pw / 2, py + ph / 2); x.rotate((r() - 0.5) * 0.3);
      speckleRect(x, -pw / 2, -ph / 2, pw, ph, patches[i % patches.length], r);
      x.setLineDash([5, 4]); x.strokeStyle = 'rgba(240,230,200,0.75)'; x.lineWidth = 2;
      x.strokeRect(-pw / 2 + 4, -ph / 2 + 4, pw - 8, ph - 8); x.setLineDash([]);
      x.restore();
    }
    // дыры с нитками
    for (let i = 0; i < 6; i++) {
      const cx = r() * w, cy = 120 + r() * (h - 200), rw = 18 + r() * 22;
      x.fillStyle = '#2a2a33'; x.beginPath(); x.ellipse(cx, cy, rw, 8 + r() * 6, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(245,245,240,0.95)'; x.lineWidth = 2;
      for (let k = -2; k <= 2; k++) { x.beginPath(); x.moveTo(cx - rw, cy + k * 3.5); x.lineTo(cx + rw, cy + k * 3.5 + (r() - 0.5) * 3); x.stroke(); }
    }
  });
}
function speckleRect(x, X, Y, W, H, base, r) {
  x.fillStyle = base; x.fillRect(X, Y, W, H);
  for (let i = 0; i < W * H / 25; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'; x.fillRect(X + r() * W, Y + r() * H, 2, 2); }
  for (let i = 0; i < W; i += 3) { x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(X + i, Y, 1, H); }
}
// Часть текстуры (верх/низ, лево/право) — чтобы ноги не были одинаковыми
function texPart(t, ox, oy, sx, sy) {
  const c = t.clone(); c.needsUpdate = true; c.offset.set(ox, oy); c.repeat.set(sx, sy); return c;
}

// ---------- геометрии ----------
const GEO = {
  skull: new THREE.SphereGeometry(0.5, 28, 22),
  sph: new THREE.SphereGeometry(0.5, 14, 10),
  cap: new THREE.SphereGeometry(0.5, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
  cone: new THREE.ConeGeometry(1, 1, 6, 1),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  plane: new THREE.PlaneGeometry(1, 1),
};
const _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _d = new THREE.Vector3(), _p = new THREE.Vector3();

function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }

// ---------- голова и волосы ----------
function addStrand(b, color, root, dir, len, rad) {
  _d.copy(dir).normalize();
  _q.setFromUnitVectors(_up, _d);
  _p.copy(root).addScaledVector(_d, len / 2);
  b.addQ(GEO.cone, color, _p, _q, rad, len, rad);
}

function buildHair(b, sk) {
  const r = rng(sk.id === 'guard' ? 99 : 7);
  const c1 = sk.hair, c2 = sk.hair2, guard = sk.hairStyle === 'curtain';
  const col = () => (r() < 0.5 ? c1 : c2);
  b.add(GEO.cap, c1, 0, 0.04, 0.01, 0.67, 0.72, 0.65);
  b.add(GEO.sph, c1, 0, -0.04, 0.07, 0.6, 0.6, 0.56);
  const N = 210, root = new THREE.Vector3(), dir = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - y * y), th = i * 2.39996;
    const nx = Math.cos(th) * rad, nz = Math.sin(th) * rad;
    if (y < -0.35) continue;
    if (nz < -0.3 && y < 0.55) continue;                // лицо открыто
    root.set(nx * 0.3, y * 0.31 + 0.04, nz * 0.29);
    const sideness = Math.abs(nx), backness = Math.max(0, nz);
    if (guard) {
      dir.set(nx * 0.35, -1, nz * 0.25 + 0.05);
      const len = 0.22 + (1 - Math.max(0, y)) * 0.22 + r() * 0.06;
      dir.x += (r() - 0.5) * 0.25; dir.z += (r() - 0.5) * 0.2;
      addStrand(b, col(), root, dir, len, 0.06 + r() * 0.03);
    } else {
      // лохматый шег: верх торчит в стороны, низ — пёрышками наружу
      const flick = y < 0.15 ? 0.9 : 0.55;
      dir.set(nx * flick, -0.75 + y * 0.25, nz * flick * 0.8 + backness * 0.2);
      dir.x += (r() - 0.5) * 0.5; dir.y += (r() - 0.5) * 0.4; dir.z += (r() - 0.5) * 0.4;
      const len = 0.16 + r() * 0.12 + sideness * 0.05 + (y < 0.1 ? 0.06 : 0);
      addStrand(b, col(), root, dir, len, 0.065 + r() * 0.035);
    }
  }
  // чёлка
  const n = guard ? 12 : 11;
  for (let i = 0; i < n; i++) {
    const fx = -0.25 + (i / (n - 1)) * 0.5;
    if (guard && Math.abs(fx) < 0.04) continue;          // прямой пробор
    root.set(fx, 0.21 + (guard ? 0.03 : 0), -0.24);
    if (guard) dir.set(Math.sign(fx) * 0.45 + fx, -1, -0.28);
    else dir.set(fx * 0.6 + (r() - 0.5) * 0.4, -1, -0.45);
    const len = guard ? 0.2 + Math.abs(fx) * 0.35 : 0.15 + r() * 0.08;
    addStrand(b, col(), root, dir, len, 0.06 + r() * 0.025);
  }
  // пряди по бокам у ушей
  for (const s of [-1, 1]) for (let i = 0; i < (guard ? 4 : 3); i++) {
    root.set(s * 0.29, 0.06 - i * 0.04, -0.08 + i * 0.07);
    dir.set(s * (guard ? 0.25 : 0.8), -1, guard ? -0.05 : 0.1);
    addStrand(b, col(), root, dir, guard ? 0.34 : 0.2, 0.07);
  }
}

function buildHead(sk) {
  const b = new B();
  const skin = sk.skin, dark = '#141418';
  b.add(GEO.skull, skin, 0, 0, 0, 0.6, 0.64, 0.58);
  b.add(GEO.sph, skin, 0, -0.1, -0.03, 0.5, 0.42, 0.48);             // щёки/подбородок
  b.add(GEO.sph, skin, -0.295, -0.02, 0.02, 0.09, 0.15, 0.1);
  b.add(GEO.sph, skin, 0.295, -0.02, 0.02, 0.09, 0.15, 0.1);
  for (const s of [-1, 1]) {
    const ex = s * 0.105;
    b.add(GEO.sph, '#ffffff', ex, -0.01, -0.255, 0.13, 0.135, 0.05);
    b.add(GEO.sph, sk.eye || '#5a3a22', ex - s * 0.005, -0.015, -0.276, 0.088, 0.1, 0.035);
    b.add(GEO.sph, '#0a0a0c', ex - s * 0.005, -0.017, -0.289, 0.045, 0.052, 0.02);
    b.add(GEO.sph, '#ffffff', ex + 0.02, 0.0, -0.291, 0.024, 0.024, 0.01);
    b.box(dark, ex, 0.052, -0.272, 0.145, 0.026, 0.03, 0.15, 0, -s * 0.12);  // подводка
    if (sk.liner) b.box(dark, s * 0.172, 0.04, -0.252, 0.05, 0.016, 0.02, 0, s * 0.5, s * 0.35);
    b.box(sk.brow || sk.hair, ex, 0.118, -0.272, 0.12, 0.024, 0.03, 0.15, 0, -s * (sk.angryBrow ? 0.3 : 0.08));
  }
  b.add(GEO.sph, sk.skinDark || '#d9a37f', 0, -0.07, -0.285, 0.06, 0.075, 0.06);
  b.box('#6a2a2a', 0.01, -0.165, -0.262, 0.09, 0.014, 0.02, 0, 0, sk.angryBrow ? -0.05 : 0.12);
  b.box('#d9958a', 0, -0.18, -0.256, 0.05, 0.012, 0.02);
  if (sk.piercing) for (const px of [-0.035, 0.035]) b.add(GEO.sph, '#dcdce4', px, -0.188, -0.252, 0.016, 0.016, 0.016);
  buildHair(b, sk);
  return b.mesh(MATS.vc);
}

// ---------- туловище ----------
function buildTorso(sk, body) {
  const W = 0.64, H = 0.56, D = 0.36, Y = 1.33;
  if (sk.top === 'varsity') {
    body.add(mesh(new RoundedBoxGeometry(W, H, D, 3, 0.07), toon({ map: woolTex(sk.jacket) }), 0, Y, 0));
    const pw = W - 0.1, ph = H - 0.12;
    const front = mesh(new THREE.PlaneGeometry(pw, ph), toon({ map: printTex(sk, false) }), 0, Y + 0.02, -D / 2 - 0.002);
    front.rotation.y = Math.PI; body.add(front);
    body.add(mesh(new THREE.PlaneGeometry(pw, ph), toon({ map: printTex(sk, true) }), 0, Y + 0.02, D / 2 + 0.002));
    const rib = toon({ map: ribTex(sk.rib) });
    body.add(mesh(new RoundedBoxGeometry(W + 0.02, 0.09, D + 0.02, 2, 0.035), rib, 0, Y - H / 2 + 0.02, 0));
    const collar = mesh(new THREE.TorusGeometry(0.155, 0.045, 8, 22), rib, 0, Y + H / 2 + 0.01, 0);
    collar.rotation.x = Math.PI / 2; body.add(collar);
    body.add(mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.06, 14), toon({ color: sk.inner || '#141418' }), 0, Y + H / 2, 0));
  } else {
    // кожанка
    const lm = leatherMat(sk.jacket);
    body.add(mesh(new RoundedBoxGeometry(W, H, D, 3, 0.07), lm, 0, Y, 0));
    body.add(mesh(new RoundedBoxGeometry(W + 0.02, 0.08, D + 0.02, 2, 0.03), lm, 0, Y - H / 2 + 0.02, 0));
    body.add(mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.11, 18, 1, true), lm, 0, Y + H / 2 + 0.03, 0));
    const b = new B(), s = '#cfd5dd';
    b.box(s, 0.02, Y, -D / 2 - 0.006, 0.014, H - 0.04, 0.01);           // молния
    b.box(s, 0.02, Y + 0.17, -D / 2 - 0.012, 0.03, 0.06, 0.01);         // бегунок
    b.box(s, -0.16, Y + 0.08, -D / 2 - 0.004, 0.11, 0.01, 0.01, 0, 0, -0.5);
    b.box(s, 0.19, Y + 0.08, -D / 2 - 0.004, 0.11, 0.01, 0.01, 0, 0, 0.5);
    b.box(s, -0.17, Y - 0.12, -D / 2 - 0.004, 0.01, 0.12, 0.01);
    b.box(s, 0.21, Y - 0.12, -D / 2 - 0.004, 0.01, 0.12, 0.01);
    b.cyl(s, -0.06, Y + H / 2 + 0.05, -0.15, 0.015, 0.01, Math.PI / 2, 0, 0);
    b.cyl(s, 0.08, Y + H / 2 + 0.05, -0.15, 0.015, 0.01, Math.PI / 2, 0, 0);
    // швы на спине и кокетка
    b.box('#2a2a30', 0, Y + 0.12, D / 2 + 0.004, W - 0.08, 0.012, 0.01);
    b.box('#2a2a30', -0.12, Y - 0.06, D / 2 + 0.004, 0.012, 0.34, 0.01);
    b.box('#2a2a30', 0.12, Y - 0.06, D / 2 + 0.004, 0.012, 0.34, 0.01);
    body.add(b.mesh(MATS.vcShiny));
    body.add(mesh(new THREE.CylinderGeometry(0.105, 0.11, 0.05, 14), toon({ color: '#141418' }), 0, Y + H / 2 + 0.02, 0));
  }
  body.add(mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.14, 14), toon({ color: sk.skin }), 0, Y + H / 2 + 0.06, 0));
  // таз
  const hipMat = sk.pantsType === 'leather' ? leatherMat(sk.pants) : toon({ map: texPart(denimTex(sk), 0, 0.85, 1, 0.15) });
  body.add(mesh(new RoundedBoxGeometry(0.58, 0.22, 0.34, 2, 0.06), hipMat, 0, 1.0, 0));
}

// ---------- руки ----------
function buildArm(sk, side) {
  const sh = new THREE.Group(); sh.position.set(side * 0.4, 1.55, 0);
  const sleeveMat = sk.sleeveType === 'leather' ? leatherMat(sk.sleeve) : toon({ map: woolTex(sk.sleeve) });
  sh.add(mesh(new THREE.SphereGeometry(0.12, 14, 10), sleeveMat));
  sh.add(mesh(new THREE.CapsuleGeometry(0.095, 0.2, 4, 12), sleeveMat, 0, -0.16, 0));
  const el = new THREE.Group(); el.position.y = -0.31; sh.add(el);
  el.add(mesh(new THREE.CapsuleGeometry(0.09, 0.18, 4, 12), sleeveMat, 0, -0.12, 0));
  const cuffMat = sk.top === 'varsity' ? toon({ map: ribTex(sk.rib) }) : sleeveMat;
  el.add(mesh(new THREE.CylinderGeometry(0.097, 0.092, 0.07, 14), cuffMat, 0, -0.25, 0));
  if (sk.top === 'varsity') {
    const bone = mesh(new THREE.PlaneGeometry(0.07, 0.2), toon({ map: boneTex(), transparent: true, alphaTest: 0.4 }), side * 0.093, -0.1, 0);
    bone.rotation.y = side * Math.PI / 2; el.add(bone);
  } else {
    // молния на манжете кожанки
    const z = mesh(GEO.box, MATS.metal, side * 0.088, -0.2, 0); z.scale.set(0.01, 0.1, 0.012); el.add(z);
  }
  const hb = new B();
  hb.add(GEO.sph, sk.skin, 0, -0.33, -0.01, 0.17, 0.19, 0.13);
  hb.add(GEO.sph, sk.skin, -side * 0.06, -0.31, -0.06, 0.07, 0.11, 0.07);
  el.add(hb.mesh(MATS.vc));
  if (sk.weapon === 'hatchet' && side > 0) el.add(buildHatchet());
  return { sh, el };
}

function buildHatchet() {
  const g = new THREE.Group(); g.position.set(0, -0.34, 0);
  const handle = mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.56, 10), MATS.metal, 0, 0, -0.18);
  handle.rotation.x = Math.PI / 2; g.add(handle);
  const grip = mesh(new THREE.CylinderGeometry(0.032, 0.03, 0.16, 10), toon({ color: '#e8e8ec' }), 0, 0, 0.02);
  grip.rotation.x = Math.PI / 2; g.add(grip);
  const sh = new THREE.Shape();
  sh.moveTo(-0.06, 0.05); sh.lineTo(0.06, 0.05); sh.lineTo(0.06, -0.03);
  sh.lineTo(0.13, -0.2); sh.quadraticCurveTo(0, -0.25, -0.13, -0.2); sh.lineTo(-0.06, -0.03); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 });
  geo.translate(0, 0, -0.015); geo.rotateY(Math.PI / 2);
  const head = mesh(geo, MATS.metal, 0, 0, -0.42); g.add(head);
  return g;
}

// ---------- ноги ----------
function buildLeg(sk, side) {
  const hip = new THREE.Group(); hip.position.set(side * 0.15, 0.95, 0);
  let thighMat, shinMat;
  if (sk.pantsType === 'leather') thighMat = shinMat = leatherMat(sk.pants);
  else {
    const d = denimTex(sk), ox = side > 0 ? 0.5 : 0;
    thighMat = toon({ map: texPart(d, ox, 0.45, 0.5, 0.4) });
    shinMat = toon({ map: texPart(d, ox, 0.0, 0.5, 0.45) });
  }
  const flare = sk.pantsType === 'leather' ? 0.18 : 0.2;
  hip.add(mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.46, 16), thighMat, 0, -0.22, 0));
  const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
  knee.add(mesh(new THREE.SphereGeometry(0.14, 14, 10), thighMat));
  knee.add(mesh(new THREE.CylinderGeometry(0.14, flare, 0.35, 16, 1, true), shinMat, 0, -0.175, 0));
  const inner = mesh(new THREE.CylinderGeometry(0.135, flare - 0.01, 0.35, 16, 1, true), toon({ color: '#1a1a22', side: THREE.BackSide }), 0, -0.175, 0); knee.add(inner);
  // ботинок-берц
  const b = new B(), c = sk.boots || '#141416', sole = '#26262a', lace = '#4a4a52';
  const by = -0.38;
  b.cyl(c, 0, by + 0.04, 0, 0.105, 0.2);
  b.add(GEO.box, c, 0, by - 0.05, -0.07, 0.22, 0.15, 0.34);
  b.add(GEO.sph, c, 0, by - 0.06, -0.22, 0.22, 0.15, 0.18);
  b.box(sole, 0, by - 0.13, -0.08, 0.26, 0.07, 0.44);
  b.box('#3a3a40', 0, by - 0.105, -0.08, 0.265, 0.015, 0.445);
  for (let i = 0; i < 4; i++) {
    const y = by + 0.03 - i * 0.035, z = -0.1 - i * 0.03;
    b.box(lace, 0, y, z, 0.12, 0.012, 0.015, 0, 0, 0.35);
    b.box(lace, 0, y, z, 0.12, 0.012, 0.015, 0, 0, -0.35);
  }
  b.box('#5a5a62', 0, by + 0.12, 0.1, 0.05, 0.06, 0.02);              // петля сзади
  knee.add(b.mesh(MATS.vcShiny));
  return { hip, knee };
}

// ---------- сборка персонажа ----------
export function makeCharacter(sk) {
  const root = new THREE.Group(), pivot = new THREE.Group();
  pivot.position.y = 0.95; root.add(pivot);
  const body = new THREE.Group(); body.position.y = -0.95; pivot.add(body);
  buildTorso(sk, body);
  const head = buildHead(sk); head.position.y = 1.98; body.add(head);
  const L = buildArm(sk, -1), R = buildArm(sk, 1);
  body.add(L.sh, R.sh);
  const lL = buildLeg(sk, -1), lR = buildLeg(sk, 1);
  body.add(lL.hip, lR.hip);
  root.userData.parts = {
    pivot, body, head, armL: L.sh, armR: R.sh, elL: L.el, elR: R.el,
    legL: lL.hip, legR: lR.hip, knL: lL.knee, knR: lR.knee, weapon: !!sk.weapon,
  };
  return root;
}

export const GUARD_SKIN = {
  id: 'guard', skin: '#f0d2bf', skinDark: '#dcb49c', eye: '#3a3a44', hair: '#121216', hair2: '#24242c', hairStyle: 'curtain',
  angryBrow: true, liner: true, top: 'leather', jacket: '#16161a', sleeve: '#16161a', sleeveType: 'leather',
  pants: '#141418', pantsType: 'leather', boots: '#101012', weapon: 'hatchet',
};

// ---------- анимация ----------
// mode: run | jump | roll | idle | fall | catch ; k — прогресс (кувырок/падение)
export function animateCharacter(ch, t, mode, k = 0) {
  const P = ch.userData.parts;
  const s = Math.sin(t), c = Math.cos(t);
  P.pivot.rotation.set(0, 0, 0); P.pivot.position.y = 0.95; P.pivot.scale.setScalar(1);
  P.body.position.y = -0.95; P.head.rotation.set(0, 0, 0);
  P.armL.rotation.set(0, 0, -0.1); P.armR.rotation.set(0, 0, 0.1);
  P.elL.rotation.set(0, 0, 0); P.elR.rotation.set(0, 0, 0);
  P.legL.rotation.set(0, 0, 0); P.legR.rotation.set(0, 0, 0);
  P.knL.rotation.set(0, 0, 0); P.knR.rotation.set(0, 0, 0);
  if (mode === 'run') {
    P.legL.rotation.x = s * 0.85; P.legR.rotation.x = -s * 0.85;
    P.knL.rotation.x = -(0.25 + Math.max(0, -Math.sin(t - 0.6)) * 1.5);
    P.knR.rotation.x = -(0.25 + Math.max(0, Math.sin(t - 0.6)) * 1.5);
    P.armL.rotation.x = -s * 0.8; P.armR.rotation.x = s * 0.8;
    P.elL.rotation.x = 1.25; P.elR.rotation.x = 1.25;
    if (P.weapon) { P.armR.rotation.x = 2.0 + s * 0.25; P.elR.rotation.x = 0.4; }
    P.body.position.y = -0.95 + Math.abs(c) * 0.08;
    P.pivot.rotation.x = -0.14;
    P.head.rotation.y = s * 0.05; P.head.rotation.x = 0.08;
  } else if (mode === 'jump') {
    P.legL.rotation.x = 1.0; P.knL.rotation.x = -1.4; P.legR.rotation.x = -0.3; P.knR.rotation.x = -0.6;
    P.armL.rotation.set(-2.3, 0, -0.4); P.armR.rotation.set(-0.5, 0, 0.7);
    P.elL.rotation.x = 0.4; P.elR.rotation.x = 0.9;
    P.pivot.rotation.x = -0.12;
  } else if (mode === 'roll') {
    P.pivot.position.y = 0.5; P.pivot.scale.setScalar(0.85);
    P.pivot.rotation.x = -k * Math.PI * 2;
    P.legL.rotation.x = 1.9; P.legR.rotation.x = 1.9; P.knL.rotation.x = -2.3; P.knR.rotation.x = -2.3;
    P.armL.rotation.x = 1.2; P.armR.rotation.x = 1.2; P.elL.rotation.x = 1.6; P.elR.rotation.x = 1.6;
  } else if (mode === 'idle') {
    P.armL.rotation.set(0.05, 0, -0.1 - s * 0.02); P.armR.rotation.set(0.05, 0, 0.1 + s * 0.02);
    P.elL.rotation.x = 0.15; P.elR.rotation.x = 0.15;
    if (P.weapon) { P.armR.rotation.set(0.35, 0, 0.15); P.elR.rotation.x = 1.9; }
    P.legL.rotation.z = -0.05; P.legR.rotation.z = 0.05;
    P.body.position.y = -0.95 + s * 0.012;
    P.head.rotation.y = Math.sin(t * 0.35) * 0.25;
  } else if (mode === 'fall') {
    const f = Math.min(1, k);
    P.pivot.rotation.x = f * 1.45; P.pivot.position.y = 0.95 - f * 0.62;
    P.legL.rotation.x = 0.5; P.knL.rotation.x = -0.6; P.legR.rotation.x = 0.2;
    P.armL.rotation.set(2.6, 0, -0.5); P.armR.rotation.set(2.6, 0, 0.5);
  } else if (mode === 'catch') {
    P.armL.rotation.set(1.3, 0, -0.2); P.elL.rotation.x = 0.3;
    P.armR.rotation.x = 2.6 + s * 0.5; P.elR.rotation.x = 0.3;
    P.legL.rotation.x = 0.25; P.knL.rotation.x = -0.3; P.legR.rotation.x = -0.2;
  }
}
