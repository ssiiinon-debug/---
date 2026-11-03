const DICT = {
  ru: {
    subtitle: 'Рыжий против Контролёра',
    play: 'ИГРАТЬ', characters: 'Герои', upgrades: 'Бонусы', back: 'Назад',
    best: 'Рекорд:', paused: 'Пауза', resume: 'Продолжить', toMenu: 'Меню',
    revive: 'Продолжить', doubleCoins: 'Удвоить монеты', again: 'Ещё раз',
    caught: 'Поймали!', crashed: 'Бах!', newBest: 'Новый рекорд!',
    controls: 'Свайпы или стрелки / WASD: ← → полоса, ↑ прыжок, ↓ кувырок',
    hint: '← →  смена полосы\n↑  прыжок     ↓  кувырок',
    select: 'Выбрать', selected: 'Выбран', max: 'Макс.',
    skin_ginger: 'Рыжий', skin_shadow: 'Тень', skin_neon: 'Неон', skin_sport: 'Спортик',
    sd_ginger: 'Кудри, бомбер, рваные джинсы', sd_shadow: 'Весь в чёрном и в очках',
    sd_neon: 'Яркая, как вывеска', sd_sport: 'Костюм, кепка, кеды',
    p_magnet: 'Магнит', p_x2: 'Очки x2', p_sneakers: 'Суперкеды', p_shield: 'Щит',
    pd_magnet: 'Притягивает монеты', pd_x2: 'Двойные очки', pd_sneakers: 'Прыжок выше поездов',
    pd_shield: 'Спасает от одного удара', sec: 'с',
  },
  en: {
    subtitle: 'Ginger vs the Inspector',
    play: 'PLAY', characters: 'Heroes', upgrades: 'Power-ups', back: 'Back',
    best: 'Best:', paused: 'Paused', resume: 'Resume', toMenu: 'Menu',
    revive: 'Continue', doubleCoins: 'Double coins', again: 'Again',
    caught: 'Caught!', crashed: 'Crash!', newBest: 'New record!',
    controls: 'Swipe or arrows / WASD: ← → lane, ↑ jump, ↓ roll',
    hint: '← →  change lane\n↑  jump     ↓  roll',
    select: 'Select', selected: 'Selected', max: 'Max',
    skin_ginger: 'Ginger', skin_shadow: 'Shadow', skin_neon: 'Neon', skin_sport: 'Sporty',
    sd_ginger: 'Curls, varsity jacket, ripped jeans', sd_shadow: 'All black, shades on',
    sd_neon: 'Bright as a sign', sd_sport: 'Tracksuit, cap, sneakers',
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
