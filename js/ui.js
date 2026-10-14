'use strict';
// Интерфейс поверх канваса (обычный HTML): верхняя панель, цели, панель выбранной
// комнаты, персонал, переезд, настройки, события, советы тёти Вали, всплывашки.

const ICON = {
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffc83d" stroke="#3b2b24" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#d9921c" stroke-width="2"/></svg>',
  rep: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#7ee08a" stroke="#3b2b24" stroke-width="2"/><circle cx="8.5" cy="10" r="1.5" fill="#3b2b24"/><circle cx="15.5" cy="10" r="1.5" fill="#3b2b24"/><path d="M7.5 14c1.2 2.2 7.8 2.2 9 0" fill="none" stroke="#3b2b24" stroke-width="2" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2.2l2.9 6.2 6.8.8-5 4.7 1.3 6.8L12 17.4l-6 3.3 1.3-6.8-5-4.7 6.8-.8z" fill="#ffd23f" stroke="#3b2b24" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  staff: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3.5" fill="#ffd9b8" stroke="#3b2b24" stroke-width="1.8"/><circle cx="16.5" cy="8.5" r="3" fill="#ffd9b8" stroke="#3b2b24" stroke-width="1.8"/><path d="M2.5 20c0-4 2.5-6.5 5.5-6.5s5.5 2.5 5.5 6.5z" fill="#4f9ad6" stroke="#3b2b24" stroke-width="1.8"/><path d="M12.5 20c.3-3.6 2-5.6 4.2-5.6S21 16.4 21.3 20z" fill="#e85d75" stroke="#3b2b24" stroke-width="1.8"/></svg>',
  move: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="10" height="14" rx="1" fill="#e8a35d" stroke="#3b2b24" stroke-width="1.8"/><rect x="5.5" y="10" width="2.2" height="2.2" fill="#fff"/><rect x="8.5" y="10" width="2.2" height="2.2" fill="#fff"/><rect x="5.5" y="14" width="2.2" height="2.2" fill="#fff"/><rect x="8.5" y="14" width="2.2" height="2.2" fill="#fff"/><path d="M15 9l5-5M20 4h-4M20 4v4" fill="none" stroke="#3b2b24" stroke-width="2.2" stroke-linecap="round"/><path d="M13 21h8v-8l-4-3-4 3" fill="#ffd23f" stroke="#3b2b24" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" fill="none" stroke="#3b2b24" stroke-width="2"/><path d="M19.4 13.5l1.6 1.2-1.8 3.2-1.9-.7a7 7 0 01-2 1.2l-.3 2h-3.6l-.3-2a7 7 0 01-2-1.2l-1.9.7-1.8-3.2 1.6-1.2a7 7 0 010-2.4L3.4 9.9l1.8-3.2 1.9.7a7 7 0 012-1.2l.3-2h3.6l.3 2a7 7 0 012 1.2l1.9-.7 1.8 3.2-1.6 1.2a7 7 0 010 2.4z" fill="#d9e2ea" stroke="#3b2b24" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  tv: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="3" fill="#fff" stroke="#3b2b24" stroke-width="2"/><path d="M10 9l5 3-5 3z" fill="#8b5cf6" stroke="#3b2b24" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 2l4 3 4-3" fill="none" stroke="#3b2b24" stroke-width="2" stroke-linecap="round"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ff6b5a" stroke="#3b2b24" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="#fff" stroke="#3b2b24" stroke-width="1.5"/><circle cx="12" cy="12" r="2.5" fill="#ff6b5a"/></svg>',
  gift: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="12" rx="2" fill="#ff6b8a" stroke="#3b2b24" stroke-width="2"/><rect x="2" y="7" width="20" height="4" rx="1.5" fill="#ff8fa6" stroke="#3b2b24" stroke-width="2"/><path d="M12 7v14" stroke="#ffd23f" stroke-width="3"/><path d="M12 7c-2-4-6-3-5 0zM12 7c2-4 6-3 5 0z" fill="#ffd23f" stroke="#3b2b24" stroke-width="1.5"/></svg>',
  roach: '<svg viewBox="0 0 24 24"><g stroke="#3a2412" stroke-width="1.5" stroke-linecap="round"><path d="M8 9L4 6M8 12H3M8 15l-4 3M16 9l4-3M16 12h5M16 15l4 3M10 5L8 1M14 5l2-4"/></g><ellipse cx="12" cy="13" rx="5" ry="8" fill="#7a4a22" stroke="#3b2b24" stroke-width="1.6"/><circle cx="12" cy="5.5" r="2.6" fill="#5a3416" stroke="#3b2b24" stroke-width="1.4"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="#3b2b24" stroke-width="3.2" stroke-linecap="round"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14" stroke="#3b2b24" stroke-width="3.2" stroke-linecap="round"/></svg>',
};

const UI = {
  els: {},
  sheetTg: null, sheetSig: '', sk: {},
  modalKind: '', mk: {}, modalData: null, modalQueue: [],
  evSig: '', ek: {},
  tick: 0, advT: 0, advText: '',
  portraits: {},
  lastCoins: '',

  init() {
    const ids = ['ui', 'hud', 'coins', 'income', 'repLabel', 'repVal', 'repBar', 'repTier', 'stars', 'goal', 'goalText', 'goalBar', 'goalBtn',
      'goalReward', 'boostBtn', 'boostTop', 'boostSub', 'event', 'advisor', 'advText', 'advImg', 'sheet', 'nav', 'toasts', 'modalWrap', 'modal',
      'adOverlay', 'adText', 'navStaffL', 'navMoveL', 'staffBadge', 'moveBadge', 'hudCoins', 'zoom'];
    for (const id of ids) this.els[id] = document.getElementById(id);
    document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = ICON[el.dataset.icon] || ''; });
    for (const k of ['valya', 'cleaner', 'plumber', 'starosta']) this.portraits[k] = this.portrait(k);
    this.els.advImg.src = this.portraits.valya;
    this.els.ui.addEventListener('click', (e) => this.onClick(e));
    this.els.advisor.addEventListener('click', () => this.hideAdvisor());
    window.addEventListener('resize', () => this.layout());
    this.applyLang();
    this.layout();
  },

  // Портреты персонала рисуем тем же кодом, что и в игре
  portrait(kind) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    const bg = { valya: '#e6d4f5', cleaner: '#d4ecf7', plumber: '#dfe6f5', starosta: '#f5ecd4' }[kind];
    A.circ(ctx, 32, 32, 31, bg, null);
    ctx.save();
    ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.clip();
    if (kind === 'valya') { ctx.translate(32, 64); ctx.scale(1.25, 1.25); A.valya(ctx, 0, 6, 1, 'happy'); }
    else {
      ctx.translate(30, 78); ctx.scale(1.35, 1.35);
      if (kind === 'cleaner') A.cleaner(ctx, 0, 0, 0, 1, 'idle');
      if (kind === 'plumber') A.plumber(ctx, 0, 0, 0, 1, 'idle');
      if (kind === 'starosta') A.starosta(ctx, 0, 0, 0, 1, 'idle');
    }
    ctx.restore();
    return c.toDataURL();
  },

  applyLang() {
    document.title = t('title');
    this.els.repLabel.textContent = t('rep');
    this.els.navStaffL.textContent = t('nav_staff');
    this.els.navMoveL.textContent = t('nav_build');
    this.els.goalBtn.textContent = t('goal_claim');
    this.evSig = '';
    if (Events.active) this.showEvent();
    this.sheetSig = '';
    if (this.modalKind && this.modalKind !== 'confirm') this.openModal(this.modalKind, this.modalData, true);
  },

  layout() {
    const hud = this.els.hud.getBoundingClientRect();
    const sheetOpen = !this.els.sheet.classList.contains('hidden');
    let bottom;
    if (sheetOpen) bottom = this.els.sheet.getBoundingClientRect().height + 12;
    else bottom = window.innerHeight - this.els.nav.getBoundingClientRect().top + 6;
    bottom = U.clamp(bottom, 40, window.innerHeight * 0.6);
    Render.padTop = hud.bottom + 4;
    Render.padBot = bottom;
    document.documentElement.style.setProperty('--bottom', bottom + 'px');
    document.documentElement.style.setProperty('--hudH', hud.bottom + 'px');
    this.topAdvisor = window.innerWidth < 700 || window.innerHeight > window.innerWidth;
    this.els.advisor.classList.toggle('top', this.topAdvisor);
    this.els.toasts.classList.toggle('bottom', this.topAdvisor);
    this.placeAdvisor();
    const ci = this.els.hudCoins.querySelector('.ico').getBoundingClientRect();
    FX.hudTarget = { x: ci.left + ci.width / 2, y: ci.top + ci.height / 2 };
    Render.updateScale();
    Render.clamp();
  },

  onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.classList.contains('dis')) return;
    Sound.unlock();
    const act = b.dataset.act;
    const s = Game.s;
    const [name, arg] = act.split(':');
    switch (name) {
      case 'settings': this.openModal('settings'); break;
      case 'staff': this.openModal('staff'); break;
      case 'prestige': this.openModal('prestige'); break;
      case 'closeSheet': Game.deselect(); break;
      case 'closeModal': this.closeModal(); break;
      case 'buy1': Game.buy(this.sheetTg, 1); break;
      case 'buyMax': Game.buy(this.sheetTg, 'max'); break;
      case 'free': Game.freeUpgrade(this.sheetTg); break;
      case 'boost': Game.boost(); break;
      case 'claimGoal': Game.claimGoal(); break;
      case 'ev_ad': Game.eventAd(); break;
      case 'party_calm': Events.partyChoice(s, 'calm'); break;
      case 'party_fine': Events.partyChoice(s, 'fine'); break;
      case 'party_ad': Game.eventAd(); break;
      case 'hire': Game.hire(arg); break;
      case 'doPrestige': this.confirm(t('pr_confirm'), () => Game.prestige()); break;
      case 'music': s.music = !s.music; Sound.setMusic(s.music); this.openModal('settings', null, true); Game.save(); break;
      case 'sfx': s.sfx = !s.sfx; Sound.setSfx(s.sfx); this.openModal('settings', null, true); Game.save(); break;
      case 'lang': Game.setLang(arg); break;
      case 'reset': this.confirm(t('set_reset_confirm'), () => Game.resetProgress()); break;
      case 'yes': { const cb = this.modalData && this.modalData.yes; this.closeModal(); if (cb) cb(); break; }
      case 'wbX2': { const a = this.modalData.amount; this.closeModal(); Game.doubleOffline(a); break; }
      case 'pcClaim': Game.earn(this.modalData.amount, true); Sound.play('coin'); this.toast('+' + U.fmt(this.modalData.amount), 'good'); this.closeModal(); break;
      case 'pcX3': {
        const a = this.modalData.amount;
        this.closeModal();
        Game.watchAd(() => { Game.earn(a * 3, true); Sound.play('coin'); UI.toast('+' + U.fmt(a * 3), 'good'); });
        break;
      }
      case 'zoomIn': Render.zoomAt(Render.vw / 2, Render.vh / 2, 1.3); break;
      case 'zoomOut': Render.zoomAt(Render.vw / 2, Render.vh / 2, 1 / 1.3); break;
    }
  },

  // ======================== обновление каждые 0.1 с ========================
  update(dt) {
    this.tick -= dt;
    if (this.advT > 0) { this.advT -= dt; if (this.advT <= 0) this.hideAdvisor(); }
    if (this.tick > 0) return;
    this.tick = 0.1;
    const s = Game.s;
    const coins = U.fmt(s.coins);
    if (coins !== this.lastCoins) { this.els.coins.textContent = coins; this.lastCoins = coins; }
    this.setText(this.els.income, '+' + U.fmt(Eco.totalIncome(s)) + t('per_sec'));
    const rep = Math.floor(s.rep);
    this.setText(this.els.repVal, String(rep));
    this.els.repBar.style.width = U.clamp(s.rep, 0, 100) + '%';
    this.setText(this.els.repTier, t('tier_cap_' + Eco.topTier(s.rep)));
    this.setText(this.els.stars, String(s.stars));
    // буст
    const b = this.els.boostBtn;
    if (s.boostLeft > 0) {
      b.classList.add('on');
      this.setText(this.els.boostTop, '×2 · ' + U.fmtTime(s.boostLeft));
      this.setText(this.els.boostSub, s.boostLeft >= CFG.BOOST_MAX - 1 ? '' : t('boost_more'));
    } else {
      b.classList.remove('on');
      this.setText(this.els.boostTop, t('boost'));
      this.setText(this.els.boostSub, t('boost_sub'));
    }
    b.classList.toggle('hidden', s.goal < 4 && s.playTime < 120);
    // значки на кнопках
    let staffAff = false;
    for (const k of CFG.STAFF_ORDER) if (s.staff[k] < CFG.STAFF[k].max && s.coins >= Eco.staffCost(k, s.staff[k])) staffAff = true;
    this.els.staffBadge.classList.toggle('hidden', !staffAff);
    this.els.nav.querySelector('[data-act="staff"]').classList.toggle('pulse', staffAff && s.staff.valya === 0);
    this.els.moveBadge.classList.toggle('hidden', !Eco.canPrestige(s));
    this.updateGoal();
    this.updateEvent();
    if (this.topAdvisor && this.advT > 0) this.placeAdvisor();
    if (this.sheetTg) this.refreshSheet();
    if (this.modalKind === 'staff' || this.modalKind === 'prestige') this.refreshModal();
  },
  setText(el, v) { if (el.textContent !== v) el.textContent = v; },

  pulseCoins() {
    const el = this.els.hudCoins;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  },

  // ---------- цель ----------
  updateGoal() {
    const g = this.els.goal;
    const p = Game.goalProgress();
    g.classList.toggle('hidden', !!Events.active);
    this.setText(this.els.goalText, p.text);
    this.els.goalBar.style.width = Math.min(100, (p.cur / p.target) * 100) + '%';
    g.classList.toggle('done', p.done);
    this.setText(this.els.goalReward, '+' + U.fmt(Game.goalReward()));
  },
  goalReady() {
    const g = this.els.goal;
    g.classList.remove('flash');
    void g.offsetWidth;
    g.classList.add('flash');
  },
  goalRect() {
    const r = this.els.goal.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  },

  // ---------- событие ----------
  showEvent() {
    const v = Events.view(Game.s);
    if (!v) return;
    const el = this.els.event;
    const icon = v.type === 'roach' ? ICON.roach : '<span class="emo">' + v.icon + '</span>';
    let btns = '';
    v.buttons.forEach((b, k) => {
      btns += '<button class="btn sm ' + (b.ad ? 'ad' : k === 0 ? 'green' : 'gold') + '" data-act="' + b.id + '">' + (b.ad ? '<i class="ico">' + ICON.tv + '</i>' : '') + '<span data-k="b' + k + '">' + b.label + '</span></button>';
    });
    el.innerHTML = '<div class="ev-ic">' + icon + '</div><div class="ev-body"><b data-k="title">' + v.title + '</b><small data-k="text">' + v.text +
      '</small><div class="bar"><i data-k="bar"></i></div></div><div class="ev-btns">' + btns + '</div>';
    this.ek = {};
    el.querySelectorAll('[data-k]').forEach((n) => { this.ek[n.dataset.k] = n; });
    el.className = 'event panel ev-' + v.type;
    this.evSig = v.type;
  },
  hideEvent() { this.els.event.classList.add('hidden'); this.evSig = ''; },
  updateEvent() {
    if (!Events.active) { if (this.evSig) this.hideEvent(); return; }
    if (this.evSig !== Events.active.type) this.showEvent();
    const v = Events.view(Game.s);
    this.ek.bar.style.width = (v.left / v.dur) * 100 + '%';
    const title = v.title + (v.progress ? ' · ' + v.progress : '');
    this.setText(this.ek.title, title);
    if (v.type === 'party' && this.ek.b1) this.setText(this.ek.b1, v.buttons[1].label);
  },

  // ---------- советы тёти Вали ----------
  say(text, dur) {
    if (!text) return;
    this.els.advText.textContent = text;
    this.advText = text;
    this.els.advisor.classList.remove('hidden');
    this.els.advisor.classList.remove('pop');
    void this.els.advisor.offsetWidth;
    this.els.advisor.classList.add('pop');
    this.advT = dur || 5;
    this.placeAdvisor();
  },
  hideAdvisor() { this.els.advisor.classList.add('hidden'); this.advT = 0; },
  // На телефоне советы показываем сверху, в небе — иначе они закрывают нижний этаж
  placeAdvisor() {
    if (!this.topAdvisor) return;
    let y = this.els.hud.getBoundingClientRect().bottom;
    for (const el of [this.els.goal, this.els.event]) {
      if (!el.classList.contains('hidden')) y = Math.max(y, el.getBoundingClientRect().bottom);
    }
    document.documentElement.style.setProperty('--advTop', Math.round(y + 8) + 'px');
  },

  toast(text, kind) {
    const box = this.els.toasts;
    while (box.children.length >= 3) box.removeChild(box.firstChild);
    const d = document.createElement('div');
    d.className = 'toast ' + (kind || '');
    d.textContent = text;
    box.appendChild(d);
    setTimeout(() => { d.classList.add('out'); }, 2300);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 2700);
  },

  coinHTML(cost) { return '<i class="ico">' + ICON.coin + '</i><span>' + U.fmt(cost) + '</span>'; },

  // ======================== панель выбранного объекта ========================
  openSheet(tg) {
    this.sheetTg = tg;
    this.sheetSig = '';
    this.els.sheet.classList.remove('hidden');
    this.els.nav.classList.add('hidden');
    this.els.zoom.classList.add('hidden');
    this.refreshSheet();
    this.layout();
  },
  closeSheet() {
    this.sheetTg = null;
    this.els.sheet.classList.add('hidden');
    this.els.nav.classList.remove('hidden');
    this.els.zoom.classList.remove('hidden');
    this.layout();
  },
  rebuildSheet() { this.sheetSig = ''; },

  sheetModel(tg) {
    const s = Game.s;
    const m = { sig: '', title: '', lvl: '', sub: '', stats: [], note: '', warn: '', btns: [] };
    const freeBtn = () => ({
      act: 'free', ad: true,
      label: s.freeUpgT > 0 ? U.fmtTime(s.freeUpgT) : t('btn_free'),
      on: s.freeUpgT <= 0, cost: null,
    });
    if (tg.type === 'room') {
      const r = s.rooms[tg.i];
      const num = (Eco.floorOf(tg.i) + 1) * 100 + Eco.slotOf(tg.i) + 1;
      m.title = t('room', { n: num });
      if (!r.lvl) {
        const c = Eco.roomUnlockCost(tg.i);
        m.sig = 'room-l-' + tg.i;
        m.sub = t('sh_locked_room');
        m.stats = [[t('sh_rent'), U.fmt(Eco.rentPerStudent(tg.i, 1) * Eco.permanentMult(s)) + t('per_sec')]];
        m.btns = [{ act: 'buy1', label: t('btn_open'), cost: c, on: s.coins >= c }, freeBtn()];
        return m;
      }
      const maxed = r.lvl >= CFG.ROOM_MAX_LVL;
      const st = Eco.stageOf(r.lvl);
      m.sig = 'room-' + tg.i + '-' + maxed;
      m.lvl = t('lvl', { n: r.lvl + '/' + CFG.ROOM_MAX_LVL });
      m.sub = t('stage_' + st);
      m.stats = [
        [t('sh_students'), r.occ.length + '/' + Eco.capacity(r.lvl)],
        [t('sh_income'), U.fmt(Eco.roomIncome(s, tg.i)) + t('per_sec')],
        [t('sh_rent'), U.fmt(Eco.rentPerStudent(tg.i, r.lvl) * Eco.permanentMult(s)) + t('per_sec')],
      ];
      if (maxed) m.note = t('sh_maxed');
      else if (Eco.isStageStep(r.lvl)) m.note = t('sh_stage_next', { name: t('stage_' + (st + 1)), cap: CFG.STAGE_CAP[st] });
      else if (st < CFG.STAGES) m.note = t('sh_to_stage', { n: st * CFG.STAGE_LEN - r.lvl });
      if (r.broken) m.warn = t('sh_broken');
      else if (r.trash > 0) m.warn = t('sh_trash', { v: r.trash * 10 });
      if (!maxed) {
        const c = Eco.roomUpgradeCost(tg.i, r.lvl);
        const gain = Eco.roomPotential(s, tg.i, r.lvl + 1) - Eco.roomPotential(s, tg.i, r.lvl);
        const step = Eco.isStageStep(r.lvl);
        m.btns.push({ act: 'buy1', label: step ? t('btn_renovate') : t('btn_upgrade'), sub: '+' + U.fmt(gain) + t('per_sec'), cost: c, on: s.coins >= c, cls: step ? 'gold' : 'green' });
        const mx = Eco.roomUpgradeMax(tg.i, r.lvl, s.coins, 999);
        m.btns.push({ act: 'buyMax', label: t('btn_max', { n: Math.max(1, mx.n) }), cost: mx.n > 0 ? mx.cost : c, on: mx.n > 1, cls: 'green' });
        m.btns.push(freeBtn());
      }
      return m;
    }
    if (tg.type === 'kitchen') {
      const l = s.kitchens[tg.f], max = CFG.KITCHEN_MAX;
      m.sig = 'kit-' + tg.f + '-' + (l > 0) + '-' + (l >= max);
      m.title = t('kitchen') + ' · ' + t('floor_n', { n: tg.f + 1 });
      m.lvl = l ? t('lvl', { n: l + '/' + max }) : '';
      m.sub = t('sh_kitchen_desc');
      const eff = (k) => t('sh_kitchen_eff', { v: Math.round(Eco.kitchenBonus(k) * 100) });
      if (l) m.stats.push([t('now'), eff(l)]);
      if (l < max) m.stats.push([t('next'), eff(l + 1)]);
      if (s.fx.burn[tg.f] > 0) m.warn = t('ev_fire_fail', { f: tg.f + 1 });
      if (l >= max) m.note = t('sh_maxed');
      else {
        const c = Eco.kitchenCost(tg.f, l);
        m.btns = [{ act: 'buy1', label: l ? t('btn_upgrade') : t('btn_build'), cost: c, on: s.coins >= c }, freeBtn()];
      }
      return m;
    }
    if (tg.type === 'fac') {
      const key = tg.key, l = s.fac[key], max = CFG.FAC[key].max;
      m.sig = 'fac-' + key + '-' + (l > 0) + '-' + (l >= max);
      m.title = t(key);
      m.lvl = l ? t('lvl', { n: l + '/' + max }) : '';
      m.sub = t('sh_' + key + '_desc');
      const eff = (k) => {
        if (key === 'vahta') return t('sh_vahta_eff', { h: CFG.OFFLINE_HOURS[k] });
        if (key === 'shower') return t('sh_shower_eff', { v: k * CFG.REP_PER_SHOWER });
        if (key === 'laundry') return t('sh_laundry_eff', { v: Math.round(k * CFG.LAUNDRY_SHARE * 100) });
        return t('sh_gym_eff', { v: Math.round(k * CFG.GYM_TIER_BONUS * 100), r: k * CFG.REP_PER_GYM });
      };
      if (l) m.stats.push([t('now'), eff(l)]);
      if (l < max) m.stats.push([t('next'), eff(l + 1)]);
      if (key === 'laundry' && l) m.stats.push([t('sh_income'), U.fmt(Eco.laundryIncome(s, Eco.roomsIncome(s))) + t('per_sec')]);
      if (key === 'vahta' && !s.staff.valya) m.warn = t('g_hire', { name: t('st_valya') });
      if (key === 'shower' && s.fx.hot > 0) m.warn = t('ev_hot_title');
      if (l >= max) m.note = t('sh_maxed');
      else {
        const c = Eco.facCost(key, l);
        m.btns = [{ act: 'buy1', label: l ? t('btn_upgrade') : t('btn_build'), cost: c, on: s.coins >= c }, freeBtn()];
      }
      return m;
    }
    if (tg.type === 'build') {
      const f = s.floors;
      m.sig = 'build-' + f;
      if (f >= CFG.FLOORS) { m.title = t('roof_' + (s.building % THEMES.length)); m.note = t('sh_maxed'); return m; }
      const c = Eco.floorCost(f);
      m.title = t('sh_build_floor_title', { n: f + 1 });
      m.sub = t('sh_build_floor');
      m.stats = [[t('sh_rent'), U.fmt(Eco.rentPerStudent(f * CFG.ROOMS_PER_FLOOR, 1) * Eco.permanentMult(s)) + t('per_sec')]];
      m.btns = [{ act: 'buy1', label: t('btn_build'), cost: c, on: s.coins >= c, cls: 'gold' }];
      return m;
    }
    return m;
  },

  refreshSheet() {
    const tg = this.sheetTg;
    if (!tg) return;
    const m = this.sheetModel(tg);
    if (m.sig !== this.sheetSig) {
      this.sheetSig = m.sig;
      let html = '<div class="sh-head"><div class="sh-title"><b data-k="title"></b><span class="pill" data-k="lvl"></span></div>' +
        '<button class="x" data-act="closeSheet">×</button></div><div class="sh-sub" data-k="sub"></div><div class="sh-stats">';
      m.stats.forEach((st, k) => { html += '<div><small data-k="sl' + k + '"></small><b data-k="sv' + k + '"></b></div>'; });
      html += '</div><div class="sh-note" data-k="note"></div><div class="sh-warn" data-k="warn"></div><div class="sh-btns">';
      m.btns.forEach((b, k) => {
        html += '<button class="btn ' + (b.ad ? 'ad' : (b.cls || 'green')) + '" data-act="' + b.act + '" data-k="b' + k + '">' +
          (b.ad ? '<i class="ico">' + ICON.tv + '</i>' : '') +
          '<span class="b-l" data-k="bl' + k + '"></span>' +
          (b.sub !== undefined ? '<span class="b-s" data-k="bs' + k + '"></span>' : '') +
          (b.cost !== null && b.cost !== undefined ? '<span class="b-c" data-k="bc' + k + '"></span>' : '') + '</button>';
      });
      html += '</div>';
      this.els.sheet.innerHTML = html;
      this.sk = {};
      this.els.sheet.querySelectorAll('[data-k]').forEach((n) => { this.sk[n.dataset.k] = n; });
      requestAnimationFrame(() => this.layout());
    }
    const k = this.sk;
    this.setText(k.title, m.title);
    this.setText(k.lvl, m.lvl);
    k.lvl.style.display = m.lvl ? '' : 'none';
    this.setText(k.sub, m.sub);
    m.stats.forEach((st, i) => { if (k['sl' + i]) { this.setText(k['sl' + i], st[0]); this.setText(k['sv' + i], st[1]); } });
    this.setText(k.note, m.note);
    k.note.style.display = m.note ? '' : 'none';
    this.setText(k.warn, m.warn);
    k.warn.style.display = m.warn ? '' : 'none';
    m.btns.forEach((b, i) => {
      const el = k['b' + i];
      if (!el) return;
      el.classList.toggle('dis', !b.on && b.ad);
      el.classList.toggle('off', !b.on && !b.ad);
      this.setText(k['bl' + i], b.label);
      if (k['bs' + i]) this.setText(k['bs' + i], b.sub || '');
      if (k['bc' + i]) {
        const html = this.coinHTML(b.cost);
        if (k['bc' + i].dataset.h !== html) { k['bc' + i].innerHTML = html; k['bc' + i].dataset.h = html; }
      }
      if (b.act === 'buyMax') el.style.display = b.on ? '' : 'none';
    });
  },

  // ======================== модальные окна ========================
  modalOpen() { return !!this.modalKind; },
  openModal(kind, data, refresh) {
    if (this.modalKind && !refresh && this.modalKind !== kind) { this.modalQueue.push([kind, data]); return; }
    this.modalKind = kind;
    this.modalData = data || this.modalData;
    const s = Game.s;
    let html = '';
    const head = (title) => '<div class="m-head"><h2>' + title + '</h2><button class="x" data-act="closeModal">×</button></div>';
    if (kind === 'staff') {
      html = head(t('staff_title')) + '<p class="m-sub">' + t('staff_hint') + '</p><div class="staff-list">';
      for (const key of CFG.STAFF_ORDER) {
        html += '<div class="staff-card"><img src="' + this.portraits[key] + '" alt=""><div class="sc-info"><div class="sc-name"><b>' + t('st_' + key) +
          '</b><small>' + t('st_' + key + '_role') + '</small></div><div class="pips" data-k="p_' + key + '"></div><p>' + t('st_' + key + '_desc') +
          '</p><div class="eff" data-k="e_' + key + '"></div></div><button class="btn green" data-act="hire:' + key + '" data-k="b_' + key +
          '"><span class="b-l" data-k="bl_' + key + '"></span><span class="b-c" data-k="bc_' + key + '"></span></button></div>';
      }
      html += '</div>';
    } else if (kind === 'prestige') {
      const nb = s.building + 1;
      const name = t('bname_' + (nb % THEMES.length)) + (nb >= THEMES.length ? ' ' + U.roman(Math.floor(nb / THEMES.length) + 1) : '');
      html = head(t('pr_title')) + '<div class="pr-star">' + ICON.star + '</div><p class="m-sub">' + t('pr_text') + '</p>' +
        '<div class="pr-row" data-k="have"></div><div class="pr-row big" data-k="gain"></div><div class="pr-row" data-k="next"></div>' +
        '<div class="pr-row" >' + t('pr_new_building', { name, m: String(Math.round(Math.pow(CFG.BUILDING_MULT, nb) * 100) / 100) }) + '</div>' +
        '<div class="pr-warn" data-k="warn"></div><button class="btn gold wide" data-act="doPrestige" data-k="btn">' + t('pr_btn') + '</button>';
    } else if (kind === 'settings') {
      const row = (label, act, on) => '<div class="set-row"><span>' + label + '</span><button class="btn sm ' + (on ? 'green' : 'off') + '" data-act="' + act + '">' + (on ? t('on') : t('off')) + '</button></div>';
      html = head(t('set_title')) + row(t('set_music'), 'music', s.music) + row(t('set_sfx'), 'sfx', s.sfx) +
        '<div class="set-row"><span>' + t('set_lang') + '</span><div><button class="btn sm ' + (I18N.lang === 'ru' ? 'green' : 'off') + '" data-act="lang:ru">RU</button> ' +
        '<button class="btn sm ' + (I18N.lang === 'en' ? 'green' : 'off') + '" data-act="lang:en">EN</button></div></div>' +
        '<p class="m-sub small">' + t('set_stats', { c: U.fmt(s.totalEarned), p: s.prestiges, e: s.stats.events }) + '</p>' +
        '<button class="btn red wide" data-act="reset">' + t('set_reset') + '</button><p class="m-sub small center">' + t('version', { v: CFG.VERSION }) + '</p>';
    } else if (kind === 'welcome') {
      const d = this.modalData;
      if (d.noValya) {
        html = head(t('wb_title')) + '<img class="m-portrait" src="' + this.portraits.valya + '" alt=""><p class="m-sub">' + t('wb_novalya', { t: U.fmtTime(d.sec) }) +
          '</p><button class="btn green wide" data-act="closeModal">' + t('ok') + '</button>';
      } else {
        html = head(t('wb_title')) + '<img class="m-portrait" src="' + this.portraits.valya + '" alt=""><p class="m-sub">' + t('wb_text', { t: U.fmtTime(d.sec) }) +
          '</p><div class="big-amount">' + this.coinHTML(d.amount) + '</div>' + (d.capped ? '<p class="m-sub small">' + t('wb_capped') + '</p>' : '') +
          '<div class="m-btns"><button class="btn green" data-act="closeModal">' + t('claim') + '</button><button class="btn ad" data-act="wbX2"><i class="ico">' +
          ICON.tv + '</i><span>' + t('claim_x2') + '</span></button></div>';
      }
    } else if (kind === 'parcel') {
      const d = this.modalData;
      html = head(t('pc_title')) + '<div class="pr-star">' + ICON.gift + '</div><p class="m-sub">' + t('pc_text', { item: d.item }) + '</p><div class="big-amount">' +
        this.coinHTML(d.amount) + '</div><div class="m-btns"><button class="btn green" data-act="pcClaim">' + t('claim') + '</button><button class="btn ad" data-act="pcX3"><i class="ico">' +
        ICON.tv + '</i><span>' + t('claim_x3') + '</span></button></div>';
    } else if (kind === 'confirm') {
      html = '<p class="m-sub big">' + this.modalData.text + '</p><div class="m-btns"><button class="btn off" data-act="closeModal">' + t('cancel') +
        '</button><button class="btn red" data-act="yes">' + t('yes') + '</button></div>';
    }
    // посылку нельзя закрыть крестиком — иначе деньги потеряются
    this.els.modal.innerHTML = html;
    if (kind === 'parcel') { const x = this.els.modal.querySelector('.x'); if (x) x.remove(); }
    this.mk = {};
    this.els.modal.querySelectorAll('[data-k]').forEach((n) => { this.mk[n.dataset.k] = n; });
    this.els.modal.className = 'modal panel m-' + kind;
    this.els.modalWrap.classList.remove('hidden');
    this.refreshModal();
  },
  refreshModal() {
    const s = Game.s, k = this.mk;
    if (this.modalKind === 'staff') {
      for (const key of CFG.STAFF_ORDER) {
        const lvl = s.staff[key], st = CFG.STAFF[key];
        let pips = '';
        for (let i = 0; i < st.max; i++) pips += '<i class="' + (i < lvl ? 'on' : '') + '"></i>';
        if (k['p_' + key].dataset.h !== pips) { k['p_' + key].innerHTML = pips; k['p_' + key].dataset.h = pips; }
        const eff = (l) => {
          if (key === 'valya') return t('st_valya_eff', { v: Math.round(st.offline[l - 1] * 100) });
          if (key === 'cleaner') return t('st_cleaner_eff', { v: st.interval[l - 1] });
          if (key === 'plumber') return t('st_plumber_eff', { v: st.delay[l - 1] });
          return t('st_starosta_eff', { v: st.speed[l - 1], r: Math.round(st.rent[l - 1] * 100) });
        };
        let e = lvl ? eff(lvl) : '';
        if (lvl < st.max) e += (lvl ? '  →  ' : '') + eff(lvl + 1);
        this.setText(k['e_' + key], e);
        const btn = k['b_' + key];
        if (lvl >= st.max) {
          btn.classList.add('dis');
          this.setText(k['bl_' + key], t('max'));
          k['bc_' + key].innerHTML = '';
          k['bc_' + key].dataset.h = '';
        } else {
          const c = Eco.staffCost(key, lvl);
          btn.classList.remove('dis');
          btn.classList.toggle('off', s.coins < c);
          this.setText(k['bl_' + key], lvl ? t('upgrade') : t('hire'));
          const html = this.coinHTML(c);
          if (k['bc_' + key].dataset.h !== html) { k['bc_' + key].innerHTML = html; k['bc_' + key].dataset.h = html; }
        }
      }
    } else if (this.modalKind === 'prestige') {
      const gain = Eco.starsGain(s);
      this.setText(k.have, t('pr_have', { n: s.stars, p: Math.round(s.stars * CFG.STAR_BONUS * 100) }));
      this.setText(k.gain, t('pr_gain', { n: gain }));
      const nextNeed = Eco.earnedForStarsTotal(s.stars + gain + 1) - s.totalEarned;
      this.setText(k.next, t('pr_next', { c: U.fmt(Math.max(0, nextNeed)) }));
      let warn = '';
      if (s.floors < CFG.PRESTIGE_MIN_FLOOR) warn = t('pr_need_floor', { n: CFG.PRESTIGE_MIN_FLOOR });
      else if (gain < 1) warn = t('pr_need_star');
      this.setText(k.warn, warn);
      k.warn.style.display = warn ? '' : 'none';
      k.btn.classList.toggle('dis', !!warn);
    }
  },
  closeModal() {
    this.modalKind = '';
    this.modalData = null;
    this.els.modalWrap.classList.add('hidden');
    if (this.modalQueue.length) {
      const [kind, data] = this.modalQueue.shift();
      setTimeout(() => this.openModal(kind, data), 150);
    }
  },
  confirm(text, yes) {
    this.modalKind = '';
    this.openModal('confirm', { text, yes });
  },
  welcome(d) { this.openModal('welcome', d); },
  parcelModal(amount) { this.openModal('parcel', { amount, item: U.pick(tArr('pc_items')) }); },

  // Имитация рекламы для локального теста
  mockAd(rewarded, done) {
    const o = this.els.adOverlay;
    let left = rewarded ? 3 : 2;
    o.classList.remove('hidden');
    this.els.adText.textContent = (rewarded ? 'Rewarded' : 'Interstitial') + ' (тест) · ' + left;
    const timer = setInterval(() => {
      left--;
      this.els.adText.textContent = (rewarded ? 'Rewarded' : 'Interstitial') + ' (тест) · ' + left;
      if (left <= 0) { clearInterval(timer); o.classList.add('hidden'); done(); }
    }, 500);
  },
};
