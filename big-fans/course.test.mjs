import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COURSE, createCourseState, advanceCourse, surfaceAt, checkpointAt, respawnPosition, beamHit } from './course.mjs';
test('course has four sections and three persistent checkpoints', () => {
  assert.equal(COURSE.checkpoints.length, 3);
  let cp = checkpointAt(0, 76, 0); assert.equal(cp, 2);
  assert.equal(checkpointAt(0, 37, cp), 2);
  assert.deepEqual(respawnPosition(cp), {x: 0, z: 76, y: 0});
});
test('fans move while pads stay solid and gaps remain empty', () => {
  const state = createCourseState();
  assert.equal(surfaceAt(state, 0, 0).type, 'pad');
  assert.equal(surfaceAt(state, 30, 30), null);
  const old = state.fans[0].angle; advanceCourse(state, 1);
  assert.notEqual(state.fans[0].angle, old);
});
test('beams hit low actors but not jumping actors', () => {
  const f = createCourseState().fans.find(f => f.beam); f.beamAngle = 0;
  assert.equal(beamHit(f, {x: f.x + 2, z: f.z, y: 0, radius: .5}), true);
  assert.equal(beamHit(f, {x: f.x + 2, z: f.z, y: 1.5, radius: .5}), false);
});
