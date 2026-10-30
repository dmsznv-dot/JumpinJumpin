import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRollOn, LIMIT, FINISH_Z, RING, LAYOUT } from './course.mjs';
import { initRacer, updateObstacleRace } from '../race-kit/obstacle-race.mjs';

const racer = (id, x, z, extra = {}) => ({ id, x, z, y: 0, vx: 0, vy: 0, vz: 0, onGround: true, isPlayer: false, ...extra });

test('sections as in the show: 3, 4 and 6 rings (the last stepping down), two drums and a swinging platform', () => {
  const count = s => LAYOUT.rings.filter(r => r.section === s).length;
  assert.deepEqual([count(0), count(1), count(2)], [3, 4, 6]);
  const stairs = LAYOUT.rings.filter(r => r.section === 2);
  assert.ok(stairs.every((r, i) => i === 0 || r.y < stairs[i - 1].y));
  assert.equal(LAYOUT.drums.length, 2);
  assert.ok(LAYOUT.swing.z2 < FINISH_Z);
});

test('a ring carries a standing racer sideways and its hole drops them', () => {
  const c = createRollOn(), r = c.rings[0];
  const a = racer('player', 0, r.z, { isPlayer: true }); initRacer(a); a.y = c.floorAt(0, r.z) ?? 0;
  const x0 = a.x;
  for (let k = 0; k < 30; k++) { a.vx = a.vz = 0; updateObstacleRace(c, [a], 1 / 60, k / 60); }
  assert.ok(Math.abs(a.x - x0) > .3, 'carried sideways');
  // Over the hole there is no floor.
  const holeAngle = (r.hole + 1) * Math.PI * 2 / RING.sectors + r.angle;
  const hx = RING.radius * Math.sin(((holeAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
  if (Math.abs(hx) < RING.walk) assert.equal(c.floorAt(hx, r.z), null);
});

test('a field of bots fills the quota before the 2:00 limit', () => {
  for (const dt of [1 / 30, 1 / 60]) {
    const c = createRollOn();
    const bots = Array.from({ length: 14 }, (_, i) => racer(`bot_${i}`, ((i % 7) - 3) * 1.8, -5 + Math.floor(i / 7) * 2));
    bots.forEach(initRacer);
    let result, t = 0;
    for (; t < LIMIT; t += dt) { result = updateObstacleRace(c, bots, dt, t, { limit: LIMIT }); if (result.done) break; }
    assert.ok(result.finished.length >= result.quota, `only ${result.finished.length} finished at dt=${dt}; z: ${bots.map(b => b.z.toFixed(0)).join(',')}`);
  }
});
