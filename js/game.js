'use strict';
// Главный контроллер: связывает симуляцию, графику, интерфейс, рекламу и сохранения.

const Game = {
  s: null,
  sel: null,
  hint: null,
  adOpen: false,
  hidden: false,
  platformPaused: false,
  hiddenAt: 0,
  valyaMood: 0,
  saveT: CFG.LOCAL_SAVE_EVERY,
  cloudT: CFG.CLOUD_SAVE_EVERY,
  goalT: 0,
  quipT: 50,
  lastFrame: 0,
  lastInterstitial: 0,
  freeNotified: true,
  prestigeNotified: false,
  newPlayer: false,
  lastGoalSaid: -1,

  init(save) {
    this.newPlayer = !save;
    this.s = save || State.create();
    this.lastInterstitial = Date.now();
    Sound.setSfx(this.s.sfx);
    Sound.setMusic(this.s.music);
    Actors.init();
    Actors.sync(this.s);
    Sim.prevTier = Eco.topTier(this.s.rep);
    this.ensureGoal();
    this.prestigeNotified = Eco.canPrestige(this.s);
    this.bindBus();
  },

  bindBus() {
    Bus.on('eventStart', (type) => {
      Sound.play(type === 'inspect' || type === 'fire' ? 'alarm' : 'event');
      UI.showEvent();
      UI.say(t('v_ev_' + type), 5);
      const row = Events.focusRow();
      if (row >= 0) Render.focusRow(row);
    });
    Bus.on('eventEnd', (type, ok, msgKey, params) => {
      UI.hideEvent();
      if (msgKey) { UI.toast(t(msgKey, params), ok ? 'good' : 'bad'); Sound.play(ok ? 'goal' : 'fail'); }
    });
    Bus.on('fixed', (i, byPlumber) => {
      const p = this.roomPos(i);
      FX.sparkle(p.x, p.y + 30, 10);
      if (byPlumber && Math.random() < 0.4) { const w = Actors.staff.plumber; w.bubble = U.pick(tArr('q_plumber')); w.bubbleT = 2.5; }
    });
    Bus.on('cleaned', (i, auto) => {
      const p = this.roomPos(i);
      FX.dust(p.x, p.y + 110, 4);
      if (auto && Math.random() < 0.25) { const w = Actors.staff.cleaner; w.bubble = U.pick(tArr('q_cleaner')); w.bubbleT = 2.5; }
    });
    Bus.on('break', (i) => {
      const p = this.roomPos(i);
      if (Render.isRowVisible(Eco.floorOf(i) + 1)) FX.text(p.x, p.y + 40, '!', '#ff5a3c', 24, 1);
    });
    Bus.on('autoCollect', (i, amount) => {
      let x, y, row;
      if (i === 'laundry') { x = L.cellX(2) + L.CW / 2; y = L.rowTop(0) + 50; row = 0; }
      else { const p = this.roomPos(i); x = p.x; y = p.y + 30; row = Eco.floorOf(i) + 1; }
      if (Render.isRowVisible(row)) FX.text(x + U.rand(-30, 30), y, '+' + U.fmt(amount), '#ffd23f', 13, 1.2);
    });
    Bus.on('tierUp', (tier) => {
      UI.toast(t('t_tier', { name: t('tier_' + tier) }), 'good');
      UI.say(t('v_tier', { name: t('tier_cap_' + tier) }), 5);
      Sound.play('goal');
    });
  },

  roomPos(i) {
    return { x: L.cellX(Eco.slotOf(i)) + L.CW / 2, y: L.rowTop(Eco.floorOf(i) + 1) };
  },
  isPaused() { return this.adOpen || this.hidden || this.platformPaused; },

  // ---------- главный цикл ----------
  start() {
    this.lastFrame = performance.now();
    const loop = (ts) => {
      const dt = Math.min(0.1, Math.max(0, (ts - this.lastFrame) / 1000));
      this.lastFrame = ts;
      try { this.update(dt); } catch (e) { console.error(e); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  update(dt) {
    const s = this.s;
    const paused = this.isPaused();
    if (!paused) {
      Sim.update(s, dt);
      Events.update(s, dt);
      this.goalT -= dt;
      if (this.goalT <= 0) { this.goalT = 0.4; this.checkGoal(); this.updateHint(); this.checkNotices(); }
      this.saveT -= dt;
      this.cloudT -= dt;
      if (this.saveT <= 0) { this.saveT = CFG.LOCAL_SAVE_EVERY; this.save(false); }
      this.quipT -= dt;
      if (this.quipT <= 0) {
        this.quipT = U.rand(60, 110);
        if (!Events.active && !UI.modalOpen() && s.goal > 4) UI.say(U.pick(tArr('valya_quips')), 5);
      }
    }
    if (this.valyaMood > 0) this.valyaMood -= dt;
    Actors.update(s, paused ? 0 : dt, Render.dark);
    Input.update(dt);
    FX.update(dt);
    Render.draw(s, dt);
    UI.update(dt);
  },

  // ---------- деньги ----------
  earn(amount, silent, wx, wy) {
    Sim.earn(this.s, amount);
    if (!silent && wx !== undefined) FX.text(wx, wy, '+' + U.fmt(amount), '#ffd23f', 15);
  },
  spend(cost) {
    if (this.s.coins + 1e-9 < cost) {
      UI.toast(t('no_money'), 'bad');
      Sound.play('error');
      return false;
    }
    this.s.coins = Math.max(0, this.s.coins - cost);
    return true;
  },

  // Цена следующей покупки для объекта (null — нечего покупать)
  costOf(tg) {
    const s = this.s;
    if (!tg) return null;
    if (tg.type === 'build') return s.floors < CFG.FLOORS ? Eco.floorCost(s.floors) : null;
    if (tg.type === 'room') {
      if (Eco.floorOf(tg.i) >= s.floors) return null;
      const r = s.rooms[tg.i];
      if (!r.lvl) return Eco.roomUnlockCost(tg.i);
      return r.lvl < CFG.ROOM_MAX_LVL ? Eco.roomUpgradeCost(tg.i, r.lvl) : null;
    }
    if (tg.type === 'kitchen') {
      if (tg.f >= s.floors) return null;
      const l = s.kitchens[tg.f];
      return l < CFG.KITCHEN_MAX ? Eco.kitchenCost(tg.f, l) : null;
    }
    if (tg.type === 'fac') {
      const l = s.fac[tg.key];
      return l < CFG.FAC[tg.key].max ? Eco.facCost(tg.key, l) : null;
    }
    return null;
  },

  // ---------- клики по миру ----------
  tapWorld(wx, wy, sx, sy) {
    const s = this.s;
    const rad = 22 / Render.scale;
    if (s.floors < CFG.FLOORS) {
      const br = L.buildRect(s.floors);
      if (wx >= br.x && wx <= br.x + br.w && wy >= br.y && wy <= br.y + br.h) { Sound.play('tap'); this.select({ type: 'build' }); return; }
    }
    const cell = L.hitCell(wx, wy, s.floors);
    if (cell && cell.row > 0 && cell.col < 3) {
      const i = (cell.row - 1) * CFG.ROOMS_PER_FLOOR + cell.col;
      const r = s.rooms[i];
      if (r.lvl && r.trash > 0) {
        Sim.syncTrash(r);
        const lx = wx - L.cellX(cell.col), ly = wy - L.rowTop(cell.row);
        for (let k = 0; k < CFG.TRASH_MAX; k++) {
          if (!(r.tmask & (1 << k))) continue;
          if (Math.hypot(lx - TRASH_X[k], (ly - (L.FY - 2)) * 0.8) < Math.max(rad, 24)) { this.cleanTrash(i, wx, wy, k); return; }
        }
      }
    }
    const a = Actors.hitStudent(wx, wy, rad);
    if (a) { this.tapStudent(a, wx, wy, sx, sy); return; }
    const k = Actors.hitStaff(wx, wy, rad, s);
    if (k) {
      const w = Actors.staff[k];
      w.bubble = U.pick(tArr('q_' + k));
      w.bubbleT = 2.5;
      Sound.play('tap');
      return;
    }
    if (cell) { this.tapCell(L.targetAt(cell.row, cell.col), wx, wy, sx, sy); return; }
    this.deselect();
  },

  tapCell(tg, wx, wy, sx, sy) {
    const s = this.s;
    if (tg.type === 'room') {
      const r = s.rooms[tg.i];
      if (r.lvl) {
        this.collectRoom(tg.i, sx, sy);
        this.earn(Eco.tapValue(s), false, wx, wy - 20);
        s.stats.taps++;
        if (r.broken) {
          r.fix--;
          Sound.play('fix');
          FX.burst(wx, wy, 5, ['#9aa3ad', '#ffd23f'], 90, 3, 200, 0.4);
          if (r.fix <= 0) { Sim.fixRoom(s, tg.i, false); UI.toast(t('t_fixed'), 'good'); }
        } else Sound.play('tap');
      }
    } else if (tg.type === 'fac' && tg.key === 'laundry' && s.fac.laundry > 0) {
      if (s.laundryBox >= 1) {
        const amt = s.laundryBox;
        s.laundryBox = 0;
        this.earn(amt, false, wx, wy - 20);
        FX.fly(sx, sy, 5);
        Sound.play('coin');
      }
    } else if (tg.type === 'fac' && tg.key === 'vahta' && s.staff.valya > 0) {
      this.valyaMood = 3;
      UI.say(U.pick(tArr('valya_quips')), 4);
      Sound.play('tap');
    }
    this.select(tg);
  },

  tapStudent(a, wx, wy, sx, sy) {
    const s = this.s;
    a.hop = 1;
    Actors.say(a, Actors.phrase(a, s), 2.2, true);
    this.collectRoom(a.i, sx, sy);
    this.earn(Eco.tapValue(s) * CFG.STUDENT_TAP_MULT, false, wx, wy - 30);
    s.stats.taps++;
    Sound.play('tap');
    this.select({ type: 'room', i: a.i });
  },

  collectRoom(i, sx, sy) {
    const s = this.s, r = s.rooms[i];
    if (!(r.box >= 1)) return;
    const amt = r.box;
    r.box = 0;
    this.earn(amt, true);
    s.stats.collects++;
    const p = this.roomPos(i);
    FX.text(p.x + 70, p.y + 30, '+' + U.fmt(amt), '#ffd23f', 17, 1.2);
    FX.coins(p.x + 72, p.y + 38, 5);
    if (sx !== undefined) FX.fly(sx, sy, Math.min(8, 3 + Math.floor(Math.log10(amt + 1))));
    Sound.play('coin');
  },

  cleanTrash(i, wx, wy, pos) {
    const s = this.s, r = s.rooms[i];
    if (r.trash <= 0) return;
    Sim.removeTrash(r, pos);
    s.stats.trash++;
    FX.dust(wx, wy, 5);
    FX.burst(wx, wy, 6, ['#efe9dc', '#8bc34a', '#f4d03f'], 120, 3, 300, 0.5);
    this.earn(Eco.tapValue(this.s), false, wx, wy - 20);
    Sound.play('trash');
  },

  select(tg) {
    this.sel = tg;
    UI.openSheet(tg);
    const c = L.cellOfTarget(tg);
    if (c) Render.focusRow(c.row);
    else if (tg.type === 'build') Render.focusRow(this.s.floors + 1);
  },
  deselect() {
    this.sel = null;
    UI.closeSheet();
  },

  // ---------- покупки ----------
  buy(tg, mode) {
    const s = this.s;
    if (!tg) return;
    if (tg.type === 'build') { this.buildFloor(); return; }
    if (tg.type === 'room') {
      if (Eco.floorOf(tg.i) >= s.floors) return;
      const r = s.rooms[tg.i];
      if (!r.lvl) {
        if (!this.spend(Eco.roomUnlockCost(tg.i))) return;
        r.lvl = 1;
        r.arriveT = CFG.FIRST_ARRIVE;
        const p = this.roomPos(tg.i);
        FX.dust(p.x, p.y + 80, 14);
        FX.sparkle(p.x, p.y + 60, 16);
        Sound.play('open');
        UI.toast(t('t_room_open'), 'good');
        UI.rebuildSheet();
        return;
      }
      if (r.lvl >= CFG.ROOM_MAX_LVL) return;
      let n = 1, cost = Eco.roomUpgradeCost(tg.i, r.lvl);
      if (mode === 'max') {
        const m = Eco.roomUpgradeMax(tg.i, r.lvl, s.coins, 999);
        if (m.n > 0) { n = m.n; cost = m.cost; }
      }
      if (!this.spend(cost)) return;
      this.levelRoom(tg.i, n);
    } else if (tg.type === 'kitchen') {
      const l = s.kitchens[tg.f];
      if (tg.f >= s.floors || l >= CFG.KITCHEN_MAX) return;
      if (!this.spend(Eco.kitchenCost(tg.f, l))) return;
      this.levelKitchen(tg.f);
    } else if (tg.type === 'fac') {
      const l = s.fac[tg.key];
      if (l >= CFG.FAC[tg.key].max) return;
      if (!this.spend(Eco.facCost(tg.key, l))) return;
      this.levelFac(tg.key);
    }
  },
  levelRoom(i, n) {
    const s = this.s, r = s.rooms[i];
    const before = Eco.stageOf(r.lvl);
    r.lvl = Math.min(CFG.ROOM_MAX_LVL, r.lvl + n);
    s.stats.upgrades += n;
    const after = Eco.stageOf(r.lvl);
    const p = this.roomPos(i);
    if (after > before) {
      Bus.emit('roomUp', i);
      FX.dust(p.x, p.y + 80, 18);
      FX.sparkle(p.x, p.y + 60, 26);
      Sound.play('stage');
      UI.toast(t('t_stage', { name: t('stage_' + after) }), 'good');
      if (Math.random() < 0.5) UI.say(t('v_stage'), 4);
      UI.rebuildSheet();
    } else {
      FX.sparkle(p.x, p.y + 70, 8);
      Sound.play('buy');
    }
  },
  levelKitchen(f) {
    const s = this.s;
    s.kitchens[f]++;
    s.stats.upgrades++;
    const x = L.cellX(3) + L.CW / 2, y = L.rowTop(f + 1);
    if (s.kitchens[f] === 1) { FX.dust(x, y + 80, 14); Sound.play('open'); UI.toast(t('t_kitchen'), 'good'); UI.rebuildSheet(); }
    else Sound.play('buy');
    FX.sparkle(x, y + 70, 12);
  },
  levelFac(key) {
    const s = this.s;
    s.fac[key]++;
    s.stats.upgrades++;
    const x = L.cellX(CFG.FAC_ORDER.indexOf(key)) + L.CW / 2, y = L.rowTop(0);
    if (s.fac[key] === 1) { FX.dust(x, y + 80, 14); Sound.play('open'); UI.toast(t('t_built', { name: t(key) }), 'good'); UI.rebuildSheet(); }
    else Sound.play('buy');
    FX.sparkle(x, y + 70, 12);
  },

  buildFloor() {
    const s = this.s;
    if (s.floors >= CFG.FLOORS) return;
    if (!this.spend(Eco.floorCost(s.floors))) return;
    s.floors++;
    const f = s.floors - 1;
    const i = f * CFG.ROOMS_PER_FLOOR;
    s.rooms[i].lvl = 1;
    s.rooms[i].arriveT = CFG.FIRST_ARRIVE;
    Render.clamp();
    Render.focusRow(s.floors, true);
    const p = this.roomPos(i);
    FX.dust(L.cellX(1) + 100, p.y + 70, 30);
    FX.sparkle(p.x, p.y + 60, 30);
    Sound.play('stage');
    UI.toast(t('t_floor'), 'good');
    UI.say(t('v_floor'), 4);
    this.deselect();
    this.save(true);
    this.tryInterstitial();
  },

  hire(key) {
    const s = this.s;
    const lvl = s.staff[key];
    if (lvl >= CFG.STAFF[key].max) return;
    if (!this.spend(Eco.staffCost(key, lvl))) return;
    s.staff[key]++;
    if (lvl === 0) {
      const w = Actors.staff[key];
      if (w) { w.row = 0; w.tRow = 0; w.x = L.stairX + 20; w.tx = L.cellX(1); }
      Sound.play('stage');
      UI.toast(t('t_hired', { name: t('st_' + key) }), 'good');
      const lines = { valya: 'v_hired', cleaner: 'v_cleaner', plumber: 'v_plumber', starosta: 'v_starosta' };
      UI.say(t(lines[key]), 5);
      if (key === 'valya') this.valyaMood = 4;
    } else Sound.play('buy');
    s.stats.upgrades++;
  },

  // ---------- реклама ----------
  setAdOpen(v) {
    this.adOpen = v;
    Sound.setMuted(v || this.hidden || this.platformPaused);
    if (v) SDK.gameplayStop();
    else if (!this.hidden && !this.platformPaused) SDK.gameplayStart();
  },
  watchAd(onReward) {
    SDK.showRewarded({
      onOpen: () => this.setAdOpen(true),
      onClose: (rewarded) => {
        this.setAdOpen(false);
        this.lastFrame = performance.now();
        if (rewarded) { this.s.stats.ads++; onReward(); this.save(false); }
      },
      onError: () => UI.toast(t('ad_fail'), 'bad'),
    });
  },
  // Межстраничная — только на переходах (новый этаж, переезд) и не чаще нашего лимита
  tryInterstitial() {
    if (Date.now() - this.lastInterstitial < CFG.INTERSTITIAL_MIN_GAP * 1000) return;
    this.lastInterstitial = Date.now();
    SDK.showInterstitial({
      onOpen: () => this.setAdOpen(true),
      onClose: () => { this.setAdOpen(false); this.lastFrame = performance.now(); },
    });
  },
  boost() {
    if (this.s.boostLeft >= CFG.BOOST_MAX - 1) return;
    this.watchAd(() => {
      this.s.boostLeft = Math.min(CFG.BOOST_MAX, this.s.boostLeft + CFG.BOOST_SECONDS);
      UI.toast(t('t_boost'), 'good');
      Sound.play('stage');
    });
  },
  freeUpgrade(tg) {
    const s = this.s;
    if (s.freeUpgT > 0 || !tg) return;
    this.watchAd(() => {
      s.freeUpgT = CFG.FREE_UPG_COOLDOWN;
      this.freeNotified = false;
      if (tg.type === 'room') {
        const r = s.rooms[tg.i];
        if (!r.lvl) { r.lvl = 1; r.arriveT = CFG.FIRST_ARRIVE; UI.rebuildSheet(); }
        else if (r.lvl < CFG.ROOM_MAX_LVL) this.levelRoom(tg.i, 1);
      } else if (tg.type === 'kitchen' && s.kitchens[tg.f] < CFG.KITCHEN_MAX) this.levelKitchen(tg.f);
      else if (tg.type === 'fac' && s.fac[tg.key] < CFG.FAC[tg.key].max) this.levelFac(tg.key);
      UI.toast(t('t_free'), 'good');
    });
  },
  eventAd() {
    if (!Events.active) return;
    this.watchAd(() => Events.adResolve(this.s));
  },

  // ---------- престиж ----------
  prestige() {
    const s = this.s;
    if (!Eco.canPrestige(s)) return;
    const gain = Eco.starsGain(s);
    this.s = State.prestige(s, gain);
    Sim.autoAcc = [];
    Sim.autoT = [];
    Sim.prevTier = Eco.topTier(this.s.rep);
    Actors.reset();
    Actors.sync(this.s);
    Events.reset();
    FX.texts.length = 0;
    FX.parts.length = 0;
    Render.clearCache();
    Render.defaultView();
    this.sel = null;
    this.prestigeNotified = false;
    UI.closeSheet();
    UI.closeModal();
    UI.toast(t('t_prestige'), 'good');
    Sound.play('stage');
    SDK.setLeaderboard(this.s.stars);
    this.save(true);
    this.tryInterstitial();
  },

  // ---------- цели ----------
  goalDef() {
    const s = this.s;
    if (s.goal < GOALS.length) return GOALS[s.goal];
    const k = (s.goal - GOALS.length) % 3;
    return { type: ['earn', 'upg', 'ev'][k], gen: true, reward: [120, 90, 90][k], min: 100 };
  },
  ensureGoal() {
    if (this.s.goal >= GOALS.length && !(this.s.goalTarget > 0)) this.setupGenerated();
  },
  setupGenerated() {
    const s = this.s, d = this.goalDef();
    if (d.type === 'earn') { s.goalStart = s.totalEarned; s.goalTarget = Math.max(1000, Math.ceil(Eco.totalIncome(s, true) * 300)); }
    else if (d.type === 'upg') { s.goalStart = s.stats.upgrades; s.goalTarget = 15 + Math.min(35, s.goal - GOALS.length); }
    else { s.goalStart = s.stats.events; s.goalTarget = 3; }
  },
  goalProgress() {
    const s = this.s, d = this.goalDef();
    let cur = 0, target = d.n || 1, text = '';
    switch (d.type) {
      case 'collect': cur = s.stats.collects; text = t('g_collect'); break;
      case 'trash': cur = s.stats.trash; text = t('g_trash', { c: Math.min(cur, target), n: target }); break;
      case 'roomLvl': cur = Eco.maxRoomLvl(s); text = t('g_roomLvl', { n: target }); break;
      case 'roomsOpen': cur = Eco.openRooms(s); text = t('g_roomsOpen', { c: Math.min(cur, target), n: target }); break;
      case 'hire': cur = s.staff[d.key] > 0 ? 1 : 0; target = 1; text = t('g_hire', { name: t('st_' + d.key) }); break;
      case 'kitchen': cur = Math.max.apply(null, s.kitchens); text = t('g_kitchen'); break;
      case 'stage': cur = Eco.maxStage(s); text = t('g_stage', { name: t('stage_' + target) }); break;
      case 'fac': cur = s.fac[d.key]; text = t('g_fac', { name: t(d.key) }); break;
      case 'floor': cur = s.floors; text = t('g_floor', { n: target }); break;
      case 'events': cur = s.stats.events; text = t('g_events', { c: Math.min(cur, target), n: target }); break;
      case 'rep': cur = Math.floor(s.rep); text = t('g_rep', { c: Math.min(cur, target), n: target }); break;
      case 'prestige': cur = s.prestiges; text = t('g_prestige'); break;
      case 'earn': cur = s.totalEarned - s.goalStart; target = s.goalTarget; text = t('g_earn', { c: U.fmt(Math.min(cur, target)), n: U.fmt(target) }); break;
      case 'upg': cur = s.stats.upgrades - s.goalStart; target = s.goalTarget; text = t('g_upg', { c: Math.min(cur, target), n: target }); break;
      case 'ev': cur = s.stats.events - s.goalStart; target = s.goalTarget; text = t('g_ev', { c: Math.min(cur, target), n: target }); break;
    }
    return { cur, target, text, done: cur >= target };
  },
  goalReward() {
    const d = this.goalDef();
    return Math.max(d.min, Math.ceil(Eco.totalIncome(this.s, true) * d.reward));
  },
  checkGoal() {
    const s = this.s;
    const p = this.goalProgress();
    if (p.done && !s.goalDone) { s.goalDone = true; Sound.play('goal'); UI.goalReady(); }
    if (this.lastGoalSaid !== s.goal) {
      this.lastGoalSaid = s.goal;
      const lines = { 0: 'v_hello', 1: 'v_tut_trash', 2: 'v_tut_upgrade', 3: 'v_tut_open', 4: 'v_tut_hire', 7: 'v_tut_kitchen', 11: 'v_tut_floor' };
      if (lines[s.goal] && !p.done && (s.goal > 0 || this.newPlayer)) UI.say(t(lines[s.goal]), 7);
    }
  },
  claimGoal() {
    const s = this.s;
    if (!this.goalProgress().done) return;
    const reward = this.goalReward();
    Sim.earn(s, reward);
    s.goal++;
    s.goalDone = false;
    if (s.goal >= GOALS.length) this.setupGenerated();
    Sound.play('goal');
    UI.toast(t('t_goal') + ' +' + U.fmt(reward), 'good');
    const r = UI.goalRect();
    if (r) FX.fly(r.x, r.y, 8);
    this.checkGoal();
  },

  // Обучающая стрелка над нужным объектом
  updateHint() {
    const s = this.s;
    this.hint = null;
    if (s.goal >= 12 || UI.modalOpen()) return;
    const d = this.goalDef();
    const top = (row) => L.rowTop(row);
    switch (d.type) {
      case 'collect': if (s.rooms[0].box >= 1) this.hint = { x: L.cellX(0) + L.CW - 28, y: top(1) + 14 }; break;
      case 'trash': {
        const m = s.rooms[0].tmask;
        const k = m & 1 ? 0 : m & 2 ? 1 : m & 4 ? 2 : -1;
        if (s.rooms[0].trash > 0 && k >= 0) this.hint = { x: L.cellX(0) + TRASH_X[k], y: top(1) + L.FY - 18 };
        break;
      }
      case 'roomLvl': if (!this.sel || this.sel.type !== 'room') this.hint = { x: L.cellX(0) + L.CW / 2 + 20, y: top(1) + 70 }; break;
      case 'roomsOpen': {
        const i = s.rooms.findIndex((r, k) => !r.lvl && Eco.floorOf(k) < s.floors);
        if (i >= 0 && s.coins >= Eco.roomUnlockCost(i)) this.hint = { x: L.cellX(Eco.slotOf(i)) + L.CW / 2, y: top(Eco.floorOf(i) + 1) + 40 };
        break;
      }
      case 'kitchen': if (s.coins >= Eco.kitchenCost(0, 0)) this.hint = { x: L.cellX(3) + L.CW / 2, y: top(1) + 50 }; break;
      case 'floor':
        if (s.floors < CFG.FLOORS && s.coins >= Eco.floorCost(s.floors)) { const br = L.buildRect(s.floors); this.hint = { x: br.x + br.w / 2, y: br.y + 4 }; }
        break;
    }
    // Новая подсказка вне экрана — подвинем камеру (один раз, чтобы не мешать игроку)
    const key = this.hint ? s.goal + ':' + Math.round(this.hint.x) : '';
    if (this.hint && key !== this.hintShown) { this.hintShown = key; Render.ensureVisible(this.hint.x, this.hint.y); }
  },
  checkNotices() {
    const s = this.s;
    if (s.freeUpgT <= 0 && !this.freeNotified && s.goal >= 6) { this.freeNotified = true; UI.say(t('v_free'), 5); }
    if (!this.prestigeNotified && Eco.canPrestige(s) && s.floors >= 4) { this.prestigeNotified = true; UI.say(t('v_prestige_ready'), 6); }
  },

  // ---------- оффлайн ----------
  applyOffline(sec) {
    const s = this.s;
    if (!(sec >= CFG.OFFLINE_MIN)) return;
    s.freeUpgT = Math.max(0, s.freeUpgT - sec);
    s.time += Math.min(sec, CFG.DAY_LENGTH * 0.5);
    const hasStudents = Eco.students(s) > 0;
    const rate = Eco.offlineRate(s);
    if (rate > 0) {
      const cap = Eco.offlineCapSec(s);
      const eff = Math.min(sec, cap);
      const amount = Math.floor(Eco.totalIncome(s, true) * eff * rate);
      if (amount > 0) { Sim.earn(s, amount); UI.welcome({ sec, amount, capped: sec > cap }); }
    } else {
      s.rooms.forEach((r, i) => { if (r.lvl && r.occ.length) r.box = Sim.boxCap(s, i); });
      if (hasStudents && sec > 300) UI.welcome({ sec, amount: 0, noValya: true });
    }
    if (!(s.staff.cleaner > 0)) for (const r of s.rooms) if (r.occ.length && r.trash < 2 && Math.random() < 0.5) Sim.addTrash(r);
    this.save(false);
  },
  doubleOffline(amount) {
    this.watchAd(() => { Sim.earn(this.s, amount); UI.toast('+' + U.fmt(amount), 'good'); Sound.play('coin'); });
  },

  // ---------- сохранения ----------
  save(cloudNow) {
    const s = this.s;
    if (!s) return;
    s.savedAt = Date.now();
    const str = State.serialize(s);
    SDK.setLocal(CFG.SAVE_KEY, str);
    if (cloudNow || this.cloudT <= 0) { SDK.saveCloud(str, !!cloudNow); this.cloudT = CFG.CLOUD_SAVE_EVERY; }
  },
  async loadSave() {
    const a = State.deserialize(SDK.getLocal(CFG.SAVE_KEY));
    const b = State.deserialize(await SDK.loadCloud());
    if (a && b) return b.savedAt > a.savedAt ? b : a;
    return a || b;
  },
  resetProgress() {
    SDK.removeLocal(CFG.SAVE_KEY);
    const fresh = State.create();
    fresh.lang = this.s.lang;
    fresh.savedAt = Date.now();
    SDK.saveCloud(State.serialize(fresh), true);
    SDK.setLocal(CFG.SAVE_KEY, State.serialize(fresh));
    location.reload();
  },

  // ---------- видимость и пауза ----------
  onVisibility() {
    if (document.hidden) {
      if (this.hidden) return;
      this.hidden = true;
      this.hiddenAt = Date.now();
      this.save(true);
      Sound.setMuted(true);
      SDK.gameplayStop();
    } else {
      if (!this.hidden) return;
      this.hidden = false;
      const sec = (Date.now() - this.hiddenAt) / 1000;
      Sound.setMuted(this.adOpen || this.platformPaused);
      if (!this.adOpen && !this.platformPaused) SDK.gameplayStart();
      this.lastFrame = performance.now();
      this.applyOffline(sec);
    }
  },
  platformPause(p) {
    this.platformPaused = p;
    Sound.setMuted(p || this.hidden || this.adOpen);
    if (p) { SDK.gameplayStop(); this.save(true); }
    else if (!this.hidden && !this.adOpen) { SDK.gameplayStart(); this.lastFrame = performance.now(); }
  },

  setLang(lang) {
    this.s.lang = lang;
    I18N.setLang(lang);
    Render.clearCache();
    UI.applyLang();
    this.save(false);
  },
};
