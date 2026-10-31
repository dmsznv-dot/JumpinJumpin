import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLobbyBehaviour } from './lobby-behaviour.mjs';

test('the lobby cube rests on the pedestal except in real hops, and does every action', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const b = createLobbyBehaviour(rnd), seen = new Set();
  let maxSpin = 0;
  for (let t = 0; t < 600; t += 1 / 60) {
    const s = b.update(1 / 60);
    seen.add(b.action);
    assert.ok(s.hop >= 0 && s.hop < .6, `hop ${s.hop}`);
    if (!['spin', 'bounce'].includes(b.action)) assert.equal(s.hop, 0, `${b.action} must keep the feet down`);
    if (s.hop > 0) assert.equal(s.pose, 'jump');
    if (b.action === 'spin') maxSpin = Math.max(maxSpin, s.spin);
  }
  for (const a of ['idle', 'look', 'wave', 'dance', 'spin', 'bounce', 'sit']) assert.ok(seen.has(a), `never did ${a}`);
  assert.ok(Math.abs(maxSpin - Math.PI * 2) < 1e-6, 'a spin is a full turn');
});
