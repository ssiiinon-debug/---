'use strict';
// Общие помощники: математика, случайности, форматирование чисел, шина событий.

const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  chance: (p) => Math.random() < p,
  dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),

  // Детерминированный генератор (mulberry32): одинаковый seed — одинаковая внешность студента.
  rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  weightedPick(items, weightFn) {
    let total = 0;
    for (const it of items) total += weightFn(it);
    let r = Math.random() * total;
    for (const it of items) {
      r -= weightFn(it);
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  },

  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),

  SUFFIXES: ['', 'K', 'M', 'B', 'T'],

  // 1234 -> "1.23K", 15300000 -> "15.3M", после T идут aa, ab, ...
  fmt(n) {
    if (n === undefined || n === null || isNaN(n)) return '0';
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + U.fmt(-n);
    if (n < 10 && n % 1 !== 0) {
      const v = Math.floor(n * 10) / 10;
      return v % 1 === 0 ? String(v) : v.toFixed(1);
    }
    if (n < 1000) return String(Math.floor(n));
    const tier = Math.floor(Math.log10(n) / 3);
    let suffix;
    if (tier < U.SUFFIXES.length) suffix = U.SUFFIXES[tier];
    else {
      const k = tier - U.SUFFIXES.length;
      suffix = String.fromCharCode(97 + (Math.floor(k / 26) % 26)) + String.fromCharCode(97 + (k % 26));
    }
    const scaled = n / Math.pow(1000, tier);
    let str;
    if (scaled >= 100) str = String(Math.floor(scaled));
    else if (scaled >= 10) str = (Math.floor(scaled * 10) / 10).toFixed(1);
    else str = (Math.floor(scaled * 100) / 100).toFixed(2);
    if (str.indexOf('.') >= 0) str = str.replace(/0+$/, '').replace(/\.$/, '');
    return str + suffix;
  },

  // 75 -> "1:15", 7500 -> "2ч 5м"
  fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return h + t('u_h') + ' ' + m + t('u_m');
    return m + ':' + (s < 10 ? '0' : '') + s;
  },

  // "#rrggbb" + "#rrggbb" -> смесь
  mix(c1, c2, k) {
    const a = U.hexToRgb(c1), b = U.hexToRgb(c2);
    const r = Math.round(a[0] + (b[0] - a[0]) * k);
    const g = Math.round(a[1] + (b[1] - a[1]) * k);
    const bl = Math.round(a[2] + (b[2] - a[2]) * k);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  },
  hexToRgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  },
  shade(hex, k) { return k >= 0 ? U.mix(hex, '#ffffff', k) : U.mix(hex, '#000000', -k); },

  roman(n) {
    const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
    return out;
  },
};

// Мини-шина событий: симуляция сообщает, графика и интерфейс реагируют.
const Bus = {
  handlers: {},
  on(name, fn) { (this.handlers[name] || (this.handlers[name] = [])).push(fn); },
  emit(name, ...args) {
    const list = this.handlers[name];
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i](...args);
  },
};
