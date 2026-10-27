import { fanSurfaceAt, advanceFan, carryByFan } from './fan-platform.mjs';

// Horizontal course from start (z=0) to finish (z=156).
// Checkpoint pads separate four sections, preserving the standard route structure.
export const COURSE = Object.freeze({
  start: { x: 0, z: 0, halfWidth: 9, halfLength: 5 },
  checkpoints: [
    { x: 0, z: 37, halfWidth: 9, halfLength: 3.5 },
    { x: 0, z: 76, halfWidth: 9, halfLength: 3.5 },
    { x: 0, z: 119.5, halfWidth: 9, halfLength: 3.5 }
  ],
  finish: { x: 0, z: 158, halfWidth: 9, halfLength: 5 },
  // Each section has a small branching path joining a larger central fan.
  fans: [
    [-6, 11.5, 5, 1], [6, 11.5, 5, -1], [0, 23, 6, 1],
    [-11.7, 48, 4.5, -1], [0, 48, 5.4, 1], [11.7, 48, 4.5, -1], [0, 64, 6, -1],
    [-10.7, 87, 4.5, 1], [0, 87, 4.5, -1], [10.7, 87, 4.5, 1], [-6, 99, 5, -1], [6, 99, 5, 1], [0, 110, 4.5, -1, true],
    [-6, 132, 5, 1, true], [6, 132, 5, -1, true], [0, 145, 6, 1, true]
  ]
});

export function createCourseState() {
  return {
    time: 0,
    fans: COURSE.fans.map(([x,z,radius,direction,beam], i) => ({
      x, z, radius: radius * 1.15, y: 0, hubRadius: 1.3, blades: 4,
      innerHalfWidth: 1.20, outerHalfWidth: 1.60,
      angle: i * 0.43, angularSpeed: direction * (0.38 + (i % 3) * 0.045),
      beam: Boolean(beam), beamAngle: i * 0.7, beamSpeed: -direction * 0.8
    }))
  };
}
export function advanceCourse(course, dt) {
  course.time += dt;
  for (const fan of course.fans) {
    advanceFan(fan, dt);
    fan.beamAngle += fan.beamSpeed * dt;
  }
}
export function padContains(pad, x, z) {
  return Math.abs(x - pad.x) <= pad.halfWidth && Math.abs(z - pad.z) <= pad.halfLength;
}
export function surfaceAt(course, x, z) {
  for (const pad of [COURSE.start, ...COURSE.checkpoints, COURSE.finish]) {
    if (padContains(pad, x, z)) return { type: 'pad', pad };
  }
  for (const fan of course.fans) {
    if (fanSurfaceAt(fan, x, z)) return { type: 'fan', fan };
  }
  return null;
}
export function carryActor(surface, actor, dt) {
  return surface?.type === 'fan' ? carryByFan(surface.fan, actor.x, actor.z, dt) : {x: actor.x, z: actor.z};
}
export function checkpointAt(x, z, current) {
  let checkpoint = current;
  COURSE.checkpoints.forEach((pad, i) => { if (padContains(pad, x, z)) checkpoint = Math.max(checkpoint, i + 1); });
  return checkpoint;
}
export function respawnPosition(checkpoint) {
  const pad = checkpoint > 0 ? COURSE.checkpoints[checkpoint - 1] : COURSE.start;
  return { x: pad.x, z: pad.z, y: 0 };
}
// Sweeper is a radial segment rotating over the fan; jumping over it avoids the hit.
export function beamHit(fan, actor) {
  if (!fan.beam || actor.y > 1.0) return false;
  const dx = actor.x - fan.x, dz = actor.z - fan.z;
  const along = dx * Math.cos(fan.beamAngle) + dz * Math.sin(fan.beamAngle);
  const across = -dx * Math.sin(fan.beamAngle) + dz * Math.cos(fan.beamAngle);
  return Math.abs(along) <= fan.radius && Math.abs(across) <= 0.6 + actor.radius;
}
