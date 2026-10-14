'use strict';
// Рендер мира: камера, небо и смена дня/ночи, город на фоне, здание в разрезе,
// кэш статичных интерьеров, ночное освещение и значки поверх мира.

const TRASH_X = [66, 104, 142];

const Render = {
  cv: null, ctx: null, dpr: 1, vw: 1, vh: 1,
  cam: { x: 0, y: 0, z: 1 },
  camTargetY: null,
  padTop: 96, padBot: 84,
  scale: 1,
  cache: {}, cellKeys: {}, cacheK: 0,
  t: 0,
  dark: 0, sunset: 0, skyMid: '#bfe6fa',
  city: null,
  lastCacheLang: '',

  init(cv) {
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    this.buildCity();
    this.resize();
  },

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = Math.max(1, window.innerWidth);
    this.vh = Math.max(1, window.innerHeight);
    this.cv.width = Math.round(this.vw * this.dpr);
    this.cv.height = Math.round(this.vh * this.dpr);
    this.cv.style.width = this.vw + 'px';
    this.cv.style.height = this.vh + 'px';
    this.updateScale();
    this.clamp();
  },

  baseScale() {
    const effH = Math.max(200, this.vh - this.padTop - this.padBot);
    let s = this.vw / L.WW;
    s = Math.min(s, effH / (3.2 * L.RH));
    return Math.max(0.18, s);
  },
  updateScale() {
    this.scale = this.baseScale() * this.cam.z;
    const k = this.scale * this.dpr;
    const kq = U.clamp(Math.pow(2, Math.ceil(Math.log2(k) * 3) / 3), 0.25, 3);
    if (kq !== this.cacheK) { this.cacheK = kq; this.clearCache(); }
  },
  clearCache() { this.cache = {}; this.cellKeys = {}; },

  screenToWorld(sx, sy) { return { x: sx / this.scale + this.cam.x, y: sy / this.scale + this.cam.y }; },
  worldToScreen(wx, wy) { return { x: (wx - this.cam.x) * this.scale, y: (wy - this.cam.y) * this.scale }; },

  clamp() {
    if (!Game.s) return;
    const s = this.scale, cam = this.cam;
    const viewW = this.vw / s;
    if (L.WW <= viewW) cam.x = (L.WW - viewW) / 2;
    else cam.x = U.clamp(cam.x, -40, L.WW - viewW + 40);
    const top = L.worldTop(Game.s.floors), bottom = L.GROUND_H * 0.45;
    const minY = top - this.padTop / s;
    const maxY = bottom - (this.vh - this.padBot) / s;
    cam.y = maxY < minY ? maxY : U.clamp(cam.y, minY, maxY);
  },
  pan(dx, dy) {
    this.cam.x -= dx / this.scale;
    this.cam.y -= dy / this.scale;
    this.camTargetY = null;
    this.clamp();
  },
  zoomAt(sx, sy, factor) {
    const w = this.screenToWorld(sx, sy);
    this.cam.z = U.clamp(this.cam.z * factor, 1, 3.2);
    this.updateScale();
    this.cam.x = w.x - sx / this.scale;
    this.cam.y = w.y - sy / this.scale;
    this.clamp();
  },
  // Плавно показать нужный этаж (например, где начались тараканы)
  focusRow(row, force) {
    if (!force && this.isRowVisible(row, 0.6)) return;
    const center = L.rowTop(row) + L.CH / 2;
    const mid = this.padTop + (this.vh - this.padTop - this.padBot) / 2;
    this.camTargetY = center - mid / this.scale;
  },
  scrollToBottom() { this.cam.y = 1e9; this.clamp(); },
  // На вертикальном телефоне по умолчанию чуть приближаем: студенты крупнее, кнопки удобнее
  defaultView() {
    this.cam.z = this.vh > this.vw * 1.2 ? 1.35 : 1;
    this.updateScale();
    this.cam.x = L.bx0 - 6;
    this.scrollToBottom();
  },
  // Сдвинуть камеру, чтобы точка мира попала в кадр
  ensureVisible(wx, wy) {
    const s = this.scale, m = 60 / s;
    const l = this.cam.x + m, r = this.cam.x + this.vw / s - m;
    if (wx < l) this.cam.x -= l - wx;
    else if (wx > r) this.cam.x += wx - r;
    const tp = this.cam.y + (this.padTop + 40) / s, bt = this.cam.y + (this.vh - this.padBot - 40) / s;
    if (wy < tp) this.cam.y -= tp - wy;
    else if (wy > bt) this.cam.y += wy - bt;
    this.clamp();
  },
  isRowVisible(row, frac) {
    const top = L.rowTop(row), bot = top + L.CH;
    const vt = this.cam.y + this.padTop / this.scale, vb = this.cam.y + (this.vh - this.padBot) / this.scale;
    const vis = Math.min(bot, vb) - Math.max(top, vt);
    return vis > L.CH * (frac || 0.05);
  },

  daylight(time) {
    const p = (time % CFG.DAY_LENGTH) / CFG.DAY_LENGTH;
    let dark;
    if (p < 0.62) dark = 0;
    else if (p < 0.7) dark = (p - 0.62) / 0.08;
    else if (p < 0.92) dark = 1;
    else dark = 1 - (p - 0.92) / 0.08;
    dark = U.easeInOut(U.clamp(dark, 0, 1));
    return { p, dark, sunset: 1 - Math.abs(dark * 2 - 1) };
  },

  getCache(key, w, h, draw) {
    let c = this.cache[key];
    if (!c) {
      c = document.createElement('canvas');
      const k = this.cacheK;
      c.width = Math.max(1, Math.ceil(w * k));
      c.height = Math.max(1, Math.ceil(h * k));
      const cx = c.getContext('2d');
      cx.scale(k, k);
      draw(cx);
      this.cache[key] = c;
    }
    return c;
  },
  cellCache(slot, key, draw) {
    const old = this.cellKeys[slot];
    if (old && old !== key) delete this.cache[old];
    this.cellKeys[slot] = key;
    return this.getCache(key, L.CW, L.CH, draw);
  },

  // ======================================================================
  draw(s, dt) {
    this.t += dt;
    if (I18N.lang !== this.lastCacheLang) { this.lastCacheLang = I18N.lang; this.clearCache(); }
    if (this.camTargetY !== null) {
      const before = this.cam.y;
      this.cam.y = U.lerp(this.cam.y, this.camTargetY, Math.min(1, dt * 5));
      this.clamp();
      if (Math.abs(this.cam.y - this.camTargetY) < 1 || Math.abs(this.cam.y - before) < 0.05) this.camTargetY = null;
    }
    const ctx = this.ctx, sc = this.scale, dpr = this.dpr;
    const dl = this.daylight(s.time);
    this.dark = dl.dark;
    this.sunset = dl.sunset;
    const theme = THEMES[s.building % THEMES.length];

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawSky(ctx, dl);

    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, -this.cam.x * dpr * sc, -this.cam.y * dpr * sc);
    const view = { l: this.cam.x, t: this.cam.y, r: this.cam.x + this.vw / sc, b: this.cam.y + this.vh / sc };
    this.view = view;
    this.drawCity(ctx, view, dl.dark);
    this.drawPastBuildings(ctx, s);
    this.drawGround(ctx, view, dl.dark, theme);

    const lights = dl.dark > 0.35;
    for (let row = 0; row <= s.floors; row++) {
      if (!this.rowInView(row, view)) continue;
      this.drawStairs(ctx, row, theme, s);
      for (let col = 0; col < L.COLS; col++) this.drawCell(ctx, s, row, col, lights);
    }
    this.drawShell(ctx, s, theme, view);
    Actors.drawStaff(ctx, s, this.t);
    Events.drawWorld(ctx, this.t, sc);
    if (dl.dark > 0.02) this.drawNight(ctx, s, view, dl.dark);
    Events.drawOver(ctx, this.t, sc);
    this.drawWorldUI(ctx, s, view);
    FX.drawWorld(ctx, sc);
    Actors.drawBubbles(ctx, sc, s);
    this.drawHint(ctx, s);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    FX.drawScreen(ctx);
  },

  rowInView(row, view) {
    const top = L.rowTop(row);
    return top + L.RH > view.t && top < view.b;
  },

  // ---------- небо ----------
  drawSky(ctx, dl) {
    const dark = dl.dark, ss = dl.sunset;
    const top = U.mix(U.mix('#5fb8ec', '#0a1430', dark), '#f07a55', ss * 0.65);
    const bot = U.mix(U.mix('#d3efff', '#26336a', dark), '#ffcf8a', ss * 0.75);
    this.skyMid = U.mix(top, bot, 0.55);
    const g = ctx.createLinearGradient(0, 0, 0, this.vh);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.vw, this.vh);
    if (dark > 0.25) {
      ctx.globalAlpha = (dark - 0.25) / 0.75;
      for (let k = 0; k < 70; k++) {
        const x = (k * 137.5) % this.vw, y = (k * 71.3) % (this.vh * 0.7);
        const tw = 0.6 + 0.4 * Math.sin(this.t * 2 + k);
        A.circ(ctx, x, y, (k % 3 === 0 ? 1.6 : 1) * tw, '#ffffff', null);
      }
      ctx.globalAlpha = 1;
    }
    // солнце днём, луна ночью
    const p = dl.p;
    if (p < 0.7) {
      const k = p / 0.7;
      const x = this.vw * (0.1 + 0.8 * k), y = this.vh * 0.42 - Math.sin(k * Math.PI) * this.vh * 0.3;
      A.circ(ctx, x, y, 34, 'rgba(255,240,170,0.25)', null);
      A.circ(ctx, x, y, 22, U.mix('#fff3b0', '#ff9a5c', ss), null);
    } else {
      const k = (p - 0.7) / 0.3;
      const x = this.vw * (0.15 + 0.7 * k), y = this.vh * 0.32 - Math.sin(k * Math.PI) * this.vh * 0.2;
      ctx.globalAlpha = dark;
      A.circ(ctx, x, y, 18, '#f4f1de', null);
      A.circ(ctx, x + 7, y - 4, 15, U.mix('#0a1430', '#26336a', 0.3), null);
      ctx.globalAlpha = 1;
    }
    // облака
    ctx.globalAlpha = 0.85 - dark * 0.6;
    for (let k = 0; k < 4; k++) {
      const w = this.vw + 360;
      const x = ((this.t * (6 + k * 2) + k * 420) % w) - 180, y = 60 + k * 52;
      const c = U.mix('#ffffff', '#55608f', dark);
      A.ell(ctx, x, y, 46, 16, c, null);
      A.ell(ctx, x + 30, y - 10, 30, 16, c, null);
      A.ell(ctx, x - 28, y - 4, 26, 12, c, null);
    }
    ctx.globalAlpha = 1;
  },

  buildCity() {
    const r = U.rng(12345);
    const list = [];
    let x = -2600;
    while (x < L.WW + 2600) {
      const w = 70 + r() * 90, h = 120 + r() * 330;
      list.push({ x, w, h, kind: r() < 0.25 ? 1 : 0, seed: (r() * 1e6) | 0 });
      x += w + 10 + r() * 40;
    }
    this.city = list;
  },
  drawCity(ctx, view, dark) {
    const par = 0.55;
    ctx.save();
    ctx.translate(this.cam.x * par, 0);
    const l = view.l - this.cam.x * par, r = view.r - this.cam.x * par;
    const base = U.mix(U.mix('#a9c3d6', '#1b2448', dark), '#d79a86', this.sunset * 0.3);
    const win = dark > 0.3 ? 'rgba(255,214,120,' + (0.8 * dark) + ')' : 'rgba(255,255,255,0.25)';
    for (const b of this.city) {
      if (b.x + b.w < l || b.x > r) continue;
      A.rect(ctx, b.x, -b.h, b.w, b.h, base);
      if (b.kind === 1) A.rect(ctx, b.x + b.w / 2 - 2, -b.h - 30, 4, 30, base);
      const rr = U.rng(b.seed);
      ctx.fillStyle = win;
      for (let y = -b.h + 12; y < -10; y += 20) {
        for (let wx = b.x + 8; wx < b.x + b.w - 12; wx += 16) {
          if (rr() < (dark > 0.3 ? 0.45 : 0.7)) ctx.fillRect(wx, y, 8, 10);
        }
      }
    }
    ctx.restore();
  },
  // Корпуса, которые уже пройдены (престиж), стоят по бокам — кампус растёт
  drawPastBuildings(ctx, s) {
    const n = Math.min(s.building, 8);
    for (let k = 0; k < n; k++) {
      const b = s.building - 1 - k;
      const th = THEMES[b % THEMES.length];
      const side = k % 2 === 0 ? -1 : 1;
      const slot = Math.floor(k / 2);
      const w = 230, h = 520 + (b % 3) * 60;
      const x = side < 0 ? L.bx0 - 90 - w - slot * (w + 70) : L.bx1 + 90 + slot * (w + 70);
      A.rect(ctx, x, -h, w, h, th.facadeDark);
      A.rect(ctx, x - 6, -h - 14, w + 12, 14, th.roof);
      const lit = this.dark > 0.3;
      for (let y = -h + 24; y < -40; y += 46) {
        for (let wx = x + 16; wx < x + w - 30; wx += 38) {
          A.box(ctx, wx, y, 24, 28, 2, lit && ((wx + y) % 3 !== 0) ? '#ffd47a' : U.mix(th.facade, '#a9d3ef', 0.5), INK, 1.5);
        }
      }
      A.box(ctx, x + w / 2 - 20, -54, 40, 54, 2, '#6b4a2b', INK, 2);
      A.textFit(ctx, t('roof_' + (b % THEMES.length)) + (b >= THEMES.length ? ' ' + U.roman(Math.floor(b / THEMES.length) + 1) : ''),
        x + w / 2, -h - 36, w + 40, 18, th.letters, 'center', 900, INK);
    }
  },

  drawGround(ctx, view, dark, theme) {
    this.lampGlows.length = 0;
    const l = view.l - 20, w = view.r - view.l + 40;
    A.rect(ctx, l, 0, w, Math.max(L.GROUND_H + 400, view.b + 20), '#7c5a3c');
    A.rect(ctx, l, 26, w, 6, '#6b4c31');
    A.rect(ctx, l, 70, w, 6, '#6b4c31');
    A.rect(ctx, l, -6, w, 14, '#68b34c');
    A.rect(ctx, l, 4, w, 4, '#559a3c');
    // тротуар
    A.rect(ctx, l, -6, w, 6, '#b8b2a6');
    // фундамент
    A.rect(ctx, L.bx0 - 10, -2, L.BW + 20, 30, '#9d968b');
    A.line(ctx, L.bx0 - 10, -2, L.bx1 + 10, -2, INK, 2);
    // крыльцо и козырёк у входа
    const fy = L.rowTop(0) + L.FY;
    for (let k = 0; k < 3; k++) A.box(ctx, L.bx0 - 30 + k * 6, fy + k * 9 - 2, 40 - k * 6, 10, 1, '#c9c2b4', INK, 1.5);
    A.poly(ctx, [L.bx0 - 44, fy - 86, L.bx0 + 8, fy - 86, L.bx0 + 8, fy - 76, L.bx0 - 38, fy - 76], theme.roof);
    // деревья, фонари, лавочки слева и справа от здания
    const step = 150;
    const start = Math.floor(l / step) * step;
    for (let x = start; x < view.r + 40; x += step) {
      if (x > L.bx0 - 80 && x < L.bx1 + 60) continue;
      const kind = Math.abs(Math.floor(x / step)) % 4;
      if (kind === 0 || kind === 2) this.tree(ctx, x + 40, kind === 2 ? 1.2 : 1);
      else if (kind === 1) this.lamp(ctx, x + 60, dark);
      else this.bench(ctx, x + 50);
    }
    // остановка у общаги
    const bx = L.bx0 - 150;
    if (bx > view.l - 100) {
      A.line(ctx, bx, 0, bx, -90, '#555', 4);
      A.box(ctx, bx - 22, -116, 44, 28, 3, '#2f86c9', INK, 2);
      A.textFit(ctx, t('bus_stop'), bx, -102, 40, 8, '#fff', 'center', 900);
    }
  },
  tree(ctx, x, s) {
    A.box(ctx, x - 6 * s, -60 * s, 12 * s, 60 * s, 3, '#7a5230');
    A.circ(ctx, x, -86 * s, 34 * s, U.mix('#4f9d4a', '#1f3a2a', this.dark * 0.6));
    A.circ(ctx, x - 22 * s, -66 * s, 22 * s, U.mix('#5bb055', '#1f3a2a', this.dark * 0.6));
    A.circ(ctx, x + 22 * s, -68 * s, 22 * s, U.mix('#46913f', '#1f3a2a', this.dark * 0.6));
  },
  lamp(ctx, x, dark) {
    A.line(ctx, x, 0, x, -120, '#3f4650', 4);
    A.line(ctx, x, -120, x + 18, -124, '#3f4650', 4);
    A.box(ctx, x + 10, -128, 18, 8, 3, '#3f4650');
    A.ell(ctx, x + 19, -118, 7, 3, dark > 0.3 ? '#fff3b0' : '#cfd5da', INK, 1.5);
    this.lampGlows.push(x + 19);
  },
  bench(ctx, x) {
    A.box(ctx, x - 30, -22, 60, 6, 2, '#b07a4a');
    A.box(ctx, x - 30, -36, 60, 6, 2, '#b07a4a');
    A.line(ctx, x - 24, -16, x - 24, 0, INK, 3);
    A.line(ctx, x + 24, -16, x + 24, 0, INK, 3);
  },
  lampGlows: [],

  // ---------- здание ----------
  drawStairs(ctx, row, theme, s) {
    const x = L.stairX, y = L.rowTop(row);
    const c = this.getCache('S|' + row + '|' + (s.building % THEMES.length), L.STAIR, L.CH, (cx) => A.stairStatic(cx, row, theme, t('lift_broken')));
    ctx.drawImage(c, x, y, L.STAIR, L.CH);
    if (row === 1) {
      ctx.save(); ctx.translate(x, y);
      A.routerLeds(ctx, this.t, s.fx.net > 0);
      ctx.restore();
    }
  },

  drawCell(ctx, s, row, col, lights) {
    const x = L.cellX(col), y = L.rowTop(row);
    const tg = L.targetAt(row, col);
    const slot = row + ':' + col;
    const tm = this.t;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, L.CW, L.CH);
    ctx.clip();
    ctx.translate(x, y);
    if (tg.type === 'room') {
      const r = s.rooms[tg.i];
      if (!r.lvl) {
        ctx.drawImage(this.cellCache(slot, 'L|' + tg.i, (cx) => A.roomLocked(cx, tg.i)), 0, 0, L.CW, L.CH);
      } else {
        const stage = Eco.stageOf(r.lvl);
        const win = ROOM_LAYOUT[stage].win;
        A.rect(ctx, win[0], win[1], win[2], win[3], this.skyMid);
        ctx.drawImage(this.cellCache(slot, 'R|' + stage + '|' + tg.i, (cx) => A.roomStatic(cx, stage, tg.i)), 0, 0, L.CW, L.CH);
        A.roomDyn(ctx, stage, tm, lights, tg.i);
        if (r.broken) A.leak(ctx, tm, tg.i % 2);
        Actors.drawRoom(ctx, tg.i, 0, 0, tm);
        for (let k = 0; k < CFG.TRASH_MAX; k++) {
          if (!(r.tmask & (1 << k))) continue;
          A.trash(ctx, TRASH_X[k], L.FY + 7, k + tg.i);
          A.flies(ctx, TRASH_X[k], L.FY + 7, tm, k * 3 + tg.i);
        }
      }
    } else if (tg.type === 'kitchen') {
      const lvl = s.kitchens[tg.f];
      const tier = A.kitchenTier(lvl);
      if (!tier) ctx.drawImage(this.cellCache(slot, 'KL', (cx) => A.facLocked(cx, 'kitchen')), 0, 0, L.CW, L.CH);
      else {
        if (tier === 1) A.rect(ctx, 158, 24, 34, 30, this.skyMid);
        ctx.drawImage(this.cellCache(slot, 'K|' + tier, (cx) => A.kitchenStatic(cx, tier, t('duty'))), 0, 0, L.CW, L.CH);
        const burned = s.fx.burn[tg.f] > 0;
        A.kitchenDyn(ctx, tier, tm, burned);
        if (burned) A.sootOverlay(ctx, tm);
      }
    } else {
      const key = tg.key, lvl = s.fac[key];
      if (!lvl) ctx.drawImage(this.cellCache(slot, 'FL', (cx) => A.facLocked(cx, key)), 0, 0, L.CW, L.CH);
      else if (key === 'vahta') {
        const tier = Math.min(10, lvl);
        const vk = tier >= 7 ? 7 : tier >= 5 ? 5 : tier >= 3 ? 3 : 1;
        ctx.drawImage(this.cellCache(slot, 'V|' + vk, (cx) => A.vahtaStatic(cx, vk, t('vahta_sign'), t('notice'))), 0, 0, L.CW, L.CH);
        A.vahtaDyn(ctx, vk, tm, s.staff.valya > 0, Game.valyaMood > 0 ? 'happy' : '', t('need_watch'));
      } else if (key === 'shower') {
        const tier = A.facTier(lvl);
        ctx.drawImage(this.cellCache(slot, 'SH|' + tier, (cx) => A.showerStatic(cx, tier)), 0, 0, L.CW, L.CH);
        A.showerDyn(ctx, tier, tm, s.fx.hot > 0);
      } else if (key === 'laundry') {
        const n = A.laundryMachines(lvl);
        ctx.drawImage(this.cellCache(slot, 'LA|' + n, (cx) => A.laundryStatic(cx, n, t('laundry_sign'))), 0, 0, L.CW, L.CH);
        A.laundryDyn(ctx, n, tm, Eco.students(s) > 0);
      } else if (key === 'gym') {
        const tier = A.facTier(lvl);
        ctx.drawImage(this.cellCache(slot, 'G|' + tier, (cx) => A.gymStatic(cx, tier, t('gym_sign'))), 0, 0, L.CW, L.CH);
        if (!this.gymLook) this.gymLook = A.makeLook(777, 1, 0);
        A.gymDyn(ctx, tier, tm, this.gymLook);
      }
    }
    ctx.restore();
  },

  drawShell(ctx, s, theme, view) {
    const topRow = s.floors;
    const roofTop = L.roofTop(topRow);
    // перекрытия
    for (let r = 0; r <= topRow; r++) {
      const y = L.rowTop(r) + L.CH;
      A.rect(ctx, L.bx0, y, L.BW, L.SLAB, theme.slab);
      A.rect(ctx, L.bx0, y + L.SLAB - 4, L.BW, 4, U.shade(theme.slab, -0.15));
      A.line(ctx, L.bx0, y, L.bx1, y, INK, 2);
      A.line(ctx, L.bx0, y + L.SLAB, L.bx1, y + L.SLAB, INK, 2);
      // перегородки
      for (let c = 0; c <= L.COLS; c++) {
        const x = c === 0 ? L.cellX(0) : L.cellX(c);
        if (c === L.COLS) continue;
        A.rect(ctx, x - 3, L.rowTop(r), 6, L.CH, U.shade(theme.slab, -0.1));
        A.line(ctx, x - 3, L.rowTop(r), x - 3, L.rowTop(r) + L.CH, INK, 1.5);
        A.line(ctx, x + 3, L.rowTop(r), x + 3, L.rowTop(r) + L.CH, INK, 1.5);
      }
    }
    // крыша
    A.rect(ctx, L.bx0 - 8, roofTop, L.BW + 16, L.ROOF_H, theme.roof);
    A.rect(ctx, L.bx0 - 12, roofTop - 6, L.BW + 24, 8, theme.trim);
    A.line(ctx, L.bx0 - 12, roofTop - 6, L.bx1 + 12, roofTop - 6, INK, 2);
    A.line(ctx, L.bx0 - 8, roofTop + L.ROOF_H, L.bx1 + 8, roofTop + L.ROOF_H, INK, 2);
    // наружные стены с кирпичом
    for (const wx of [L.bx0, L.bx1 - L.WALL]) {
      A.rect(ctx, wx, roofTop, L.WALL, -roofTop, theme.facade);
      ctx.fillStyle = theme.mortar;
      for (let y = roofTop + 4; y < 0; y += 9) ctx.fillRect(wx, y, L.WALL, 1.5);
      A.line(ctx, wx, roofTop, wx, 0, INK, 2);
      A.line(ctx, wx + L.WALL, roofTop, wx + L.WALL, 0, INK, 2);
    }
    // входная дверь
    const fy = L.rowTop(0) + L.FY;
    A.box(ctx, L.bx0 - 2, fy - 72, L.WALL + 4, 72, 2, '#7a5232', INK, 2);
    A.rect(ctx, L.bx0 + 2, fy - 64, L.WALL - 4, 22, '#bfe2ee');

    // антенна и тарелка
    const ax = L.bx1 - 60;
    A.line(ctx, ax, roofTop - 6, ax, roofTop - 70, '#555', 3);
    for (let k = 0; k < 4; k++) A.line(ctx, ax - 16 + k * 3, roofTop - 64 + k * 12, ax + 16 - k * 3, roofTop - 64 + k * 12, '#555', 2);
    A.ell(ctx, L.bx0 + 120, roofTop - 22, 14, 18, '#e8e8e8', INK, 2, -0.6);
    A.line(ctx, L.bx0 + 120, roofTop - 22, L.bx0 + 128, roofTop - 6, '#555', 3);

    if (s.floors >= CFG.FLOORS) this.drawRoofSign(ctx, s, theme, roofTop);
    else this.drawConstruction(ctx, s, theme, roofTop);
  },

  roofName(s) {
    const b = s.building;
    return t('roof_' + (b % THEMES.length)) + (b >= THEMES.length ? ' ' + U.roman(Math.floor(b / THEMES.length) + 1) : '');
  },
  drawRoofSign(ctx, s, theme, roofTop) {
    const cx = L.bx0 + L.BW / 2 + 40, y = roofTop - 52;
    for (let k = -2; k <= 2; k++) A.line(ctx, cx + k * 120, roofTop - 6, cx + k * 120, y + 18, '#555', 3);
    A.line(ctx, cx - 280, y + 18, cx + 280, y + 18, '#555', 3);
    const name = this.roofName(s);
    // ночью буквы светятся неоном
    if (this.dark > 0.2) { ctx.shadowColor = theme.letters; ctx.shadowBlur = 18 * this.dark * this.scale * this.dpr; }
    A.textFit(ctx, name, cx, y, 600, 40, this.dark > 0.2 ? U.mix(theme.letters, '#ffffff', 0.3) : theme.letters, 'center', 900, INK);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  },
  drawConstruction(ctx, s, theme, roofTop) {
    const top = roofTop - L.RH + 26;
    const x0 = L.bx0 + 10, x1 = L.bx1 - 10;
    // леса
    for (let x = x0; x <= x1; x += 74) A.line(ctx, x, roofTop - 6, x, top, '#c27a2c', 4);
    for (let y = roofTop - 40; y > top; y -= 44) {
      A.box(ctx, x0 - 6, y, x1 - x0 + 12, 6, 1, '#d9a35a', INK, 1.5);
    }
    ctx.globalAlpha = 0.35;
    for (let x = x0; x < x1 - 74; x += 148) A.rect(ctx, x, top, 74, roofTop - top - 6, '#ff8a3d');
    ctx.globalAlpha = 1;
    // башенный кран
    const cx = x1 - 30, ct = top - 130;
    A.rect(ctx, cx - 8, ct, 16, roofTop - 6 - ct, '#f2c230');
    for (let y = ct; y < roofTop - 10; y += 16) { A.line(ctx, cx - 8, y, cx + 8, y + 16, INK, 1.5); A.line(ctx, cx + 8, y, cx - 8, y + 16, INK, 1.5); }
    A.rect(ctx, cx - 340, ct - 10, 420, 10, '#f2c230');
    A.line(ctx, cx - 340, ct - 10, cx + 80, ct - 10, INK, 2);
    A.line(ctx, cx - 340, ct, cx + 80, ct, INK, 2);
    A.box(ctx, cx + 30, ct - 4, 40, 24, 2, '#7d8590', INK, 2);
    A.box(ctx, cx - 16, ct + 2, 22, 18, 2, '#eaf2f8', INK, 2);
    const hx = cx - 200 + Math.sin(this.t * 0.6) * 40, hy = ct + 90 + Math.sin(this.t * 1.2) * 6;
    A.line(ctx, hx, ct, hx, hy, '#333', 1.5);
    A.box(ctx, hx - 22, hy, 44, 18, 2, '#b8634a', INK, 2);
    for (let k = 0; k < 3; k++) A.line(ctx, hx - 22, hy + 6 * k, hx + 22, hy + 6 * k, '#8f4a35', 1);
  },

  drawNight(ctx, s, view, dark) {
    ctx.fillStyle = 'rgba(10,16,48,' + (0.45 * dark) + ')';
    ctx.fillRect(view.l - 10, view.t - 10, view.r - view.l + 20, view.b - view.t + 20);
    ctx.globalCompositeOperation = 'lighter';
    for (let row = 0; row <= s.floors; row++) {
      if (!this.rowInView(row, view)) continue;
      const y = L.rowTop(row);
      for (let col = 0; col < L.COLS; col++) {
        const tg = L.targetAt(row, col);
        let on = true;
        if (tg.type === 'room') on = s.rooms[tg.i].lvl > 0;
        else if (tg.type === 'kitchen') on = s.kitchens[tg.f] > 0;
        else on = s.fac[tg.key] > 0;
        if (!on) continue;
        const x = L.cellX(col);
        const g = ctx.createRadialGradient(x + 120, y + 16, 10, x + 110, y + 70, 140);
        g.addColorStop(0, 'rgba(255,196,120,' + (0.42 * dark) + ')');
        g.addColorStop(1, 'rgba(255,196,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, L.CW, L.CH);
      }
      const g2 = ctx.createRadialGradient(L.stairX + 38, y + 30, 5, L.stairX + 38, y + 70, 90);
      g2.addColorStop(0, 'rgba(255,240,200,' + (0.25 * dark) + ')');
      g2.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(L.stairX, y, L.STAIR, L.CH);
    }
    for (const lx of this.lampGlows) {
      const g = ctx.createRadialGradient(lx, -116, 2, lx, -60, 90);
      g.addColorStop(0, 'rgba(255,230,150,' + (0.5 * dark) + ')');
      g.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lx - 90, -130, 180, 130);
    }
    this.lampGlows.length = 0;
    ctx.globalCompositeOperation = 'source-over';
  },

  // ---------- значки поверх мира ----------
  drawWorldUI(ctx, s, view) {
    const sc = this.scale, tm = this.t;
    const size = Math.max(13, 12 / sc);
    const valya = s.staff.valya > 0;
    for (let row = 0; row <= s.floors; row++) {
      if (!this.rowInView(row, view)) continue;
      const y = L.rowTop(row);
      for (let col = 0; col < L.COLS; col++) {
        const x = L.cellX(col);
        const tg = L.targetAt(row, col);
        const cost = Game.costOf(tg);
        if (tg.type === 'room') {
          const r = s.rooms[tg.i];
          if (!r.lvl) {
            A.plaque(ctx, x + L.CW / 2, y + L.CH * 0.52, U.clamp(size * 8, 150, L.CW - 10), t('room', { n: (row * 100) + col + 1 }), cost, s.coins >= cost, size);
            continue;
          }
          if (!valya && r.box >= 1) {
            const cap = Sim.boxCap(s, tg.i);
            A.cashBag(ctx, x + L.CW - 28, y + 38, r.box / cap, tm, Math.max(22, size * 1.8));
            A.text(ctx, U.fmt(r.box), x + L.CW - 28, y + 38 + Math.max(22, size * 1.8) * 0.75, size * 0.85, '#fff', 'center', 900, INK);
          }
          if (r.broken) A.wrenchBadge(ctx, x + L.CW / 2, y + 30, r.fix, tm);
        } else if (tg.type === 'kitchen' && !s.kitchens[tg.f]) {
          A.plaque(ctx, x + L.CW / 2, y + L.CH * 0.52, U.clamp(size * 8, 150, L.CW - 10), t('kitchen'), cost, s.coins >= cost, size);
          continue;
        } else if (tg.type === 'fac' && !s.fac[tg.key]) {
          A.plaque(ctx, x + L.CW / 2, y + L.CH * 0.52, U.clamp(size * 8, 150, L.CW - 10), t(tg.key), cost, s.coins >= cost, size);
          continue;
        } else if (tg.type === 'fac' && tg.key === 'laundry' && !valya && s.laundryBox >= 1) {
          A.cashBag(ctx, x + L.CW - 28, y + 70, s.laundryBox / Sim.laundryCap(s), tm, Math.max(22, size * 1.8));
        }
        // можно улучшить — зелёная стрелка
        if (cost !== null && cost > 0 && s.coins >= cost) {
          const bob = Math.sin(tm * 5 + col) * 3;
          const ax = x + 22, ay = y + 22 + bob, r2 = Math.max(10, size * 0.75);
          A.circ(ctx, ax, ay, r2, '#3ccf5a', INK, 2);
          A.poly(ctx, [ax, ay - r2 * 0.6, ax + r2 * 0.55, ay, ax + r2 * 0.22, ay, ax + r2 * 0.22, ay + r2 * 0.55, ax - r2 * 0.22, ay + r2 * 0.55, ax - r2 * 0.22, ay, ax - r2 * 0.55, ay], '#ffffff', null);
        }
      }
    }
    // стройка следующего этажа
    if (s.floors < CFG.FLOORS) {
      const br = L.buildRect(s.floors);
      const cost = Eco.floorCost(s.floors);
      A.plaque(ctx, br.x + br.w / 2, br.y + br.h / 2, Math.max(220, size * 11), t('w_build_floor', { n: s.floors + 1 }), cost, s.coins >= cost, size * 1.15);
    }
    // выделенная ячейка
    const sel = Game.sel && L.cellOfTarget(Game.sel);
    if (sel) {
      const x = L.cellX(sel.col), y = L.rowTop(sel.row);
      ctx.globalAlpha = 0.65 + Math.sin(tm * 5) * 0.3;
      A.box(ctx, x + 3, y + 3, L.CW - 6, L.CH - 6, 8, null, '#ffd23f', 5);
      ctx.globalAlpha = 1;
    }
  },

  // Обучающая стрелка: показывает, куда нажать
  drawHint(ctx, s) {
    const h = Game.hint;
    if (!h) return;
    const sc = this.scale;
    const bob = Math.abs(Math.sin(this.t * 4)) * 14 / sc;
    const sz = Math.max(16, 22 / sc);
    const x = h.x, y = h.y - bob;
    A.poly(ctx, [x, y, x - sz * 0.8, y - sz, x - sz * 0.3, y - sz, x - sz * 0.3, y - sz * 1.9, x + sz * 0.3, y - sz * 1.9, x + sz * 0.3, y - sz, x + sz * 0.8, y - sz], '#ffd23f', INK, Math.max(2, 3 / sc));
  },
};
