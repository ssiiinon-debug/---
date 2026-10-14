'use strict';
// Живые человечки: студенты в комнатах и персонал, который ходит по этажам.
// Логика поведения только визуальная — деньги и мусор считает Sim.

// Ходок: умеет идти по этажу и подниматься/спускаться по лестнице.
function makeWalker(kind, row, x) {
  return {
    kind, row, x, y: 0, tRow: row, tx: x, dir: 1, state: 'idle', anim: Math.random() * 10,
    climb: null, speed: 70, speedMul: 1, bubble: '', bubbleT: 0, visible: true, alpha: 1,
  };
}

const Walk = {
  stairCenter() { return L.stairX + L.STAIR / 2; },
  setTarget(w, row, x) { w.tRow = row; w.tx = x; },
  distTo(w) {
    if (w.row === w.tRow && !w.climb) return Math.abs(w.x - w.tx);
    const sc = this.stairCenter();
    return Math.abs(w.x - sc) + Math.abs(w.tx - sc) + Math.abs(w.row - w.tRow) * L.RH;
  },
  arrived(w) { return !w.climb && w.row === w.tRow && Math.abs(w.x - w.tx) < 2; },
  update(w, dt) {
    w.anim += dt;
    if (w.bubbleT > 0) w.bubbleT -= dt;
    const sp = w.speed * w.speedMul;
    if (w.climb) {
      const c = w.climb;
      c.p += dt * sp / 110;
      const up = c.to > c.from;
      const x0 = L.stairX + (up ? 10 : L.STAIR - 10), x1 = L.stairX + (up ? L.STAIR - 10 : 10);
      const k = Math.min(1, c.p);
      w.x = U.lerp(x0, x1, k);
      w.y = U.lerp(L.feetY(c.from), L.feetY(c.to), k);
      w.dir = x1 > x0 ? 1 : -1;
      w.state = 'walk';
      if (c.p >= 1) { w.row = c.to; w.climb = null; w.y = L.feetY(w.row); }
      return;
    }
    w.y = L.feetY(w.row);
    let goal = w.tx;
    if (w.row !== w.tRow) goal = L.stairX + (w.tRow > w.row ? 10 : L.STAIR - 10);
    const d = goal - w.x;
    if (Math.abs(d) > 1.5) {
      const step = Math.sign(d) * Math.min(Math.abs(d), sp * dt);
      w.x += step;
      w.dir = Math.sign(d);
      w.state = 'walk';
    } else {
      w.x = goal;
      if (w.row !== w.tRow) {
        w.climb = { from: w.row, to: w.row + Math.sign(w.tRow - w.row), p: 0 };
      } else if (w.state === 'walk') w.state = 'idle';
    }
  },
};

const Actors = {
  students: new Map(),
  leaving: [],
  spots: {},          // занятые спальные места: room -> {key: actorId}
  staff: {},
  ambientT: 6,

  reset() {
    this.students.clear();
    this.leaving = [];
    this.spots = {};
    const x0 = L.cellX(0) - 20;
    this.staff = {
      cleaner: makeWalker('cleaner', 0, x0 + 30),
      plumber: makeWalker('plumber', 0, x0 + 10),
      starosta: makeWalker('starosta', 1, L.cellX(1)),
    };
    this.staff.cleaner.speed = 75;
    this.staff.plumber.speed = 65;
    this.staff.starosta.speed = 55;
    this.staff.starosta.wanderT = 3;
    this.staff.cleaner.wanderT = 2;
    this.staff.plumber.wanderT = 4;
  },

  init() {
    this.reset();
    Bus.on('arrive', (i, o) => this.addStudent(i, o, true));
    Bus.on('leave', (i, o) => this.removeStudent(o.id, true));
    Bus.on('roomUp', (i) => this.wakeRoom(i));
  },

  addStudent(i, o, arriving) {
    if (this.students.has(o.id)) return;
    const look = A.makeLook(o.seed, o.tier, Game.s.building);
    const a = {
      id: o.id, i, look, x: arriving ? 26 : U.rand(56, L.CW - 18), tx: 0, dir: 1,
      state: arriving ? 'arrive' : 'idle', t: U.rand(0.5, 3), anim: Math.random() * 10,
      alpha: arriving ? 0 : 1, spot: null, bubble: '', bubbleT: 0, hop: 0,
    };
    a.tx = U.rand(60, L.CW - 18);
    this.students.set(o.id, a);
  },
  removeStudent(id, animate) {
    const a = this.students.get(id);
    if (!a) return;
    this.freeSpot(a);
    this.students.delete(id);
    if (animate) { a.state = 'leave'; a.leaveT = 0; this.leaving.push(a); }
  },
  // Сверяем актёров с данными (после загрузки, престижа и т.п.)
  sync(s) {
    const alive = new Set();
    s.rooms.forEach((r, i) => {
      for (const o of r.occ) {
        alive.add(o.id);
        if (!this.students.has(o.id)) this.addStudent(i, o, false);
      }
    });
    for (const id of Array.from(this.students.keys())) if (!alive.has(id)) this.removeStudent(id, false);
  },
  wakeRoom(i) {
    for (const a of this.students.values()) {
      if (a.i === i && (a.state === 'sleep' || a.state === 'sit')) { this.freeSpot(a); a.state = 'idle'; a.t = 0.5; }
    }
  },
  freeSpot(a) {
    if (a.spot && this.spots[a.i]) delete this.spots[a.i][a.spot.key];
    a.spot = null;
  },
  takeSpot(a, stage, kind) {
    const lay = ROOM_LAYOUT[stage];
    if (!lay) return null;
    const used = this.spots[a.i] || (this.spots[a.i] = {});
    const list = kind === 'sit' ? lay.sit : lay.beds.concat(lay.floor);
    const free = [];
    list.forEach((p, k) => {
      const key = kind + k;
      if (!used[key]) free.push({ key, x: p[0], y: p[1], floor: kind !== 'sit' && k >= lay.beds.length });
    });
    if (!free.length) return null;
    const sp = U.pick(free);
    used[sp.key] = a.id;
    a.spot = sp;
    return sp;
  },

  phrase(a, s) {
    const r = s.rooms[a.i];
    const st = Eco.stageOf(r.lvl);
    const f = Eco.floorOf(a.i);
    if (Events.partyFloor() === f) return U.pick(tArr('ph_party'));
    if (s.fx.net > 0 && Math.random() < 0.7) return U.pick(tArr('ph_net'));
    if (r.broken && Math.random() < 0.7) return U.pick(tArr('ph_broken'));
    if (r.trash >= 2 && Math.random() < 0.5) return U.pick(tArr('ph_trash'));
    if (a.look.tier === 3 && Math.random() < 0.4) return U.pick(tArr('ph_foreign'));
    if (Math.random() < 0.45) return U.pick(tArr('ph_stage' + st));
    if (s.building % CFG.BUILDING_THEMES === 1 && Math.random() < 0.3) return U.pick(tArr('ph_med'));
    return U.pick(tArr('ph_any'));
  },
  // Не больше трёх реплик одновременно, чтобы не было каши (клик игрока — всегда)
  say(a, text, dur, force) {
    if (!force) {
      let n = 0;
      for (const o of this.students.values()) if (o.bubbleT > 0) n++;
      if (n >= 3) return;
    }
    a.bubble = text;
    a.bubbleT = dur || 2.6;
  },

  update(s, dt, night) {
    const partyF = Events.partyFloor();
    const scaredF = Events.roachFloor();
    for (const a of this.students.values()) {
      const r = s.rooms[a.i];
      const stage = Eco.stageOf(r.lvl);
      const floor = Eco.floorOf(a.i);
      a.anim += dt;
      if (a.bubbleT > 0) a.bubbleT -= dt;
      if (a.hop > 0) a.hop = Math.max(0, a.hop - dt * 4);

      if (partyF === floor && a.state !== 'arrive') {
        if (a.state !== 'dance') { this.freeSpot(a); a.state = 'dance'; }
        continue;
      } else if (a.state === 'dance') { a.state = 'idle'; a.t = 1; }
      if (scaredF === floor && (a.state === 'sleep' || a.state === 'sit')) { this.freeSpot(a); a.state = 'idle'; a.t = 0; this.say(a, U.pick(tArr('ph_roach')), 2); }

      switch (a.state) {
        case 'arrive':
          a.alpha = Math.min(1, a.alpha + dt * 2.5);
          this.walkTo(a, dt, 30);
          if (Math.abs(a.x - a.tx) < 1.5) { a.state = 'idle'; a.t = U.rand(1, 3); if (Math.random() < 0.3) this.say(a, U.pick(tArr('ph_arrive')), 2.2); }
          break;
        case 'walk':
          this.walkTo(a, dt, 26);
          if (Math.abs(a.x - a.tx) < 1.5) { a.state = 'idle'; a.t = U.rand(1.5, 5); }
          break;
        case 'sleep':
        case 'sit':
          a.t -= dt;
          if (a.t <= 0) { this.freeSpot(a); a.state = 'idle'; a.t = U.rand(0.5, 2); }
          break;
        default: // idle
          a.t -= dt;
          if (a.t <= 0) {
            const rnd = Math.random();
            if (rnd < 0.12 + 0.6 * night && scaredF !== floor && this.takeSpot(a, stage, 'bed')) {
              a.state = 'sleep';
              a.t = U.rand(8, 18) + night * 25;
            } else if (rnd < 0.4 && ROOM_LAYOUT[stage] && ROOM_LAYOUT[stage].sit.length && this.takeSpot(a, stage, 'sit')) {
              a.state = 'sit';
              a.t = U.rand(6, 14);
            } else {
              a.state = 'walk';
              a.tx = U.rand(48, L.CW - 16);
            }
          }
      }
    }
    for (let k = this.leaving.length - 1; k >= 0; k--) {
      const a = this.leaving[k];
      a.anim += dt;
      a.tx = 26;
      this.walkTo(a, dt, 34);
      if (Math.abs(a.x - a.tx) < 2) { a.alpha -= dt * 2.5; if (a.alpha <= 0) this.leaving.splice(k, 1); }
    }

    // Иногда кто-нибудь что-нибудь говорит
    this.ambientT -= dt;
    if (this.ambientT <= 0) {
      this.ambientT = U.rand(5, 10);
      const list = Array.from(this.students.values()).filter((a) => a.state !== 'sleep' && a.bubbleT <= 0 && Render.isRowVisible(Eco.floorOf(a.i) + 1));
      if (list.length) { const a = U.pick(list); this.say(a, this.phrase(a, s)); }
    }

    this.updateStaff(s, dt);
  },

  walkTo(a, dt, speed) {
    const d = a.tx - a.x;
    if (Math.abs(d) > 1) { a.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt); a.dir = Math.sign(d); }
  },

  updateStaff(s, dt) {
    const st = this.staff;
    // Уборщица: идёт к мусору, который ей назначила симуляция
    const c = st.cleaner;
    if (s.staff.cleaner > 0) {
      const job = s.cleanerJob;
      if (job.target >= 0) {
        const row = Eco.floorOf(job.target) + 1;
        const tx = L.cellX(Eco.slotOf(job.target)) + 110;
        Walk.setTarget(c, row, tx);
        const dist = Walk.distTo(c);
        c.speedMul = U.clamp(dist / Math.max(0.3, job.t * 0.6) / c.speed, 1, 8);
        c.working = Walk.arrived(c);
      } else {
        c.working = false;
        c.speedMul = 1;
        c.wanderT -= dt;
        if (c.wanderT <= 0) { c.wanderT = U.rand(5, 10); this.wander(c, s); }
      }
      Walk.update(c, dt);
    }
    // Михалыч
    const p = st.plumber;
    if (s.staff.plumber > 0) {
      const job = s.plumberJob;
      if (job.target >= 0) {
        const row = Eco.floorOf(job.target) + 1;
        Walk.setTarget(p, row, L.cellX(Eco.slotOf(job.target)) + 86);
        const dist = Walk.distTo(p);
        p.speedMul = U.clamp(dist / Math.max(0.3, job.t * 0.6) / p.speed, 1, 8);
        p.working = Walk.arrived(p);
      } else {
        p.working = false;
        p.speedMul = 1;
        p.wanderT -= dt;
        if (p.wanderT <= 0) { p.wanderT = U.rand(8, 16); Walk.setTarget(p, 0, L.cellX(U.randInt(0, 3)) + U.rand(30, 170)); }
      }
      Walk.update(p, dt);
    }
    // Староста бродит по этажам и проверяет комнаты
    const k = st.starosta;
    if (s.staff.starosta > 0) {
      k.wanderT -= dt;
      if (k.wanderT <= 0) { k.wanderT = U.rand(7, 14); this.wander(k, s); }
      Walk.update(k, dt);
    }
  },
  wander(w, s) {
    const rows = [0];
    for (let r = 1; r <= s.floors; r++) rows.push(r);
    const row = Math.random() < 0.6 ? w.row : U.pick(rows);
    Walk.setTarget(w, U.clamp(row, 0, s.floors), L.cellX(U.randInt(0, 3)) + U.rand(30, 170));
  },

  // ---------- рисование ----------
  drawRoom(ctx, i, cx, cy, t) {
    for (const a of this.students.values()) if (a.i === i) this.drawStudent(ctx, a, cx, cy, t);
    for (const a of this.leaving) if (a.i === i) this.drawStudent(ctx, a, cx, cy, t);
  },
  drawStudent(ctx, a, cx, cy, t) {
    const hopY = -Math.sin(a.hop * Math.PI) * 10;
    if (a.state === 'sleep' && a.spot) {
      if (a.spot.floor) A.box(ctx, cx + a.spot.x - 26, cy + a.spot.y - 6, 52, 7, 3, '#6f8a5f', INK, 1.5);
      A.sleeper(ctx, cx + a.spot.x + 4, cy + a.spot.y + (a.spot.floor ? -2 : 0), a.look, a.anim, false);
      const zp = (a.anim * 0.6) % 1;
      ctx.globalAlpha = 1 - zp;
      A.text(ctx, 'z', cx + a.spot.x - 12 + zp * 8, cy + a.spot.y - 16 - zp * 18, 9 + zp * 5, '#5a6fd6', 'center', 900);
      ctx.globalAlpha = 1;
    } else if (a.state === 'sit' && a.spot) {
      A.student(ctx, cx + a.spot.x, cy + a.spot.y + hopY, a.look, 'sit', a.anim, 1);
    } else {
      let pose = 'stand';
      if (a.state === 'walk') pose = 'walk';
      else if (a.state === 'arrive' || a.state === 'leave') pose = 'carry';
      else if (a.state === 'dance') pose = 'dance';
      else if (Game.s.rooms[a.i] && Game.s.rooms[a.i].broken) pose = 'sad';
      A.student(ctx, cx + a.x, cy + L.FY + 7 + hopY, a.look, pose, a.anim, a.dir, a.alpha);
    }
  },
  drawBubbles(ctx, scale, s) {
    const size = Math.max(9, 11 / scale);
    for (const a of this.students.values()) {
      if (a.bubbleT <= 0 || !a.bubble) continue;
      const row = Eco.floorOf(a.i) + 1;
      const cx = L.cellX(Eco.slotOf(a.i)), cy = L.rowTop(row);
      let x = cx + a.x, y = cy + L.FY - 48;
      if (a.spot && (a.state === 'sleep' || a.state === 'sit')) { x = cx + a.spot.x; y = cy + a.spot.y - 24; }
      x = U.clamp(x, cx + 40, cx + L.CW - 40);
      A.bubble(ctx, x, Math.max(cy + size * 2.4, y), a.bubble, size, Math.min(1, a.bubbleT * 2));
    }
    for (const w of Object.values(this.staff)) {
      if (w.bubbleT > 0 && w.bubble) A.bubble(ctx, w.x, w.y - 56, w.bubble, size, Math.min(1, w.bubbleT * 2));
    }
  },
  drawStaff(ctx, s, t) {
    const st = this.staff;
    if (s.staff.cleaner > 0) A.cleaner(ctx, st.cleaner.x, st.cleaner.y, st.cleaner.anim, st.cleaner.dir, st.cleaner.working ? 'work' : st.cleaner.state);
    if (s.staff.plumber > 0) A.plumber(ctx, st.plumber.x, st.plumber.y, st.plumber.anim, st.plumber.dir, st.plumber.working ? 'work' : st.plumber.state);
    if (s.staff.starosta > 0) A.starosta(ctx, st.starosta.x, st.starosta.y, st.starosta.anim, st.starosta.dir, st.starosta.state);
  },

  hitStudent(wx, wy, rad) {
    let best = null, bd = Infinity;
    for (const a of this.students.values()) {
      const row = Eco.floorOf(a.i) + 1;
      const cx = L.cellX(Eco.slotOf(a.i)), cy = L.rowTop(row);
      let x = cx + a.x, y = cy + L.FY - 18;
      if (a.spot && (a.state === 'sleep' || a.state === 'sit')) { x = cx + a.spot.x; y = cy + a.spot.y - 6; }
      const d = Math.hypot(wx - x, (wy - y) * 0.7);
      if (d < Math.max(rad, 20) && d < bd) { bd = d; best = a; }
    }
    return best;
  },
  hitStaff(wx, wy, rad, s) {
    for (const [k, w] of Object.entries(this.staff)) {
      if (!(s.staff[k] > 0)) continue;
      if (Math.hypot(wx - w.x, (wy - (w.y - 22)) * 0.7) < Math.max(rad, 22)) return k;
    }
    return null;
  },
};
