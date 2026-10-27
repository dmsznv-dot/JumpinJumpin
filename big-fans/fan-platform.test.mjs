import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fanSurfaceAt, advanceFan, carryByFan } from './fan-platform.mjs';
const fan = () => ({ x: 1, z: 2, angle: 0, angularSpeed: Math.PI / 2, radius: 5, hubRadius: 1, blades: 4, innerHalfWidth: .4, outerHalfWidth: .8 });
test('hub, blade, gap and outer edge provide distinct support', () => {
  const f = fan();
  assert.equal(fanSurfaceAt(f, 1, 2).part, 'hub');
  assert.equal(fanSurfaceAt(f, 4, 2).part, 'blade');
  assert.equal(fanSurfaceAt(f, 3, 4), null);
  assert.equal(fanSurfaceAt(f, 7, 2), null);
});
test('rotation changes blade support consistently with the carried actor', () => {
  const f = fan();
  const p = carryByFan(f, 4, 2, 1);
  advanceFan(f, 1);
  assert.ok(Math.abs(p.x - 1) < 1e-9);
  assert.ok(Math.abs(p.z - 5) < 1e-9);
  assert.equal(fanSurfaceAt(f, p.x, p.z).part, 'blade');
  assert.equal(fanSurfaceAt(f, 3, 4), null);
});
test('reverse rotation carries in the opposite direction', () => {
  const f = fan(); f.angularSpeed *= -1;
  const p = carryByFan(f, 4, 2, 1);
  assert.ok(Math.abs(p.z + 1) < 1e-9);
});
