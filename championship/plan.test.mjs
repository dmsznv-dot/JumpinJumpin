import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planChampionship, roundLabel, OPENING, MIDDLE, FINALS } from './plan.mjs';

test('four rounds: an opener, two different middle levels, a final', () => {
  for (let i = 0; i < 400; i++) {
    let seed = i * 9301 + 49297;
    const rnd = () => ((seed = (seed * 233280 + 12345) % 2147483647) / 2147483647);
    const plan = planChampionship(rnd);
    assert.equal(plan.length, 4);
    assert.ok(OPENING.includes(plan[0]), plan.join());
    assert.ok(FINALS.includes(plan[3]), plan.join());
    assert.equal(new Set(plan).size, 4, `no level twice: ${plan}`);
    for (const k of plan.slice(1, 3)) assert.ok([...MIDDLE, ...OPENING].includes(k) && !FINALS.includes(k));
  }
});
test('every allowed level shows up somewhere over many shows', () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) planChampionship().forEach(k => seen.add(k));
  for (const k of [...OPENING, ...MIDDLE, ...FINALS]) assert.ok(seen.has(k), k);
});
test('round labels', () => {
  assert.equal(roundLabel(0, 4), 'РАУНД 1 / 4');
  assert.equal(roundLabel(3, 4), 'ГРАНД-ФИНАЛ');
});
