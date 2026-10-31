// Championship: four rounds with elimination.
// Round 1 is one of the opening races, rounds 2–3 are two different levels from everything else (including the
// openers not picked), and the grand final is Jump Showdown or Hex-A-Gone.
export const OPENING = ['see-saw', 'big-fans', 'roll-on'];
export const MIDDLE = ['door-dash', 'gate-crash', 'roll-out'];
export const FINALS = ['showdown', 'hex'];

export function planChampionship(random = Math.random) {
  const pick = list => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  const first = pick(OPENING);
  const pool = [...MIDDLE, ...OPENING.filter(k => k !== first)];
  const second = pick(pool);
  const third = pick(pool.filter(k => k !== second));
  return [first, second, third, pick(FINALS)];
}

// "РАУНД 2 / 4" for the HUD and banners, "ГРАНД-ФИНАЛ" for the last round.
export function roundLabel(index, total) {
  return index === total - 1 ? 'ГРАНД-ФИНАЛ' : `РАУНД ${index + 1} / ${total}`;
}
