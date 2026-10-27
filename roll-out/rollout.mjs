// Roll Out: five counter-rotating drums. Angle zero is the top of a drum.
export const RADIUS = 8;
export const RING_WIDTH = 4.4;
export const SECTORS = 16;
export const RINGS = [
  { gap: 5, wall: 11 }, { gap: 10, wall: 3 }, { gap: 7, wall: 13 },
  { gap: 3, wall: 9 }, { gap: 12, wall: 5 }
];
const TAU = Math.PI * 2;
const sectorAngle = TAU / SECTORS;
const wrap = x => ((x % TAU) + TAU) % TAU;
export function createRollout() {
  return { time: 0, rings: RINGS.map((spec, i) => ({...spec, index:i,
    x:(i-2)*RING_WIDTH, angle:i*.21, speed:(i%2 ? -1 : 1)*.20})) };
}
export function advanceRollout(course, dt) {
  course.time += dt;
  const speedup = 1 + Math.min(course.time / 150, 1) * .45;
  for (const ring of course.rings) ring.angle += ring.speed * speedup * dt;
}
export function ringAt(course, x) {
  const index = Math.floor((x + RING_WIDTH * 2.5) / RING_WIDTH);
  return course.rings[index] || null;
}
export function sampleSurface(course, x, z) {
  const ring = ringAt(course, x);
  if (!ring || Math.abs(z) >= RADIUS * .94) return null;
  const angle = Math.asin(z / RADIUS);
  const local = wrap(angle - ring.angle);
  const sector = Math.floor(local / sectorAngle);
  if (sector === ring.gap) return null;
  const y = -RADIUS + Math.sqrt(RADIUS*RADIUS-z*z);
  const wallAngle = wrap((ring.wall+.5)*sectorAngle + ring.angle + Math.PI) - Math.PI;
  return { ring, y, angle, wallAngle };
}
export function carryRacer(course, actor, dt) {
  const surface = sampleSurface(course, actor.x, actor.z);
  if (!surface || !actor.onGround) return;
  const speedup = 1 + Math.min(course.time / 150, 1)*.45;
  const angle = surface.angle + surface.ring.speed * speedup * dt;
  actor.z = RADIUS*Math.sin(angle);
  actor.y = -RADIUS + RADIUS*Math.cos(angle);
}
export function hitWall(surface, actor, previousZ) {
  if (!surface || actor.y > surface.y + 1.5) return false;
  const wallZ = RADIUS * Math.sin(surface.wallAngle);
  if (Math.abs(surface.wallAngle) > 1.15 || Math.abs(actor.z-wallZ) > .55) return false;
  actor.z = wallZ + (previousZ <= wallZ ? -.58 : .58);
  actor.vz *= -.2;
  return true;
}
export function botDecision(course, actor) {
  // Look ahead on the rotating ring; move across to a safer neighbour when a gap approaches.
  const speedup = 1 + Math.min(course.time/150,1)*.45;
  const probe = {rings:course.rings.map(r => ({...r,angle:r.angle+r.speed*speedup*1.1}))};
  const candidates = [-1,0,1].map(step => {
    const x = Math.max(-RING_WIDTH*2.35, Math.min(RING_WIDTH*2.35, actor.x + step*RING_WIDTH*.8));
    const f = sampleSurface(probe,x,actor.z);
    return {step,x,score:f ? 3-Math.abs(f.wallAngle)*.1 : -5};
  });
  const current = candidates[1];
  let best = current.score > 0 ? current : candidates.reduce((a,b) => b.score>a.score ? b:a);
  let vx = best.step ? Math.sign(best.x-actor.x)*5 : 0;
  let vz = Math.abs(actor.z)>2.3 ? -Math.sign(actor.z)*3.8 : 0;
  const currentSurface = sampleSurface(course,actor.x,actor.z);
  const jump = !!currentSurface && Math.abs(currentSurface.wallAngle-currentSurface.angle)<.20 && actor.onGround;
  return {vx,vz,jump};
}
