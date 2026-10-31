import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeeSaw, LIMIT, MAX_TILT, FINISH_Z, plankY, LAYOUT } from './course.mjs';
import { initRacer, updateObstacleRace } from '../race-kit/obstacle-race.mjs';

const racer = (id, x, z, extra = {}) => ({ id, x, z, y: 0, vx: 0, vy: 0, vz: 0, onGround: true, isPlayer: false, ...extra });

test('big see-saws lie across the course; after the 2nd checkpoint they meet side by side and row to row', () => {
  const rows = s => new Set(LAYOUT.planks.filter(p => p.section === s).map(p => p.row)).size;
  assert.deepEqual([rows(0), rows(1), rows(2)], [4, 5, 7]);
  for (const p of LAYOUT.planks) assert.ok(p.length >= 18 && p.length > p.depth, 'long side runs across the course');
  assert.ok(LAYOUT.planks.filter(p => p.section < 2).every(p => !p.joined), 'early sections have gaps between rows');
  const late = LAYOUT.planks.filter(p => p.section === 2);
  assert.ok(late.some(p => p.joined), 'some rows touch the row before');
  const pairs = late.filter(p => late.some(q => q !== p && q.row === p.row));
  assert.ok(pairs.length >= 2 && pairs.every(p => Math.abs(Math.abs(p.x) - p.length / 2) < .2), 'two see-saws edge to edge in a row');
  assert.ok(FINISH_Z > 240);
});

test('one racer near an end rolls the see-saw toward them; past the limit they slide off the low side', () => {
  const c = createSeeSaw(), p = c.planks[0];
  const a = racer('player', p.x + p.length / 2 - 2, p.z, { isPlayer: true }); initRacer(a);
  let peak = 0, lowest = 0;
  for (let t = 0; t < 3; t += 1 / 60) { a.vx = a.vz = 0; updateObstacleRace(c, [a], 1 / 60, t); peak = Math.max(peak, p.angle); lowest = Math.min(lowest, a.y); }
  assert.ok(peak > MAX_TILT * .95, `peak angle ${peak.toFixed(2)}`);
  assert.ok(lowest < -10, 'slid off the low end into the slime');
  assert.equal(a.z, (c.pads[0].z1 + c.pads[0].z2) / 2 + ((0 % 3) - 1) * 1.2, 'respawned on the start pad');
});

test('a tilted neighbour edge higher than a step is a ledge: walking stops, a jump gets over', () => {
  const c = createSeeSaw();
  // A single see-saw that touches the row before it, and the plank of that row under the same x.
  const back = c.planks.find(p => p.joined && !c.planks.some(q => q !== p && q.row === p.row));
  const x = back.x + back.length / 2 - 3;
  const front = c.planks.find(p => p.row === back.row - 1 && Math.abs(x - p.x) <= p.length / 2);
  back.angle = -MAX_TILT; back.spin = 0; // +x side of the back plank up
  const a = racer('player', x, back.z - back.depth / 2 - 1, { isPlayer: true }); initRacer(a);
  a.y = plankY(front, x);
  // Hold the planks still: only the ledge matters here.
  const hold = () => { back.angle = -MAX_TILT; back.spin = 0; front.angle = 0; front.spin = 0; };
  assert.ok(plankY(back, x) - a.y > c.stepUp, 'the set-up really is a ledge');
  for (let k = 0; k < 30; k++) { hold(); a.vz = 7.2; updateObstacleRace(c, [a], 1 / 60, k / 60); }
  assert.ok(a.z < back.z - back.depth / 2 + .01, 'blocked by the ledge');
});

test('a field of bots fills the quota before the 3:00 limit', () => {
  for (const dt of [1 / 30, 1 / 60]) {
    const c = createSeeSaw();
    const bots = Array.from({ length: 14 }, (_, i) => racer(`bot_${i}`, ((i % 7) - 3) * 2.6, -5 + Math.floor(i / 7) * 2));
    bots.forEach(initRacer);
    let result, t = 0;
    for (; t < LIMIT; t += dt) { result = updateObstacleRace(c, bots, dt, t, { limit: LIMIT }); if (result.done) break; }
    assert.ok(result.finished.length >= result.quota, `only ${result.finished.length} finished at dt=${dt}; z: ${bots.map(b => b.z.toFixed(0))}`);
  }
});
