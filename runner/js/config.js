// Все цифры игры в одном месте — баланс крутим здесь.
export const CFG = {
  VERSION: '1.0.0',
  LANES: [-2.5, 0, 2.5],

  SPEED0: 15,          // стартовая скорость (м/с)
  SPEED_MAX: 33,
  SPEED_ACC: 0.16,     // прирост скорости в секунду
  GRAVITY: 62,
  JUMP_V: 17.5,        // высота прыжка ≈ 2.5 м
  SUPER_JUMP_V: 25,    // с суперкедами ≈ 5 м — можно запрыгнуть на поезд
  DIVE_V: -38,         // «вниз» в воздухе — резкое приземление
  ROLL_TIME: 0.6,
  LANE_SPEED: 19,      // м/с при смене полосы
  H_STAND: 1.7,
  H_ROLL: 0.85,
  HALF_W: 0.38,        // полуширина игрока

  TRAIN_H: 3.3,
  TRAIN_HW: 1.1,
  RAMP_LEN: 7,
  MOVING_SPEED: 11,
  MOVING_WAKE: 110,    // за сколько метров до игрока встречный поезд трогается
  VIEW_AHEAD: 175,

  STUMBLE_TIME: 4,     // сколько секунд контролёр «дышит в спину» после спотыкания
  INVULN_REVIVE: 3,
  INVULN_SHIELD: 1.6,

  SCORE_PER_M: 1,
  COIN_SCORE: 10,

  POWERS: {
    magnet:   { base: 8,  per: 2.5, color: '#e5322d', label: 'U' },
    x2:       { base: 10, per: 3,   color: '#ff4fb0', label: 'x2' },
    sneakers: { base: 8,  per: 2.5, color: '#3fbf3f', label: '⇧' },
    shield:   { base: 20, per: 6,   color: '#2fa8ff', label: '◆' },
  },
  UPG_COST: [250, 600, 1300, 2600, 5000],
  UPG_MAX: 5,

  INTERSTITIAL_EVERY: 2,  // показывать межстраничную рекламу раз в N забегов

  // Персонажи (собраны кодом). Тригот — по аутфиту: шег, бомбер с костями, джинсы в заплатках, берцы.
  SKINS: [
    { id: 'trigot', price: 0, top: 'varsity', sleeveType: 'leather', pantsType: 'denim', hairStyle: 'shag',
      skin: '#f6d3bd', skinDark: '#e4b49a', eye: '#4a3a2a', liner: true, piercing: true,
      hair: '#f2865e', hair2: '#ffa684', brow: '#c8603e',
      jacket: '#c41e2a', sleeve: '#121216', rib: ['#c41e2a', '#f4f4f4', '#141418'], inner: '#141418',
      text: 'SUPREME', textFill: '#141418', textEdge: '#ffffff', backText: '3GOTH', backSub: '2002',
      pants: '#8fb2d6', patch: ['#4f73a6', '#6d90bf', '#b4cde8', '#3b5683'], boots: '#121214' },
    { id: 'trigot_night', price: 2000, top: 'varsity', sleeveType: 'leather', pantsType: 'denim', hairStyle: 'shag',
      skin: '#f6d3bd', skinDark: '#e4b49a', eye: '#6a8a9a', liner: true, piercing: true,
      hair: '#e9e2d6', hair2: '#fffaf0', brow: '#b0a89a',
      jacket: '#18181f', sleeve: '#ececf2', rib: ['#18181f', '#f4f4f4', '#7a1c2a'], inner: '#7a1c2a',
      text: '3GOTH', textSize: 108, textFill: '#f4f4f4', textEdge: '#7a1c2a', backText: 'SURFERS', backSub: '2002',
      pants: '#3e4a66', patch: ['#2a3348', '#5a6888', '#22283a'], boots: '#121214' },
    { id: 'trigot_pink', price: 5000, top: 'varsity', sleeveType: 'leather', pantsType: 'denim', hairStyle: 'shag',
      skin: '#f6d3bd', skinDark: '#e4b49a', eye: '#6a3a5a', liner: true, piercing: true,
      hair: '#ff5fa8', hair2: '#ff9ad0', brow: '#c84a86',
      jacket: '#5a2a8a', sleeve: '#121216', rib: ['#5a2a8a', '#ff9ad0', '#141418'], inner: '#141418',
      text: 'SUPREME', textFill: '#141418', textEdge: '#ff9ad0', backText: '3GOTH', backSub: '2002',
      pants: '#2c2c34', patch: ['#45454f', '#1c1c22', '#5a5a66'], boots: '#121214' },
  ],
};
