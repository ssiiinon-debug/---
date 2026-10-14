'use strict';
// Обёртка над Яндекс Игры SDK v2.
// На Яндексе подключается /sdk.js и всё работает по-настоящему.
// Локально (без SDK) включается «мок»: реклама имитируется, сохранения — в localStorage.

const SDK = {
  ysdk: null,
  player: null,
  storage: null,
  isMock: true,
  lang: '',
  device: 'desktop',
  gp: false,
  adBusy: false,

  timeout(p, ms) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  },

  async init() {
    if (typeof YaGames === 'undefined') { this.isMock = true; return; }
    try {
      this.ysdk = await this.timeout(YaGames.init(), 8000);
      this.isMock = false;
      try { this.lang = this.ysdk.environment.i18n.lang; } catch (e) { /* нет языка — определим сами */ }
      try { this.device = this.ysdk.deviceInfo.type; } catch (e) { /* desktop по умолчанию */ }
      // Платформа может поставить игру на паузу (например, открыли своё меню)
      try {
        this.ysdk.on('game_api_pause', () => Game.platformPause(true));
        this.ysdk.on('game_api_resume', () => Game.platformPause(false));
      } catch (e) { /* старые версии SDK */ }
      try { this.storage = await this.timeout(this.ysdk.getStorage(), 3000); } catch (e) { this.storage = null; }
      try { this.player = await this.timeout(this.ysdk.getPlayer({ scopes: false }), 5000); } catch (e) { this.player = null; }
    } catch (e) {
      console.warn('Yandex SDK init failed, using mock', e);
      this.ysdk = null;
      this.isMock = true;
    }
  },

  // Игра загрузилась — сообщаем платформе (обязательное требование модерации)
  loadingReady() {
    try { if (this.ysdk && this.ysdk.features && this.ysdk.features.LoadingAPI) this.ysdk.features.LoadingAPI.ready(); } catch (e) { /* ignore */ }
  },
  // Разметка геймплея (обязательна с 2024 года)
  gameplayStart() {
    if (this.gp) return;
    this.gp = true;
    try { if (this.ysdk && this.ysdk.features.GameplayAPI) this.ysdk.features.GameplayAPI.start(); } catch (e) { /* ignore */ }
  },
  gameplayStop() {
    if (!this.gp) return;
    this.gp = false;
    try { if (this.ysdk && this.ysdk.features.GameplayAPI) this.ysdk.features.GameplayAPI.stop(); } catch (e) { /* ignore */ }
  },

  // ---------- сохранения ----------
  getLocal(key) {
    try { return (this.storage || window.localStorage).getItem(key); } catch (e) { return null; }
  },
  setLocal(key, val) {
    try { (this.storage || window.localStorage).setItem(key, val); } catch (e) { /* приватный режим */ }
  },
  removeLocal(key) {
    try { (this.storage || window.localStorage).removeItem(key); } catch (e) { /* ignore */ }
  },
  async loadCloud() {
    if (!this.player) return null;
    try {
      const d = await this.timeout(this.player.getData(['save']), 5000);
      return d && typeof d.save === 'string' ? d.save : null;
    } catch (e) { return null; }
  },
  saveCloud(str, flush) {
    if (!this.player) return;
    try {
      const p = this.player.setData({ save: str }, !!flush);
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  },

  // ---------- реклама ----------
  // cb: { onOpen, onClose(rewarded), onError }
  showRewarded(cb) {
    if (this.adBusy) return;
    this.adBusy = true;
    let rewarded = false, done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      this.adBusy = false;
      if (err && !rewarded) cb.onError && cb.onError();
      cb.onClose && cb.onClose(rewarded);
    };
    if (this.isMock) {
      cb.onOpen && cb.onOpen();
      UI.mockAd(true, () => { rewarded = true; finish(false); });
      return;
    }
    try {
      this.ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => { cb.onOpen && cb.onOpen(); },
          onRewarded: () => { rewarded = true; },
          onClose: () => finish(false),
          onError: () => finish(true),
        },
      });
    } catch (e) { finish(true); }
  },
  showInterstitial(cb) {
    if (this.adBusy) { cb.onClose && cb.onClose(false); return; }
    this.adBusy = true;
    let done = false;
    const finish = (shown) => {
      if (done) return;
      done = true;
      this.adBusy = false;
      cb.onClose && cb.onClose(shown);
    };
    if (this.isMock) {
      cb.onOpen && cb.onOpen();
      UI.mockAd(false, () => finish(true));
      return;
    }
    try {
      this.ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: () => { cb.onOpen && cb.onOpen(); },
          onClose: (wasShown) => finish(wasShown),
          onError: () => finish(false),
          onOffline: () => finish(false),
        },
      });
    } catch (e) { finish(false); }
  },

  // Лидерборд «stars» нужно создать в консоли разработчика (необязательно)
  setLeaderboard(score) {
    if (!this.ysdk) return;
    try {
      if (this.ysdk.leaderboards && this.ysdk.leaderboards.setScore) {
        const p = this.ysdk.leaderboards.setScore('stars', score);
        if (p && p.catch) p.catch(() => {});
      } else if (this.ysdk.getLeaderboards) {
        this.ysdk.getLeaderboards().then((lb) => lb.setLeaderboardScore('stars', score)).catch(() => {});
      }
    } catch (e) { /* ignore */ }
  },
};
