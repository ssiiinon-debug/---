'use strict';
// Точка входа: SDK → язык → сохранение → запуск.

(function boot() {
  const ldBar = document.getElementById('ldBar');
  const ldText = document.getElementById('ldText');
  const progress = (p) => { ldBar.style.width = Math.round(p * 100) + '%'; };

  async function start() {
    I18N.setLang(I18N.detect(''));
    ldText.textContent = t('loading');
    progress(0.15);
    await SDK.init();
    progress(0.5);
    const save = await Game.loadSave();
    progress(0.8);
    I18N.setLang(save && save.lang ? save.lang : I18N.detect(SDK.lang));
    ldText.textContent = t('loading');

    Game.init(save);
    Render.init(document.getElementById('game'));
    UI.init();
    Input.init(document.getElementById('game'));
    Render.defaultView();

    document.addEventListener('visibilitychange', () => Game.onVisibility());
    window.addEventListener('pagehide', () => Game.save(true));
    window.addEventListener('resize', () => { Render.resize(); UI.layout(); });
    window.addEventListener('orientationchange', () => setTimeout(() => { Render.resize(); UI.layout(); }, 200));

    // Оффлайн-доход за время отсутствия
    if (save && save.savedAt) Game.applyOffline((Date.now() - save.savedAt) / 1000);

    Game.start();
    progress(1);
    setTimeout(() => {
      document.getElementById('loading').classList.add('gone');
      SDK.loadingReady();
      SDK.gameplayStart();
    }, 250);
  }

  start().catch((e) => {
    console.error(e);
    ldText.textContent = 'Error: ' + (e && e.message ? e.message : e);
  });
})();
