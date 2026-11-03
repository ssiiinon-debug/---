const DICT = {
  ru: {
    subtitle: 'Тригот против дровосека в индислиз',
    play: 'ИГРАТЬ', characters: 'Герои', upgrades: 'Бонусы', back: 'Назад',
    best: 'Рекорд:', paused: 'Пауза', resume: 'Продолжить', toMenu: 'Меню',
    revive: 'Продолжить', doubleCoins: 'Удвоить монеты', again: 'Ещё раз',
    caught: 'Охранник поймал!', crashed: 'Бах!', newBest: 'Новый рекорд!',
    controls: 'Свайпы или стрелки / WASD: ← → полоса, ↑ прыжок, ↓ кувырок',
    hint: '← →  смена полосы\n↑  прыжок     ↓  кувырок',
    select: 'Выбрать', selected: 'Выбран', max: 'Макс.',
    skin_trigot: 'Тригот', skin_trigot_night: 'Тригот: Ночь', skin_trigot_pink: 'Тригот: Пинк',
    sd_trigot: 'Шег, бомбер с костями, джинсы в заплатках', sd_trigot_night: 'Платиновый шег, чёрно-белый бомбер',
    sd_trigot_pink: 'Розовый шег, фиолетовый бомбер',
    p_magnet: 'Магнит', p_x2: 'Очки x2', p_sneakers: 'Суперкеды', p_shield: 'Щит',
    pd_magnet: 'Притягивает монеты', pd_x2: 'Двойные очки', pd_sneakers: 'Прыжок выше поездов',
    pd_shield: 'Спасает от одного удара', sec: 'с',
  },
  en: {
    subtitle: '3goth vs the indie sleaze Lumberjack',
    play: 'PLAY', characters: 'Heroes', upgrades: 'Power-ups', back: 'Back',
    best: 'Best:', paused: 'Paused', resume: 'Resume', toMenu: 'Menu',
    revive: 'Continue', doubleCoins: 'Double coins', again: 'Again',
    caught: 'Caught!', crashed: 'Crash!', newBest: 'New record!',
    controls: 'Swipe or arrows / WASD: ← → lane, ↑ jump, ↓ roll',
    hint: '← →  change lane\n↑  jump     ↓  roll',
    select: 'Select', selected: 'Selected', max: 'Max',
    skin_trigot: '3goth', skin_trigot_night: '3goth: Night', skin_trigot_pink: '3goth: Pink',
    sd_trigot: 'Shag hair, bone varsity, patched jeans', sd_trigot_night: 'Platinum shag, black & white varsity',
    sd_trigot_pink: 'Pink shag, purple varsity',
    p_magnet: 'Magnet', p_x2: 'Score x2', p_sneakers: 'Super sneakers', p_shield: 'Shield',
    pd_magnet: 'Pulls coins in', pd_x2: 'Double score', pd_sneakers: 'Jump over trains',
    pd_shield: 'Saves you from one hit', sec: 's',
  },
};

let lang = 'ru';
export function setLang(l) { lang = DICT[l] ? l : (['be', 'kk', 'uk', 'uz'].includes(l) ? 'ru' : 'en'); document.documentElement.lang = lang; }
export function t(key) { return (DICT[lang] && DICT[lang][key]) || DICT.ru[key] || key; }
export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
}
