// Трасса: куски окружения, генерация препятствий, монеты, бонусы.
// Координата вдоль пути — s (метры вперёд). В мире z = -s.
import * as THREE from 'three';
import { CFG } from './config.js';
import {
  MAT, SEG_LEN, makeSegmentGeo, makeTrain, makeLow, makeHigh, makeRamp, coinGeo, makePowerSprite, TRAIN_PAL_COUNT,
} from './models.js';

const LANES = CFG.LANES;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const MAX_COINS = 400;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group(); scene.add(this.root);
    // окружение
    this.segGeos = [makeSegmentGeo(0), makeSegmentGeo(1)];
    this.segs = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Group();
      m.add(new THREE.Mesh(this.segGeos[0].geo, MAT.toon), new THREE.Mesh(this.segGeos[0].glow, MAT.glow));
      this.root.add(m); this.segs.push(m);
    }
    // монеты — один InstancedMesh
    this.coinMesh = new THREE.InstancedMesh(coinGeo(), MAT.coin, MAX_COINS);
    this.coinMesh.frustumCulled = false;
    this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(this.coinMesh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._one = new THREE.Vector3(1, 1, 1);
    this._axis = new THREE.Vector3(0, 1, 0);
    this.reset();
  }

  reset() {
    if (this.obs) this.obs.forEach(o => this.root.remove(o.mesh));
    if (this.powers) this.powers.forEach(p => this.root.remove(p.mesh));
    this.obs = []; this.coins = []; this.powers = [];
    this.genS = 0;
    this.laneEnd = [-999, -999, -999];
    this.segVariant = 0;
    this.segs.forEach((m, i) => this.placeSeg(m, i));
    this.nextSegIdx = this.segs.length;
    this.sectionCount = 0;
  }

  placeSeg(m, idx) {
    m.position.set(0, 0, -(idx - 1) * SEG_LEN);
    // каждые 3 куска — смена пейзажа
    const g = this.segGeos[Math.floor(idx / 3) % 2];
    m.children[0].geometry = g.geo; m.children[1].geometry = g.glow;
    m.userData.idx = idx;
  }

  // ---------- создание объектов ----------
  addObs(type, lane, s0, len, opts = {}) {
    const x = LANES[lane];
    let mesh, y0 = 0, y1 = 0, hw = CFG.TRAIN_HW;
    if (type === 'train') { mesh = makeTrain(len, opts.pal ?? Math.floor(Math.random() * TRAIN_PAL_COUNT), !!opts.moving); y1 = CFG.TRAIN_H; }
    else if (type === 'low') { mesh = makeLow(); y1 = 1.1; len = 0.35; hw = 1.0; }
    else if (type === 'high') { mesh = makeHigh(); y0 = 1.35; y1 = 2.9; len = 0.3; hw = 1.0; }
    else if (type === 'ramp') { mesh = makeRamp(); len = CFG.RAMP_LEN; y1 = CFG.TRAIN_H; }
    mesh.position.set(x, 0, -s0);
    this.root.add(mesh);
    const o = { type, lane, x, s0, s1: s0 + len, len, y0, y1, hw, mesh, moving: !!opts.moving, active: false, ps0: s0, dead: false };
    this.obs.push(o);
    if (!o.moving) this.laneEnd[lane] = Math.max(this.laneEnd[lane], o.s1);
    else this.laneEnd[lane] = Math.max(this.laneEnd[lane], o.s1 + 40);
    return o;
  }

  addCoin(lane, s, y) { this.coins.push({ lane, x: LANES[lane], s, y, alive: true, pull: false }); }
  coinLine(lane, s0, s1, yFn = () => 1.0, step = 2.2) {
    for (let s = s0; s <= s1; s += step) this.addCoin(lane, s, yFn(s));
  }
  coinArc(lane, sc, base = 0) {
    for (let i = -3; i <= 3; i++) {
      const s = sc + i * 1.4, k = 1 - (i / 3.6) ** 2;
      this.addCoin(lane, s, base + 1.0 + k * 1.6);
    }
  }
  addPower(lane, s, kind) {
    kind = kind || pick(Object.keys(CFG.POWERS));
    const mesh = makePowerSprite(kind);
    mesh.position.set(LANES[lane], 1.2, -s);
    this.root.add(mesh);
    this.powers.push({ kind, lane, x: LANES[lane], s, y: 1.2, mesh, alive: true });
  }

  // ---------- генерация ----------
  difficulty(speed) { return Math.min(1, (speed - CFG.SPEED0) / (CFG.SPEED_MAX - CFG.SPEED0)); }

  generate(playerS, speed) {
    let added = false;
    while (this.genS < playerS + CFG.VIEW_AHEAD) { this.section(speed); added = true; }
    if (added) this.coins.sort((a, b) => a.s - b.s);
  }

  section(speed) {
    const d = this.difficulty(speed), S = this.genS;
    const gap = 9 + speed * 0.55;
    this.sectionCount++;
    if (S < 50) { this.coinLine(1, 20, 44); this.genS = 60; return; }
    const r = Math.random();
    let end;
    if (r < 0.28) end = this.tBarriers(S, d);
    else if (r < 0.58) end = this.tTrains(S, d);
    else if (r < 0.74) end = this.tMoving(S, d);
    else if (r < 0.9) end = this.tZigzag(S, d, speed);
    else end = this.tBreather(S);
    this.genS = end + gap * rnd(0.9, 1.3);
  }

  tBarriers(S, d) {
    const n = Math.random() < 0.25 + d * 0.5 ? (Math.random() < d * 0.6 ? 3 : 2) : 1;
    const lanes = shuffle([0, 1, 2]);
    const blocked = lanes.slice(0, n), free = lanes.slice(n);
    for (const l of blocked) {
      const type = Math.random() < 0.55 ? 'low' : 'high';
      this.addObs(type, l, S);
      if (type === 'low' && Math.random() < 0.5) this.coinArc(l, S);
    }
    if (free.length) this.coinLine(free[0], S - 8, S + 8);
    else if (Math.random() < 0.5) this.coinLine(blocked[0], S + 2, S + 10);
    return S + 2;
  }

  tTrains(S, d) {
    const L = 2 * Math.round(rnd(9, 15 + d * 6));
    const p = Math.floor(Math.random() * 3);
    let pal = Math.floor(Math.random() * TRAIN_PAL_COUNT);
    let end = S + L;
    const ramp = Math.random() < 0.55;
    for (let l = 0; l < 3; l++) {
      if (l === p) continue;
      if (Math.random() < 0.82) {
        const off = ramp ? CFG.RAMP_LEN : rnd(0, 6);
        this.addObs('train', l, S + off, L, { pal: (pal++) % TRAIN_PAL_COUNT });
        end = Math.max(end, S + off + L);
      }
    }
    if (ramp) {
      this.addObs('ramp', p, S);
      this.addObs('train', p, S + CFG.RAMP_LEN, L, { pal: (pal++) % TRAIN_PAL_COUNT });
      const H = CFG.TRAIN_H, RL = CFG.RAMP_LEN;
      this.coinLine(p, S + 1, S + RL + L - 1, s => (s < S + RL ? (s - S) / RL * H : H) + 1.0);
      if (Math.random() < 0.15) this.addPower(p, S + RL + L * 0.5, null);
      end = Math.max(end, S + RL + L);
    } else {
      if (d > 0.25 && Math.random() < 0.6) {
        const type = Math.random() < 0.5 ? 'low' : 'high';
        this.addObs(type, p, S + L * 0.5);
        this.coinLine(p, S, S + L * 0.5 - 4);
        if (type === 'low') this.coinArc(p, S + L * 0.5);
      } else {
        this.coinLine(p, S, S + L);
        if (Math.random() < 0.12) this.addPower(p, S + L + 4, null);
      }
    }
    return end;
  }

  tMoving(S, d) {
    const cand = [0, 1, 2].filter(l => this.laneEnd[l] < S - 75);
    if (!cand.length) return this.tBarriers(S, d);
    const m = pick(cand), L = 2 * Math.round(rnd(8, 11));
    this.addObs('train', m, S + 12, L, { moving: true, pal: Math.floor(Math.random() * TRAIN_PAL_COUNT) });
    const others = shuffle([0, 1, 2].filter(l => l !== m));
    if (Math.random() < 0.6) {
      const l = others[0];
      if (Math.random() < 0.4) {
        this.addObs('ramp', l, S);
        this.addObs('train', l, S + CFG.RAMP_LEN, L);
        this.coinLine(l, S + 1, S + CFG.RAMP_LEN + L - 1, s => (s < S + CFG.RAMP_LEN ? (s - S) / CFG.RAMP_LEN * CFG.TRAIN_H : CFG.TRAIN_H) + 1.0);
      } else this.addObs('train', l, S + rnd(4, 12), L);
    }
    this.coinLine(others[1], S, S + L + 8);
    return S + 12 + L;
  }

  tZigzag(S, d, speed) {
    const rows = 3 + Math.floor(d * 3), step = Math.max(11, speed * 0.62);
    let free = Math.floor(Math.random() * 3);
    for (let i = 0; i < rows; i++) {
      const s = S + i * step;
      for (let l = 0; l < 3; l++) if (l !== free) this.addObs(Math.random() < 0.5 ? 'low' : 'high', l, s);
      this.coinLine(free, s - 3, s + 3, () => 1.0, 1.5);
      let nf; do { nf = Math.max(0, Math.min(2, free + (Math.random() < 0.5 ? -1 : 1))); } while (nf === free);
      free = nf;
    }
    return S + (rows - 1) * step + 2;
  }

  tBreather(S) {
    const l = Math.floor(Math.random() * 3);
    this.coinLine(l, S, S + 26);
    this.addPower((l + 1 + Math.floor(Math.random() * 2)) % 3, S + 14);
    return S + 26;
  }

  // ---------- кадр ----------
  update(dt, playerS, t, magnetOn, player) {
    // окружение: переносим пройденные куски вперёд
    for (const m of this.segs) {
      if (-m.position.z + SEG_LEN < playerS - 15) this.placeSeg(m, this.nextSegIdx++);
    }
    // встречные поезда
    for (const o of this.obs) {
      o.ps0 = o.s0;
      if (o.moving) {
        if (!o.active && o.s0 - playerS < CFG.MOVING_WAKE) o.active = true;
        if (o.active) { o.s0 -= CFG.MOVING_SPEED * dt; o.s1 = o.s0 + o.len; o.mesh.position.z = -o.s0; }
      }
    }
    // уборка позади
    if (this.obs.length && this.obs.some(o => o.s1 < playerS - 25)) {
      this.obs = this.obs.filter(o => { if (o.s1 < playerS - 25) { this.root.remove(o.mesh); return false; } return true; });
    }
    let k = 0;
    while (k < this.coins.length && (this.coins[k].s < playerS - 10 || !this.coins[k].alive) && k < 50) k++;
    if (k) this.coins.splice(0, k);
    this.powers = this.powers.filter(p => {
      if (!p.alive || p.s < playerS - 10) { this.root.remove(p.mesh); return false; }
      p.mesh.position.y = p.y + Math.sin(t * 3 + p.s) * 0.15;
      return true;
    });

    // монеты: магнит + отрисовка
    const q = this._q.setFromAxisAngle(this._axis, t * 3), M = this._m, v = this._v;
    let n = 0;
    for (const c of this.coins) {
      if (!c.alive) continue;
      if (c.s > playerS + CFG.VIEW_AHEAD) break;
      if (magnetOn && !c.pull && c.s - playerS < 22 && c.s > playerS - 1) c.pull = true;
      if (c.pull) {
        const k2 = Math.min(1, dt * 12);
        c.x += (player.x - c.x) * k2; c.y += (player.y + 1.0 - c.y) * k2; c.s += (playerS - c.s) * k2;
      }
      if (n < MAX_COINS) { v.set(c.x, c.y, -c.s); M.compose(v, q, this._one); this.coinMesh.setMatrixAt(n++, M); }
    }
    this.coinMesh.count = n;
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  removeObs(o) { o.dead = true; this.root.remove(o.mesh); this.obs = this.obs.filter(x => x !== o); }

  // Очистить путь впереди (после воскрешения)
  clearAhead(s0, s1) {
    for (const o of [...this.obs]) if (o.s1 > s0 && o.s0 < s1) this.removeObs(o);
  }
}
