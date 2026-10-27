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
test('rotating fans have clearance at every angle', () => {
  const fans = createCourseState().fans;
  for (let i=0; i<fans.length; i++) for (let j=i+1; j<fans.length; j++) {
    const a=fans[i], b=fans[j];
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z) > a.radius+b.radius,
      `fans ${i} and ${j} intersect`);
  }
});
test('fans clear start, checkpoint and finish pads throughout rotation', () => {
  const pads=[COURSE.start,...COURSE.checkpoints,COURSE.finish];
  for (const [i, fan] of createCourseState().fans.entries()) for (const [j, pad] of pads.entries()) {
    const dx=Math.max(0,Math.abs(fan.x-pad.x)-pad.halfWidth);
    const dz=Math.max(0,Math.abs(fan.z-pad.z)-pad.halfLength);
    assert.ok(Math.hypot(dx,dz)>fan.radius,`fan ${i} overlaps pad ${j}`);
  }
});
