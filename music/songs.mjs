// Original eight-bar songs for the in-game synthesizer (AA'BA form, 16th-note grid): 15 written for the levels,
// the 9 original arena themes rearranged in the same format, 5 more, and 4 main-menu songs of different moods.
// Notation, one token per 16th: note `c5` / `f#4` / `bb5`, rest `.`, hold `-` (extends the previous note).
// Bass lines are rhythm templates over each bar's chord root: R root, O octave up, F fifth, . rest.
// `levels` says where a song fits: race (courses), survival (Roll Out, Hex arena), final (Jump Showdown), lobby (menu).
// `heavy` doubles the bass with a clean sine on the same note for a fuller low end.

const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
export function noteToMidi(token) {
  const m = /^([a-g])(#|b)?(\d)$/.exec(token);
  if (!m) throw new Error('bad note ' + token);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
// One bar of melody -> [{step, midi, len}] (len in 16ths).
export function parseBar(text) {
  const tokens = text.trim().split(/\s+/), notes = [];
  if (tokens.length !== 16) throw new Error(`bar needs 16 steps, got ${tokens.length}: ${text}`);
  tokens.forEach((t, step) => {
    if (t === '.') return;
    if (t === '-') { if (notes.length) notes[notes.length - 1].len++; return; }
    notes.push({ step, midi: noteToMidi(t), len: 1 });
  });
  return notes;
}
// Chord symbol -> close-voiced triad (+7th) around middle C; also returns the bass root (octave 2).
export function chordNotes(symbol) {
  const m = /^([A-G])(#|b)?(m)?(7)?$/.exec(symbol);
  if (!m) throw new Error('bad chord ' + symbol);
  const root = PC[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const base = 60 + ((root + 12) % 12);
  const notes = [base, base + (m[3] ? 3 : 4), base + 7];
  if (m[4]) notes.push(base + 10);
  return { notes: notes.map(n => (n > 71 ? n - 12 : n)), root: 36 + ((root + 12) % 12) };
}
export function bassBar(template, chord) {
  const { root } = chordNotes(chord), out = [];
  template.trim().split(/\s+/).forEach((t, step) => {
    if (t === 'R') out.push({ step, midi: root });
    else if (t === 'O') out.push({ step, midi: root + 12 });
    else if (t === 'F') out.push({ step, midi: root + 7 });
  });
  return out;
}

const BASS = {
  pop: 'R . . R . . R . R . . R . . O .', polka: 'R . . . . . . . F . . . . . . .',
  chip: 'R . R . O . R . R . R . O . R .', dembow: 'R . . R . . R . R . . R . . R .',
  disco: 'R . O . R . O . R . O . R . O .', ska: 'R . . . F . . . R . . . F . . .',
  hip: 'R . . . . . . R . . R . . . . .', jersey: 'R . . R . . R . . . R . R . . .',
  jig: 'R . . F . . R . . F . . R . F .', hyper: 'R R . R . R R . R . . R . R R .',
  walk: 'R . F . O . F . R . F . O . F .', baile: 'R . . R . . R . . R . . R . . .',
  stomp: 'R . . . . . . . R . . R . . . .',
  // Busier, bassier lines (the ones players liked): octave pumps, driving 8ths, syncopated funk.
  octave: 'R . O . R . O . R . O R . R O .', drive: 'R R . R O . R . R R . R O . R .',
  funk: 'R . . R . O . R . . R . O . R O'
};

const RAW = [
  { name: 'Мармеладный бит', bpm: 122, groove: 'four', voice: 'pluck', bass: 'pop', levels: ['race', 'survival'],
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'],
    lead: ['e5 . g5 . c6 . g5 . a5 - g5 . e5 . d5 .', 'd5 . g5 . b5 . g5 . a5 - g5 . d5 . . .',
      'c5 . e5 . a5 . e5 . g5 - e5 . c5 . . .', 'a4 . c5 . f5 - e5 . d5 . c5 . . . . .',
      'e5 . g5 . c6 . g5 . a5 - g5 . e5 . d5 .', 'd5 . g5 . b5 . g5 . a5 - g5 . d5 . . .',
      'f5 . e5 . d5 . c5 . a4 - - . c5 . d5 .', 'g5 - - . f5 . e5 . d5 - - - b4 . . .'] },
  { name: 'Конфетная полька', bpm: 150, groove: 'polka', voice: 'brass', bass: 'polka', levels: ['survival', 'race'],
    chords: ['F', 'C7', 'C7', 'F', 'F', 'Bb', 'C7', 'F'],
    lead: ['c5 . f5 . a5 . f5 . c5 . f5 . a5 . c6 .', 'bb5 . g5 . e5 . g5 . bb5 . a5 . g5 . . .',
      'e5 . g5 . bb5 . g5 . c6 . bb5 . g5 . e5 .', 'f5 . . . a5 . c6 . f6 - - . . . . .',
      'a5 a5 . a5 c6 . a5 . f5 . a5 . c6 . . .', 'bb5 bb5 . bb5 d6 . bb5 . f5 . bb5 . d6 . . .',
      'c6 . bb5 . g5 . e5 . c5 . e5 . g5 . bb5 .', 'a5 . f5 . c5 . f5 . f5 - - . . . . .'] },
  { name: 'Пиксельный спринт', bpm: 160, groove: 'breakbeat', voice: 'chip', bass: 'chip', levels: ['race'],
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'],
    lead: ['a5 . c6 . e6 . a5 . c6 e6 . a6 - - . .', 'f5 . a5 . c6 . f5 . a5 c6 . f6 - - . .',
      'e5 . g5 . c6 . e5 . g5 c6 . e6 - - . .', 'd6 . b5 . g5 . b5 . d6 . g6 . . . . .',
      'e6 e6 . e6 . c6 . a5 . c6 . e6 . a6 . .', 'f6 f6 . f6 . c6 . a5 . c6 . f6 . a6 . .',
      'g6 . f6 . d6 . b5 . g5 . b5 . d6 . f6 .', 'e6 - - . g#5 . b5 . e6 . . . e5 . . .'] },
  { name: 'Шоколадный реггетон', bpm: 96, groove: 'dembow', voice: 'pluck', bass: 'dembow', levels: ['survival'],
    chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'C'],
    lead: ['d5 . . f5 . . a5 . . f5 . . e5 . d5 .', 'd5 . . f5 . . bb5 . . a5 . . f5 . . .',
      'c5 . . f5 . . a5 . . c6 . . a5 . f5 .', 'e5 . . g5 . . c6 . . g5 . . e5 . . .',
      'a5 . a5 . . a5 . g5 f5 . . d5 . . . .', 'bb5 . bb5 . . bb5 . a5 g5 . . f5 . . . .',
      'a5 . a5 . . c6 . a5 f5 . . c5 . . . .', 'g5 . . e5 . . c5 . . e5 . . g5 - - .'] },
  { name: 'Диско-желе', bpm: 118, groove: 'disco', voice: 'brass', bass: 'disco', levels: ['race', 'final'],
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D7'],
    lead: ['b5 . d6 . . b5 . g5 . . a5 . b5 . . .', 'b5 . e6 . . b5 . g5 . . e5 . g5 . . .',
      'c6 . e6 . . c6 . g5 . . e5 . g5 . . .', 'a5 . d6 . f#6 . d6 . a5 . . . . . . .',
      'g6 - - . f#6 . e6 . d6 . b5 . d6 . . .', 'e6 - - . d6 . b5 . g5 . e5 . g5 . . .',
      'e6 - - . d6 . c6 . g5 . e5 . g5 . c6 .', 'd6 . . . a5 . . . f#5 . a5 . d6 . . .'] },
  { name: 'Ска-прыгалка', bpm: 168, groove: 'ska', voice: 'brass', bass: 'ska', levels: ['race'],
    chords: ['Bb', 'Eb', 'F', 'Bb', 'Gm', 'Eb', 'F', 'Bb'],
    lead: ['f5 . bb5 . . . d6 . . . bb5 . f5 . . .', 'g5 . bb5 . . . eb6 . . . bb5 . g5 . . .',
      'a5 . c6 . . . f6 . . . c6 . a5 . . .', 'bb5 . d6 . f6 . d6 . bb5 - - . . . . .',
      'g5 g5 . bb5 . d6 . bb5 g5 g5 . bb5 . d6 . .', 'eb6 . d6 . c6 . bb5 . g5 . bb5 . eb6 . . .',
      'f6 . eb6 . c6 . a5 . f5 . a5 . c6 . eb6 .', 'd6 . . . bb5 . . . f5 . . . bb5 . . .'] },
  { name: 'Облачный свисток', bpm: 92, groove: 'halftime', voice: 'whistle', bass: 'hip', levels: ['survival'],
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'],
    lead: ['g5 - - . e5 . g5 . c6 - - . . . . .', 'a5 - - . e5 . a5 . c6 - - . b5 . a5 .',
      'a5 - - . f5 . a5 . c6 - - . d6 . c6 .', 'b5 - - . g5 . b5 . d6 - - . . . . .',
      'e6 . d6 . c6 . g5 . e6 . d6 . c6 . . .', 'e6 . d6 . c6 . a5 . e6 . d6 . c6 . . .',
      'f6 . e6 . d6 . c6 . a5 . c6 . d6 . . .', 'd6 - - . b5 . g5 . . . . . . . . .'] },
  { name: 'Клубный попрыгун', bpm: 140, groove: 'jersey', voice: 'chip', bass: 'jersey', levels: ['race', 'survival'],
    chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'],
    lead: ['e5 . e5 . g5 . . b5 . . g5 . e5 . . .', 'e5 . e5 . g5 . . c6 . . g5 . e5 . . .',
      'd5 . d5 . g5 . . b5 . . d6 . b5 . . .', 'f#5 . f#5 . a5 . . d6 . . a5 . f#5 . . .',
      'b5 b5 b5 . b5 b5 b5 . e6 . d6 . b5 . . .', 'c6 c6 c6 . c6 c6 c6 . e6 . d6 . c6 . . .',
      'd6 d6 d6 . b5 b5 b5 . g5 . a5 . b5 . . .', 'a5 - - . f#5 . d5 . a5 - - . . . . .'] },
  { name: 'Морской джиг', bpm: 150, groove: 'four', voice: 'bell', bass: 'jig', levels: ['survival', 'race'],
    chords: ['D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'D'],
    lead: ['d5 . f#5 a5 . f#5 d5 . a5 . f#5 a5 . d6 . .', 'b5 . g5 b5 . g5 d5 . g5 . b5 d6 . b5 . .',
      'c#6 . a5 c#6 . a5 e5 . a5 . c#6 e6 . c#6 . .', 'd6 . a5 f#5 . d5 . . d5 - - . . . . .',
      'f#5 f#5 . d5 . f#5 b5 . d6 . b5 . f#5 . . .', 'g5 g5 . d5 . g5 b5 . d6 . b5 . g5 . . .',
      'a5 . c#6 . e6 . c#6 . a5 . e5 . a5 . c#6 .', 'd6 . . . a5 . . . f#5 . . . d5 . . .'] },
  { name: 'Звёздный гиперпоп', bpm: 170, groove: 'breakbeat', voice: 'bell', bass: 'hyper', levels: ['final', 'race'],
    chords: ['F', 'G', 'Em', 'Am', 'F', 'G', 'Em', 'Am'],
    lead: ['c6 a5 f5 a5 c6 a5 f5 a5 c6 . f6 . e6 . c6 .', 'd6 b5 g5 b5 d6 b5 g5 b5 d6 . g6 . f6 . d6 .',
      'b5 g5 e5 g5 b5 g5 e5 g5 b5 . e6 . d6 . b5 .', 'c6 a5 e5 a5 c6 a5 e5 a5 e6 - - - . . . .',
      'a6 . g6 . f6 . e6 . f6 . c6 . a5 . . .', 'b6 . a6 . g6 . f6 . g6 . d6 . b5 . . .',
      'g6 . f6 . e6 . d6 . e6 . b5 . g5 . . .', 'a5 . c6 . e6 . a6 - - - . . . . . .'] },
  { name: 'Кумбия-кактус', bpm: 100, groove: 'cumbia', voice: 'pluck', bass: 'ska', levels: ['survival'],
    chords: ['Am', 'Dm', 'G', 'C', 'F', 'Dm', 'E', 'Am'],
    lead: ['e5 . . a5 . . c6 . b5 . a5 . e5 . . .', 'f5 . . a5 . . d6 . c6 . a5 . f5 . . .',
      'd5 . . g5 . . b5 . a5 . g5 . d5 . . .', 'e5 . . g5 . . c6 . . . . . . . . .',
      'a5 . c6 . a5 . f5 . a5 . c6 . f6 . . .', 'a5 . d6 . a5 . f5 . a5 . d6 . f6 . . .',
      'g#5 . b5 . e6 . b5 . g#5 . e5 . g#5 . b5 .', 'a5 . . . e5 . . . c5 . . . a4 . . .'] },
  { name: 'Электросвинг-печенька', bpm: 126, groove: 'swing', voice: 'brass', bass: 'walk', levels: ['survival', 'final'],
    chords: ['Dm', 'A7', 'Dm', 'A7', 'Gm', 'Dm', 'E7', 'A7'],
    lead: ['d5 . f5 . a5 . d6 . c#6 . d6 . a5 . . .', 'e5 . g5 . a5 . c#6 . e6 . c#6 . a5 . . .',
      'f5 . a5 . d6 . f6 . e6 . d6 . a5 . . .', 'g5 . e5 . c#5 . e5 . a5 - - . . . . .',
      'd6 . d6 . bb5 . g5 . d6 . bb5 . g5 . . .', 'a5 . a5 . f5 . d5 . a5 . f5 . d5 . . .',
      'g#5 . b5 . d6 . e6 . d6 . b5 . g#5 . . .', 'a5 . c#6 . e6 . g6 . a6 - - . . . . .'] },
  { name: 'Бразильский фанк', bpm: 130, groove: 'baile', voice: 'whistle', bass: 'baile', levels: ['race', 'survival'],
    chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'D'],
    lead: ['e5 . e5 e5 . . g5 . . e5 . . . . . .', 'e5 . e5 e5 . . b5 . . a5 . g5 . . . .',
      'e5 . e5 e5 . . g5 . . c6 . . . . . .', 'd5 . d5 d5 . . f#5 . . a5 . . d6 . . .',
      'b5 . b5 b5 . . e6 . . b5 . . g5 . . .', 'b5 . b5 b5 . . d6 . . b5 . . a5 . . .',
      'c6 . c6 c6 . . e6 . . c6 . . g5 . . .', 'd6 . . . a5 . . . f#5 . . . d5 . . .'] },
  { name: 'Хором на финал', bpm: 104, groove: 'stomp', voice: 'brass', bass: 'stomp', levels: ['final'],
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'Am'],
    lead: ['e5 - - . e5 . a5 . c6 - - . b5 . a5 .', 'c6 - - . a5 . f5 . a5 - - . . . . .',
      'g5 - - . g5 . c6 . e6 - - . d6 . c6 .', 'd6 - - . b5 . g5 . b5 - - . . . . .',
      'e6 . e6 . e6 . d6 . c6 . c6 . c6 . b5 .', 'a5 . a5 . a5 . c6 . f6 - - . e6 . . .',
      'd6 . d6 . d6 . e6 . g6 - - . f6 . e6 .', 'e6 - - . c6 . a5 . a5 - - - . . . .'] },
  { name: 'Банановый буги', bpm: 140, groove: 'swing', voice: 'pluck', bass: 'walk', levels: ['race', 'final'],
    chords: ['C', 'C', 'F', 'C', 'G', 'F', 'C', 'G'],
    lead: ['c5 . e5 . g5 . a5 . bb5 . a5 . g5 . e5 .', 'c6 . . . bb5 . g5 . a5 . g5 . e5 . . .',
      'f5 . a5 . c6 . d6 . eb6 . d6 . c6 . a5 .', 'g5 . e5 . c5 . e5 . g5 - - . . . . .',
      'd6 . . . b5 . . . g5 . a5 . b5 . d6 .', 'c6 . . . a5 . . . f5 . g5 . a5 . c6 .',
      'e6 . d6 . c6 . bb5 . a5 . g5 . e5 . c5 .', 'd5 . f5 . g5 . b5 . d6 - - . . . . .'] },
  // ---- The original arena themes, rearranged in this format (same motifs and chords, new grooves and bass) ----
  { name: 'Фестиваль', bpm: 128, groove: 'four', voice: 'brass', bass: 'octave', heavy: true, levels: ['race', 'survival'],
    chords: ['C', 'F', 'Am', 'G', 'C', 'Am', 'F', 'G'],
    lead: ['c5 . e5 . g5 - e5 . a5 . g5 . e5 . d5 .', 'f5 . a5 . c6 - a5 . g5 . f5 . e5 . c5 .',
      'a5 . c6 . e6 - c6 . b5 . a5 . g5 . e5 .', 'g5 . b5 . d6 - c6 . a5 . g5 . e5 . d5 .',
      'e6 - - . d6 . c6 . g5 - - . e5 . g5 .', 'a5 - - . c6 . e6 . d6 - - . c6 . a5 .',
      'f5 . a5 . c6 . f6 . e6 . d6 . c6 . a5 .', 'b5 . d6 . g6 - - . f6 . d6 . b5 - - .'] },
  { name: 'Прыжок', bpm: 140, groove: 'breakbeat', voice: 'pluck', bass: 'funk', heavy: true, levels: ['race'],
    chords: ['Dm', 'G', 'F', 'Am', 'Dm', 'G', 'F', 'Am'],
    lead: ['d5 . f5 . a5 . f5 . d5 . a5 . c6 . a5 .', 'g5 . b5 . d6 . b5 . a5 . g5 . f5 . d5 .',
      'f5 . a5 . c6 . a5 . f5 . e5 . d5 . c5 .', 'a5 . c6 . e6 . d6 . c6 . a5 . g5 . e5 .',
      'a5 a5 . f5 . d5 . f5 a5 . d6 - - . . .', 'b5 b5 . g5 . d5 . g5 b5 . d6 - - . . .',
      'c6 c6 . a5 . f5 . a5 c6 . f6 - - . . .', 'e6 . c6 . a5 . e5 . a5 - - - . . . .'] },
  { name: 'Карнавал', bpm: 124, groove: 'disco', voice: 'bell', bass: 'octave', heavy: true, levels: ['survival', 'race'],
    chords: ['F', 'Bb', 'G', 'C', 'F', 'Bb', 'G', 'C'],
    lead: ['f5 . a5 . c6 . f6 - c6 . a5 . g5 . f5 .', 'bb5 . d6 . f6 . d6 - c6 . bb5 . a5 . f5 .',
      'g5 . b5 . d6 . b5 - g5 . a5 . b5 . d6 .', 'c6 . e6 . g6 . f6 - d6 . c6 . a5 . g5 .',
      'a5 a5 a5 . c6 . a5 . f5 f5 f5 . a5 . . .', 'bb5 bb5 bb5 . d6 . bb5 . f5 f5 f5 . bb5 . . .',
      'b5 . d6 . g6 . d6 . b5 . g5 . a5 . b5 .', 'c6 - - . g5 . e5 . c6 - - - . . . .'] },
  { name: 'Басовый марш', bpm: 96, groove: 'halftime', voice: 'brass', bass: 'drive', heavy: true, levels: ['survival', 'final'],
    chords: ['Dm', 'Gm', 'F', 'Am', 'Dm', 'Gm', 'F', 'Am'],
    lead: ['d5 . d5 . f5 . a5 - f5 . d5 . c5 . a4 .', 'g5 . f5 . d5 . bb4 . d5 . f5 . g5 . a5 .',
      'f5 . f5 . a5 . c6 - a5 . f5 . e5 . c5 .', 'a5 . g5 . e5 . c5 . e5 . g5 . a5 . c6 .',
      'd6 - - . a5 . f5 . d6 - - . c6 . a5 .', 'bb5 - - . g5 . d5 . bb5 - - . a5 . g5 .',
      'a5 - - . f5 . c5 . a5 . c6 . f6 . e6 .', 'e6 - - . c6 . a5 . e5 - - - . . . .'] },
  { name: 'Ночной заезд', bpm: 118, groove: 'four', voice: 'pluck', bass: 'octave', heavy: true, levels: ['race'],
    chords: ['Em', 'Am', 'G', 'Bm', 'Em', 'Am', 'G', 'Bm'],
    lead: ['e5 . g5 . b5 . g5 . e5 . d5 . b4 . d5 .', 'a5 . c6 . e6 . c6 . a5 . g5 . e5 . g5 .',
      'g5 . b5 . d6 . b5 . g5 . f#5 . d5 . f#5 .', 'b5 . d6 . f#6 . d6 . b5 . a5 . f#5 . d5 .',
      'b5 - - . e6 . b5 . g5 - - . e5 . . .', 'c6 - - . e6 . c6 . a5 - - . e5 . . .',
      'd6 - - . g6 . d6 . b5 - - . g5 . . .', 'f#6 - - . d6 . b5 . f#5 - - - . . . .'] },
  { name: 'Солнечный парад', bpm: 150, groove: 'ska', voice: 'brass', bass: 'ska', levels: ['race', 'survival'],
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'],
    lead: ['c5 . e5 . g5 . c6 . g5 . e5 . d5 . e5 .', 'g5 . b5 . d6 . b5 . g5 . a5 . b5 . d6 .',
      'a5 . c6 . e6 . d6 . c6 . a5 . g5 . e5 .', 'f5 . a5 . c6 . a5 . g5 . e5 . d5 . c5 .',
      'e6 . . e6 . . d6 . c6 . . g5 . . . .', 'd6 . . d6 . . c6 . b5 . . g5 . . . .',
      'c6 . . c6 . . b5 . a5 . . e5 . . . .', 'f5 . a5 . c6 . f6 . e6 - - . . . . .'] },
  { name: 'Облачная гонка', bpm: 138, groove: 'jersey', voice: 'bell', bass: 'drive', heavy: true, levels: ['race'],
    chords: ['F', 'Am', 'Bb', 'G', 'F', 'Am', 'Bb', 'G'],
    lead: ['f5 . a5 . c6 . a5 . f5 . g5 . a5 . c6 .', 'a5 . c6 . e6 . c6 . a5 . c6 . e6 . f6 .',
      'bb5 . d6 . f6 . d6 . bb5 . a5 . g5 . f5 .', 'g5 . b5 . d6 . b5 . g5 . f5 . e5 . c5 .',
      'c6 c6 . c6 . . a5 . f5 . a5 . c6 . . .', 'e6 e6 . e6 . . c6 . a5 . c6 . e6 . . .',
      'f6 f6 . f6 . . d6 . bb5 . d6 . f6 . . .', 'd6 . b5 . g5 . b5 . d6 - - - . . . .'] },
  { name: 'Конфетти', bpm: 100, groove: 'dembow', voice: 'pluck', bass: 'dembow', heavy: true, levels: ['survival'],
    chords: ['Bb', 'Eb', 'C', 'F', 'Bb', 'Eb', 'C', 'F'],
    lead: ['bb4 . . d5 . . f5 . bb5 . . f5 . d5 . .', 'eb5 . . g5 . . bb5 . g5 . . eb5 . g5 . .',
      'c5 . . e5 . . g5 . c6 . . g5 . e5 . .', 'f5 . . a5 . . c6 . a5 . . f5 . a5 . c6',
      'd6 . d6 . . bb5 . f5 d6 . d6 . . bb5 . .', 'eb6 . eb6 . . bb5 . g5 eb6 . eb6 . . bb5 . .',
      'e6 . e6 . . c6 . g5 e6 . e6 . . c6 . .', 'f6 - - . c6 . a5 . f5 - - - . . . .'] },
  { name: 'Гимн арены', bpm: 136, groove: 'four', voice: 'brass', bass: 'octave', heavy: true, levels: ['survival', 'race'],
    chords: ['Gm', 'F', 'Eb', 'D7', 'Gm', 'F', 'Eb', 'D7'],
    lead: ['g5 . g5 bb5 d6 . c6 bb5 c6 . g5 f5 g5 . d5 .', 'g5 . g5 bb5 d6 . f6 d6 c6 . bb5 g5 a5 . . .',
      'eb5 . g5 . f5 . a5 . g5 bb5 d6 c6 bb5 . g5 .', 'd6 d6 . d6 eb6 eb6 . eb6 f6 f6 . f6 g6 f6 d6 bb5',
      'g5 . g5 bb5 d6 . c6 bb5 c6 . g5 f5 g5 . d5 .', 'g5 . g5 bb5 d6 . f6 d6 c6 . bb5 g5 a5 . . .',
      'bb5 - - . g5 . eb5 . f5 - - . a5 . c6 .', 'd6 - - . c6 . a5 . f#5 - - - . . . .'] },
  // ---- Five new ones ----
  { name: 'Бас-батут', bpm: 112, groove: 'baile', voice: 'whistle', bass: 'funk', heavy: true, levels: ['race', 'survival'],
    chords: ['Gm', 'Gm', 'Eb', 'F', 'Gm', 'Gm', 'Eb', 'F'],
    lead: ['g5 . . bb5 . . g5 . d6 . . bb5 . g5 . .', 'g5 . . bb5 . . c6 . d6 . . f6 . d6 . .',
      'eb6 . . d6 . . bb5 . g5 . . bb5 . c6 . .', 'c6 . . a5 . . f5 . a5 - - . . . . .',
      'd6 d6 . d6 . bb5 . g5 d6 d6 . d6 . bb5 . .', 'f6 f6 . f6 . d6 . bb5 g6 - - . f6 . d6 .',
      'eb6 eb6 . eb6 . bb5 . g5 eb6 - - . d6 . c6 .', 'c6 - - . a5 . f5 . c6 - - - . . . .'] },
  { name: 'Мармеладная лава', bpm: 108, groove: 'dembow', voice: 'chip', bass: 'dembow', heavy: true, levels: ['survival'],
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'],
    lead: ['e5 . a5 . . c6 . . b5 . a5 . . e5 . .', 'f5 . a5 . . c6 . . a5 . f5 . . c5 . .',
      'e5 . g5 . . c6 . . d6 . e6 . . c6 . .', 'd6 . . b5 . . g5 . . . . . . . . .',
      'a5 a5 c6 . a5 a5 e6 . a5 a5 c6 . b5 . a5 .', 'a5 a5 c6 . a5 a5 f6 . a5 a5 c6 . a5 . f5 .',
      'g5 g5 c6 . g5 g5 e6 . g5 g5 c6 . d6 . e6 .', 'd6 - - . b5 . g5 . d6 - - - . . . .'] },
  { name: 'Турбо-тубы', bpm: 132, groove: 'four', voice: 'brass', bass: 'drive', heavy: true, levels: ['race'],
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Dm', 'Bb'],
    lead: ['c6 . c6 . a5 . f5 . c6 . d6 . c6 . a5 .', 'c6 . c6 . g5 . e5 . c6 . d6 . e6 . . .',
      'd6 . d6 . a5 . f5 . d6 . e6 . f6 . d6 .', 'f6 - - . d6 . bb5 . f5 . . . . . . .',
      'a5 . c6 . f6 . c6 . a5 . c6 . f6 . a6 .', 'g5 . c6 . e6 . c6 . g5 . c6 . e6 . g6 .',
      'f5 . a5 . d6 . a5 . f5 . a5 . d6 . f6 .', 'f6 . d6 . bb5 . f5 . bb5 - - - . . . .'] },
  { name: 'Ниндзя-лапша', bpm: 150, groove: 'breakbeat', voice: 'pluck', bass: 'funk', heavy: true, levels: ['race'],
    chords: ['Em', 'D', 'C', 'D', 'Em', 'D', 'C', 'D'],
    lead: ['e5 . g5 a5 . b5 . . d6 . b5 . a5 g5 . .', 'd5 . f#5 a5 . d6 . . e6 . d6 . a5 f#5 . .',
      'e5 . g5 c6 . e6 . . g6 . e6 . c6 g5 . .', 'f#6 - - . e6 . d6 . a5 - - . . . . .',
      'b5 b5 . e6 . b5 . g5 b5 b5 . e6 . g6 . .', 'a5 a5 . d6 . a5 . f#5 a5 a5 . d6 . f#6 . .',
      'g5 g5 . c6 . g5 . e5 g5 g5 . c6 . e6 . .', 'd6 . a5 . f#5 . d5 . d6 - - - . . . .'] },
  { name: 'Последний прыжок', bpm: 100, groove: 'stomp', voice: 'brass', bass: 'octave', heavy: true, levels: ['final'],
    chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'Dm'],
    lead: ['a5 - - . a5 . d6 . f6 - - . e6 . d6 .', 'd6 - - . bb5 . f5 . bb5 - - . . . . .',
      'c6 - - . c6 . f6 . a6 - - . g6 . f6 .', 'g6 - - . e6 . c6 . e6 - - . . . . .',
      'a6 . a6 . a6 . g6 . f6 . f6 . f6 . e6 .', 'd6 . d6 . d6 . f6 . bb6 - - . a6 . . .',
      'g6 . g6 . g6 . a6 . c7 - - . bb6 . a6 .', 'a6 - - . f6 . d6 . d6 - - - . . . .'] },
  // ---- Main menu: four moods ----
  { name: 'Уютный фанк', bpm: 104, groove: 'four', voice: 'pluck', bass: 'funk', heavy: true, levels: ['lobby'],
    chords: ['F', 'Gm', 'Dm', 'C', 'F', 'Gm', 'Dm', 'C'],
    lead: ['f5 . a5 . c6 a5 f5 . g5 . f5 d5 c5 . . .', 'f5 . a5 . c6 d6 c6 . a5 . g5 f5 g5 . . .',
      'd5 . f5 . a5 f5 d5 . g5 . a5 bb5 c6 . a5 .', 'd6 c6 a5 g5 f5 . d5 f5 g5 . e5 . f5 . . .',
      'a5 - - . c6 . a5 . f5 - - . . . . .', 'bb5 - - . d6 . bb5 . g5 - - . . . . .',
      'a5 - - . f5 . d5 . f5 . a5 . c6 . d6 .', 'e6 - - . c6 . g5 . c6 - - - . . . .'] },
  { name: 'Мечтательное облако', bpm: 84, groove: 'halftime', voice: 'bell', bass: 'hip', levels: ['lobby'],
    chords: ['C', 'Em', 'Am', 'F', 'C', 'Em', 'Am', 'F'],
    lead: ['e5 - - . g5 - - . c6 - - - . . . .', 'b5 - - . g5 - - . e5 - - - . . . .',
      'c6 - - . a5 - - . e5 - - . g5 . a5 .', 'a5 - - - . . f5 . c6 - - - . . . .',
      'g5 . e5 . g5 . c6 . e6 - - . d6 . c6 .', 'b5 . g5 . b5 . e6 . g6 - - . e6 . b5 .',
      'c6 . a5 . c6 . e6 . a6 - - . g6 . e6 .', 'f6 - - . c6 - - . a5 - - - . . . .'] },
  { name: 'Конфетный марш', bpm: 120, groove: 'polka', voice: 'chip', bass: 'polka', levels: ['lobby'],
    chords: ['G', 'D', 'G', 'C', 'G', 'D', 'C', 'G'],
    lead: ['d5 . g5 . b5 . g5 . d6 . b5 . g5 . . .', 'a5 . f#5 . d5 . f#5 . a5 . d6 . a5 . . .',
      'b5 . d6 . g6 . d6 . b5 . g5 . d6 . . .', 'c6 . e6 . g6 . e6 . c6 - - . . . . .',
      'g6 g6 . d6 . b5 . d6 g6 g6 . d6 . b5 . .', 'f#6 f#6 . d6 . a5 . d6 f#6 f#6 . d6 . a5 . .',
      'e6 e6 . c6 . g5 . c6 e6 . d6 . c6 . b5 .', 'g5 . . . d5 . . . g5 - - - . . . .'] },
  { name: 'Ночная игротека', bpm: 96, groove: 'swing', voice: 'whistle', bass: 'walk', levels: ['lobby'],
    chords: ['Am', 'Dm', 'E7', 'Am', 'Am', 'Dm', 'E7', 'Am'],
    lead: ['a5 . . c6 . . e6 . . c6 . a5 . . . .', 'a5 . . d6 . . f6 . . d6 . a5 . . . .',
      'g#5 . . b5 . . d6 . . b5 . g#5 . e5 . .', 'a5 - - . e5 . a5 . c6 - - . . . . .',
      'e6 . d6 . c6 . b5 . a5 . b5 . c6 . e6 .', 'f6 . e6 . d6 . c6 . a5 . c6 . d6 . f6 .',
      'e6 . d6 . b5 . g#5 . e5 . g#5 . b5 . d6 .', 'c6 - - . a5 . e5 . a5 - - - . . . .'] }
];

// Pre-parsed, ready for the scheduler.
export const SONGS = RAW.map(s => ({
  name: s.name, bpm: s.bpm, groove: s.groove, voice: s.voice, levels: s.levels, heavy: !!s.heavy,
  bars: s.lead.map((text, i) => {
    const lead = parseBar(text), bass = bassBar(BASS[s.bass], s.chords[i]);
    // Lookup by 16th step for the scheduler.
    const leadAt = Array(16).fill(null), bassAt = Array(16).fill(null);
    lead.forEach(n => { leadAt[n.step] = n; }); bass.forEach(n => { bassAt[n.step] = n.midi; });
    return { lead, bass, leadAt, bassAt, chord: chordNotes(s.chords[i]).notes };
  })
}));

// Next song for a level ('race' | 'survival' | 'final' | 'lobby'), never the same one twice in a row.
// Menu songs only play in the menu; without a level any game song can come up.
export function pickMusic(previous, level, random = Math.random) {
  const pool = SONGS.flatMap((s, i) => ((level ? s.levels.includes(level) : !s.levels.includes('lobby')) ? ['song:' + i] : []));
  const options = pool.length > 1 ? pool.filter(key => key !== previous) : pool;
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
}
export const GROOVES = ['four', 'disco', 'dembow', 'polka', 'ska', 'breakbeat', 'halftime', 'jersey', 'cumbia', 'swing', 'baile', 'stomp'];
