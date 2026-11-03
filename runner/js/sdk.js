// Обёртка над Яндекс Игры SDK v2. Без SDK (локально) включается мок:
// реклама имитируется заглушкой, сохранения — в localStorage.
const SAVE_KEY = 'railrush_save_v1';

function timeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

export const SDK = {
  ysdk: null, player: null, isMock: true, lang: '', gp: false, adBusy: false,
  onPause: null, onResume: null,

  async init() {
    if (typeof YaGames === 'undefined') return;
    try {
      this.ysdk = await timeout(YaGames.init(), 8000);
      this.isMock = false;
      try { this.lang = this.ysdk.environment.i18n.lang; } catch (e) { /* ignore */ }
      try {
        this.ysdk.on('game_api_pause', () => this.onPause && this.onPause());
        this.ysdk.on('game_api_resume', () => this.onResume && this.onResume());
      } catch (e) { /* старый SDK */ }
      try { this.player = await timeout(this.ysdk.getPlayer({ scopes: false }), 5000); } catch (e) { this.player = null; }
    } catch (e) {
      console.warn('Yandex SDK init failed, mock mode', e);
      this.ysdk = null; this.isMock = true;
    }
  },

  loadingReady() {
    try { this.ysdk && this.ysdk.features.LoadingAPI && this.ysdk.features.LoadingAPI.ready(); } catch (e) { /* ignore */ }
  },
  gameplayStart() {
    if (this.gp) return; this.gp = true;
    try { this.ysdk && this.ysdk.features.GameplayAPI && this.ysdk.features.GameplayAPI.start(); } catch (e) { /* ignore */ }
  },
  gameplayStop() {
    if (!this.gp) return; this.gp = false;
    try { this.ysdk && this.ysdk.features.GameplayAPI && this.ysdk.features.GameplayAPI.stop(); } catch (e) { /* ignore */ }
  },

  // ---------- сохранения: облако Яндекса + localStorage как запас ----------
  async load() {
    let local = null, cloud = null;
    try { local = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { /* ignore */ }
    if (this.player) {
      try {
        const d = await timeout(this.player.getData(['save']), 5000);
        if (d && d.save) cloud = typeof d.save === 'string' ? JSON.parse(d.save) : d.save;
      } catch (e) { /* ignore */ }
    }
    if (cloud && local) return (cloud.t || 0) >= (local.t || 0) ? cloud : local;
    return cloud || local;
  },
  save(data, flush) {
    data.t = Date.now();
    const s = JSON.stringify(data);
    try { localStorage.setItem(SAVE_KEY, s); } catch (e) { /* приватный режим */ }
    if (this.player) {
      try { const p = this.player.setData({ save: s }, !!flush); p && p.catch && p.catch(() => {}); } catch (e) { /* ignore */ }
    }
  },

  setLeaderboard(score) {
    try {
      const lb = this.ysdk && this.ysdk.leaderboards;
      if (lb && lb.setScore) { const p = lb.setScore('railrushScore', Math.floor(score)); p && p.catch && p.catch(() => {}); }
    } catch (e) { /* лидерборд не создан в консоли — не страшно */ }
  },

  // ---------- реклама ----------
  mock(ms) {
    const el = document.getElementById('adMock');
    el.classList.remove('hidden');
    return new Promise(r => setTimeout(() => { el.classList.add('hidden'); r(); }, ms));
  },

  showInterstitial(onOpen, onClose) {
    if (this.adBusy) return Promise.resolve();
    this.adBusy = true;
    const done = () => { this.adBusy = false; onClose && onClose(); };
    if (!this.ysdk) { onOpen && onOpen(); return this.mock(900).then(done); }
    return new Promise(res => {
      try {
        this.ysdk.adv.showFullscreenAdv({ callbacks: {
          onOpen: () => onOpen && onOpen(),
          onClose: () => { done(); res(); },
          onError: () => { done(); res(); },
        } });
      } catch (e) { done(); res(); }
    });
  },

  // Возвращает true, если награду надо выдать
  showRewarded(onOpen, onClose) {
    if (this.adBusy) return Promise.resolve(false);
    this.adBusy = true;
    if (!this.ysdk) {
      onOpen && onOpen();
      return this.mock(1200).then(() => { this.adBusy = false; onClose && onClose(); return true; });
    }
    return new Promise(res => {
      let rewarded = false;
      const fin = () => { this.adBusy = false; onClose && onClose(); res(rewarded); };
      try {
        this.ysdk.adv.showRewardedVideo({ callbacks: {
          onOpen: () => onOpen && onOpen(),
          onRewarded: () => { rewarded = true; },
          onClose: fin,
          onError: fin,
        } });
      } catch (e) { fin(); }
    });
  },
};
