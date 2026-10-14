'use strict';
// Экономика: все формулы дохода и цен. Только расчёты, никакой графики —
// поэтому этот же файл гоняет симулятор баланса tools/balance_sim.js.

const Eco = {
  floorOf: (i) => Math.floor(i / CFG.ROOMS_PER_FLOOR),
  slotOf: (i) => i % CFG.ROOMS_PER_FLOOR,

  stageOf(lvl) {
    return lvl <= 0 ? 0 : Math.min(CFG.STAGES, Math.floor((lvl - 1) / CFG.STAGE_LEN) + 1);
  },
  capacity(lvl) {
    const st = this.stageOf(lvl);
    return st ? CFG.STAGE_CAP[st - 1] : 0;
  },
  // Следующее улучшение — капремонт (смена вида комнаты)?
  isStageStep(lvl) {
    return lvl > 0 && lvl % CFG.STAGE_LEN === 0 && lvl < CFG.ROOM_MAX_LVL;
  },
  levelMult(lvl) {
    if (lvl <= 0) return 0;
    return (1 + CFG.LVL_STEP * (lvl - 1)) * Math.pow(CFG.STAGE_RENT_MULT, this.stageOf(lvl) - 1);
  },
  baseRent(i) { return CFG.RENT_BASE * Math.pow(CFG.RENT_GROWTH, i); },
  rentPerStudent(i, lvl) { return this.baseRent(i) * this.levelMult(lvl); },

  // ---------- Цены ----------
  roomBaseCost(i) { return CFG.ROOM_COST_BASE * Math.pow(CFG.ROOM_COST_GROWTH, i); },
  roomUnlockCost(i) { return Math.ceil(this.roomBaseCost(i)); },
  roomUpgradeCost(i, lvl) {
    let c = this.roomBaseCost(i) * CFG.UPG_COST_FACTOR * Math.pow(CFG.UPG_GROWTH, lvl - 1);
    if (this.isStageStep(lvl)) c *= CFG.STAGE_STEP_COST;
    return Math.ceil(c);
  },
  // Сколько уровней можно купить на имеющиеся деньги (до maxN).
  roomUpgradeMax(i, lvl, coins, maxN) {
    let n = 0, cost = 0;
    while (lvl + n < CFG.ROOM_MAX_LVL && n < maxN) {
      const c = this.roomUpgradeCost(i, lvl + n);
      if (cost + c > coins) break;
      cost += c; n++;
    }
    return { n, cost };
  },
  floorCost(f) { return f <= 0 ? 0 : Math.ceil(this.roomBaseCost(f * CFG.ROOMS_PER_FLOOR) * CFG.FLOOR_COST_MULT); },
  kitchenCost(f, lvl) {
    return Math.ceil(this.roomBaseCost(f * CFG.ROOMS_PER_FLOOR) * CFG.KITCHEN_COST_FACTOR * Math.pow(CFG.KITCHEN_GROWTH, lvl));
  },
  facCost(key, lvl) {
    const f = CFG.FAC[key];
    return Math.ceil(f.cost * Math.pow(f.growth, lvl - f.startLvl));
  },
  staffCost(key, lvl) {
    const st = CFG.STAFF[key];
    return Math.ceil(st.cost * Math.pow(st.growth, lvl));
  },

  // ---------- Множители ----------
  starsMult(s) { return 1 + CFG.STAR_BONUS * s.stars; },
  buildingMult(s) { return Math.pow(CFG.BUILDING_MULT, s.building); },
  starostaRent(s) { return s.staff.starosta > 0 ? CFG.STAFF.starosta.rent[s.staff.starosta - 1] : 0; },
  permanentMult(s) { return this.starsMult(s) * this.buildingMult(s) * (1 + this.starostaRent(s)); },
  tempMult(s) {
    let m = 1;
    if (s.boostLeft > 0) m *= 2;
    if (s.fx.roach > 0) m *= CFG.EVENTS.roach.mult;
    if (s.fx.net > 0) m *= CFG.EVENTS.net.mult;
    return m;
  },
  kitchenBonus(lvl) { return lvl * CFG.KITCHEN_BONUS; },
  floorMult(s, f) {
    if (s.fx.burn[f] > 0) return 1;
    return 1 + this.kitchenBonus(s.kitchens[f]);
  },
  tierSum(r) {
    let sum = 0;
    for (const o of r.occ) sum += CFG.TIERS[o.tier].mult;
    return sum;
  },

  // Доход комнаты в секунду. nominal = без мусора, поломок, бустов и дебаффов.
  roomIncome(s, i, nominal) {
    const r = s.rooms[i];
    if (!r.lvl || !r.occ.length) return 0;
    let inc = this.rentPerStudent(i, r.lvl) * this.tierSum(r) * this.floorMult(s, this.floorOf(i)) * this.permanentMult(s);
    if (!nominal) {
      inc *= (1 - CFG.TRASH_PENALTY * r.trash) * (r.broken ? CFG.BROKEN_MULT : 1) * this.tempMult(s);
    }
    return inc;
  },
  roomsIncome(s, nominal) {
    let sum = 0;
    for (let i = 0; i < s.rooms.length; i++) sum += this.roomIncome(s, i, nominal);
    return sum;
  },
  laundryIncome(s, roomsIncome) {
    return roomsIncome * CFG.LAUNDRY_SHARE * s.fac.laundry;
  },
  totalIncome(s, nominal) {
    const r = this.roomsIncome(s, nominal);
    return r + this.laundryIncome(s, r);
  },
  // Доход полной комнаты с текущим средним уровнем студентов — для подсказок в интерфейсе.
  roomPotential(s, i, lvl) {
    const tierAvg = this.avgTierMult(s);
    return this.rentPerStudent(i, lvl) * this.capacity(lvl) * tierAvg * this.floorMult(s, this.floorOf(i)) * this.permanentMult(s);
  },
  avgTierMult(s) {
    const tiers = this.availableTiers(s);
    let tw = 0, tm = 0;
    for (const t of tiers) { const w = this.tierWeight(s, t, tiers); tw += w; tm += w * CFG.TIERS[t].mult; }
    return tw ? tm / tw : 1;
  },

  tapValue(s) {
    return (CFG.TAP_BASE + CFG.TAP_SHARE * this.totalIncome(s, true)) * (s.boostLeft > 0 ? 2 : 1);
  },
  // Награда «N секунд дохода», но не меньше минимума.
  incomeReward(s, sec, min) {
    return Math.max(min || 0, Math.ceil(this.totalIncome(s, true) * sec), 10);
  },

  // ---------- Студенты и репутация ----------
  topTier(rep) {
    let top = 0;
    for (let k = 0; k < CFG.TIERS.length; k++) if (rep >= CFG.TIERS[k].rep) top = k;
    return top;
  },
  availableTiers(s) {
    const top = this.topTier(s.rep);
    const out = [];
    for (let k = 0; k <= top; k++) out.push(k);
    return out;
  },
  tierWeight(s, t, tiers) {
    let w = CFG.TIERS[t].w;
    if (t === tiers[tiers.length - 1]) w *= 1 + CFG.GYM_TIER_BONUS * s.fac.gym;
    return w;
  },
  pickTier(s) {
    const tiers = this.availableTiers(s);
    return U.weightedPick(tiers, (t) => this.tierWeight(s, t, tiers));
  },
  cleanliness(s) {
    let rooms = 0, trash = 0;
    for (const r of s.rooms) if (r.lvl > 0 && r.occ.length) { rooms++; trash += r.trash; }
    return rooms ? 1 - trash / (rooms * CFG.TRASH_MAX) : 1;
  },
  brokenCount(s) {
    let n = 0;
    for (const r of s.rooms) if (r.broken) n++;
    return n;
  },
  repTarget(s) {
    let tgt = CFG.REP_BASE + CFG.REP_PER_SHOWER * s.fac.shower + CFG.REP_PER_GYM * s.fac.gym
      + CFG.REP_CLEAN * this.cleanliness(s) - CFG.REP_PER_BROKEN * this.brokenCount(s);
    if (s.fx.hot > 0) tgt -= CFG.REP_HOT_WATER;
    return U.clamp(tgt, 0, 100);
  },

  // ---------- Оффлайн ----------
  offlineCapSec(s) { return CFG.OFFLINE_HOURS[U.clamp(s.fac.vahta, 0, 10)] * 3600; },
  offlineRate(s) { return s.staff.valya > 0 ? CFG.STAFF.valya.offline[s.staff.valya - 1] : 0; },

  // ---------- Престиж ----------
  // Звёзды считаются от заработка за ВСЁ время (как ангелы в AdVenture Capitalist):
  // всего звёзд = (всего заработано / BASE) ^ POW, при переезде получаешь разницу.
  // Так каждая следующая звезда дороже предыдущей и прогресс не улетает в бесконечность.
  starsTotalFor(totalEarned) { return Math.floor(Math.pow(Math.max(0, totalEarned) / CFG.PRESTIGE_BASE, CFG.PRESTIGE_POW) + 1e-9); },
  starsGain(s) { return Math.max(0, this.starsTotalFor(s.totalEarned) - s.stars); },
  earnedForStarsTotal(n) { return Math.pow(n, 1 / CFG.PRESTIGE_POW) * CFG.PRESTIGE_BASE; },
  canPrestige(s) { return s.floors >= CFG.PRESTIGE_MIN_FLOOR && this.starsGain(s) >= 1; },

  // ---------- Счётчики ----------
  openRooms(s) { let n = 0; for (const r of s.rooms) if (r.lvl > 0) n++; return n; },
  maxRoomLvl(s) { let m = 0; for (const r of s.rooms) m = Math.max(m, r.lvl); return m; },
  maxStage(s) { return this.stageOf(this.maxRoomLvl(s)); },
  students(s) { let n = 0; for (const r of s.rooms) n += r.occ.length; return n; },
};
