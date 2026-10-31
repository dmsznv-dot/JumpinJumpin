// Roll Out: five counter-rotating drums. Angle zero is the top of a drum.
// SCALE: drums are 1.5× their first version relative to the 1.6 m cube; their spin is divided by SCALE so the
// surface still moves under the racers at the same speed.
export const SCALE = 1.5;
export const RADIUS = 10 * SCALE;
export const RING_WIDTH = 5.4 * SCALE;
export const SECTORS = 16;
export const LIMIT = 120; // round length: the drums reach full speed at 90 s, the last 30 s are the crunch
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
    x:(i-2)*RING_WIDTH, angle:i*.03, speed:(i%2 ? -1 : 1)*.20/SCALE})) };
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
  const crossed = (previousZ-wallZ)*(actor.z-wallZ) <= 0;
  if (Math.abs(surface.wallAngle) > 1.15 || (!crossed && Math.abs(actor.z-wallZ) > .55)) return false;
  actor.z = wallZ + (previousZ <= wallZ ? -.58 : .58);
  actor.vz *= -.2;
  return true;
}
// Bots try a few moves against the predicted drums (gaps, walls, speed-up) and keep the safest one.
const BOT_STEP = 1 / 20, BOT_HORIZON = 1.3;
function ghostAfter(course, steps) {
  const ghost = { time: course.time, rings: course.rings.map(r => ({...r})) };
  const frames = [ghost];
  for (let k = 1; k <= steps; k++) { const g = { time: frames[k-1].time, rings: frames[k-1].rings.map(r => ({...r})) }; advanceRollout(g, BOT_STEP); frames.push(g); }
  return frames;
}
let botForecast = { course: null, time: NaN, frames: null };
function simulateBot(frames, actor, vx, vz, jumpAt) {
  const a = { x: actor.x, y: actor.y ?? 0, z: actor.z, vx: actor.vx || 0, vz: actor.vz || 0, vy: actor.vy || 0, onGround: actor.onGround };
  const blend = 1 - Math.exp(-7 * BOT_STEP);
  let walls = 0;
  for (let k = 0; k < frames.length - 1; k++) {
    const t = k * BOT_STEP, course = frames[k];
    if (jumpAt !== null && t >= jumpAt && a.onGround) { a.vy = 12.4; a.onGround = false; jumpAt = null; }
    a.vx += (vx - a.vx) * blend; a.vz += (vz - a.vz) * blend;
    carryRacer(course, a, BOT_STEP);
    const oldY = a.y, oldZ = a.z;
    a.x += a.vx * BOT_STEP; a.z += a.vz * BOT_STEP; a.vy -= 30 * BOT_STEP; a.y += a.vy * BOT_STEP;
    const surface = sampleSurface(frames[k+1], a.x, a.z); a.onGround = false;
    if (surface && a.vy <= 0 && oldY >= surface.y - .65 && a.y <= surface.y + .08) { a.y = surface.y; a.vy = 0; a.onGround = true; }
    if (hitWall(surface, a, oldZ)) walls++;
    if (a.y < -3.5) return { fell: t };
  }
  return { x: a.x, z: a.z, walls, onGround: a.onGround };
}
export function botDecision(course, actor) {
  const id = Number(String(actor.id || '').replace(/\D/g,'')) || 0;
  const skill = actor.botSkill ?? Math.max(.55, 1 - id * .03);
  const plan = actor.rollPlan;
  if (plan && course.time < plan.until) {
    const jump = plan.jumpAt !== null && course.time >= plan.jumpAt && actor.onGround;
    if (jump) plan.jumpAt = null;
    return { vx: plan.vx, vz: plan.vz, jump };
  }
  if (botForecast.course !== course || botForecast.time !== course.time) botForecast = { course, time: course.time, frames: ghostAfter(course, Math.ceil(BOT_HORIZON / BOT_STEP)) };
  const speed = 6.2 + skill * 1.0, homeX = Math.round(actor.x / RING_WIDTH) * RING_WIDTH;
  let best = null;
  for (const sx of [-1, 0, 1]) for (const vz of [-speed, -speed * .45, 0, speed * .45, speed]) for (const jumpAt of actor.onGround ? [null, 0, .3] : [null]) {
    const x = Math.max(-RING_WIDTH * 2, Math.min(RING_WIDTH * 2, homeX + sx * RING_WIDTH));
    const vx = Math.max(-speed, Math.min(speed, (x - actor.x) * 3));
    const end = simulateBot(botForecast.frames, actor, vx, vz, jumpAt);
    let score;
    if (end.fell !== undefined) score = -100 + end.fell * 30;
    // Stay near the top of the drum, away from the steep sides, and only hop when it helps.
    else score = -Math.abs(end.z) * 1.2 - end.walls * 4 - (jumpAt !== null ? 1 : 0) - (sx ? .8 : 0) - (end.onGround ? 0 : 2) - Math.max(0, Math.abs(end.x) - RING_WIDTH * 2.2) * 6;
    if (plan && plan.sx === sx && plan.vzKey === vz) score += .8;
    score += (Math.random() - .5) * (1 - skill) * 16;
    if (!best || score > best.score) best = { score, vx, vz, vzKey: vz, sx, jumpAt };
  }
  if (best.jumpAt !== null) best.jumpAt += course.time;
  actor.rollPlan = { ...best, until: course.time + .07 + (1 - skill) * .25 };
  const jump = best.jumpAt !== null && best.jumpAt <= course.time && actor.onGround;
  if (jump) actor.rollPlan.jumpAt = null;
  return { vx: best.vx, vz: best.vz, jump };
}
