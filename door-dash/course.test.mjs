import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoorDash, ROWS, FINISH_Z, LIMIT } from './course.mjs';
import { initRacer, updateObstacleRace } from '../race-kit/obstacle-race.mjs';

const racer = (id, x, z, extra = {}) => ({ id, x, z, y: 0, vx: 0, vy: 0, vz: 0, onGround: true, isPlayer: false, ...extra });

test('rows match the show: door counts and number of real doors', () => {
  const c = createDoorDash(7);
  assert.deepEqual(c.rows.map(r => r.doors.length), [7, 7, 7, 6, 5, 4, 3]);
  assert.deepEqual(c.rows.map(r => r.doors.filter(d => d.real).length), [5, 3, 2, 2, 2, 2, 1]);
  assert.notDeepEqual(createDoorDash(1).rows.map(r => r.doors.map(d => d.real)), createDoorDash(2).rows.map(r => r.doors.map(d => d.real)));
});

test('a real door breaks when run into, a fake one bounces the racer back', () => {
  const c = createDoorDash(3), row = c.rows[0];
  const real = row.doors.find(d => d.real), fake = row.doors.find(d => !d.real);
  const a = racer('player', real.x, row.z - 2, { isPlayer: true, vz: 7.2 }); initRacer(a);
  for (let t = 0; t < .6; t += 1 / 60) { a.vz = 7.2; updateObstacleRace(c, [a], 1 / 60, t); }
  assert.ok(real.broken && a.z > row.z, 'went through the real door');
  const b = racer('player', fake.x, row.z - 2, { isPlayer: true }); initRacer(b);
  for (let t = 0; t < .6; t += 1 / 60) { b.vz = 7.2; updateObstacleRace(c, [b], 1 / 60, t); }
  assert.ok(!fake.broken && b.z < row.z, 'stopped by the fake door');
});

test('walls between doors are solid even for a diving racer', () => {
  const c = createDoorDash(5), row = c.rows[6];
  const gapX = (row.doors[0].x + row.doors[1].x) / 2;
  const a = racer('player', gapX, row.z - 2, { isPlayer: true, isDiving: true }); initRacer(a);
  for (let t = 0; t < .5; t += 1 / 30) { a.vz = 13.5; updateObstacleRace(c, [a], 1 / 30, t); }
  assert.ok(a.z < row.z);
});

test('a field of bots finds the real doors and fills the quota in time', () => {
  for (const dt of [1 / 30, 1 / 60]) {
    const c = createDoorDash(11);
    const bots = Array.from({ length: 14 }, (_, i) => racer(`bot_${i}`, ((i % 7) - 3) * 2.6, -5 + Math.floor(i / 7) * 2));
    bots.forEach(initRacer);
    let result, t = 0;
    for (; t < LIMIT; t += dt) { result = updateObstacleRace(c, bots, dt, t, { limit: LIMIT }); if (result.done) break; }
    assert.ok(result.finished.length >= result.quota, `only ${result.finished.length} finished at dt=${dt}`);
    assert.ok(t < 100, `quota took ${t.toFixed(1)} s`);
    assert.ok(bots.every(b => b.z < FINISH_Z + 5));
  }
});
