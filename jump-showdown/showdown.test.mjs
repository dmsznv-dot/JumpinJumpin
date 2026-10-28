import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NUM_SECTORS,
  INNER_RADIUS,
  OUTER_RADIUS,
  createShowdown,
  advanceShowdown,
  sampleSurface,
  checkSweeperHit,
  botDecision,
  getSectorAt,
  getRemainingSectors,
  speedMultiplier
} from './showdown.mjs';

test('arena has 8 distinct sectors with solid surfaces and slit gaps', () => {
  const c = createShowdown();
  assert.equal(c.sectors.length, NUM_SECTORS);

  // Center hole has no surface
  assert.equal(sampleSurface(c, 0, 0), null);
  // Outside perimeter has no surface
  assert.equal(sampleSurface(c, 30, 0), null);

  // Sector 0 center (at midAngle)
  const mid0 = c.sectors[0].angleMid;
  const surf0 = sampleSurface(c, Math.cos(mid0) * 9.0, Math.sin(mid0) * 9.0);
  assert.ok(surf0 !== null);
  assert.equal(surf0.sector.index, 0);
  assert.equal(surf0.y, 0);

  // Check all 8 sectors have walkable surfaces at mid-angle
  for (let i = 0; i < NUM_SECTORS; i++) {
    const midAngle = c.sectors[i].angleMid;
    const x = Math.cos(midAngle) * 9.0;
    const z = Math.sin(midAngle) * 9.0;
    const s = sampleSurface(c, x, z);
    assert.ok(s !== null, `sector ${i} mid surface should be walkable`);
    assert.equal(s.sector.index, i);
  }
});

test('sweepers rotate and speed up progressively', () => {
  const c = createShowdown();
  const initLowOmega = c.lowBar.omega;
  const initAngle = c.lowBar.angle;

  advanceShowdown(c, 1.0);
  assert.ok(c.lowBar.angle > initAngle);

  // Advance to t = 100s
  advanceShowdown(c, 99.0);
  assert.ok(c.lowBar.omega > initLowOmega * 1.5, 'sweepers should accelerate over time');
  assert.ok(c.highBar.omega > c.lowBar.omega, 'high bar has different speed to create dynamic overlaps');
});

test('sectors shake in warning, drop into slime, leaving at least 2 safe sectors', () => {
  const c = createShowdown();
  assert.equal(getRemainingSectors(c).length, 8);

  // Advance to t = 14s (drop 1 triggered at 12s)
  advanceShowdown(c, 14.0);
  const warningSectors = c.sectors.filter(s => s.state === 'warning' || s.state === 'falling' || s.state === 'dropped');
  assert.ok(warningSectors.length >= 1, 'first sector warning should be active');

  // Advance through entire drop schedule
  advanceShowdown(c, 120.0);
  const remaining = getRemainingSectors(c);
  assert.ok(remaining.length >= 2, `at least 2 sectors must remain safe (got ${remaining.length})`);
});

test('sweeper collisions: low bar requires jumping, high bar requires staying low', () => {
  const c = createShowdown();
  // Align lowBar angle to 0 (pointing along +X)
  c.lowBar.angle = 0;
  c.highBar.angle = Math.PI; // highBar points in opposite direction

  // Actor standing on ground on low bar's path (x=9, z=0, y=0) -> HIT BY LOW BAR!
  const actorLowGrounded = { x: 9, z: 0, y: 0, radius: 0.8, alive: true };
  const hitLow = checkSweeperHit(c, actorLowGrounded);
  assert.ok(hitLow !== null);
  assert.equal(hitLow.bar, 'low');
  assert.ok(hitLow.knockVz > 0, 'tangential knockback along bar rotation');

  // Actor jumping cleanly over low bar (x=9, z=0, y=1.35) -> NO HIT!
  const actorLowJumping = { x: 9, z: 0, y: 1.35, radius: 0.8, alive: true };
  assert.equal(checkSweeperHit(c, actorLowJumping), null);

  // Now test high bar: point highBar to 0
  c.highBar.angle = 0;
  c.lowBar.angle = Math.PI;

  // Actor on ground under high bar (x=9, z=0, y=0) -> DUCKS UNDER SAFELY!
  assert.equal(checkSweeperHit(c, actorLowGrounded), null);

  // Actor jumping in mid-air under high bar (x=9, z=0, y=2.0) -> HIT BY HIGH OVERHEAD ARM!
  const actorHighJumping = { x: 9, z: 0, y: 2.0, radius: 0.8, alive: true };
  const hitHigh = checkSweeperHit(c, actorHighJumping);
  assert.ok(hitHigh !== null);
  assert.equal(hitHigh.bar, 'high');
});

test('fast sweeper catches actors between its previous and current positions', () => {
  const c = createShowdown();
  c.highBar.angle = Math.PI;
  c.lowBar.angle = 0;
  advanceShowdown(c, 0.3);
  const theta = c.lowBar.angle / 2;
  for (const id of ['player', 'bot_0']) {
    const actor = { id, x: 12 * Math.cos(theta), z: 12 * Math.sin(theta), y: 0, radius: .8, alive: true };
    assert.equal(checkSweeperHit(c, actor)?.bar, 'low');
  }
});

test('bot AI evacuates shaking sectors and jumps approaching sweepers', () => {
  const c = createShowdown();

  // Test 1: Bot on shaking sector evacuates to adjacent solid sector
  c.sectors[0].state = 'warning';
  c.sectors[0].warningTimer = 3.0;
  const botOnWarning = { id: 'bot_0', x: 9.0, z: 0.0, y: 0, onGround: true, radius: 0.8 };
  const dEvac = botDecision(c, botOnWarning);
  assert.ok(Math.hypot(dEvac.vx, dEvac.vz) > 4.0, 'bot should run away from warning sector');

  // Test 2: Low bar approaches safe bot -> bot triggers jump
  c.sectors[0].state = 'solid';
  // Bot at theta = 0.2 rad, low bar at theta = 0.0 rad, omega = 1.0 rad/s => timeToLow = 0.2s
  c.lowBar.angle = 0.0;
  c.lowBar.omega = 1.0;
  c.highBar.angle = Math.PI; // no overlap danger
  const botSafe = { id: 'bot_0', x: 9.0 * Math.cos(0.2), z: 9.0 * Math.sin(0.2), y: 0, onGround: true, radius: 0.8 };
  const dJump = botDecision(c, botSafe);
  assert.equal(dJump.jump, true, 'bot should jump when lower sweeper approaches');
});

