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

  // Персонажи (собраны из примитивов кодом). Цвета — hex.
  SKINS: [
    { id: 'ginger', price: 0,
      skin: '#f2c19b', hair: '#f08a2c', hair2: '#ffb050', hairStyle: 'curly',
      jacket: '#d62828', sleeve: '#1d1d24', trim: '#ffffff', inner: '#18181e',
      pants: '#8fb7e0', pants2: '#d7e7f7', shoes: '#141418', sole: '#ffffff', glasses: false, letter: '#ffffff' },
    { id: 'shadow', price: 1500,
      skin: '#e8b996', hair: '#121216', hair2: '#2a2a33', hairStyle: 'long',
      jacket: '#1a1a20', sleeve: '#1a1a20', trim: '#3a3a44', inner: '#0e0e12',
      pants: '#22222a', pants2: '#3a3a44', shoes: '#0e0e10', sole: '#2a2a30', glasses: true, letter: '#9a9aa8' },
    { id: 'neon', price: 4000,
      skin: '#c98b62', hair: '#ff4fb0', hair2: '#ff9ad6', hairStyle: 'bun',
      jacket: '#18d6c8', sleeve: '#7a3cff', trim: '#ffffff', inner: '#ffe04a',
      pants: '#2b2b6e', pants2: '#4545a0', shoes: '#ffffff', sole: '#ff4fb0', glasses: false, letter: '#7a3cff' },
    { id: 'sport', price: 8000,
      skin: '#f0c6a4', hair: '#5a3a22', hair2: '#7a5232', hairStyle: 'cap',
      jacket: '#1f4fd1', sleeve: '#1f4fd1', trim: '#ffffff', inner: '#ffffff',
      pants: '#1f4fd1', pants2: '#ffffff', shoes: '#ffffff', sole: '#1f4fd1', glasses: false, letter: '#ffd23f', cap: '#e5322d' },
  ],
};
