'use strict';
// Случайные события — то, что делает общагу живой.
// Одновременно идёт одно событие. Каждое можно решить руками или мгновенно — за видео.

const EV_ICONS = { roach: '🪳', fire: '🔥', party: '🎉', inspect: '👮', parcel: '📦', net: '📶', hot: '🚿', cat: '🐈' };

const Events = {
  active: null,
  nextT: CFG.EVENT_FIRST,
  lastType: '',

  reset() { this.active = null; this.nextT = Math.min(this.nextT, CFG.EVENT_FIRST); },

  partyFloor() { return this.active && this.active.type === 'party' ? this.active.f : -1; },
  roachFloor() { return this.active && this.active.type === 'roach' ? this.active.f : -1; },

  occupiedFloors(s) {
    const out = [];
    for (let f = 0; f < s.floors; f++) {
      for (let k = 0; k < CFG.ROOMS_PER_FLOOR; k++) if (s.rooms[f * CFG.ROOMS_PER_FLOOR + k].occ.length) { out.push(f); break; }
    }
    return out;
  },
  eligible(s) {
    const occ = this.occupiedFloors(s);
    const list = [];
    const add = (type) => { if (type !== this.lastType) list.push(type); };
    if (occ.length) add('roach');
    if (s.kitchens.some((l, f) => l > 0 && f < s.floors && !(s.fx.burn[f] > 0))) add('fire');
    if (occ.length && Eco.students(s) >= 3) add('party');
    if (Eco.openRooms(s) >= 3) add('inspect');
    add('parcel');
    if (Eco.openRooms(s) >= 2 && !(s.fx.net > 0)) add('net');
    if (s.fac.shower > 0 && !(s.fx.hot > 0)) add('hot');
    if (occ.length) add('cat');
    return list;
  },

  update(s, dt) {
    const ev = this.active;
    if (!ev) {
      if (s.goal < 3 && s.playTime < 240) return;
      this.nextT -= dt;
      if (this.nextT <= 0) {
        this.nextT = U.rand(CFG.EVENT_INTERVAL[0], CFG.EVENT_INTERVAL[1]);
        const list = this.eligible(s);
        if (list.length) this.start(s, U.weightedPick(list, (k) => CFG.EVENTS[k].w));
      }
      return;
    }
    ev.t += dt;
    ev.anim += dt;
    switch (ev.type) {
      case 'roach': this.updateRoaches(s, ev, dt); break;
      case 'inspect': this.updateInspector(s, ev, dt); break;
      case 'cat': this.updateCat(s, ev, dt); break;
      case 'party':
        if (Math.random() < dt * 3) {
          const x = L.cellX(U.randInt(0, 2)) + U.rand(30, 170);
          FX.text(x, L.rowTop(ev.f + 1) + 60, U.pick(['♪', '♫', '♬']), U.pick(['#ff5ad1', '#5ad1ff', '#ffe95a']), 18, 1.4);
        }
        break;
    }
    if (this.active && ev.t >= ev.dur) this.timeout(s, ev);
  },

  start(s, type) {
    const cfg = CFG.EVENTS[type];
    const ev = { type, t: 0, anim: 0, dur: cfg.dur, taps: 0, need: 0 };
    const occ = this.occupiedFloors(s);
    switch (type) {
      case 'roach': {
        ev.f = U.pick(occ);
        ev.roaches = [];
        const n = 6 + Math.min(4, ev.f);
        for (let k = 0; k < n; k++) ev.roaches.push(this.newRoach(ev.f + 1));
        ev.need = n;
        break;
      }
      case 'fire': {
        const fl = [];
        s.kitchens.forEach((l, f) => { if (l > 0 && f < s.floors && !(s.fx.burn[f] > 0)) fl.push(f); });
        ev.f = U.pick(fl);
        ev.need = cfg.hp;
        break;
      }
      case 'party': ev.f = occ.indexOf(2) >= 0 && Math.random() < 0.5 ? 2 : U.pick(occ); break;
      case 'inspect':
        ev.walker = makeWalker('inspector', 0, L.stairX + 4);
        ev.walker.speed = 55;
        ev.route = [];
        for (let r = 0; r <= s.floors; r++) ev.route.push(r);
        ev.leg = 0;
        break;
      case 'parcel': break;
      case 'net': ev.need = cfg.taps; s.fx.net = cfg.dur; break;
      case 'hot': ev.need = cfg.taps; s.fx.hot = cfg.dur; break;
      case 'cat': {
        ev.f = U.pick(occ);
        const fromLeft = Math.random() < 0.5;
        ev.walker = makeWalker('cat', ev.f + 1, fromLeft ? L.cellX(0) - 30 : L.cellX(3) + L.CW + 10);
        ev.walker.speed = 40;
        ev.dirSign = fromLeft ? 1 : -1;
        Walk.setTarget(ev.walker, ev.f + 1, fromLeft ? L.cellX(3) + L.CW - 30 : L.cellX(0) + 30);
        break;
      }
    }
    this.active = ev;
    this.lastType = type;
    Bus.emit('eventStart', type, ev);
  },

  newRoach(row) {
    const a = Math.random() * Math.PI * 2, v = U.rand(45, 85);
    return {
      x: U.rand(L.cellX(0) + 20, L.cellX(3) + L.CW - 20),
      y: L.rowTop(row) + U.rand(40, L.FY + 4),
      vx: Math.cos(a) * v, vy: Math.sin(a) * v, turn: U.rand(0.3, 1.2), alive: true, row,
    };
  },
  updateRoaches(s, ev, dt) {
    const minX = L.cellX(0) + 8, maxX = L.cellX(3) + L.CW - 8;
    for (const r of ev.roaches) {
      if (!r.alive) continue;
      const minY = L.rowTop(r.row) + 20, maxY = L.rowTop(r.row) + L.FY + 8;
      r.turn -= dt;
      if (r.turn <= 0) {
        const a = Math.random() * Math.PI * 2, v = U.rand(45, 90);
        r.vx = Math.cos(a) * v; r.vy = Math.sin(a) * v * 0.6; r.turn = U.rand(0.3, 1.2);
      }
      r.x += r.vx * dt; r.y += r.vy * dt;
      if (r.x < minX || r.x > maxX) { r.vx *= -1; r.x = U.clamp(r.x, minX, maxX); }
      if (r.y < minY || r.y > maxY) { r.vy *= -1; r.y = U.clamp(r.y, minY, maxY); }
    }
  },
  updateInspector(s, ev, dt) {
    const w = ev.walker;
    if (Walk.arrived(w)) {
      if (ev.leg < ev.route.length) {
        const row = ev.route[ev.leg++];
        Walk.setTarget(w, row, L.cellX(U.randInt(1, 3)) + U.rand(40, 160));
      }
    }
    w.speedMul = 1.6;
    Walk.update(w, dt);
  },
  updateCat(s, ev, dt) {
    const w = ev.walker;
    Walk.update(w, dt);
    if (Walk.arrived(w)) Walk.setTarget(w, w.row, ev.dirSign > 0 ? L.cellX(3) + L.CW + 40 : L.cellX(0) - 40);
  },

  // ---------- исходы ----------
  reward(s, sec, min) { return Eco.incomeReward(s, sec, min); },

  finish(s, ok, msgKey, params) {
    const ev = this.active;
    if (!ev) return;
    this.active = null;
    if (ev.type === 'net') s.fx.net = 0;
    if (ev.type === 'hot') s.fx.hot = 0;
    if (ok) s.stats.events++;
    Bus.emit('eventEnd', ev.type, ok, msgKey, params);
  },
  succeed(s, viaAd) {
    const ev = this.active;
    if (!ev) return;
    switch (ev.type) {
      case 'roach': {
        if (viaAd) for (const r of ev.roaches) { if (r.alive) { r.alive = false; FX.splat(r.x, r.y); } }
        const c = this.reward(s, 12, 20);
        Game.earn(c, true);
        Sim.changeRep(s, 3);
        this.finish(s, true, 'ev_roach_ok', { c: U.fmt(c) });
        break;
      }
      case 'fire': {
        const c = this.reward(s, 15, 25);
        Game.earn(c, true);
        Sim.changeRep(s, 4);
        this.finish(s, true, 'ev_fire_ok', { c: U.fmt(c) });
        break;
      }
      case 'inspect': this.inspectResult(s, true); break;
      case 'net': Sim.changeRep(s, 2); this.finish(s, true, 'ev_net_ok'); break;
      case 'hot': Sim.changeRep(s, 2); this.finish(s, true, 'ev_hot_ok'); break;
      case 'cat': {
        const c = this.reward(s, 20, 30);
        Game.earn(c, true);
        Sim.changeRep(s, 3);
        FX.text(ev.walker.x, ev.walker.y - 40, t('meow'), '#ffffff', 16, 1.4);
        this.finish(s, true, 'ev_cat_ok', { c: U.fmt(c) });
        break;
      }
    }
  },
  timeout(s, ev) {
    switch (ev.type) {
      case 'roach':
        s.fx.roach = CFG.EVENTS.roach.debuff;
        Sim.changeRep(s, -2);
        this.finish(s, false, 'ev_roach_fail');
        break;
      case 'fire':
        s.fx.burn[ev.f] = CFG.EVENTS.fire.burn;
        Sim.changeRep(s, -6);
        this.finish(s, false, 'ev_fire_fail', { f: ev.f + 1 });
        break;
      case 'party':
        Sim.changeRep(s, -4);
        this.finish(s, false, 'ev_party_ignored');
        break;
      case 'inspect': this.inspectResult(s, false); break;
      case 'parcel': this.finish(s, false, 'ev_parcel_gone'); break;
      case 'net': this.finish(s, false, 'ev_net_self'); break;
      case 'hot': this.finish(s, false, 'ev_hot_self'); break;
      case 'cat': this.finish(s, false, 'ev_cat_gone'); break;
    }
  },
  inspectResult(s, forced) {
    const clean = Eco.cleanliness(s);
    const ok = forced || (clean >= 0.8 && Eco.brokenCount(s) === 0);
    if (ok) {
      const c = this.reward(s, 90, 100);
      Game.earn(c, true);
      Sim.changeRep(s, 10);
      this.finish(s, true, 'ev_inspect_ok', { c: U.fmt(c) });
    } else {
      const fine = Math.floor(Math.min(s.coins * 0.1, this.reward(s, 45, 10)));
      s.coins = Math.max(0, s.coins - fine);
      Sim.changeRep(s, -8);
      this.finish(s, false, 'ev_inspect_fail', { c: U.fmt(fine) });
    }
  },
  // Решить за рекламу
  adResolve(s) {
    const ev = this.active;
    if (!ev) return;
    if (ev.type === 'inspect') {
      for (const r of s.rooms) { r.trash = 0; r.tmask = 0; if (r.broken) { r.broken = false; r.fix = 0; } }
    }
    if (ev.type === 'party') { this.partyChoice(s, 'ad'); return; }
    this.succeed(s, true);
  },
  partyChoice(s, choice) {
    const ev = this.active;
    if (!ev || ev.type !== 'party') return;
    if (choice === 'calm') {
      Sim.changeRep(s, 6);
      this.finish(s, true, 'ev_party_calm');
    } else if (choice === 'fine') {
      const c = this.reward(s, 60, 50);
      Game.earn(c, true);
      Sim.changeRep(s, -8);
      this.finish(s, true, 'ev_party_fine', { c: U.fmt(c) });
    } else {
      const c = this.reward(s, 60, 50);
      Game.earn(c, true);
      Sim.changeRep(s, 3);
      this.finish(s, true, 'ev_party_deal', { c: U.fmt(c) });
    }
  },

  // ---------- клики по объектам события ----------
  hit(s, wx, wy, rad) {
    const ev = this.active;
    if (!ev) return false;
    switch (ev.type) {
      case 'roach': {
        let best = null, bd = Math.max(rad, 24);
        for (const r of ev.roaches) {
          if (!r.alive) continue;
          const d = Math.hypot(wx - r.x, wy - r.y);
          if (d < bd) { bd = d; best = r; }
        }
        if (!best) return false;
        best.alive = false;
        ev.taps++;
        FX.splat(best.x, best.y);
        Sound.play('squish');
        Game.earn(Eco.tapValue(s), false, best.x, best.y);
        if (ev.roaches.every((r) => !r.alive)) this.succeed(s, false);
        return true;
      }
      case 'fire': {
        const p = this.firePos(ev);
        if (Math.hypot(wx - p.x, wy - p.y) > Math.max(rad, 55)) return false;
        ev.taps++;
        FX.foam(p.x + U.rand(-20, 20), p.y + U.rand(-10, 10));
        Sound.play('spray');
        if (ev.taps >= ev.need) this.succeed(s, false);
        return true;
      }
      case 'parcel': {
        const p = this.parcelPos();
        if (Math.hypot(wx - p.x, wy - p.y) > Math.max(rad, 40)) return false;
        const c = this.reward(s, 45, 40);
        FX.sparkle(p.x, p.y, 20);
        Sound.play('parcel');
        this.finish(s, true, '', {});
        UI.parcelModal(c);
        return true;
      }
      case 'net': {
        const p = this.routerPos();
        if (Math.hypot(wx - p.x, wy - p.y) > Math.max(rad, 40)) return false;
        ev.taps++;
        FX.burst(p.x, p.y, 4, ['#5ee87a', '#ffffff'], 70, 2.5, 100, 0.4);
        Sound.play('tap');
        if (ev.taps >= ev.need) this.succeed(s, false);
        return true;
      }
      case 'hot': {
        const p = this.boilerPos();
        if (Math.hypot(wx - p.x, wy - p.y) > Math.max(rad, 40)) return false;
        ev.taps++;
        FX.burst(p.x, p.y, 4, ['#ff9a3d', '#ffffff'], 70, 2.5, 100, 0.4);
        Sound.play('fix');
        if (ev.taps >= ev.need) this.succeed(s, false);
        return true;
      }
      case 'cat': {
        const w = ev.walker;
        if (Math.hypot(wx - w.x, wy - (w.y - 14)) > Math.max(rad, 32)) return false;
        Sound.play('meow');
        this.succeed(s, false);
        return true;
      }
      case 'inspect': {
        const w = ev.walker;
        if (Math.hypot(wx - w.x, wy - (w.y - 24)) > Math.max(rad, 26)) return false;
        w.bubble = U.pick(tArr('ph_inspector'));
        w.bubbleT = 2.5;
        return true;
      }
    }
    return false;
  },

  firePos(ev) { return { x: L.cellX(3) + 126, y: L.rowTop(ev.f + 1) + 88 }; },
  parcelPos() { return { x: L.cellX(0) + 64, y: L.rowTop(0) + L.FY - 2 }; },
  routerPos() { return { x: L.stairX + 45, y: L.rowTop(1) + 62 }; },
  boilerPos() { return { x: L.cellX(1) + 23, y: L.rowTop(0) + 45 }; },
  focusRow() {
    const ev = this.active;
    if (!ev) return -1;
    switch (ev.type) {
      case 'roach': case 'fire': case 'party': case 'cat': return ev.f + 1;
      case 'net': return 1;
      case 'hot': case 'parcel': return 0;
      default: return -1;
    }
  },

  // ---------- рисование ----------
  drawWorld(ctx, t, sc) {
    const ev = this.active;
    if (!ev) return;
    if (ev.type === 'inspect') A.inspector(ctx, ev.walker.x, ev.walker.y, ev.walker.anim, ev.walker.dir, ev.walker.state);
    if (ev.type === 'cat') A.cat(ctx, ev.walker.x, ev.walker.y, ev.walker.anim, ev.walker.dir, ev.walker.state === 'walk');
  },
  drawOver(ctx, t, sc) {
    const ev = this.active;
    if (!ev) return;
    const size = Math.max(12, 12 / sc);
    if (ev.type === 'roach') {
      for (const r of ev.roaches) A.roach(ctx, r.x, r.y, Math.atan2(r.vy, r.vx), t, !r.alive);
    } else if (ev.type === 'fire') {
      const p = this.firePos(ev);
      const k = 1 - ev.taps / ev.need;
      const grow = 0.6 + Math.min(1, ev.t / ev.dur) * 0.8;
      for (let j = 0; j < 7; j++) {
        const fx = p.x + (j - 3) * 9 * grow, fl = (26 + Math.sin(t * 12 + j * 1.7) * 8) * grow * (0.3 + 0.7 * k);
        ctx.globalCompositeOperation = 'lighter';
        A.ell(ctx, fx, p.y - fl * 0.45, 9 * grow * (0.4 + 0.6 * k), fl * 0.7, 'rgba(255,120,30,0.7)', null);
        A.ell(ctx, fx, p.y - fl * 0.3, 5 * grow * (0.4 + 0.6 * k), fl * 0.45, 'rgba(255,230,90,0.8)', null);
        ctx.globalCompositeOperation = 'source-over';
      }
      for (let j = 0; j < 3; j++) {
        const pp = (t * 0.6 + j / 3) % 1;
        A.circ(ctx, p.x + Math.sin(pp * 5 + j) * 14, p.y - 30 - pp * 70, 10 + pp * 14, 'rgba(70,70,70,' + (0.45 * (1 - pp)) + ')', null);
      }
      this.tapIcon(ctx, p.x + 50, p.y - 50, '🧯', t, size);
    } else if (ev.type === 'party') {
      const row = ev.f + 1, y = L.rowTop(row);
      ctx.globalCompositeOperation = 'lighter';
      for (let c = 0; c < 3; c++) {
        const x = L.cellX(c);
        const hue = (t * 120 + c * 90) % 360;
        const g = ctx.createRadialGradient(x + 100, y + 20, 5, x + 100, y + 80, 120);
        g.addColorStop(0, 'hsla(' + hue + ',100%,60%,0.45)');
        g.addColorStop(1, 'hsla(' + hue + ',100%,60%,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, L.CW, L.CH);
      }
      ctx.globalCompositeOperation = 'source-over';
      const bx = L.cellX(1) + 100;
      A.line(ctx, bx, y, bx, y + 18, '#555', 1.5);
      A.circ(ctx, bx, y + 26, 9, '#d8dde3');
      for (let k = 0; k < 6; k++) A.rect(ctx, bx - 6 + (k % 3) * 4, y + 20 + Math.floor(k / 3) * 6, 3, 3, (k + Math.floor(t * 8)) % 2 ? '#ffffff' : '#7f8c99');
    } else if (ev.type === 'parcel') {
      const p = this.parcelPos();
      const b = Math.abs(Math.sin(t * 5)) * 8;
      A.box(ctx, p.x - 18, p.y - 28 - b, 36, 28, 3, '#c9944f');
      A.rect(ctx, p.x - 3, p.y - 28 - b, 6, 28, '#e8c07a');
      A.line(ctx, p.x - 18, p.y - 18 - b, p.x + 18, p.y - 18 - b, '#a8743a', 2);
      A.text(ctx, '❤', p.x + 10, p.y - 10 - b, 9, '#e74c3c', 'center', 900);
      if (Math.random() < 0.15) FX.sparkle(p.x + U.rand(-20, 20), p.y - 30 - b, 2);
      this.tapIcon(ctx, p.x, p.y - 70, '👆', t, size);
    } else if (ev.type === 'net') {
      const p = this.routerPos();
      A.circ(ctx, p.x, p.y, 18 + Math.sin(t * 6) * 3, 'rgba(255,60,60,0.25)', '#ff3b3b', 2);
      this.tapIcon(ctx, p.x + 4, p.y - 46, '🔄', t, size);
      A.text(ctx, ev.taps + '/' + ev.need, p.x, p.y + 30, size, '#fff', 'center', 900, INK);
    } else if (ev.type === 'hot') {
      const p = this.boilerPos();
      A.circ(ctx, p.x, p.y, 22 + Math.sin(t * 6) * 3, 'rgba(80,160,255,0.25)', '#2a7fd6', 2);
      this.tapIcon(ctx, p.x + 30, p.y - 30, '🔧', t, size);
      A.text(ctx, ev.taps + '/' + ev.need, p.x, p.y + 36, size, '#fff', 'center', 900, INK);
    }
  },
  tapIcon(ctx, x, y, icon, t, size) {
    const s = 1 + Math.sin(t * 7) * 0.12;
    A.circ(ctx, x, y, size * 1.4 * s, '#ffffff', INK, 2);
    A.text(ctx, icon, x, y + 1, size * 1.4 * s, INK, 'center', 400);
  },

  view(s) {
    const ev = this.active;
    if (!ev) return null;
    const v = { type: ev.type, icon: EV_ICONS[ev.type], left: Math.max(0, ev.dur - ev.t), dur: ev.dur, buttons: [] };
    const fl = (ev.f !== undefined) ? ev.f + 1 : 0;
    v.title = t('ev_' + ev.type + '_title', { f: fl });
    v.text = t('ev_' + ev.type + '_text', { f: fl });
    if (ev.need) v.progress = ev.type === 'roach' ? ev.taps + '/' + ev.need : '';
    if (ev.type === 'party') {
      v.buttons.push({ id: 'party_calm', label: t('ev_party_calm_btn') });
      v.buttons.push({ id: 'party_fine', label: t('ev_party_fine_btn', { c: U.fmt(this.reward(s, 60, 50)) }) });
      v.buttons.push({ id: 'party_ad', label: t('ev_party_ad_btn'), ad: true });
    } else if (ev.type !== 'parcel' && ev.type !== 'cat') {
      v.buttons.push({ id: 'ev_ad', label: t('ev_' + ev.type + '_ad'), ad: true });
    }
    return v;
  },
};
