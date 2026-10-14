'use strict';
// Состояние игры: создание, престиж, сериализация и починка старых сохранений.
// В state лежат только простые данные (числа, строки, массивы) — его можно сохранить как JSON.

const State = {
  newRoom(lvl) {
    return { lvl: lvl || 0, box: 0, broken: false, fix: 0, trash: 0, tmask: 0, occ: [], arriveT: CFG.FIRST_ARRIVE };
  },

  create() {
    const roomsTotal = CFG.FLOORS * CFG.ROOMS_PER_FLOOR;
    const rooms = [];
    for (let i = 0; i < roomsTotal; i++) rooms.push(this.newRoom(0));
    const fac = {};
    for (const k of CFG.FAC_ORDER) fac[k] = CFG.FAC[k].startLvl;
    const staff = {};
    for (const k of CFG.STAFF_ORDER) staff[k] = 0;

    const s = {
      v: CFG.SAVE_VERSION,
      savedAt: 0,
      createdAt: Date.now(),

      // --- то, что переживает престиж ---
      lang: '',
      sfx: true,
      music: true,
      stars: 0,
      building: 0,
      totalEarned: 0,
      prestiges: 0,
      goal: 0,
      goalStart: 0,
      goalTarget: 0,
      goalDone: false,
      nextId: 1,
      playTime: 0,
      stats: { collects: 0, taps: 0, trash: 0, events: 0, upgrades: 0, ads: 0 },
      seenIntro: false,

      // --- то, что обнуляется при переезде в новый корпус ---
      coins: 0,
      runEarned: 0,
      rep: CFG.REP_START,
      floors: 1,
      rooms,
      kitchens: new Array(CFG.FLOORS).fill(0),
      fac,
      laundryBox: 0,
      staff,
      boostLeft: 0,
      freeUpgT: 60,
      fx: { roach: 0, net: 0, hot: 0, burn: new Array(CFG.FLOORS).fill(0) },
      trashT: 8,
      breakT: 90,
      cleanerJob: { target: -1, t: 0 },
      plumberJob: { target: -1, t: 0 },
      time: 60,
    };
    // Первая комната — грязная, но уже наша.
    s.rooms[0].lvl = 1;
    s.rooms[0].trash = 2;
    s.rooms[0].tmask = 3;
    return s;
  },

  // Новый корпус: обнуляем прогресс, оставляем мета-данные и персонал (на 1 уровне).
  prestige(old, gainStars) {
    const s = this.create();
    const keep = ['lang', 'sfx', 'music', 'totalEarned', 'goal', 'goalStart', 'goalTarget', 'goalDone',
      'nextId', 'playTime', 'stats', 'seenIntro', 'createdAt', 'boostLeft', 'freeUpgT'];
    for (const k of keep) s[k] = old[k];
    s.stars = old.stars + gainStars;
    s.building = old.building + 1;
    s.prestiges = old.prestiges + 1;
    for (const k of CFG.STAFF_ORDER) s.staff[k] = old.staff[k] > 0 ? 1 : 0;
    s.rooms[0].trash = 0;
    s.rooms[0].tmask = 0;
    s.time = old.time;
    return s;
  },

  serialize(s) {
    return JSON.stringify(s);
  },

  // Восстанавливаем сохранение поверх свежего состояния: если в будущей версии
  // добавятся поля — старые сейвы не сломаются.
  deserialize(str) {
    if (!str) return null;
    let data;
    try { data = typeof str === 'string' ? JSON.parse(str) : str; } catch (e) { return null; }
    if (!data || typeof data !== 'object' || !Array.isArray(data.rooms)) return null;
    const fresh = this.create();
    const s = this.fixup(fresh, data);
    // Комнаты чиним отдельно — у них массив жильцов.
    s.rooms = fresh.rooms.map((def, i) => {
      const r = this.fixup(def, data.rooms[i] || {});
      r.occ = Array.isArray(r.occ) ? r.occ.filter((o) => o && typeof o.tier === 'number').map((o) => ({
        id: o.id | 0, tier: U.clamp(o.tier | 0, 0, CFG.TIERS.length - 1),
        life: isFinite(o.life) ? o.life : 300, seed: o.seed | 0,
      })) : [];
      r.lvl = U.clamp(r.lvl | 0, 0, CFG.ROOM_MAX_LVL);
      r.occ.length = Math.min(r.occ.length, Eco.capacity(r.lvl));
      return r;
    });
    s.floors = U.clamp(s.floors | 0, 1, CFG.FLOORS);
    s.rep = U.clamp(s.rep, 0, 100);
    if (s.rooms[0].lvl < 1) s.rooms[0].lvl = 1;
    return s;
  },

  fixup(def, val) {
    if (Array.isArray(def)) {
      if (!Array.isArray(val) || val.length !== def.length) return def;
      return def.map((d, i) => this.fixup(d, val[i]));
    }
    if (def !== null && typeof def === 'object') {
      if (!val || typeof val !== 'object' || Array.isArray(val)) return def;
      const out = {};
      for (const k of Object.keys(def)) out[k] = k in val ? this.fixup(def[k], val[k]) : def[k];
      // occ у комнаты — массив произвольной длины, берём как есть
      if ('occ' in def && Array.isArray(val.occ)) out.occ = val.occ;
      return out;
    }
    if (typeof def === 'number') return typeof val === 'number' && isFinite(val) ? val : def;
    if (typeof def === 'boolean') return typeof val === 'boolean' ? val : def;
    if (typeof def === 'string') return typeof val === 'string' ? val : def;
    return val === undefined ? def : val;
  },
};
