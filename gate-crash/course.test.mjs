import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGateCrash, gateHeight, gateOpen, ROWS, GATE, LIMIT, FINISH_Z, floorY } from './course.mjs';
import { initRacer, updateObstacleRace } from '../race-kit/obstacle-race.mjs';

const racer = (id, x, z, extra = {}) => ({ id, x, z, y: floorY(z), vx: 0, vy: 0, vz: 0, onGround: true, isPlayer: false, ...extra });

test('gates cycle between down and up, faster in later rows; the final row alternates', () => {
  const c = createGateCrash(), [first, , , fourth] = c.rows, final = c.rows.at(-1);
  assert.ok(fourth.period < first.period);
  const heights = [];
  for (let t = 0; t < first.period; t += .05) heights.push(gateHeight(first, first.gates[0], t));
  assert.equal(Math.min(...heights), 0); assert.equal(Math.max(...heights), GATE.height);
  for (let t = 0; t < final.period; t += .25) {
    const open = final.gates.map(g => gateOpen(final, g, t));
    if (open[0] !== open[1]) assert.equal(open[0], open[2]);
  }
});

test('a raised gate stops a racer and throws it back; a lowered one lets it through', () => {
  const c = createGateCrash(), row = c.rows[0], g = row.gates[2];
  const closedAt = [...Array(200).keys()].map(i => i * .05).find(t => gateHeight(row, g, t) === GATE.height && gateHeight(row, g, t + .6) === GATE.height);
  c.time = closedAt - 1 / 60; c.advance(1 / 60);
  const a = racer('player', g.x, row.z - 1.6, { isPlayer: true }); initRacer(a);
  for (let k = 0; k < 20; k++) { a.vz = 7.2; updateObstacleRace(c, [a], 1 / 60, 0); }
  assert.ok(a.z < row.z, 'blocked by the raised gate');
  const openAt = [...Array(200).keys()].map(i => i * .05).find(t => gateOpen(row, g, t) && gateOpen(row, g, t + .8));
  c.time = openAt - 1 / 60; c.advance(1 / 60);
  const b = racer('player', g.x, row.z - 1.6, { isPlayer: true }); initRacer(b);
  for (let k = 0; k < 40; k++) { b.vz = 7.2; updateObstacleRace(c, [b], 1 / 60, 0); }
  assert.ok(b.z > row.z + .5, 'passed the lowered gate');
});

test('bots time the gates and fill the quota before the time limit', () => {
  for (const dt of [1 / 30, 1 / 60]) {
    const c = createGateCrash();
    const bots = Array.from({ length: 14 }, (_, i) => racer(`bot_${i}`, ((i % 7) - 3) * 2.2, -5 + Math.floor(i / 7) * 2));
    bots.forEach(initRacer);
    let result, t = 0;
    for (; t < LIMIT; t += dt) { result = updateObstacleRace(c, bots, dt, t, { limit: LIMIT }); if (result.done) break; }
    assert.ok(result.finished.length >= result.quota, `only ${result.finished.length} finished at dt=${dt}`);
    assert.ok(bots.every(b => b.z < FINISH_Z + 6));
  }
});
