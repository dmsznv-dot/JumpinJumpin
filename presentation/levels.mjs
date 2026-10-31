// Show names of the rounds, one place for the lobby list, intros, HUD and results. `name` is the title as people
// say it; `title` is the uppercase form used on badges and banners. Groups follow the round types of the show.
export const LEVELS = {
  'big-fans':  { name: 'Вертушки',        icon: '🌀', group: 'race',     tagline: 'Ветер сдувает с дорожки — держись середины' },
  'door-dash': { name: 'Двери-обманки',   icon: '🚪', group: 'race',     tagline: 'Половина дверей не открывается — угадай' },
  'gate-crash':{ name: 'Хлоп-ворота',     icon: '🚧', group: 'race',     tagline: 'Ворота ходят вверх-вниз — проскочи вовремя' },
  'see-saw':   { name: 'Качель-кутерьма', icon: '⚖️', group: 'race',     tagline: 'Огромные качели кренятся под толпой' },
  'roll-on':   { name: 'Кольцеворот',     icon: '🛞', group: 'race',     tagline: 'Беги сквозь вращающиеся кольца' },
  'roll-out':  { name: 'Барабанная дробь', icon: '🥁', group: 'survival', tagline: 'Устой на крутящихся барабанах' },
  hex:         { name: 'Сотовый обвал',   icon: '⬡', group: 'final',    tagline: 'Соты тают под ногами — продержись дольше всех' },
  showdown:    { name: 'Прыг за корону',  icon: '👑', group: 'final',    tagline: 'Перепрыгивай балки и останься последним' }
};
for (const level of Object.values(LEVELS)) level.title = level.name.toUpperCase();

export const GROUPS = [
  { id: 'race', title: 'Гонки', hint: 'Добеги до финиша среди первых' },
  { id: 'survival', title: 'Выживание', hint: 'Продержись до конца раунда' },
  { id: 'final', title: 'Финалы', hint: 'Победитель забирает корону' }
];

export const levelTitle = kind => LEVELS[kind]?.title ?? String(kind).toUpperCase();
