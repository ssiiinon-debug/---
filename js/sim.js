'use strict';
// Симуляция общаги: заселение, плата, мусор, поломки, персонал, репутация.
// Работает только с состоянием s; о происходящем сообщает через Bus,
// чтобы графика могла нарисовать студента с чемоданом, монетки и т.п.

const Sim = {
  autoAcc: [],   // накопленная авто-плата по комнатам (для всплывающих «+N»)
  autoT: [],
  laundryAcc: 0,
  laundryT: 0,
  prevTier: -1,

  earn(s, amount) {
    if (!(amount > 0)) return;
    s.coins += amount;
    s.runEarned += amount;
    s.totalEarned += amount;
  },

  newOccupant(s) {
    return {
      id: s.nextId++,
      tier: Eco.pickTier(s),
      life: U.rand(CFG.STUDENT_LIFE[0], CFG.STUDENT_LIFE[1]),
      seed: (Math.random() * 1e9) | 0,
    };
  },

  boxCap(s, i) {
    return Math.max(CFG.BOX_MIN, Eco.roomIncome(s, i, true) * CFG.BOX_SECONDS);
  },
  laundryCap(s) {
    return Math.max(CFG.BOX_MIN, Eco.laundryIncome(s, Eco.roomsIncome(s, true)) * CFG.BOX_SECONDS);
  },

  // Мусор: trash — сколько кучек, tmask — на каких из трёх мест они лежат
  bits(m) { return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1); },
  syncTrash(r) { if (this.bits(r.tmask) !== r.trash) r.tmask = (1 << U.clamp(r.trash, 0, CFG.TRASH_MAX)) - 1; },
  addTrash(r) {
    this.syncTrash(r);
    const free = [];
    for (let k = 0; k < CFG.TRASH_MAX; k++) if (!(r.tmask & (1 << k))) free.push(k);
    if (!free.length) return;
    r.tmask |= 1 << U.pick(free);
    r.trash++;
  },
  removeTrash(r, pos) {
    this.syncTrash(r);
    if (pos === undefined) {
      const used = [];
      for (let k = 0; k < CFG.TRASH_MAX; k++) if (r.tmask & (1 << k)) used.push(k);
      if (!used.length) return;
      pos = U.pick(used);
    }
    if (!(r.tmask & (1 << pos))) return;
    r.tmask &= ~(1 << pos);
    r.trash--;
  },

  fixRoom(s, i, byPlumber) {
    const r = s.rooms[i];
    if (!r.broken) return;
    r.broken = false;
    r.fix = 0;
    Bus.emit('fixed', i, byPlumber);
  },

  update(s, dt) {
    s.time += dt;
    s.playTime += dt;
    if (s.boostLeft > 0) s.boostLeft = Math.max(0, s.boostLeft - dt);
    if (s.freeUpgT > 0) s.freeUpgT = Math.max(0, s.freeUpgT - dt);
    const fx = s.fx;
    if (fx.roach > 0) fx.roach = Math.max(0, fx.roach - dt);
    if (fx.net > 0) fx.net = Math.max(0, fx.net - dt);
    if (fx.hot > 0) fx.hot = Math.max(0, fx.hot - dt);
    for (let f = 0; f < fx.burn.length; f++) if (fx.burn[f] > 0) fx.burn[f] = Math.max(0, fx.burn[f] - dt);

    const valya = s.staff.valya > 0;
    const settle = s.staff.starosta > 0 ? CFG.STAFF.starosta.speed[s.staff.starosta - 1] : 1;
    let roomsInc = 0;
    const occupied = [];

    for (let i = 0; i < s.rooms.length; i++) {
      const r = s.rooms[i];
      if (!r.lvl) continue;
      this.syncTrash(r);
      if (this.autoAcc[i] === undefined) { this.autoAcc[i] = 0; this.autoT[i] = 1 + (i % 7) * 0.45; }

      // Заселение
      const cap = Eco.capacity(r.lvl);
      if (r.occ.length < cap) {
        r.arriveT -= dt * settle;
        if (r.arriveT <= 0) {
          const o = this.newOccupant(s);
          r.occ.push(o);
          r.arriveT = U.rand(CFG.ARRIVE_TIME[0], CFG.ARRIVE_TIME[1]);
          Bus.emit('arrive', i, o);
        }
      }
      // Выезд (студенты выпускаются, переезжают, отчисляются...)
      for (let k = r.occ.length - 1; k >= 0; k--) {
        const o = r.occ[k];
        o.life -= dt;
        if (o.life <= 0) {
          r.occ.splice(k, 1);
          r.arriveT = Math.max(r.arriveT, U.rand(CFG.ARRIVE_TIME[0], CFG.ARRIVE_TIME[1]));
          Bus.emit('leave', i, o);
        }
      }
      if (r.occ.length) occupied.push(i);

      // Плата: либо в копилку комнаты, либо тётя Валя собирает сама
      const inc = Eco.roomIncome(s, i);
      roomsInc += inc;
      if (valya) {
        const amt = r.box + inc * dt;
        r.box = 0;
        this.earn(s, amt);
        this.autoAcc[i] += amt;
        this.autoT[i] -= dt;
        if (this.autoT[i] <= 0) {
          this.autoT[i] = 4;
          if (this.autoAcc[i] > 0) Bus.emit('autoCollect', i, this.autoAcc[i]);
          this.autoAcc[i] = 0;
        }
      } else {
        r.box = Math.min(this.boxCap(s, i), r.box + inc * dt);
      }
    }

    // Прачечная — пассивный доход
    if (s.fac.laundry > 0) {
      const inc = Eco.laundryIncome(s, roomsInc);
      if (valya) {
        const amt = s.laundryBox + inc * dt;
        s.laundryBox = 0;
        this.earn(s, amt);
        this.laundryAcc += amt;
        this.laundryT -= dt;
        if (this.laundryT <= 0) {
          this.laundryT = 4;
          if (this.laundryAcc > 0) Bus.emit('autoCollect', 'laundry', this.laundryAcc);
          this.laundryAcc = 0;
        }
      } else {
        s.laundryBox = Math.min(this.laundryCap(s), s.laundryBox + inc * dt);
      }
    }

    // Мусор появляется тем чаще, чем больше жилых комнат
    s.trashT -= dt;
    if (s.trashT <= 0) {
      const cands = occupied.filter((i) => s.rooms[i].trash < CFG.TRASH_MAX);
      if (cands.length) {
        const i = U.weightedPick(cands, (k) => s.rooms[k].occ.length);
        this.addTrash(s.rooms[i]);
        Bus.emit('trash', i);
      }
      s.trashT = CFG.TRASH_INTERVAL / Math.sqrt(Math.max(1, occupied.length)) * U.rand(0.7, 1.3);
    }

    // Поломки
    s.breakT -= dt;
    if (s.breakT <= 0) {
      const cands = occupied.filter((i) => !s.rooms[i].broken);
      if (cands.length) {
        const i = U.pick(cands);
        s.rooms[i].broken = true;
        s.rooms[i].fix = CFG.FIX_TAPS;
        Bus.emit('break', i);
      }
      s.breakT = U.rand(CFG.BREAK_INTERVAL[0], CFG.BREAK_INTERVAL[1]);
    }

    // Михалыч
    if (s.staff.plumber > 0) {
      const job = s.plumberJob;
      if (job.target >= 0 && !s.rooms[job.target].broken) job.target = -1;
      if (job.target < 0) {
        const i = s.rooms.findIndex((r) => r.broken);
        if (i >= 0) { job.target = i; job.t = CFG.STAFF.plumber.delay[s.staff.plumber - 1]; }
      } else {
        job.t -= dt;
        if (job.t <= 0) { this.fixRoom(s, job.target, true); job.target = -1; }
      }
    }

    // Уборщица
    if (s.staff.cleaner > 0) {
      const job = s.cleanerJob;
      if (job.target >= 0 && s.rooms[job.target].trash <= 0) job.target = -1;
      if (job.target < 0) {
        let best = -1, bestTrash = 0;
        for (let i = 0; i < s.rooms.length; i++) {
          if (s.rooms[i].trash > bestTrash) { bestTrash = s.rooms[i].trash; best = i; }
        }
        if (best >= 0) { job.target = best; job.t = CFG.STAFF.cleaner.interval[s.staff.cleaner - 1]; }
      } else {
        job.t -= dt;
        if (job.t <= 0) {
          this.removeTrash(s.rooms[job.target]);
          Bus.emit('cleaned', job.target, true);
          job.target = -1;
        }
      }
    }

    // Репутация плавно тянется к цели (чистота, душевая, качалка, поломки)
    const tgt = Eco.repTarget(s);
    s.rep += (tgt - s.rep) * (1 - Math.exp(-CFG.REP_DRIFT * dt));
    s.rep = U.clamp(s.rep, 0, 100);
    const tier = Eco.topTier(s.rep);
    if (this.prevTier >= 0 && tier > this.prevTier) Bus.emit('tierUp', tier);
    this.prevTier = tier;
  },

  changeRep(s, delta) {
    s.rep = U.clamp(s.rep + delta, 0, 100);
    Bus.emit('rep', delta);
  },
};
