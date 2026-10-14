'use strict';
// Рисование кодом: палитра, примитивы и персонажи. Никаких картинок — всё векторное.
// Все персонажи рисуются «от ног»: (x, y) — точка между ступнями, рост ~46 единиц.

const INK = '#3b2b24';

const PAL = {
  skin: ['#ffdcc2', '#f6c7a3', '#e7b089', '#cf946b', '#a8704c', '#7a4c33'],
  hair: ['#2a1d17', '#4b3123', '#7a4a2a', '#c48a43', '#e3c27a', '#1d1d24', '#a8432c', '#6d6d72'],
  pants: ['#3d4f7a', '#2e3442', '#5a6476', '#6b4f3a', '#33553f', '#4a3f63'],
  shoes: ['#2b2b2b', '#f1f1f1', '#b0413e', '#3a5ba0'],
  tierTops: [
    ['#ff7a59', '#ffb84d', '#5ec46f', '#4fb3e8', '#c77dff', '#ff6fa8'],
    ['#e0563f', '#3f8fd1', '#2d9c6b', '#8e5ad6', '#d68a2d', '#4a5568'],
    ['#8a6a4f', '#5b6f8a', '#8a4f5c', '#4f7a63', '#6a6a6a', '#9b7b3f'],
    ['#ff4f7a', '#14b8a6', '#f2c230', '#6366f1', '#f97316', '#22c55e'],
  ],
  coin: '#ffc83d',
  coinDark: '#d9921c',
};

// Темы корпусов (престиж): цвет фасада, крыши, акценты.
const THEMES = [
  { facade: '#c96d4c', facadeDark: '#a3523a', mortar: '#b25d40', slab: '#a39b90', roof: '#5f4c43', trim: '#f0e1c4', stair: '#d9cfb6', accent: '#e8442f', letters: '#ff5a3c' },
  { facade: '#dfe8ee', facadeDark: '#b9c8d3', mortar: '#cbd8e1', slab: '#a7b1b8', roof: '#4d6273', trim: '#ffffff', stair: '#e5eef2', accent: '#2f86c9', letters: '#e83b3b' },
  { facade: '#4f5f78', facadeDark: '#3a475c', mortar: '#46546b', slab: '#8d93a0', roof: '#2d3442', trim: '#e2b552', stair: '#cfd5df', accent: '#e2b552', letters: '#ffd36b' },
  { facade: '#e8bd66', facadeDark: '#c79843', mortar: '#d6a955', slab: '#a69a85', roof: '#4f6b3e', trim: '#fff4dc', stair: '#efe3c6', accent: '#3f9a5a', letters: '#2fbf5f' },
];

const A = {
  // ---------- примитивы ----------
  rrPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
  box(ctx, x, y, w, h, r, fill, stroke, lw) {
    this.rrPath(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke !== null) { ctx.lineWidth = lw || 2; ctx.strokeStyle = stroke || INK; ctx.stroke(); }
  },
  rect(ctx, x, y, w, h, fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); },
  circ(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke !== null) { ctx.lineWidth = lw || 2; ctx.strokeStyle = stroke || INK; ctx.stroke(); }
  },
  ell(ctx, x, y, rx, ry, fill, stroke, lw, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke !== null) { ctx.lineWidth = lw || 2; ctx.strokeStyle = stroke || INK; ctx.stroke(); }
  },
  line(ctx, x1, y1, x2, y2, color, lw) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = lw || 2;
    ctx.strokeStyle = color || INK;
    ctx.stroke();
  },
  poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke !== null) { ctx.lineWidth = lw || 2; ctx.strokeStyle = stroke || INK; ctx.stroke(); }
  },
  // Толстая линия с обводкой — руки, ноги, трубы.
  limb(ctx, x1, y1, x2, y2, color, w) {
    ctx.lineCap = 'round';
    this.line(ctx, x1, y1, x2, y2, INK, w + 3);
    this.line(ctx, x1, y1, x2, y2, color, w);
    ctx.lineCap = 'butt';
  },
  limb2(ctx, x1, y1, xm, ym, x2, y2, color, w) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [c, lw] of [[INK, w + 3], [color, w]]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(xm, ym);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = lw;
      ctx.strokeStyle = c;
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
  },
  text(ctx, str, x, y, size, color, align, weight, stroke) {
    ctx.font = (weight || 800) + ' ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    if (stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, size * 0.22);
      ctx.strokeStyle = stroke;
      ctx.strokeText(str, x, y);
      ctx.lineJoin = 'miter';
    }
    ctx.fillStyle = color || INK;
    ctx.fillText(str, x, y);
  },

  // ---------- внешность студента ----------
  makeLook(seed, tier, building) {
    const r = U.rng(seed);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const look = {
      skin: pick(PAL.skin),
      hair: pick(PAL.hair),
      hairStyle: Math.floor(r() * 6),
      top: pick(PAL.tierTops[tier] || PAL.tierTops[0]),
      pants: pick(PAL.pants),
      shoes: pick(PAL.shoes),
      h: 0.92 + r() * 0.14,
      tier,
      backpack: tier === 0 && r() < 0.6,
      headphones: tier === 1 && r() < 0.55,
      glasses: tier === 2 || r() < 0.12,
      scarf: tier === 3 && r() < 0.6,
      beanie: tier === 3 && r() < 0.35,
      coat: building % CFG.BUILDING_THEMES === 1 && r() < 0.35,
      blinkOff: r() * 5,
    };
    if (look.beanie) look.hairStyle = 0;
    return look;
  },

  hair(ctx, look) {
    const c = look.hair;
    switch (look.hairStyle) {
      case 0: // короткая
        ctx.beginPath();
        ctx.arc(0, -43, 10.5, Math.PI * 1.02, Math.PI * 1.98);
        ctx.quadraticCurveTo(4, -47, -10.5, -42);
        ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
        break;
      case 1: // длинные
        this.box(ctx, -11, -51, 20, 24, 9, c);
        break;
      case 2: // пучок
        this.circ(ctx, -3, -55, 5.5, c);
        ctx.beginPath();
        ctx.arc(0, -43, 10.5, Math.PI * 1.05, Math.PI * 1.95);
        ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
        break;
      case 3: // кудри
        for (const [hx, hy] of [[-7, -50], [-1, -53], [6, -50], [-9, -44], [8, -46]]) this.circ(ctx, hx, hy, 5, c);
        break;
      case 4: // кепка
        ctx.beginPath();
        ctx.arc(0, -44, 10.5, Math.PI, Math.PI * 2);
        ctx.closePath(); ctx.fillStyle = look.top; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
        this.box(ctx, 4, -46, 11, 4, 2, look.top);
        break;
      default: // ёжик
        ctx.beginPath();
        ctx.moveTo(-10, -45);
        for (let k = 0; k <= 6; k++) ctx.lineTo(-10 + k * 3.4, k % 2 ? -57 : -51);
        ctx.lineTo(10, -45);
        ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    }
  },

  face(ctx, look, t, mood) {
    const blink = ((t + look.blinkOff) % 4.2) < 0.13;
    if (mood === 'sleep' || blink) {
      this.line(ctx, 1.5, -43, 4.5, -43, INK, 1.6);
      this.line(ctx, 7, -43, 9.5, -43, INK, 1.6);
    } else {
      this.circ(ctx, 3, -43.5, 1.5, INK, null);
      this.circ(ctx, 8, -43.5, 1.5, INK, null);
    }
    ctx.beginPath();
    if (mood === 'sad') ctx.arc(5.5, -36, 2.6, Math.PI * 1.15, Math.PI * 1.85);
    else if (mood === 'wow') { this.circ(ctx, 5.5, -38, 1.8, '#7a2e2e', INK, 1.2); return; }
    else ctx.arc(5.5, -39.5, 2.6, Math.PI * 0.15, Math.PI * 0.85);
    ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
    this.circ(ctx, 10, -39.5, 1.8, 'rgba(255,110,110,0.35)', null);
  },

  // pose: stand | walk | sit | dance | lift | sad | carry | wave
  student(ctx, x, y, look, pose, t, dir, alpha) {
    ctx.save();
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(x, y);
    ctx.scale((dir < 0 ? -1 : 1) * look.h, look.h);
    let bob = 0, la = 0, ra = 0, legL = 0, legR = 0, armUp = false;
    if (pose === 'walk' || pose === 'carry') {
      const p = Math.sin(t * 9);
      legL = p * 5; legR = -p * 5; la = -p * 4; ra = p * 4;
      bob = -Math.abs(Math.cos(t * 9)) * 1.5;
    } else if (pose === 'dance') {
      bob = -Math.abs(Math.sin(t * 8)) * 5;
      legL = Math.sin(t * 8) * 4; legR = -legL;
      armUp = true;
    } else if (pose === 'lift') {
      bob = Math.sin(t * 3) > 0 ? 0 : 2;
    }
    const sit = pose === 'sit';
    ctx.translate(0, bob + (sit ? 7 : 0));

    if (look.backpack) this.box(ctx, -13, -32, 8, 15, 3, '#4a6fa5');

    // ноги
    if (sit) {
      this.limb2(ctx, -3, -16, 6, -16, 7, -8, look.pants, 4.5);
      this.limb2(ctx, 3, -16, 11, -16, 12, -8, look.pants, 4.5);
      this.ell(ctx, 9, -6, 4, 2.2, look.shoes, INK, 1.5);
      this.ell(ctx, 14, -6, 4, 2.2, look.shoes, INK, 1.5);
    } else {
      this.limb(ctx, -3, -16, -3 + legL, -2, look.pants, 4.5);
      this.limb(ctx, 3, -16, 3 + legR, -2, look.pants, 4.5);
      this.ell(ctx, -2 + legL, -1.5, 4, 2.2, look.shoes, INK, 1.5);
      this.ell(ctx, 4 + legR, -1.5, 4, 2.2, look.shoes, INK, 1.5);
    }

    // туловище
    const top = look.coat ? '#f4f7fa' : look.top;
    this.box(ctx, -8, -33, 16, 19, 6, top);
    if (look.coat) this.line(ctx, 0, -32, 0, -15, '#9fb3c2', 1.5);
    if (look.scarf) { this.box(ctx, -7, -34, 14, 5, 2.5, '#d94848'); this.box(ctx, 2, -31, 4, 9, 2, '#d94848'); }

    // руки
    if (pose === 'lift') {
      const up = Math.sin(t * 3) > 0;
      const hy = up ? -58 : -40;
      this.limb(ctx, -6, -30, -9, hy, top, 4);
      this.limb(ctx, 6, -30, 9, hy, top, 4);
      this.line(ctx, -22, hy, 22, hy, '#4a4f57', 3);
      this.box(ctx, -26, hy - 6, 5, 12, 1.5, '#2f3238');
      this.box(ctx, 21, hy - 6, 5, 12, 1.5, '#2f3238');
    } else if (armUp || pose === 'wave') {
      const w = Math.sin(t * 10) * 3;
      this.limb(ctx, -6, -30, -11 - w, -45, top, 4);
      this.limb(ctx, 6, -30, 11 + (pose === 'wave' ? w * 2 : w), -46, top, 4);
    } else if (pose === 'sad') {
      this.limb(ctx, -6, -30, -7, -17, top, 4);
      this.limb(ctx, 6, -30, 7, -17, top, 4);
    } else {
      this.limb(ctx, -6, -30, -8 + la, -18, top, 4);
      this.limb(ctx, 6, -30, 8 + ra, -18, top, 4);
      if (pose === 'carry') {
        this.box(ctx, 5 + ra, -19, 13, 11, 2, '#8a5a3c');
        this.line(ctx, 8 + ra, -19, 8 + ra, -22, INK, 1.5);
      }
    }

    // голова
    if (look.hairStyle === 1) this.hair(ctx, look);
    this.circ(ctx, 0, -43, 10, look.skin);
    if (look.hairStyle !== 1) this.hair(ctx, look);
    else {
      ctx.beginPath();
      ctx.arc(0, -43, 10.5, Math.PI * 1.05, Math.PI * 1.95);
      ctx.closePath(); ctx.fillStyle = look.hair; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    }
    if (look.beanie) {
      ctx.beginPath(); ctx.arc(0, -45, 10.5, Math.PI, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = '#3b82f6'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      this.circ(ctx, 0, -57, 3, '#fbbf24');
    }
    this.face(ctx, look, t, pose === 'sad' ? 'sad' : pose === 'dance' ? 'wow' : '');
    if (look.glasses) {
      this.circ(ctx, 3, -43.5, 3.2, 'rgba(200,230,255,0.35)', INK, 1.3);
      this.circ(ctx, 9, -43.5, 3.2, 'rgba(200,230,255,0.35)', INK, 1.3);
    }
    if (look.headphones) {
      ctx.beginPath(); ctx.arc(0, -44, 11.5, Math.PI * 1.05, Math.PI * 1.95);
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#2d2d35'; ctx.stroke();
      this.box(ctx, -3, -47, 5, 8, 2, '#e94560');
    }
    ctx.restore();
  },

  // Спящий студент: (x, y) — середина матраса сверху
  sleeper(ctx, x, y, look, t, flip) {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    this.circ(ctx, -15, -7, 8, look.skin);
    ctx.beginPath(); ctx.arc(-15, -7, 8.5, Math.PI * 0.6, Math.PI * 1.45);
    ctx.lineTo(-15, -7); ctx.closePath(); ctx.fillStyle = look.hair; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    this.line(ctx, -14, -8, -11, -8, INK, 1.4);
    this.box(ctx, -9, -10, 30, 11, 5, look.top);
    this.line(ctx, -2, -9, -2, 0, 'rgba(0,0,0,0.15)', 2);
    this.line(ctx, 8, -9, 8, 0, 'rgba(0,0,0,0.15)', 2);
    ctx.restore();
  },

  // ---------- персонал ----------
  valya(ctx, x, y, t, mood) {
    // Сидит за стойкой: рисуем только верхнюю часть; (x, y) — уровень столешницы
    ctx.save();
    ctx.translate(x, y);
    const breathe = Math.sin(t * 2) * 0.6;
    this.box(ctx, -15, -26 + breathe, 30, 28, 10, '#8e5bb5');
    this.line(ctx, 0, -24 + breathe, 0, 0, '#6f4196', 2);
    this.circ(ctx, -5, -14 + breathe, 1.4, '#f3d36b', null);
    this.circ(ctx, -5, -8 + breathe, 1.4, '#f3d36b', null);
    this.circ(ctx, 0, -37 + breathe, 11, '#f2c6a2');
    // седой пучок и причёска
    this.circ(ctx, 0, -51 + breathe, 6, '#c9c4c0');
    ctx.beginPath(); ctx.arc(0, -38 + breathe, 11.5, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath();
    ctx.fillStyle = '#c9c4c0'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    // очки на кончике носа
    this.circ(ctx, -4, -35 + breathe, 3.6, 'rgba(220,240,255,0.4)', INK, 1.4);
    this.circ(ctx, 4, -35 + breathe, 3.6, 'rgba(220,240,255,0.4)', INK, 1.4);
    const blink = (t % 5) < 0.14;
    if (!blink) { this.circ(ctx, -4, -35 + breathe, 1.3, INK, null); this.circ(ctx, 4, -35 + breathe, 1.3, INK, null); }
    ctx.beginPath();
    if (mood === 'happy') ctx.arc(0, -30 + breathe, 3, Math.PI * 0.15, Math.PI * 0.85);
    else ctx.moveTo(-3, -28 + breathe), ctx.lineTo(3, -28 + breathe);
    ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
    this.circ(ctx, -10, -32 + breathe, 2, 'rgba(255,120,120,0.35)', null);
    this.circ(ctx, 10, -32 + breathe, 2, 'rgba(255,120,120,0.35)', null);
    this.circ(ctx, -11, -36 + breathe, 1.6, '#f3d36b', null);
    this.circ(ctx, 11, -36 + breathe, 1.6, '#f3d36b', null);
    ctx.restore();
  },

  cleaner(ctx, x, y, t, dir, pose) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir < 0 ? -1 : 1, 1);
    const walk = pose === 'walk';
    const p = walk ? Math.sin(t * 8) * 4 : 0;
    const sweep = pose === 'work' ? Math.sin(t * 9) * 8 : 0;
    // ведро
    if (!walk) { this.box(ctx, -22, -14, 12, 13, 2, '#5b8bd6'); this.line(ctx, -22, -14, -10, -14, INK, 2); }
    this.limb(ctx, -3, -14, -3 + p, -2, '#f0e6d8', 4);
    this.limb(ctx, 3, -14, 3 - p, -2, '#f0e6d8', 4);
    this.ell(ctx, -2 + p, -1.5, 4, 2, '#5a4636', INK, 1.5);
    this.ell(ctx, 4 - p, -1.5, 4, 2, '#5a4636', INK, 1.5);
    // халат
    this.poly(ctx, [-9, -34, 9, -34, 12, -12, -12, -12], '#4f9ad6');
    this.box(ctx, -6, -26, 12, 9, 2, '#ffffff');
    // швабра
    const mx = 14 + sweep;
    this.line(ctx, 8, -26, mx, 0, '#a77845', 3);
    this.box(ctx, mx - 8, -3, 16, 5, 2, '#d9d0b8');
    this.limb(ctx, 6, -30, 10, -20, '#4f9ad6', 4);
    this.limb(ctx, -6, -30, -7, -17, '#4f9ad6', 4);
    this.circ(ctx, 0, -43, 10, '#f2c6a2');
    // косынка в горошек
    ctx.beginPath(); ctx.arc(0, -44, 11, Math.PI * 0.95, Math.PI * 2.05); ctx.closePath();
    ctx.fillStyle = '#e04b4b'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    this.circ(ctx, -4, -50, 1.4, '#fff', null); this.circ(ctx, 3, -51, 1.4, '#fff', null); this.circ(ctx, 8, -46, 1.2, '#fff', null);
    this.poly(ctx, [-10, -42, -15, -37, -8, -39], '#e04b4b');
    this.circ(ctx, 3, -42, 1.4, INK, null); this.circ(ctx, 8, -42, 1.4, INK, null);
    ctx.beginPath(); ctx.arc(5, -38, 2.4, Math.PI * 0.15, Math.PI * 0.85); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
  },

  plumber(ctx, x, y, t, dir, pose) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir < 0 ? -1 : 1, 1);
    const walk = pose === 'walk';
    const p = walk ? Math.sin(t * 7) * 4 : 0;
    this.limb(ctx, -4, -15, -4 + p, -2, '#3c5a99', 5);
    this.limb(ctx, 4, -15, 4 - p, -2, '#3c5a99', 5);
    this.ell(ctx, -3 + p, -1.5, 4.5, 2.4, '#3a2a20', INK, 1.5);
    this.ell(ctx, 5 - p, -1.5, 4.5, 2.4, '#3a2a20', INK, 1.5);
    // пузико в комбинезоне
    this.ell(ctx, 1, -24, 12, 12, '#3c5a99');
    this.box(ctx, -6, -32, 12, 9, 2, '#e9e2d4');
    this.line(ctx, -5, -34, -5, -20, '#2b4277', 2.5);
    this.line(ctx, 6, -34, 6, -20, '#2b4277', 2.5);
    const swing = pose === 'work' ? Math.sin(t * 12) * 0.6 : 0.2;
    ctx.save();
    ctx.translate(10, -28);
    ctx.rotate(swing);
    this.limb(ctx, 0, 0, 5, 10, '#3c5a99', 4.5);
    this.line(ctx, 5, 10, 14, 4, '#9aa4ad', 3.5);
    this.circ(ctx, 15, 3, 3, null, '#9aa4ad', 2.5);
    ctx.restore();
    this.limb(ctx, -9, -28, -11, -17, '#3c5a99', 4.5);
    this.circ(ctx, 0, -43, 10, '#eab48d');
    // кепка
    ctx.beginPath(); ctx.arc(0, -45, 10.5, Math.PI, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = '#2b4277'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    this.box(ctx, 4, -47, 12, 4, 2, '#2b4277');
    // усы
    this.ell(ctx, 6, -38.5, 6, 2.6, '#8c8c8c', INK, 1.3);
    this.circ(ctx, 3, -43, 1.4, INK, null); this.circ(ctx, 8, -43, 1.4, INK, null);
    this.circ(ctx, 10.5, -41, 2.2, '#e98d7a', null);
    ctx.restore();
  },

  starosta(ctx, x, y, t, dir, pose) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir < 0 ? -1 : 1, 1);
    const p = pose === 'walk' ? Math.sin(t * 9) * 5 : 0;
    this.limb(ctx, -3, -16, -3 + p, -2, '#2e3442', 4.5);
    this.limb(ctx, 3, -16, 3 - p, -2, '#2e3442', 4.5);
    this.ell(ctx, -2 + p, -1.5, 4, 2.2, '#1b1b1b', INK, 1.5);
    this.ell(ctx, 4 - p, -1.5, 4, 2.2, '#1b1b1b', INK, 1.5);
    this.box(ctx, -8, -33, 16, 19, 5, '#f4f4f4');
    this.poly(ctx, [-1.5, -33, 1.5, -33, 2.5, -20, 0, -17, -2.5, -20], '#d23c3c', INK, 1.2);
    this.limb(ctx, -6, -30, -8, -18, '#f4f4f4', 4);
    this.limb(ctx, 6, -30, 10, -22, '#f4f4f4', 4);
    this.box(ctx, 8, -30, 10, 13, 1.5, '#c7a274');
    this.rect(ctx, 10, -28, 6, 1.4, '#fff');
    this.rect(ctx, 10, -25, 6, 1.4, '#fff');
    this.circ(ctx, 0, -43, 10, '#f4cba8');
    ctx.beginPath(); ctx.arc(0, -44, 10.5, Math.PI * 1.0, Math.PI * 1.95);
    ctx.quadraticCurveTo(-2, -50, -10.5, -41); ctx.closePath();
    ctx.fillStyle = '#5a3a22'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    this.face(ctx, { blinkOff: 1.3 }, t, '');
    this.circ(ctx, 3, -43.5, 3.2, 'rgba(200,230,255,0.35)', INK, 1.3);
    this.circ(ctx, 9, -43.5, 3.2, 'rgba(200,230,255,0.35)', INK, 1.3);
    ctx.restore();
  },

  inspector(ctx, x, y, t, dir, pose) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir < 0 ? -1 : 1, 1);
    const p = pose === 'walk' ? Math.sin(t * 7) * 4 : 0;
    this.limb(ctx, -3, -16, -3 + p, -2, '#40444f', 4.5);
    this.limb(ctx, 3, -16, 3 - p, -2, '#40444f', 4.5);
    this.ell(ctx, -2 + p, -1.5, 4, 2.2, '#111', INK, 1.5);
    this.ell(ctx, 4 - p, -1.5, 4, 2.2, '#111', INK, 1.5);
    this.box(ctx, -9, -34, 18, 20, 5, '#5a6070');
    this.poly(ctx, [-2, -34, 2, -34, 0, -26], '#fff', INK, 1);
    this.line(ctx, 0, -30, 0, -20, '#7b2b2b', 2.5);
    this.limb(ctx, 6, -31, 9, -18, '#5a6070', 4.5);
    this.box(ctx, 5, -19, 15, 11, 2, '#6b3f22');
    this.limb(ctx, -6, -31, -8, -18, '#5a6070', 4.5);
    this.circ(ctx, 0, -43, 10, '#efc4a0');
    this.box(ctx, -11, -51, 22, 4, 2, '#2e2e33');
    this.box(ctx, -7, -60, 14, 10, 3, '#2e2e33');
    this.line(ctx, 1, -47.5, 6, -46.5, INK, 2);
    this.line(ctx, 7, -46.5, 11, -47.5, INK, 2);
    this.circ(ctx, 3, -43, 1.4, INK, null); this.circ(ctx, 8.5, -43, 1.4, INK, null);
    this.line(ctx, 3, -38, 8, -38, INK, 1.6);
    ctx.restore();
  },

  cat(ctx, x, y, t, dir, moving) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir < 0 ? -1 : 1, 1);
    const p = moving ? Math.sin(t * 10) * 3 : 0;
    const tail = Math.sin(t * 3) * 6;
    ctx.beginPath(); ctx.moveTo(-14, -12); ctx.quadraticCurveTo(-26, -18, -24 + tail * 0.3, -30 - tail * 0.2);
    ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke();
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#8c8f99'; ctx.stroke(); ctx.lineCap = 'butt';
    for (const lx of [-9, -4, 5, 10]) this.limb(ctx, lx, -8, lx + (lx < 0 ? p : -p), -1, '#8c8f99', 3);
    this.ell(ctx, 0, -12, 15, 7, '#8c8f99');
    this.line(ctx, -4, -18, -2, -7, '#6c6f78', 2);
    this.line(ctx, 2, -18, 4, -7, '#6c6f78', 2);
    this.circ(ctx, 14, -19, 7.5, '#8c8f99');
    this.poly(ctx, [9, -24, 10, -32, 14, -26], '#8c8f99');
    this.poly(ctx, [15, -26, 19, -32, 20, -23], '#8c8f99');
    this.circ(ctx, 13, -20, 1.6, INK, null); this.circ(ctx, 18, -20, 1.6, INK, null);
    this.circ(ctx, 16, -17, 1.2, '#ff8fa3', null);
    ctx.restore();
  },

  roach(ctx, x, y, ang, t, dead) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    if (dead) {
      this.ell(ctx, 0, 0, 9, 7, 'rgba(90,60,30,0.6)', null);
      this.circ(ctx, -6, 4, 2.5, 'rgba(90,60,30,0.5)', null);
      ctx.restore();
      return;
    }
    const w = Math.sin(t * 30) * 2.5;
    ctx.lineCap = 'round';
    for (const [lx, sgn] of [[-3, 1], [1, 1], [5, 1], [-3, -1], [1, -1], [5, -1]]) {
      this.line(ctx, lx, 0, lx - 2 + (sgn > 0 ? w : -w), sgn * 8, '#3a2412', 1.5);
    }
    this.line(ctx, 8, -1, 16, -6 + w, '#3a2412', 1.2);
    this.line(ctx, 8, 1, 16, 6 - w, '#3a2412', 1.2);
    ctx.lineCap = 'butt';
    this.ell(ctx, -1, 0, 9, 5.5, '#7a4a22', INK, 1.5);
    this.line(ctx, -9, 0, 7, 0, 'rgba(40,20,5,0.5)', 1);
    this.circ(ctx, 8, 0, 3.2, '#5a3416', INK, 1.3);
    ctx.restore();
  },

  coinIcon(ctx, x, y, r) {
    this.circ(ctx, x, y, r, PAL.coin, INK, Math.max(1.2, r * 0.18));
    this.circ(ctx, x, y, r * 0.62, null, PAL.coinDark, Math.max(1, r * 0.14));
  },

  // Текст, который ужимается, чтобы влезть в табличку
  textFit(ctx, str, x, y, maxW, size, color, align, weight, stroke) {
    ctx.font = (weight || 800) + ' ' + size + 'px ' + FONT;
    const w = ctx.measureText(str).width;
    if (w > maxW) size = size * maxW / w;
    this.text(ctx, str, x, y, size, color, align, weight, stroke);
  },

  bubble(ctx, x, y, str, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.font = '700 ' + size + 'px ' + FONT;
    const w = Math.min(ctx.measureText(str).width, size * 16) + size * 1.2;
    const h = size * 1.7;
    const bx = x - w / 2, by = y - h - size * 0.6;
    this.box(ctx, bx, by, w, h, h * 0.45, '#ffffff', INK, Math.max(1.2, size * 0.12));
    this.poly(ctx, [x - size * 0.4, by + h - 1, x + size * 0.4, by + h - 1, x, by + h + size * 0.55], '#ffffff', null);
    this.line(ctx, x - size * 0.4, by + h, x, by + h + size * 0.55, INK, Math.max(1.2, size * 0.12));
    this.line(ctx, x + size * 0.4, by + h, x, by + h + size * 0.55, INK, Math.max(1.2, size * 0.12));
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, by + h / 2 + 0.5, size * 16);
    ctx.restore();
  },
};

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
