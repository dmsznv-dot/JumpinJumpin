import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, GROOVES, parseBar, noteToMidi, chordNotes, pickMusic } from './songs.mjs';

test('33 complete eight-bar songs with distinct names, grooves and sane ranges', () => {
  assert.equal(SONGS.length, 33);
  assert.equal(new Set(SONGS.map(s => s.name)).size, 33);
  for (const s of SONGS) {
    assert.equal(s.bars.length, 8, s.name);
    assert.ok(GROOVES.includes(s.groove), s.name);
    assert.ok(s.bpm >= 80 && s.bpm <= 180, s.name);
    for (const bar of s.bars) {
      assert.ok(bar.lead.length >= 3, s.name);
      for (const n of bar.lead) assert.ok(n.midi >= 57 && n.midi <= 96 && n.step + n.len <= 16, `${s.name} ${n.midi}`);
      assert.ok(bar.bass.length >= 2 && bar.chord.length >= 3);
    }
  }
});
test('notation: notes, rests and holds', () => {
  assert.equal(noteToMidi('c4'), 60); assert.equal(noteToMidi('f#5'), 78); assert.equal(noteToMidi('bb4'), 70);
  const bar = parseBar('c5 - - . e5 . . . g5 - . . . . . .');
  assert.deepEqual(bar.map(n => [n.step, n.len]), [[0, 3], [4, 1], [8, 2]]);
  assert.deepEqual(chordNotes('Am').notes, [69, 60, 64].map(n => n > 71 ? n - 12 : n));
});
test('the main menu has four songs of its own, kept out of the levels', () => {
  const menu = SONGS.filter(s => s.levels.includes('lobby'));
  assert.equal(menu.length, 4);
  assert.equal(new Set(menu.map(s => s.groove)).size, 4, 'four different moods');
  for (const level of ['race', 'survival', 'final', undefined]) for (let i = 0; i < 30; i++) {
    const key = pickMusic(null, level, () => i / 30);
    assert.ok(!SONGS[Number(key.split(':')[1])].levels.includes('lobby'), `${key} leaked into ${level}`);
  }
});
test('every level gets several songs and never the same piece twice in a row', () => {
  for (const level of ['race', 'survival', 'final', 'lobby']) {
    assert.ok(SONGS.filter(s => s.levels.includes(level)).length >= 4, level);
    let prev = null;
    for (let i = 0; i < 40; i++) { const next = pickMusic(prev, level, () => (i * .137) % 1); assert.notEqual(next, prev); prev = next; }
  }
});
