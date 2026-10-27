import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  courseY,
  slimeY,
  surface,
  LENGTH,
  LIMIT,
  FINISH_Y,
  obstaclesAt,
  botDecision,
  createCourse,
  advanceCourse,
  obstacleContact,
  WAYPOINTS,
  pusherExtension
} from './course.mjs';

test('slime rises to summit by the time limit', () => {
  assert.ok(slimeY(0) < 0);
  assert.ok(slimeY(LIMIT) >= FINISH_Y);
});

test('stepped stairs and multi-tier surface support exact heights', () => {
  // Start pad
  assert.equal(surface(0, 0, 0), 0);
  // Real stepped stairs (step 1 at z=21, step 3 at z=25, step 6 at z=31)
  assert.equal(surface(0, 21, 0.8), 0.8);
  assert.ok(Math.abs(surface(0, 25, 2.4) - 2.4) < 1e-5);
  assert.equal(surface(0, 31, 4.8), 4.8);
  // Floor 1 pushers
  assert.equal(surface(0, 36, 4.8), 4.8);
  // Rotating logs top surface at z=61.5
  const logTopY = surface(7, 61.5, 12.0);
  assert.ok(logTopY !== null && logTopY >= 12.4);
  // Recovery pit underneath the rotating logs
  const pitY = surface(7, 61.5, 9.8);
  assert.equal(pitY, 9.8);
  // Floor 5 summit
  assert.equal(surface(0, 125, 26.0), 26.0);
  // Off-track abyss should return null
  assert.equal(surface(35, 50, 8.0), null);
});

test('pushers use snappy punch-out motion', () => {
  const ext0 = pusherExtension(0.2);
  const extPunch = pusherExtension(0.75);
  const extHold = pusherExtension(0.95);
  assert.equal(ext0, 0);
  assert.ok(extPunch > 0.5);
  assert.equal(extHold, 1.0);
});

test('giant boulder triggers only when contestants step on Floor 2 ramp', () => {
  const c = createCourse();
  assert.equal(c.boulder.active, false);

  // Far away contestants -> no trigger
  advanceCourse(c, 0.1, [{ alive: true, x: 0, z: 10, y: 0 }]);
  assert.equal(c.boulder.active, false);

  // Contestant on Floor 1 pushers -> still no trigger!
  advanceCourse(c, 0.1, [{ alive: true, x: -1, z: 36, y: 4.8 }]);
  assert.equal(c.boulder.active, false);

  // Contestant steps onto Floor 2 entrance staircase (y=5.2, z=47, x=-10) -> BOULDER TRIGGERS!
  advanceCourse(c, 0.1, [{ alive: true, x: -10, z: 47, y: 5.2 }]);
  assert.equal(c.boulder.active, true);
  assert.ok(c.boulder.progress >= 0);

  // Advance course -> boulder rolls down
  advanceCourse(c, 1.0, []);
  assert.ok(c.boulder.progress > 0.2);
  const obs = obstaclesAt(1.0, c);
  const ball = obs.find(o => o.type === 'ball');
  assert.ok(ball !== undefined);
  assert.equal(ball.isGiant, true);
});

test('bot can navigate the switchback waypoints to the summit finish', () => {
  const c = createCourse();
  const a = {
    id: 'bot_0',
    x: 0,
    z: -2,
    y: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    onGround: true,
    wpIdx: 0
  };

  let finished = false;
  for (let t = 0; t < LIMIT; t += 1 / 60) {
    const dt = 1 / 60;
    advanceCourse(c, dt, [a]);
    const d = botDecision(c, a);
    a.vx += (d.vx - a.vx) * dt * 9;
    a.vz += (d.vz - a.vz) * dt * 9;
    if (d.jump && a.onGround) {
      a.vy = 12.0;
      a.onGround = false;
    }

    const oldY = a.y;
    a.x += a.vx * dt;
    a.z += a.vz * dt;
    a.vy -= 30 * dt;
    a.y += a.vy * dt;

    const floor = surface(a.x, a.z, a.y);
    a.onGround = false;
    if (floor !== null && a.vy <= 0 && oldY >= floor - 1.5 && a.y <= floor + 0.35) {
      a.y = floor;
      a.vy = 0;
      a.onGround = true;
    } else if (floor !== null && oldY >= floor - 1.5 && a.y < floor) {
      a.y = floor;
      a.vy = 0;
      a.onGround = true;
    }

    if (a.z >= 120 && a.y >= FINISH_Y - 1.0) {
      finished = true;
      break;
    }

    if (a.y <= slimeY(t)) {
      break;
    }
  }

  assert.ok(finished, `bot failed to finish: z=${a.z.toFixed(1)}, y=${a.y.toFixed(1)}, x=${a.x.toFixed(1)}`);
});
