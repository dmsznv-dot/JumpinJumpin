// Roll Out: five counter-rotating drums. Angle zero is the top of a drum.
export const RADIUS = 10;
export const RING_WIDTH = 5.4;
export const SECTORS = 16;
export const RINGS = [
  { gap: 5, wall: 11 }, { gap: 10, wall: 3 }, { gap: 7, wall: 13 },
  { gap: 3, wall: 9 }, { gap: 12, wall: 5 }
];
const TAU = Math.PI * 2;
const sectorAngle = TAU / SECTORS;
export const speedMultiplier = time => 1 + Math.min(Math.max(time, 0) / 90, 1) * 1.2;
const wrap = x => ((x % TAU) + TAU) % TAU;
export function createRollout() {
  return { time: 0, rings: RINGS.map((spec, i) => ({...spec, index:i,
    x:(i-2)*RING_WIDTH, angle:i*.03, speed:(i%2 ? -1 : 1)*.20})) };
}
export function advanceRollout(course, dt) {
  course.time += dt;
  const speedup = speedMultiplier(course.time);
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
  if (sector === ring.gap || sector === (ring.gap + 1) % SECTORS) return null;
  const y = -RADIUS + Math.sqrt(RADIUS*RADIUS-z*z);
  const wallAngle = wrap((ring.wall+.5)*sectorAngle + ring.angle + Math.PI) - Math.PI;
  return { ring, y, angle, wallAngle };
}
export function carryRacer(course, actor, dt) {
  const surface = sampleSurface(course, actor.x, actor.z);
  if (!surface || !actor.onGround) return;
  const speedup = speedMultiplier(course.time);
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
  const speedup = speedMultiplier(course.time);
  const probe = {rings:course.rings.map(r => ({...r,angle:r.angle+r.speed*speedup*1.1}))};
  const candidates = [-1,0,1].map(step => {
    const x = Math.max(-RING_WIDTH*2.35, Math.min(RING_WIDTH*2.35, actor.x + step*RING_WIDTH*.8));
    const f = sampleSurface(probe,x,actor.z);
    return {step,x,score:f ? 3-Math.abs(f.wallAngle)*.1 : -5};
  });
  const id = Number(String(actor.id || '').replace(/\D/g,'')) || 0;
  // Change lanes periodically; retain a safe current surface if the next lane has a gap.
  const preferred = Math.sin(course.time*.32 + id*1.7) > 0 ? 2 : 0;
  const selected = candidates[preferred].score > 0 ? candidates[preferred]
    : candidates[1].score > 0 ? candidates[1] : candidates.reduce((a,b) => b.score>a.score ? b:a);
  const vx = selected.step ? Math.sign(selected.x-actor.x)*4.2 : 0;
  const targetZ = Math.sin(course.time*.22 + id*1.31)*2.3;
  const vz = Math.max(-4,Math.min(4,(targetZ-actor.z)*1.4));
  const currentSurface = sampleSurface(course,actor.x,actor.z);
  const wallNear = !!currentSurface && Math.abs(currentSurface.wallAngle-currentSurface.angle)<.20;
  const hopDue = course.time >= (actor.rollNextJump ?? (4 + id*.37));
  const jump = actor.onGround && (wallNear || (hopDue && !!currentSurface && Math.abs(actor.z)<RADIUS*.5));
  if (jump) actor.rollNextJump = course.time + 5 + (id%4);
  return {vx,vz,jump};
}
