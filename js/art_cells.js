'use strict';
// Интерьеры: комнаты пяти стадий, кухня, душевая, прачечная, качалка, вахта, лестница.
// Статичная часть рисуется один раз в кэш (offscreen canvas), а живое — каждый кадр:
// лампочка качается, гирлянда мигает, в стиральных машинах крутится бельё.

const BED_STYLES = {
  army:  { frame: '#7d8a9e', dark: '#5f6b7e', mat: '#d8d2c2', b1: '#7f8f6a', b2: '#8a9a72', pil: '#ecebe4' },
  metal: { frame: '#6f84a8', dark: '#546790', mat: '#e2dccb', b1: '#5c86c2', b2: '#c25c5c', pil: '#f4f1e8' },
  wood:  { frame: '#b07a4a', dark: '#8a5a33', mat: '#efe7d6', b1: '#e36b5a', b2: '#5aa36b', pil: '#fff8ea' },
  cozy:  { frame: '#c48a55', dark: '#966337', mat: '#f3ecdc', b1: '#f2a541', b2: '#7b6cd9', pil: '#ffffff' },
  lux:   { frame: '#4b3a33', dark: '#2f2420', mat: '#f8f2e6', b1: '#3f7fbf', b2: '#bf3f6f', pil: '#ffffff' },
};

const WALLPAPERS = [
  ['#e9d6a8', '#d4b97c'], ['#cfe1cf', '#a9c7a9'], ['#e6cfe0', '#c9a7c0'], ['#d4dff0', '#aebfdc'], ['#f0d9c4', '#d9b494'],
];
const LUX_WALLS = [['#2f4b5c', '#d4a94f'], ['#4a3358', '#d4a94f'], ['#3c4a35', '#d4a94f']];

Object.assign(A, {
  // ---------- общие детали ----------
  wall2(ctx, top, bottom, splitY) {
    this.rect(ctx, 0, 0, L.CW, L.FY, top);
    if (bottom) {
      this.rect(ctx, 0, splitY, L.CW, L.FY - splitY, bottom);
      this.rect(ctx, 0, splitY - 2, L.CW, 3, U.shade(bottom, -0.18));
    }
  },
  floorStrip(ctx, color, kind) {
    const y = L.FY, h = L.CH - L.FY;
    this.rect(ctx, 0, y, L.CW, h, color);
    const dark = U.shade(color, -0.15);
    if (kind === 'lino') {
      for (let x = 0; x < L.CW; x += 16) this.rect(ctx, x, y + 2, 1.5, h, dark);
    } else if (kind === 'parquet') {
      for (let x = -8; x < L.CW; x += 12) { this.line(ctx, x, y + h, x + 8, y, dark, 1.5); }
    } else if (kind === 'tile') {
      for (let x = 0; x < L.CW; x += 12) this.rect(ctx, x, y, 1.5, h, dark);
      this.rect(ctx, 0, y + h / 2, L.CW, 1.5, dark);
    } else if (kind === 'checker') {
      for (let x = 0; x < L.CW; x += 12) for (let k = 0; k < 2; k++) if (((x / 12) + k) % 2 === 0) this.rect(ctx, x, y + k * h / 2, 12, h / 2, dark);
    } else {
      for (const [sx, sy] of [[30, 5], [90, 8], [150, 4], [178, 9]]) this.ell(ctx, sx, y + sy, 6, 2, dark, null);
    }
    this.line(ctx, 0, y, L.CW, y, INK, 2);
  },
  brickPatch(ctx, x, y, w, h) {
    this.ell(ctx, x + w / 2, y + h / 2, w / 2 + 6, h / 2 + 5, '#cdc6b5', null);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const bx = x + c * (w / 3) + (r % 2 ? w / 6 : 0) - 2;
        this.box(ctx, bx, y + r * (h / 3), w / 3 - 2, h / 3 - 2, 1, '#b8634a', 'rgba(60,40,30,0.5)', 1);
      }
    }
  },
  door(ctx, x, y, style, num) {
    const w = 28, h = L.FY - y;
    const c = { old: ['#8f7151', '#6f5338', '#bdb4a2'], plain: ['#9b6b43', '#7a5232', '#cfc6b4'], nice: ['#b5814f', '#8c5f35', '#efe6d4'], lux: ['#5a3a2a', '#3f271b', '#d4a94f'] }[style];
    this.box(ctx, x - 4, y - 4, w + 8, h + 4, 2, c[2]);
    this.box(ctx, x, y, w, h, 2, c[0]);
    this.box(ctx, x + 4, y + 18, w - 8, 18, 1.5, null, c[1], 1.5);
    this.box(ctx, x + 4, y + 42, w - 8, 22, 1.5, null, c[1], 1.5);
    this.circ(ctx, x + w - 6, y + h * 0.56, 2.2, style === 'lux' ? '#e8c26a' : '#d9b25a', INK, 1.2);
    if (style === 'old') {
      this.ell(ctx, x + 9, y + 50, 4, 6, '#b29a7c', null);
      this.ell(ctx, x + 19, y + 12, 3, 4, '#b29a7c', null);
    }
    if (num) {
      this.box(ctx, x + 6, y + 5, 16, 9, 1.5, style === 'lux' ? '#d4a94f' : '#ece5d2', INK, 1);
      this.text(ctx, num, x + 14, y + 9.8, 6.5, INK, 'center', 800);
    }
  },
  windowCut(ctx, win) { ctx.clearRect(win[0], win[1], win[2], win[3]); },
  windowFrame(ctx, win, style, curtain) {
    const [x, y, w, h] = win;
    const fc = style === 'old' ? '#e2dccb' : style === 'lux' ? '#3a2a22' : '#f6f3ea';
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 3; ctx.strokeStyle = fc; ctx.strokeRect(x, y, w, h);
    this.line(ctx, x + w / 2, y, x + w / 2, y + h, fc, 2.5);
    this.line(ctx, x, y + h * 0.38, x + w, y + h * 0.38, fc, 2.5);
    ctx.globalAlpha = 0.35;
    this.line(ctx, x + 5, y + h - 5, x + w * 0.4, y + 5, '#ffffff', 2);
    ctx.globalAlpha = 1;
    this.box(ctx, x - 5, y + h, w + 10, 5, 1.5, style === 'lux' ? '#d4a94f' : '#e7e1d3');
    if (style === 'old') {
      ctx.globalAlpha = 0.8;
      this.line(ctx, x + 2, y + 2, x + w * 0.5 - 2, y + h * 0.38 - 2, '#efe2b5', 3);
      this.line(ctx, x + w * 0.5 - 2, y + 2, x + 2, y + h * 0.38 - 2, '#efe2b5', 3);
      ctx.globalAlpha = 1;
    }
    if (curtain) {
      this.box(ctx, x - 8, y - 6, w + 16, 4, 2, '#8a6a4a');
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 3); ctx.lineTo(x + 8, y - 3);
      ctx.quadraticCurveTo(x + 2, y + h * 0.6, x + 6, y + h + 2); ctx.lineTo(x - 8, y + h + 2); ctx.closePath();
      ctx.fillStyle = curtain; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w + 8, y - 3); ctx.lineTo(x + w - 8, y - 3);
      ctx.quadraticCurveTo(x + w - 2, y + h * 0.6, x + w - 6, y + h + 2); ctx.lineTo(x + w + 8, y + h + 2); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
  },
  wallpaper(ctx, base, motif, kind) {
    this.rect(ctx, 0, 0, L.CW, L.FY, base);
    ctx.fillStyle = motif;
    if (kind === 0) {
      for (let x = 6; x < L.CW; x += 18) ctx.fillRect(x, 0, 5, L.FY);
    } else if (kind === 1) {
      for (let y = 8; y < L.FY; y += 16) for (let x = (y / 16) % 2 ? 4 : 12; x < L.CW; x += 16) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); }
    } else {
      for (let y = 10; y < L.FY; y += 20) for (let x = (y / 20) % 2 ? 6 : 16; x < L.CW; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.fill();
      }
    }
    this.rect(ctx, 0, L.FY - 8, L.CW, 8, U.shade(motif, -0.2));
  },
  carpet(ctx, x, y, w, h) {
    this.box(ctx, x, y, w, h, 2, '#a3302b');
    this.box(ctx, x + 4, y + 4, w - 8, h - 8, 1, null, '#e2a93b', 2);
    const cx = x + w / 2, cy = y + h / 2;
    this.poly(ctx, [cx, y + 9, x + w - 9, cy, cx, y + h - 9, x + 9, cy], '#2f4f86', '#e2a93b', 1.5);
    this.poly(ctx, [cx, cy - 8, cx + 7, cy, cx, cy + 8, cx - 7, cy], '#e2a93b', null);
    this.circ(ctx, cx, cy, 2.5, '#a3302b', null);
    for (const [px, py] of [[x + 10, y + 10], [x + w - 10, y + 10], [x + 10, y + h - 10], [x + w - 10, y + h - 10]]) {
      this.poly(ctx, [px, py - 3, px + 3, py, px, py + 3, px - 3, py], '#2f4f86', null);
    }
    for (let k = x + 3; k < x + w - 2; k += 4) {
      this.line(ctx, k, y + h, k, y + h + 4, '#e2a93b', 1.2);
      this.line(ctx, k, y, k, y - 4, '#e2a93b', 1.2);
    }
  },
  bunk(ctx, x, w, style) {
    const st = BED_STYLES[style];
    this.box(ctx, x, 50, 5, L.FY - 50, 1.5, st.frame);
    this.box(ctx, x + w - 5, 50, 5, L.FY - 50, 1.5, st.frame);
    this.line(ctx, x + 3, 66, x + w * 0.62, 66, st.frame, 3);
    // верхний ярус
    this.box(ctx, x, 84, w, 6, 1.5, st.dark);
    this.box(ctx, x + 2, 76, w - 4, 9, 3, st.mat);
    this.box(ctx, x + 15, 74, w - 18, 11, 4, st.b1);
    this.line(ctx, x + 24, 75, x + 24, 84, 'rgba(255,255,255,0.35)', 2);
    this.box(ctx, x + 4, 72, 13, 7, 3, st.pil);
    // нижний ярус
    this.box(ctx, x, 120, w, 6, 1.5, st.dark);
    this.box(ctx, x + 2, 112, w - 4, 9, 3, st.mat);
    this.box(ctx, x + 15, 110, w - 18, 11, 4, st.b2);
    this.line(ctx, x + 24, 111, x + 24, 120, 'rgba(255,255,255,0.35)', 2);
    this.box(ctx, x + 4, 108, 13, 7, 3, st.pil);
    // лесенка
    const lx = x + w - 13;
    this.line(ctx, lx, 86, lx, 112, st.frame, 2);
    this.line(ctx, lx + 7, 86, lx + 7, 112, st.frame, 2);
    for (let ly = 92; ly < 112; ly += 7) this.line(ctx, lx, ly, lx + 7, ly, st.frame, 2);
  },
  bed(ctx, x, w, style) {
    const st = BED_STYLES[style];
    this.box(ctx, x, 94, 7, L.FY - 94, 2, st.frame);
    this.box(ctx, x + w - 7, 104, 7, L.FY - 104, 2, st.frame);
    this.box(ctx, x + 3, 121, w - 6, 8, 1.5, st.dark);
    this.box(ctx, x + 5, 114, w - 10, 8, 3, st.mat);
    this.box(ctx, x + 16, 112, w - 23, 10, 4, st.b1);
    this.box(ctx, x + 7, 108, 13, 7, 3, st.pil);
  },
  nightstand(ctx, x, w, color) {
    this.box(ctx, x, 110, w, L.FY - 110, 2, color);
    this.line(ctx, x + 2, 122, x + w - 2, 122, INK, 1.5);
    this.circ(ctx, x + w / 2, 116, 1.6, '#e8d28a', INK, 1);
    this.circ(ctx, x + w / 2, 130, 1.6, '#e8d28a', INK, 1);
  },
  table(ctx, x, w, top, color) {
    this.box(ctx, x, top, w, 5, 1.5, color);
    this.line(ctx, x + 4, top + 5, x + 4, L.FY, INK, 3);
    this.line(ctx, x + w - 4, top + 5, x + w - 4, L.FY, INK, 3);
  },
  kettle(ctx, x, y) {
    this.box(ctx, x, y - 15, 13, 15, 4, '#f4f4f4');
    this.poly(ctx, [x + 13, y - 11, x + 19, y - 15, x + 13, y - 6], '#f4f4f4', INK, 1.5);
    this.box(ctx, x - 1, y - 3, 15, 3, 1, '#4a4a4a', INK, 1);
    this.rect(ctx, x + 2, y - 12, 3, 6, '#7ec8e3');
  },
  mug(ctx, x, y, color) {
    this.box(ctx, x, y - 8, 7, 8, 1.5, color, INK, 1.3);
    ctx.beginPath(); ctx.arc(x + 8, y - 4, 2.5, -1.4, 1.4); ctx.lineWidth = 1.3; ctx.strokeStyle = INK; ctx.stroke();
  },
  fridge(ctx, x, y, w, h, tall) {
    this.box(ctx, x, y, w, h, 3, '#f2f3f0');
    this.line(ctx, x, y + (tall ? h * 0.35 : h * 0.3), x + w, y + (tall ? h * 0.35 : h * 0.3), INK, 1.5);
    this.line(ctx, x + w - 4, y + 6, x + w - 4, y + 14, '#9aa3ad', 2);
    this.line(ctx, x + w - 4, y + h * 0.42, x + w - 4, y + h * 0.6, '#9aa3ad', 2);
    this.circ(ctx, x + 6, y + h * 0.5, 2, '#e85d5d', null);
    this.rect(ctx, x + 9, y + h * 0.55, 5, 4, '#5db8e8');
    this.circ(ctx, x + 7, y + h * 0.7, 2, '#f2c230', null);
  },
  poster(ctx, x, y, w, h, c1, c2) {
    this.box(ctx, x, y, w, h, 1, c1, INK, 1.5);
    this.circ(ctx, x + w / 2, y + h * 0.42, Math.min(w, h) * 0.22, c2, null);
    this.rect(ctx, x + 4, y + h - 9, w - 8, 3, c2);
  },
  plant(ctx, x, y, s) {
    s = s || 1;
    this.poly(ctx, [x - 7 * s, y - 14 * s, x + 7 * s, y - 14 * s, x + 5 * s, y, x - 5 * s, y], '#c4673f');
    for (const [dx, dy, r] of [[-6, -26, 0.6], [5, -28, -0.5], [0, -34, 0], [-9, -20, 1], [9, -21, -1]]) {
      this.ell(ctx, x + dx * s, y + dy * s, 4 * s, 9 * s, '#4f9d5a', INK, 1.5, r);
    }
  },
  books(ctx, x, y, n) {
    const cols = ['#c0392b', '#2e86c1', '#27ae60', '#f39c12', '#8e44ad', '#16a085'];
    let bx = x;
    for (let k = 0; k < n; k++) {
      const h = 10 + ((k * 7) % 5);
      this.box(ctx, bx, y - h, 4.5, h, 0.8, cols[k % cols.length], INK, 1);
      bx += 5;
    }
  },

  // ---------- комнаты ----------
  roomStatic(ctx, stage, i) {
    const num = String((Math.floor(i / CFG.ROOMS_PER_FLOOR) + 1) * 100 + (i % CFG.ROOMS_PER_FLOOR) + 1);
    const lay = ROOM_LAYOUT[stage];
    const v = i % 5;
    if (stage === 1) {
      this.wall2(ctx, '#aab2a0', '#8f9b86', 86);
      this.brickPatch(ctx, 150, 72, 30, 16);
      this.brickPatch(ctx, 60, 30, 24, 14);
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(50,45,35,0.45)';
      ctx.beginPath(); ctx.moveTo(178, 0); ctx.lineTo(171, 12); ctx.lineTo(179, 22); ctx.lineTo(173, 34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(44, 92); ctx.lineTo(51, 100); ctx.lineTo(46, 112); ctx.stroke();
      this.ell(ctx, 96, 50, 15, 9, 'rgba(120,105,60,0.18)', null);
      this.floorStrip(ctx, '#8d8984', 'concrete');
      this.door(ctx, 12, 64, 'old', num);
      this.windowCut(ctx, lay.win);
      this.windowFrame(ctx, lay.win, 'old');
      this.box(ctx, 96, 102, 8, 10, 1.5, '#e8e4da', INK, 1.2);
      this.circ(ctx, 98.5, 107, 0.9, INK, null); this.circ(ctx, 101.5, 107, 0.9, INK, null);
      // коробка вместо стола, кружка и лапша
      this.box(ctx, 52, 116, 34, 22, 1.5, '#c9a06a');
      this.line(ctx, 52, 121, 86, 121, '#a8814f', 2);
      this.mug(ctx, 57, 116, '#e05a47');
      this.box(ctx, 70, 108, 11, 8, 1.5, '#f4d03f', INK, 1.2);
      this.rect(ctx, 70.5, 108.5, 10, 2.5, '#e74c3c');
      // раскладушка
      ctx.lineCap = 'round';
      for (const lx of [126, 178]) {
        this.line(ctx, lx - 6, L.FY, lx + 6, 122, '#6f7782', 2.5);
        this.line(ctx, lx + 6, L.FY, lx - 6, 122, '#6f7782', 2.5);
      }
      ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(120, 117); ctx.quadraticCurveTo(156, 129, 192, 117);
      ctx.lineTo(192, 122); ctx.quadraticCurveTo(156, 133, 120, 122); ctx.closePath();
      ctx.fillStyle = '#6f8a5f'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      this.box(ctx, 122, 109, 15, 8, 3, '#d9d4c5');
      // паутина
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(L.CW, 0); ctx.lineTo(L.CW - 26 + k * 2, k * 8); ctx.stroke(); }
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(L.CW, 0, k * 8, Math.PI * 0.5, Math.PI); ctx.stroke(); }
    } else if (stage === 2) {
      this.wall2(ctx, '#d6e3e8', '#8fb0bf', 78);
      this.floorStrip(ctx, '#a0714f', 'lino');
      this.door(ctx, 12, 64, 'plain', num);
      this.windowCut(ctx, lay.win);
      this.windowFrame(ctx, lay.win, 'plain');
      this.box(ctx, 14, 20, 24, 30, 1, '#fdfbf3', INK, 1.3);
      for (let k = 0; k < 4; k++) this.line(ctx, 17, 28 + k * 5, 35, 28 + k * 5, '#9aa3ad', 1);
      this.rect(ctx, 14, 20, 24, 5, '#e05a47');
      this.nightstand(ctx, 56, 30, '#b58b5c');
      this.box(ctx, 63, 101, 12, 9, 3, '#e05a47');
      this.circ(ctx, 69, 105.5, 3, '#fff', INK, 1);
      this.bunk(ctx, 100, 46, 'metal');
      this.bunk(ctx, 150, 46, 'army');
    } else if (stage === 3) {
      const wp = WALLPAPERS[v];
      this.wallpaper(ctx, wp[0], wp[1], v % 3);
      this.floorStrip(ctx, '#b07d55', 'lino');
      this.ell(ctx, 120, 142, 44, 5, '#a8433a', INK, 1.5);
      this.door(ctx, 12, 64, 'nice', num);
      this.box(ctx, 6, 50, 40, 4, 1, '#8a5a33');
      this.books(ctx, 9, 50, 6);
      this.windowCut(ctx, lay.win);
      this.windowFrame(ctx, lay.win, 'plain', ['#e85d75', '#5d8fe8', '#5dbb63', '#e8a35d', '#a35de8'][v]);
      this.table(ctx, 46, 46, 104, '#b07a4a');
      this.kettle(ctx, 52, 104);
      this.mug(ctx, 74, 104, '#4f9ad6');
      this.mug(ctx, 82, 104, '#f2c230');
      this.carpet(ctx, 99, 34, 44, 62);
      this.bed(ctx, 96, 50, 'wood');
      this.bunk(ctx, 150, 46, 'wood');
    } else if (stage === 4) {
      const wp = WALLPAPERS[(v + 2) % 5];
      this.wallpaper(ctx, wp[0], wp[1], (v + 1) % 3);
      this.floorStrip(ctx, '#b88a5c', 'lino');
      this.ell(ctx, 120, 142, 46, 5, '#5b6fbf', INK, 1.5);
      this.door(ctx, 12, 64, 'nice', num);
      this.poster(ctx, 14, 16, 22, 30, '#2d2d44', '#f2c230');
      this.windowCut(ctx, lay.win);
      this.windowFrame(ctx, lay.win, 'plain', ['#f2a541', '#e85d75', '#5dbb63', '#5d8fe8', '#a35de8'][v]);
      this.fridge(ctx, 44, 92, 22, 46);
      this.box(ctx, 47, 84, 16, 8, 2, '#2f3542');
      this.line(ctx, 50, 84, 48, 76, INK, 1.5);
      this.line(ctx, 60, 84, 62, 76, INK, 1.5);
      this.table(ctx, 68, 28, 106, '#b07a4a');
      this.box(ctx, 71, 94, 18, 12, 1.5, '#3d4250');
      this.rect(ctx, 73, 96, 14, 8, '#6fc3e8');
      this.rect(ctx, 69, 105, 22, 2, '#3d4250');
      this.carpet(ctx, 99, 34, 44, 62);
      this.bed(ctx, 96, 50, 'cozy');
      this.bunk(ctx, 150, 46, 'cozy');
      this.poster(ctx, 152, 18, 18, 24, '#e85d75', '#ffffff');
    } else {
      const lw = LUX_WALLS[v % 3];
      this.wallpaper(ctx, lw[0], U.shade(lw[0], 0.12), 2);
      ctx.globalAlpha = 0.5;
      for (let y = 10; y < L.FY; y += 20) for (let x = (y / 20) % 2 ? 6 : 16; x < L.CW; x += 20) this.circ(ctx, x, y, 1.2, lw[1], null);
      ctx.globalAlpha = 1;
      this.floorStrip(ctx, '#a8714a', 'parquet');
      this.ell(ctx, 76, 142, 36, 5, '#e8e1d2', INK, 1.5);
      this.door(ctx, 12, 64, 'lux', num);
      this.windowCut(ctx, lay.win);
      this.windowFrame(ctx, lay.win, 'lux', '#c9a24f');
      // кондиционер
      this.box(ctx, 148, 6, 46, 16, 4, '#f7f7f7');
      this.line(ctx, 152, 17, 190, 17, '#c4c4c4', 2);
      this.circ(ctx, 188, 10, 1.6, '#5ee87a', null);
      // телевизор и тумба с приставкой
      this.box(ctx, 46, 34, 52, 32, 3, '#1c1c22');
      this.box(ctx, 46, 126, 52, 12, 2, '#3a2a22');
      this.box(ctx, 52, 119, 20, 7, 2, '#f2f2f2');
      this.circ(ctx, 56, 122.5, 1.2, '#4a90e2', null);
      this.box(ctx, 78, 121, 12, 5, 2.5, '#2b2b33');
      this.plant(ctx, 104, L.FY, 0.9);
      // пуфик
      this.ell(ctx, 76, 131, 14, 8, '#e05a7a');
      this.bed(ctx, 108, 42, 'lux');
      this.bunk(ctx, 150, 46, 'lux');
    }
  },

  roomLocked(ctx, i) {
    this.wall2(ctx, '#6d6a62', '#5d5a53', 86);
    this.floorStrip(ctx, '#5f5c57', 'concrete');
    this.brickPatch(ctx, 140, 40, 30, 16);
    this.door(ctx, 12, 64, 'old', null);
    // доски крест-накрест
    this.box(ctx, 4, 84, 44, 8, 1.5, '#b08a5a', INK, 1.5);
    ctx.save(); ctx.translate(26, 100); ctx.rotate(-0.5);
    this.box(ctx, -24, -4, 48, 8, 1.5, '#a07a4a', INK, 1.5);
    ctx.restore();
    this.box(ctx, 120, 112, 26, 26, 1.5, '#9a7a52');
    this.box(ctx, 148, 120, 22, 18, 1.5, '#8a6a46');
    this.box(ctx, 128, 96, 18, 16, 1.5, '#a5855b');
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(L.CW, 0, k * 9, Math.PI * 0.5, Math.PI); ctx.stroke(); }
  },

  // Живая часть комнаты (поверх кэша)
  roomDyn(ctx, stage, t, lights, i) {
    if (stage === 1) {
      const a = Math.sin(t * 1.3 + i) * 0.12;
      const bx = 92 + Math.sin(a) * 40, by = Math.cos(a) * 40;
      this.line(ctx, 92, 0, bx, by, INK, 1.5);
      this.box(ctx, bx - 2.5, by - 2, 5, 4, 1, '#555', INK, 1);
      this.circ(ctx, bx, by + 5, 5, lights ? '#fff3b0' : '#f3efe0', INK, 1.5);
    } else if (stage === 2 || stage === 3) {
      this.box(ctx, 106, 0, 30, 6, 2, '#f1f1f1', INK, 1.5);
      this.ell(ctx, 121, 8, 13, 5, lights ? '#fff3b0' : '#f3efe0', INK, 1.5);
      if (stage === 3 && Math.sin(t * 0.7 + i) > 0.6) {
        for (let k = 0; k < 3; k++) {
          const p = ((t * 0.8 + k * 0.33) % 1);
          this.circ(ctx, 64 + Math.sin(p * 6 + k) * 3, 86 - p * 22, 3 + p * 3, 'rgba(255,255,255,' + (0.5 * (1 - p)) + ')', null);
        }
      }
    } else if (stage === 4) {
      // гирлянда
      ctx.beginPath(); ctx.moveTo(2, 6);
      for (let x = 2; x <= L.CW - 2; x += 4) ctx.lineTo(x, 6 + Math.sin((x / (L.CW - 4)) * Math.PI * 3) * 4 + 4);
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#2f5a2f'; ctx.stroke();
      const cols = ['#ff4d4d', '#ffd23f', '#3fd2ff', '#7dff6b', '#ff7df0'];
      for (let k = 0; k < 14; k++) {
        const x = 8 + k * 13.5;
        const y = 6 + Math.sin((x / (L.CW - 4)) * Math.PI * 3) * 4 + 7;
        const on = Math.sin(t * 4 + k * 1.7) > -0.2;
        this.circ(ctx, x, y, 2.6, on ? cols[k % 5] : '#555', INK, 0.8);
      }
      // роутер мигает
      if (Math.sin(t * 9 + i) > 0) this.circ(ctx, 52, 88, 1.3, '#5ee87a', null);
      if (Math.sin(t * 13 + i) > 0.3) this.circ(ctx, 57, 88, 1.3, '#5ee87a', null);
      this.ell(ctx, 121, 8, 12, 4, lights ? '#fff3b0' : '#f3efe0', INK, 1.5);
    } else {
      // LED-лента
      const hue = (t * 40 + i * 30) % 360;
      ctx.fillStyle = 'hsl(' + hue + ',90%,60%)';
      ctx.fillRect(0, 0, L.CW, 3);
      // экран телевизора
      const g = ctx.createLinearGradient(48, 36, 96, 64);
      g.addColorStop(0, 'hsl(' + ((t * 25) % 360) + ',70%,55%)');
      g.addColorStop(1, 'hsl(' + ((t * 25 + 120) % 360) + ',70%,45%)');
      ctx.fillStyle = g;
      ctx.fillRect(49, 37, 46, 26);
      this.rect(ctx, 52 + ((t * 20) % 30), 52, 8, 6, 'rgba(255,255,255,0.8)');
      this.rect(ctx, 62, 44 + Math.sin(t * 3) * 4, 4, 4, '#fff36b');
      // поток воздуха из кондиционера
      ctx.strokeStyle = 'rgba(160,220,255,0.55)'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const p = (t * 0.9 + k / 3) % 1;
        ctx.globalAlpha = 1 - p;
        ctx.beginPath(); ctx.moveTo(156 + k * 12, 24 + p * 26);
        ctx.quadraticCurveTo(160 + k * 12, 30 + p * 26, 156 + k * 12, 36 + p * 26); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  },

  // ---------- кухня ----------
  kitchenTier(lvl) { return lvl <= 0 ? 0 : lvl <= 3 ? 1 : lvl <= 7 ? 2 : 3; },
  kitchenStatic(ctx, tier, duty) {
    const top = ['#e8dcbc', '#efe6cf', '#e3ecee'][tier - 1];
    this.rect(ctx, 0, 0, L.CW, L.FY, top);
    // плитка
    this.rect(ctx, 0, 72, L.CW, L.FY - 72, '#f4f6f6');
    ctx.fillStyle = 'rgba(80,120,150,0.25)';
    for (let x = 0; x < L.CW; x += 11) ctx.fillRect(x, 72, 1, L.FY - 72);
    for (let y = 72; y < L.FY; y += 11) ctx.fillRect(0, y, L.CW, 1);
    if (tier === 1) for (let x = 0; x < L.CW; x += 22) this.rect(ctx, x, 72, 11, 11, '#9cc7d9');
    this.floorStrip(ctx, tier === 3 ? '#7e8a91' : '#a67b55', 'checker');
    // общий холодильник с запиской
    this.fridge(ctx, 8, 64, 30, 74, true);
    this.box(ctx, 14, 92, 14, 10, 0.5, '#fff7a8', INK, 1);
    this.text(ctx, '!!!', 21, 97, 6, '#d33', 'center', 900);
    // график дежурств
    this.box(ctx, 46, 22, 46, 40, 1, '#fdfbf3', INK, 1.3);
    this.textFit(ctx, duty, 69, 29, 42, 5.5, '#c0392b', 'center', 900);
    for (let k = 0; k < 5; k++) { this.line(ctx, 50, 36 + k * 5, 88, 36 + k * 5, '#9aa3ad', 1); this.line(ctx, 64, 34, 64, 60, '#9aa3ad', 1); }
    // мойка
    this.box(ctx, 46, 106, 52, L.FY - 106, 2, tier === 3 ? '#e8e8e8' : '#c7a77c');
    this.box(ctx, 44, 101, 56, 6, 1.5, tier === 3 ? '#9aa3ad' : '#d9cbb0');
    this.box(ctx, 56, 99, 26, 4, 1.5, '#b9c3cc');
    this.line(ctx, 69, 99, 69, 88, '#9aa3ad', 2.5);
    this.line(ctx, 69, 88, 76, 88, '#9aa3ad', 2.5);
    this.line(ctx, 72, 106, 72, L.FY, INK, 1.2);
    // гора посуды
    this.ell(ctx, 88, 98, 7, 2, '#ffffff', INK, 1);
    this.ell(ctx, 88, 95, 6, 2, '#f2d3a0', INK, 1);
    // плита
    const sc = tier === 3 ? '#2b2b30' : tier === 2 ? '#f0f0f0' : '#e7e2d6';
    this.box(ctx, 104, 100, 44, L.FY - 100, 2, sc);
    this.box(ctx, 110, 112, 32, 18, 2, tier === 3 ? '#111' : '#3b3b3b');
    this.rect(ctx, 113, 115, 26, 4, 'rgba(255,255,255,0.15)');
    for (let k = 0; k < 4; k++) this.circ(ctx, 110 + k * 10.5, 106, 1.8, tier === 3 ? '#777' : INK, null);
    this.rect(ctx, 104, 97, 44, 3, tier === 3 ? '#1b1b1f' : '#cfc8b8');
    // кастрюля и сковородка
    this.box(ctx, 108, 84, 20, 13, 2, '#c0c7cf');
    this.box(ctx, 106, 82, 24, 3, 1.5, '#9aa3ad');
    this.ell(ctx, 140, 95, 9, 2.5, '#2b2b2b', INK, 1.5);
    this.line(ctx, 149, 95, 160, 93, '#2b2b2b', 3);
    // полка с банками
    this.box(ctx, 102, 56, 50, 4, 1, '#8a5a33');
    const jars = ['#e8a35d', '#d9534f', '#f2c230', '#8bc34a'];
    for (let k = 0; k < 4; k++) this.box(ctx, 106 + k * 11, 45, 8, 11, 2, jars[k], INK, 1.2);
    if (tier >= 2) { this.box(ctx, 152, 46, 30, 18, 2, '#e9e9e9'); this.rect(ctx, 155, 49, 18, 12, '#2b2b30'); }
    else { this.windowCut(ctx, [158, 24, 34, 30]); this.windowFrame(ctx, [158, 24, 34, 30], 'old'); }
    // столик
    this.table(ctx, 160, 36, 112, '#b07a4a');
    this.kettle(ctx, 172, 112);
    if (tier === 3) { this.box(ctx, 104, 66, 44, 10, 3, '#cfd5da'); this.poly(ctx, [110, 76, 142, 76, 148, 82, 104, 82], '#b9c3cc'); }
  },
  facLocked(ctx, kind) {
    this.wall2(ctx, '#8f897c', '#7a7468', 80);
    this.floorStrip(ctx, '#6d6a65', 'concrete');
    this.box(ctx, 16, 108, 30, 30, 1.5, '#9a7a52');
    this.box(ctx, 44, 118, 24, 20, 1.5, '#8a6a46');
    this.box(ctx, 22, 88, 20, 20, 1.5, '#a5855b');
    // стремянка и ведро краски
    this.line(ctx, 160, L.FY, 172, 80, '#c7a46a', 3);
    this.line(ctx, 186, L.FY, 174, 80, '#c7a46a', 3);
    for (let y = 92; y < 136; y += 12) this.line(ctx, 163 + (y - 80) * 0.0, y, 183 - (y - 80) * 0.0, y, '#c7a46a', 2);
    this.box(ctx, 128, 122, 16, 16, 2, '#e8e8e8');
    this.rect(ctx, 128, 122, 16, 4, '#5d8fe8');
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(0, 0, k * 9, 0, Math.PI * 0.5); ctx.stroke(); }
  },
  kitchenDyn(ctx, tier, t, burned) {
    if (!burned) {
      for (let k = 0; k < 4; k++) {
        const p = (t * 0.5 + k / 4) % 1;
        this.circ(ctx, 118 + Math.sin(p * 7 + k) * 4, 80 - p * 40, 3 + p * 5, 'rgba(255,255,255,' + (0.55 * (1 - p)) + ')', null);
      }
      if (Math.sin(t * 2) > 0) this.circ(ctx, 110 + 10.5 * 3, 106, 2.2, '#ff6b3d', null);
    }
    this.box(ctx, 106, 0, 30, 6, 2, '#f1f1f1', INK, 1.5);
  },
  sootOverlay(ctx, t) {
    ctx.fillStyle = 'rgba(30,25,25,0.45)';
    ctx.fillRect(0, 0, L.CW, L.FY);
    for (const [x, y, r] of [[120, 70, 30], [150, 40, 24], [90, 50, 20], [130, 20, 26]]) this.circ(ctx, x, y, r, 'rgba(20,15,15,0.35)', null);
    for (let k = 0; k < 4; k++) {
      const p = (t * 0.3 + k / 4) % 1;
      this.circ(ctx, 126 + Math.sin(p * 5 + k) * 8, 90 - p * 90, 6 + p * 10, 'rgba(60,60,60,' + (0.5 * (1 - p)) + ')', null);
    }
  },

  // ---------- душевая ----------
  facTier(lvl) { return lvl <= 0 ? 0 : lvl <= 3 ? 1 : lvl <= 7 ? 2 : 3; },
  showerStatic(ctx, tier) {
    const tile = ['#bcd6df', '#cfe6ef', '#e3f1f5'][tier - 1];
    this.rect(ctx, 0, 0, L.CW, L.FY, tile);
    ctx.fillStyle = 'rgba(60,100,120,0.25)';
    for (let x = 0; x < L.CW; x += 12) ctx.fillRect(x, 0, 1, L.FY);
    for (let y = 0; y < L.FY; y += 12) ctx.fillRect(0, y, L.CW, 1);
    if (tier === 1) {
      for (const [x, y] of [[60, 30], [150, 90], [96, 112]]) this.line(ctx, x, y, x + 8, y + 6, 'rgba(60,60,60,0.5)', 1.2);
    }
    this.floorStrip(ctx, '#6f97a6', 'tile');
    // бойлер
    this.box(ctx, 8, 20, 30, 50, 8, '#f2f2f2');
    this.circ(ctx, 23, 40, 6, '#ffffff', INK, 1.5);
    this.line(ctx, 23, 40, 26, 37, '#d33', 1.5);
    const pipe = tier === 1 ? '#a5683c' : tier === 2 ? '#8f9aa5' : '#c9d3db';
    this.line(ctx, 18, 70, 18, 80, pipe, 3);
    this.line(ctx, 28, 70, 28, 80, pipe, 3);
    this.line(ctx, 18, 80, L.CW, 80, pipe, 3);
    // кабинки
    const n = tier >= 2 ? 3 : 2;
    const x0 = 46, sw = (L.CW - x0) / n;
    for (let k = 0; k < n; k++) {
      const sx = x0 + k * sw;
      this.line(ctx, sx + sw / 2, 0, sx + sw / 2, 24, pipe, 3);
      this.poly(ctx, [sx + sw / 2 - 8, 30, sx + sw / 2 + 8, 30, sx + sw / 2 + 4, 24, sx + sw / 2 - 4, 24], pipe);
      if (k > 0) this.box(ctx, sx - 2, 40, 4, L.FY - 40, 1, '#e8eef0', INK, 1.5);
    }
    // шторка у первой кабинки
    const cc = ['#e85d75', '#5d8fe8', '#5dbb63'][tier - 1];
    this.line(ctx, x0, 36, x0 + sw, 36, '#9aa3ad', 2);
    ctx.beginPath(); ctx.moveTo(x0 + 2, 36);
    for (let k = 0; k <= 4; k++) ctx.quadraticCurveTo(x0 + 4 + k * 6, 80, x0 + 2 + k * 6, L.FY - 4);
    ctx.lineTo(x0 + 2, L.FY - 4); ctx.closePath();
    ctx.fillStyle = cc; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
    // тапки
    this.ell(ctx, x0 + sw + 14, L.FY + 4, 6, 2.5, '#2fa1d6', INK, 1.2);
    this.ell(ctx, x0 + sw + 26, L.FY + 5, 6, 2.5, '#2fa1d6', INK, 1.2);
    this.ell(ctx, x0 + sw * 2 + 10, L.FY + 4, 5, 1.5, '#5a7d8a', null);
  },
  showerDyn(ctx, tier, t, hotOff) {
    const n = tier >= 2 ? 3 : 2;
    const x0 = 46, sw = (L.CW - x0) / n;
    for (let k = 1; k < n; k++) {
      const cx = x0 + k * sw + sw / 2;
      ctx.strokeStyle = 'rgba(120,190,230,0.75)'; ctx.lineWidth = 1.5;
      for (let d = -6; d <= 6; d += 4) {
        const off = (t * 120 + d * 13) % 20;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -off;
        ctx.beginPath(); ctx.moveTo(cx + d * 0.7, 32); ctx.lineTo(cx + d * 1.4, L.FY); ctx.stroke();
      }
      ctx.setLineDash([]);
      if (!hotOff) {
        for (let j = 0; j < 3; j++) {
          const p = (t * 0.4 + j / 3 + k * 0.2) % 1;
          this.circ(ctx, cx + Math.sin(p * 6 + j) * 10, 110 - p * 90, 8 + p * 10, 'rgba(255,255,255,' + (0.35 * (1 - p)) + ')', null);
        }
      }
    }
    if (hotOff) {
      this.circ(ctx, 23, 40, 12, 'rgba(120,190,255,0.5)', null);
      this.text(ctx, '❄', 23, 41, 14, '#2a7fd6', 'center', 900);
    }
  },

  // ---------- прачечная ----------
  laundryMachines(lvl) { return U.clamp(1 + Math.floor((lvl - 1) / 3), 1, 4); },
  laundryStatic(ctx, n, sign) {
    this.wall2(ctx, '#d3dbe0', '#9fb3c0', 84);
    this.floorStrip(ctx, '#8c9aa3', 'tile');
    // верёвка с бельём
    ctx.beginPath(); ctx.moveTo(4, 14); ctx.quadraticCurveTo(L.CW / 2, 26, L.CW - 4, 14); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
    const cl = [['#e85d75', 'shirt'], ['#f2c230', 'sock'], ['#5d8fe8', 'shirt'], ['#ffffff', 'sock'], ['#5dbb63', 'shirt'], ['#a35de8', 'sock']];
    for (let k = 0; k < cl.length; k++) {
      const x = 20 + k * 28, y = 14 + Math.sin((x / L.CW) * Math.PI) * 11;
      if (cl[k][1] === 'shirt') this.poly(ctx, [x - 9, y, x + 9, y, x + 12, y + 6, x + 7, y + 6, x + 7, y + 20, x - 7, y + 20, x - 7, y + 6, x - 12, y + 6], cl[k][0], INK, 1.3);
      else this.poly(ctx, [x - 3, y, x + 3, y, x + 3, y + 12, x + 8, y + 15, x + 8, y + 18, x - 3, y + 18], cl[k][0], INK, 1.3);
    }
    this.box(ctx, 8, 50, 40, 14, 2, '#fdfbf3', INK, 1.3);
    this.textFit(ctx, sign, 28, 57.5, 36, 7, '#2e86c1', 'center', 900);
    // корзина
    this.poly(ctx, [6, 112, 34, 112, 31, L.FY, 9, L.FY], '#c79a5b');
    for (let k = 0; k < 4; k++) this.line(ctx, 8, 117 + k * 5, 32, 117 + k * 5, '#a07a43', 1);
    this.circ(ctx, 14, 110, 5, '#5d8fe8', null); this.circ(ctx, 24, 108, 5, '#e85d75', null);
    for (let k = 0; k < n; k++) {
      const x = 42 + k * 39;
      this.box(ctx, x, 92, 36, 46, 3, '#f4f6f7');
      this.rect(ctx, x + 2, 94, 32, 7, '#dfe5e9');
      this.circ(ctx, x + 28, 97.5, 2, '#5dbb63', null);
      this.circ(ctx, x + 18, 120, 12, '#c9d3db', INK, 2);
    }
  },
  laundryDyn(ctx, n, t, active) {
    for (let k = 0; k < n; k++) {
      const x = 42 + k * 39 + 18, y = 120;
      const shake = active ? Math.sin(t * 40 + k) * 0.6 : 0;
      this.circ(ctx, x + shake, y, 9, '#2f4a62', INK, 1.5);
      if (active) {
        const cols = ['#e85d75', '#f2c230', '#5d8fe8', '#ffffff'];
        for (let j = 0; j < 3; j++) {
          const a = t * (5 + k) + j * 2.1;
          this.circ(ctx, x + shake + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5, 3.2, cols[(j + k) % 4], null);
        }
        this.circ(ctx, x + shake - 3, y - 4, 1.5, 'rgba(255,255,255,0.8)', null);
      }
      ctx.globalAlpha = 0.35;
      this.line(ctx, x - 5, y - 2, x - 1, y - 6, '#ffffff', 2);
      ctx.globalAlpha = 1;
    }
  },

  // ---------- качалка ----------
  gymStatic(ctx, tier, sign) {
    this.rect(ctx, 0, 0, L.CW, L.FY, '#b05c45');
    ctx.fillStyle = 'rgba(70,30,20,0.35)';
    for (let y = 0; y < L.FY; y += 9) {
      ctx.fillRect(0, y, L.CW, 1.5);
      for (let x = (y / 9) % 2 ? 0 : 10; x < L.CW; x += 20) ctx.fillRect(x, y, 1.5, 9);
    }
    this.floorStrip(ctx, '#3d3f45', 'concrete');
    // зеркало
    this.box(ctx, 40, 22, 62, 66, 2, '#bfe2ee', INK, 2.5);
    ctx.globalAlpha = 0.5;
    this.line(ctx, 50, 80, 76, 30, '#ffffff', 3);
    this.line(ctx, 62, 82, 90, 34, '#ffffff', 2);
    ctx.globalAlpha = 1;
    this.box(ctx, 108, 26, 52, 16, 1.5, '#f2c230', INK, 1.5);
    this.textFit(ctx, sign, 134, 34.5, 48, 5.5, INK, 'center', 900);
    // стойка с гантелями
    this.box(ctx, 6, 104, 30, 34, 1.5, '#555a63');
    for (let k = 0; k < 3; k++) {
      const y = 109 + k * 9;
      this.line(ctx, 10, y, 32, y, '#2b2b2b', 2.5);
      this.box(ctx, 8, y - 3, 5, 6, 1, '#2f3238', INK, 1);
      this.box(ctx, 29, y - 3, 5, 6, 1, '#2f3238', INK, 1);
    }
    // скамья
    this.box(ctx, 60, 120, 64, 7, 2, '#c0392b');
    this.line(ctx, 66, 127, 66, L.FY, INK, 3);
    this.line(ctx, 118, 127, 118, L.FY, INK, 3);
    this.line(ctx, 66, 92, 66, 120, '#777', 3);
    this.line(ctx, 118, 92, 118, 120, '#777', 3);
    if (tier >= 2) {
      for (let k = 0; k < 3; k++) this.circ(ctx, 132 + k * 6, 112 + k * 2, 10 - k * 2, '#2f3238', INK, 1.5);
    }
    if (tier >= 3) {
      this.box(ctx, 108, 50, 40, 6, 2, '#2f3238');
      this.text(ctx, '💪', 128, 70, 14, INK, 'center', 400);
    }
    this.line(ctx, 172, 0, 172, 30, '#555', 2.5);
  },
  gymDyn(ctx, tier, t, look) {
    const sw = Math.sin(t * 2.4) * 0.18;
    ctx.save(); ctx.translate(172, 30); ctx.rotate(sw);
    this.box(ctx, -10, 0, 20, 50, 8, '#b03a2e');
    this.rect(ctx, -10, 10, 20, 3, '#2b2b2b');
    this.rect(ctx, -10, 38, 20, 3, '#2b2b2b');
    ctx.restore();
    if (look) this.student(ctx, 92, 120, look, 'lift', t, 1);
  },

  // ---------- вахта ----------
  vahtaStatic(ctx, lvl, sign, notice) {
    this.wall2(ctx, '#e3e7cf', '#9cbf9f', 70);
    this.floorStrip(ctx, '#a07a55', 'checker');
    // доска с ключами
    this.box(ctx, 8, 30, 44, 50, 2, '#a4734a');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const x = 15 + c * 10, y = 38 + r * 14;
      this.circ(ctx, x, y, 1.3, '#d9d9d9', INK, 0.8);
      if ((r * 4 + c) % 3 !== 1) {
        this.line(ctx, x, y, x, y + 5, '#c9c9c9', 1.2);
        this.box(ctx, x - 2.5, y + 5, 5, 4, 1, '#f2c230', INK, 0.8);
      }
    }
    this.plant(ctx, 26, L.FY, 1.1);
    // объявление
    this.box(ctx, 60, 14, 26, 32, 0.5, '#fdfbf3', INK, 1.2);
    this.textFit(ctx, notice, 73, 20, 23, 4.4, '#c0392b', 'center', 900);
    for (let k = 0; k < 4; k++) this.line(ctx, 63, 26 + k * 4.5, 83, 26 + k * 4.5, '#9aa3ad', 1);
    // будка вахты: рама и стекло
    this.box(ctx, 92, 26, 104, 76, 2, 'rgba(190,225,240,0.55)', INK, 3);
    this.line(ctx, 144, 26, 144, 70, INK, 2.5);
    this.box(ctx, 108, 12, 72, 16, 2, '#2e7d4f', INK, 2);
    this.textFit(ctx, sign, 144, 20.5, 66, 9, '#ffffff', 'center', 900);
    if (lvl >= 3) { this.box(ctx, 98, 30, 22, 16, 2, '#2b2b30'); this.rect(ctx, 100, 32, 18, 12, '#5a7d6a'); }
    if (lvl >= 7) { this.box(ctx, 170, 30, 22, 16, 2, '#2b2b30'); this.rect(ctx, 172, 32, 18, 12, '#5a6a7d'); }
  },
  vahtaCounter(ctx, lvl) {
    this.box(ctx, 88, 98, 110, 8, 2, '#c48a55');
    this.box(ctx, 92, 106, 102, L.FY - 106, 2, '#a5703f');
    this.box(ctx, 100, 112, 38, 18, 2, null, '#87562d', 1.5);
    this.box(ctx, 148, 112, 38, 18, 2, null, '#87562d', 1.5);
    // дисковый телефон
    this.box(ctx, 170, 90, 18, 9, 3, '#c0392b');
    this.box(ctx, 168, 86, 22, 5, 2.5, '#a93226');
    this.circ(ctx, 179, 94.5, 2.5, '#f2f2f2', INK, 1);
    if (lvl >= 5) this.kettle(ctx, 100, 98);
  },
  vahtaDyn(ctx, lvl, t, hired, mood, hireText) {
    if (hired) {
      ctx.save();
      ctx.beginPath(); ctx.rect(88, 20, 112, 79); ctx.clip();
      this.valya(ctx, 136, 100, t, mood);
      ctx.restore();
    } else {
      this.box(ctx, 108, 70, 56, 26, 2, '#fdfbf3', INK, 1.5);
      this.textFit(ctx, hireText, 136, 83, 52, 5.6, '#c0392b', 'center', 900);
    }
    this.vahtaCounter(ctx, lvl);
    if (lvl >= 3) this.rect(ctx, 100, 32 + ((t * 8) % 12), 18, 1.5, 'rgba(255,255,255,0.35)');
  },

  // ---------- лестница ----------
  stairStatic(ctx, row, theme, lift) {
    const W = L.STAIR;
    this.rect(ctx, 0, 0, W, L.FY, theme.stair);
    this.rect(ctx, 0, 84, W, L.FY - 84, U.shade(theme.stair, -0.15));
    this.rect(ctx, 0, 82, W, 2, U.shade(theme.stair, -0.3));
    this.rect(ctx, 0, L.FY, W, L.CH - L.FY, '#8d8984');
    this.line(ctx, 0, L.FY, W, L.FY, INK, 2);
    if (row > 0) this.text(ctx, String(row), W / 2 + 14, 40, 30, U.shade(theme.stair, -0.25), 'center', 900);
    // пролёт лестницы
    const steps = 9;
    ctx.beginPath();
    ctx.moveTo(4, L.FY);
    for (let k = 0; k < steps; k++) {
      const x = 4 + k * 7, y = L.FY - k * 15;
      ctx.lineTo(x, y - 15); ctx.lineTo(x + 7, y - 15);
    }
    ctx.lineTo(W, L.FY - steps * 15);
    ctx.lineTo(W, L.FY - steps * 15 + 6);
    ctx.lineTo(4 + steps * 7 + 6, L.FY - steps * 15 + 18);
    ctx.lineTo(18, L.FY);
    ctx.closePath();
    ctx.fillStyle = '#b3aca0'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    // перила
    this.line(ctx, 8, L.FY - 30, 8 + steps * 7, L.FY - steps * 15 - 28, '#8a5a33', 3);
    for (let k = 0; k <= steps; k += 3) this.line(ctx, 8 + k * 7, L.FY - k * 15 - 30, 8 + k * 7, L.FY - k * 15, '#6f6f6f', 1.5);
    if (row === 0) {
      // «лифт не работает»
      this.box(ctx, 40, 72, 30, 66, 1.5, '#9aa3ad');
      this.line(ctx, 55, 74, 55, L.FY, INK, 1.5);
      this.box(ctx, 38, 56, 34, 14, 1, '#fdfbf3', INK, 1.2);
      this.textFit(ctx, lift, 55, 63, 31, 4.2, '#c0392b', 'center', 900);
      // указатель «выход»
      this.box(ctx, 6, 20, 22, 12, 2, '#2ea44f', INK, 1.5);
      this.circ(ctx, 14, 23.5, 1.6, '#fff', null);
      this.line(ctx, 14, 25, 16, 29, '#fff', 1.5);
      this.line(ctx, 15, 27, 23, 26, '#fff', 1.5);
    } else if (row % 2 === 1) {
      // огнетушитель на стене
      this.box(ctx, 58, 96, 9, 20, 3, '#d63b2f');
      this.box(ctx, 59, 92, 6, 5, 1, '#333');
    }
    if (row === 1) {
      // роутер на всю общагу
      this.box(ctx, 34, 62, 22, 8, 2, '#2f3542');
      this.line(ctx, 37, 62, 35, 52, INK, 1.5);
      this.line(ctx, 53, 62, 55, 52, INK, 1.5);
    }
  },
  routerLeds(ctx, t, down) {
    for (let k = 0; k < 4; k++) {
      const on = down ? Math.sin(t * 8) > 0 && k === 0 : Math.sin(t * 9 + k * 2) > -0.3;
      this.circ(ctx, 39 + k * 4, 66, 1.2, on ? (down ? '#ff3b3b' : '#5ee87a') : '#444', null);
    }
  },

  // ---------- игровые значки в мире ----------
  trash(ctx, x, y, k) {
    if (k % 3 === 0) {
      this.circ(ctx, x - 6, y - 4, 5, '#efe9dc', INK, 1.3);
      this.circ(ctx, x + 2, y - 5, 6, '#f6f1e6', INK, 1.3);
      this.box(ctx, x + 5, y - 12, 9, 12, 2, '#f4d03f', INK, 1.2);
      this.rect(ctx, x + 5.5, y - 11.5, 8, 3, '#e74c3c');
    } else if (k % 3 === 1) {
      this.box(ctx, x - 12, y - 10, 9, 10, 1.5, '#d9534f', INK, 1.2);
      this.ell(ctx, x + 3, y - 3, 9, 3.5, '#f2e14c', INK, 1.3, -0.2);
      this.circ(ctx, x + 10, y - 6, 4, '#efe9dc', INK, 1.2);
    } else {
      this.box(ctx, x - 9, y - 8, 18, 8, 2, '#8bc34a', INK, 1.3);
      this.line(ctx, x - 6, y - 8, x + 4, y - 14, '#6b4f3a', 2);
      this.circ(ctx, x + 8, y - 3, 4, '#f6f1e6', INK, 1.2);
    }
  },
  flies(ctx, x, y, t, seed) {
    for (let k = 0; k < 2; k++) {
      const a = t * (5 + k) + seed + k * 3;
      this.circ(ctx, x + Math.cos(a) * 9, y - 16 + Math.sin(a * 1.3) * 5, 1.3, INK, null);
    }
  },
  leak(ctx, t, kind) {
    if (kind === 0) {
      this.box(ctx, 90, 0, 30, 6, 1, '#7d8a96');
      for (let k = 0; k < 3; k++) {
        const p = (t * 1.3 + k / 3) % 1;
        this.ell(ctx, 104 + k * 3, 8 + p * (L.FY - 12), 2, 3.5, '#4aa3df', null);
      }
      this.ell(ctx, 106, L.FY + 4, 16 + Math.sin(t * 3) * 2, 3, 'rgba(74,163,223,0.6)', null);
    } else {
      this.box(ctx, 96, 102, 8, 10, 1.5, '#e8e4da', INK, 1.2);
      if (Math.sin(t * 17) > 0.2) {
        for (let k = 0; k < 4; k++) {
          const a = k * 1.6 + t * 9;
          this.line(ctx, 100, 107, 100 + Math.cos(a) * 9, 107 + Math.sin(a) * 9, '#ffd23f', 2);
        }
      }
      this.circ(ctx, 100, 98, 6 + Math.sin(t * 4) * 1, 'rgba(80,80,80,0.25)', null);
    }
  },
  cashBag(ctx, x, y, frac, t, sz) {
    const full = frac >= 0.999;
    const bounce = full ? Math.abs(Math.sin(t * 6)) * 4 : 0;
    const s = sz * (0.7 + 0.3 * Math.min(1, frac));
    ctx.save();
    ctx.translate(x, y - bounce);
    ctx.scale(s / 20, s / 20);
    this.poly(ctx, [-6, -16, 6, -16, 4, -12, -4, -12], '#c7965a');
    this.ell(ctx, 0, 0, 13, 12, '#d9a865');
    this.line(ctx, -5, -12, 5, -12, '#7a5230', 2.5);
    this.coinIcon(ctx, 0, 1, 6.5);
    if (full) {
      this.circ(ctx, 11, -12, 6, '#e74c3c', INK, 1.5);
      this.text(ctx, '!', 11, -11.5, 9, '#fff', 'center', 900);
    }
    ctx.restore();
  },
  wrenchBadge(ctx, x, y, left, t) {
    const pulse = 1 + Math.sin(t * 6) * 0.08;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    this.circ(ctx, 0, 0, 13, '#ff6b4a', INK, 2);
    this.text(ctx, '🔧', 0, 1, 13, INK, 'center', 400);
    for (let k = 0; k < left; k++) this.circ(ctx, -6 + k * 6, 18, 2.2, '#fff', INK, 1);
    ctx.restore();
  },
  plaque(ctx, cx, cy, w, title, price, afford, size) {
    const h = size * 3.1;
    const x = cx - w / 2, y = cy - h / 2;
    this.line(ctx, cx - w * 0.3, y - 10, cx - w * 0.3, y, '#6b4a2b', 2);
    this.line(ctx, cx + w * 0.3, y - 10, cx + w * 0.3, y, '#6b4a2b', 2);
    this.box(ctx, x, y, w, h, size * 0.4, '#f6e7c8', INK, Math.max(1.5, size * 0.14));
    this.textFit(ctx, title, cx, y + h * 0.3, w - size * 0.8, size * 0.82, INK, 'center', 800);
    const ps = U.fmt(price);
    ctx.font = '900 ' + size + 'px ' + FONT;
    const pw = ctx.measureText(ps).width;
    const r = size * 0.42;
    const px = cx - (pw + r * 2 + size * 0.3) / 2;
    this.coinIcon(ctx, px + r, y + h * 0.7, r);
    this.text(ctx, ps, px + r * 2 + size * 0.3, y + h * 0.71, size, afford ? '#1f8a3a' : '#b03a2e', 'left', 900);
  },
});
