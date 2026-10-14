'use strict';
// =====================================================================
//  Общага-тайкун — баланс и игровые константы.
//  Все цифры игры живут здесь: поменял число — поменялся баланс.
//  Проверять изменения удобно симуляцией: node tools/balance_sim.js
// =====================================================================

const CFG = {
  VERSION: '1.0.0',
  SAVE_KEY: 'obshaga_tycoon_save_v1',
  SAVE_VERSION: 1,

  // ---------- Здание ----------
  FLOORS: 5,                  // жилых этажей в корпусе
  ROOMS_PER_FLOOR: 3,         // комнат на этаже (+ кухня справа)

  // ---------- Комнаты ----------
  ROOM_MAX_LVL: 50,
  STAGE_LEN: 10,              // каждые 10 уровней — капремонт и новый вид комнаты
  STAGES: 5,
  STAGE_CAP: [1, 3, 4, 5, 6], // сколько студентов живёт на каждой стадии
  LVL_STEP: 0.15,             // +15% к плате за каждый уровень
  STAGE_RENT_MULT: 2,         // x2 к плате за каждую стадию
  RENT_BASE: 1,               // плата одного студента в первой комнате, монет/сек
  RENT_GROWTH: 3,             // каждая следующая комната платит в 3 раза больше
  ROOM_COST_BASE: 20,
  ROOM_COST_GROWTH: 4.5,
  UPG_COST_FACTOR: 0.6,       // первое улучшение = 60% цены комнаты
  UPG_GROWTH: 1.22,           // каждое следующее улучшение дороже на 22%
  STAGE_STEP_COST: 3,         // капремонт стоит как 3 обычных улучшения
  FLOOR_COST_MULT: 2.5,       // этаж = 2.5 цены его первой комнаты (комната в подарок)
  BOX_SECONDS: 30,            // копилка комнаты вмещает 30 секунд дохода
  BOX_MIN: 10,

  // ---------- Кухни (по одной на этаж) ----------
  KITCHEN_MAX: 10,
  KITCHEN_BONUS: 0.1,         // +10% к доходу этажа за уровень
  KITCHEN_COST_FACTOR: 2,
  KITCHEN_GROWTH: 2.3,

  // ---------- Общие помещения (цоколь) ----------
  FAC_ORDER: ['vahta', 'shower', 'laundry', 'gym'],
  FAC: {
    vahta:   { max: 10, cost: 150,   growth: 2.6, startLvl: 1 },
    shower:  { max: 10, cost: 400,   growth: 2.7, startLvl: 0 },
    laundry: { max: 10, cost: 2500,  growth: 2.7, startLvl: 0 },
    gym:     { max: 10, cost: 20000, growth: 2.8, startLvl: 0 },
  },
  OFFLINE_HOURS: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12], // по уровню вахты
  LAUNDRY_SHARE: 0.04,        // прачечная: +4% от дохода комнат за уровень
  GYM_TIER_BONUS: 0.15,       // качалка: шанс дорогого студента +15% за уровень

  // ---------- Персонал ----------
  STAFF_ORDER: ['valya', 'cleaner', 'plumber', 'starosta'],
  STAFF: {
    // offline — доля оффлайн-дохода
    valya:    { cost: 200,   growth: 9, max: 5, offline: [0.3, 0.4, 0.5, 0.65, 0.8] },
    // interval — раз во сколько секунд убирает одну кучку мусора
    cleaner:  { cost: 500,   growth: 9, max: 5, interval: [12, 8, 5.5, 4, 2.5] },
    // delay — через сколько секунд чинит поломку
    plumber:  { cost: 2500,  growth: 9, max: 5, delay: [20, 14, 9, 5, 2.5] },
    // speed — ускорение заселения, rent — бонус к плате
    starosta: { cost: 15000, growth: 9, max: 5, speed: [1.8, 2.4, 3, 4, 5], rent: [0.05, 0.1, 0.15, 0.2, 0.3] },
  },

  // ---------- Клики ----------
  TAP_BASE: 1,
  TAP_SHARE: 0.08,            // клик = 1 + 8% дохода в секунду
  STUDENT_TAP_MULT: 1.5,

  // ---------- Студенты ----------
  ARRIVE_TIME: [5, 9],        // секунд до заселения следующего студента
  FIRST_ARRIVE: 1.5,
  STUDENT_LIFE: [240, 540],   // сколько секунд студент живёт до выезда
  TIERS: [
    { key: 'fresh',   rep: 0,  mult: 1,   w: 1 },
    { key: 'senior',  rep: 25, mult: 1.5, w: 1.5 },
    { key: 'master',  rep: 50, mult: 2.2, w: 2 },
    { key: 'foreign', rep: 75, mult: 3.2, w: 2.5 },
  ],

  // ---------- Мусор и поломки ----------
  TRASH_MAX: 3,
  TRASH_PENALTY: 0.1,         // -10% дохода комнаты за кучку
  TRASH_INTERVAL: 22,         // делится на корень из числа жилых комнат
  BREAK_INTERVAL: [55, 110],
  BROKEN_MULT: 0.5,
  FIX_TAPS: 3,

  // ---------- Репутация (0..100) ----------
  REP_START: 10,
  REP_BASE: 15,
  REP_DRIFT: 0.012,           // как быстро репутация тянется к цели
  REP_CLEAN: 20,              // вклад чистоты
  REP_PER_SHOWER: 4,
  REP_PER_GYM: 2,
  REP_PER_BROKEN: 4,
  REP_HOT_WATER: 20,          // штраф при отключённой горячей воде

  // ---------- Престиж ----------
  PRESTIGE_BASE: 1e5,         // всего звёзд = floor((заработано за всё время / BASE) ^ POW)
  PRESTIGE_POW: 0.25,
  PRESTIGE_MIN_FLOOR: 3,
  STAR_BONUS: 0.1,            // +10% к доходу за звезду
  BUILDING_MULT: 1.25,        // каждый новый корпус: доход x1.25
  BUILDING_THEMES: 4,

  // ---------- Реклама ----------
  BOOST_SECONDS: 300,         // x2 на 5 минут
  BOOST_MAX: 3600,            // можно накопить до часа
  FREE_UPG_COOLDOWN: 180,     // бесплатное улучшение раз в 3 минуты
  INTERSTITIAL_MIN_GAP: 180,  // наш собственный лимит между межстраничными (сек)

  // ---------- События ----------
  EVENT_FIRST: 75,
  EVENT_INTERVAL: [55, 110],
  EVENTS: {
    roach:   { w: 3,   dur: 12, debuff: 60, mult: 0.8 },
    fire:    { w: 2,   dur: 15, hp: 12, burn: 120 },
    party:   { w: 2,   dur: 25 },
    inspect: { w: 1.5, dur: 25 },
    parcel:  { w: 2,   dur: 20 },
    net:     { w: 1.5, dur: 90, taps: 15, mult: 0.7 },
    hot:     { w: 1,   dur: 60, taps: 12 },
    cat:     { w: 1.5, dur: 20 },
  },

  // ---------- Цикл дня и ночи ----------
  DAY_LENGTH: 480,

  // ---------- Сохранения ----------
  LOCAL_SAVE_EVERY: 5,
  CLOUD_SAVE_EVERY: 45,
  OFFLINE_MIN: 60,            // меньше минуты — не считаем оффлайном
};

// Цепочка целей (обучение + удержание). reward — секунд дохода, min — минимум монет.
const GOALS = [
  { type: 'collect',   n: 1,                 reward: 10,  min: 15 },
  { type: 'trash',     n: 2,                 reward: 10,  min: 15 },
  { type: 'roomLvl',   n: 3,                 reward: 20,  min: 30 },
  { type: 'roomsOpen', n: 2,                 reward: 30,  min: 60 },
  { type: 'hire',      key: 'valya',         reward: 40,  min: 100 },
  { type: 'roomLvl',   n: 6,                 reward: 40,  min: 150 },
  { type: 'roomsOpen', n: 3,                 reward: 45,  min: 250 },
  { type: 'kitchen',   n: 1,                 reward: 45,  min: 300 },
  { type: 'hire',      key: 'cleaner',       reward: 50,  min: 500 },
  { type: 'stage',     n: 2,                 reward: 60,  min: 800 },
  { type: 'fac',       key: 'shower', n: 1,  reward: 60,  min: 800 },
  { type: 'floor',     n: 2,                 reward: 60,  min: 1500 },
  { type: 'events',    n: 3,                 reward: 60,  min: 1500 },
  { type: 'hire',      key: 'plumber',       reward: 60,  min: 2000 },
  { type: 'rep',       n: 25,                reward: 60,  min: 2000 },
  { type: 'fac',       key: 'laundry', n: 1, reward: 60,  min: 3000 },
  { type: 'floor',     n: 3,                 reward: 75,  min: 5000 },
  { type: 'hire',      key: 'starosta',      reward: 75,  min: 10000 },
  { type: 'stage',     n: 3,                 reward: 75,  min: 10000 },
  { type: 'fac',       key: 'gym', n: 1,     reward: 75,  min: 20000 },
  { type: 'rep',       n: 50,                reward: 90,  min: 30000 },
  { type: 'floor',     n: 4,                 reward: 90,  min: 50000 },
  { type: 'stage',     n: 4,                 reward: 90,  min: 50000 },
  { type: 'floor',     n: 5,                 reward: 120, min: 100000 },
  { type: 'prestige',  n: 1,                 reward: 120, min: 1000 },
  { type: 'rep',       n: 75,                reward: 120, min: 100000 },
  { type: 'stage',     n: 5,                 reward: 150, min: 100000 },
];
