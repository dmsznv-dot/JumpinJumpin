import { COURSE, padContains, surfaceAt, SCALE } from './course.mjs';
import { fanSurfaceAt } from './fan-platform.mjs';

// A central route leaves side fans available as alternative paths for players.
const ROUTE = [
  {x:-6,z:11.5}, {x:0,z:23}, {x:0,z:37},
  {x:0,z:48}, {x:0,z:64}, {x:0,z:76},
  {x:0,z:87}, {x:-6,z:99}, {x:0,z:110}, {x:0,z:119.5},
  {x:-6,z:132}, {x:0,z:145}, {x:0,z:158}
].map(p => ({ x: p.x * SCALE, z: p.z * SCALE }));
const PADS = [COURSE.start, ...COURSE.checkpoints, COURSE.finish];
const SPEED = 7.2, JUMP = 12.4, GRAVITY = 30, STEP = 1 / 15;
// Headings tried relative to the waypoint direction; null = stand still and let the fan carry the bot.
const EDGE = -1; // jumpAt value: run on and jump at the last moment before the surface ends
const HEADINGS = [0, .35, -.35, .75, -.75, 1.25, -1.25, 2.0, -2.0, Math.PI];

export function resetBotRoute(actor) {
  const checkpointZ = actor.checkpoint > 0 ? COURSE.checkpoints[actor.checkpoint-1].z : 0;
  actor.raceWaypoint = ROUTE.findIndex(p => p.z > checkpointZ + 1);
  if (actor.raceWaypoint < 0) actor.raceWaypoint = ROUTE.length - 1;
  actor.racePlan = null; actor.raceBestZ = undefined;
}
function botNumber(actor) { return Number(String(actor.id || '').replace(/\D/g, '')) || 0; }
// 0 — clumsy, 1 — sees every blade coming. The game sets botSkill from the difficulty; tests use a spread by id.
function skillOf(actor) { return actor.botSkill ?? Math.max(.55, 1 - botNumber(actor) * .03); }

function surfaceAtTime(fans, x, z, t) {
  for (const pad of PADS) if (padContains(pad, x, z)) return true;
  for (const fan of fans) {
    const dx = x - fan.x, dz = z - fan.z;
    if (dx*dx + dz*dz > fan.radius*fan.radius) continue;
    if (fanSurfaceAt({...fan, angle: fan.angle + fan.angularSpeed * t}, x, z)) return fan;
  }
  return null;
}
function beamAtTime(fans, x, z, y, t, radius) {
  if (y > 1) return false;
  for (const fan of fans) {
    if (!fan.beam) continue;
    const a = fan.beamAngle + fan.beamSpeed * t, dx = x - fan.x, dz = z - fan.z;
    if (Math.abs(dx*Math.cos(a) + dz*Math.sin(a)) <= fan.radius && Math.abs(-dx*Math.sin(a) + dz*Math.cos(a)) <= .6 + radius) return true;
  }
  return false;
}
// Steers to an aim point and stops there, as the bot will. Returns where it ends up, or when it would fall.
function rollout(fans, actor, aimX, aimZ, jumpAt, horizon, settle, pace) {
  let x = actor.x, z = actor.z, y = actor.y || 0, vy = actor.vy || 0, vx = actor.vx || 0, vz = actor.vz || 0, grounded = actor.onGround, beam = false, end = horizon + settle;
  const blend = 1 - Math.exp(-6 * STEP);
  for (let t = 0; t < end; t += STEP) {
    const edge = jumpAt === EDGE && grounded && !surfaceAtTime(fans, x + vx * STEP * 1.5, z + vz * STEP * 1.5, t + STEP);
    if (grounded && jumpAt !== null && (edge || (jumpAt >= 0 && t >= jumpAt))) { vy = JUMP; grounded = false; jumpAt = null; }
    if (grounded) {
      const fan = surfaceAtTime(fans, x, z, t);
      if (!fan) grounded = false;
      else if (fan !== true) {
        const d = fan.angularSpeed * STEP, c = Math.cos(d), s = Math.sin(d), dx = x - fan.x, dz = z - fan.z;
        x = fan.x + dx*c - dz*s; z = fan.z + dx*s + dz*c;
      }
    }
    // After the horizon the bot just stands: a good plan must leave it somewhere it can wait.
    const [dirX, dirZ] = t < horizon ? steer(aimX - x, aimZ - z, pace) : [0, 0];
    vx += (dirX * SPEED - vx) * blend; vz += (dirZ * SPEED - vz) * blend;
    x += vx * STEP; z += vz * STEP;
    if (!grounded) {
      const oldY = y; vy -= GRAVITY * STEP; y += vy * STEP;
      if (vy <= 0 && y <= .15 && oldY >= -.65 && surfaceAtTime(fans, x, z, t + STEP)) { y = 0; vy = 0; grounded = true; }
      else if (y < -.65) return { fell: t, x, z };
    }
    if (!beam && beamAtTime(fans, x, z, y, t, actor.radius || .8)) beam = true;
    if (t >= horizon && !grounded && end < horizon + 1.5) end += STEP; // judge a jump by where it lands
  }
  return { x, z, beam };
}
// Full speed until close, then ease in so the bot can stop on a hub or blade.
function steer(dx, dz, pace) {
  const d = Math.hypot(dx, dz);
  if (d < .15) return [0, 0];
  const k = Math.min(pace, d / 1.2) / d;
  return [dx * k, dz * k];
}

export function botRaceDecision(course, actor) {
  if (!Number.isInteger(actor.raceWaypoint)) resetBotRoute(actor);
  // A waypoint counts as passed once the bot is near it or already closer to the next one than it is.
  while (actor.raceWaypoint < ROUTE.length - 1) {
    const target = ROUTE[actor.raceWaypoint], next = ROUTE[actor.raceWaypoint + 1];
    if (Math.hypot(target.x-actor.x, target.z-actor.z) >= 2 && Math.hypot(next.x-actor.x, next.z-actor.z) >= Math.hypot(next.x-target.x, next.z-target.z)) break;
    actor.raceWaypoint++; actor.racePlan = null;
  }
  const target = ROUTE[actor.raceWaypoint];
  let plan = actor.racePlan;
  if (!plan || course.time >= plan.until) plan = actor.racePlan = planMove(course, actor, target, plan);
  const [x, z] = steer(plan.aimX - actor.x, plan.aimZ - actor.z, plan.pace);
  const atEdge = plan.jumpAt === EDGE && !surfaceAt(course, actor.x + (actor.vx || 0) * .05, actor.z + (actor.vz || 0) * .05);
  const jump = actor.onGround && plan.jumpAt !== null && (atEdge || (plan.jumpAt >= 0 && course.time >= plan.jumpAt));
  if (jump) plan.jumpAt = null;
  return { x, z, jump };
}

function planMove(course, actor, target, previous) {
  const skill = skillOf(actor);
  const fans = course.fans.filter(f => Math.hypot(f.x - actor.x, f.z - actor.z) < f.radius + 12);
  // Remaining distance via this waypoint or straight to the next one, so passing through a waypoint is not punished.
  const next = ROUTE[Math.min(ROUTE.length - 1, actor.raceWaypoint + 1)], leg = Math.hypot(next.x - target.x, next.z - target.z);
  const remaining = (x, z) => Math.min(Math.hypot(target.x - x, target.z - z) + leg, Math.hypot(next.x - x, next.z - z));
  const d0 = remaining(actor.x, actor.z), base = Math.atan2(target.x - actor.x, target.z - actor.z);
  const aims = [[actor.x, actor.z, 0], [target.x, target.z, 9], [next.x, next.z, 9]];
  for (const heading of HEADINGS) if (heading !== null) for (const reach of [2.2, 4.5, 8]) aims.push([actor.x + Math.sin(base + heading) * reach, actor.z + Math.cos(base + heading) * reach, reach]);
  // Weaker bots run a little slower, react later and misjudge more (below).
  const horizon = 1, settle = .45, pace = .78 + skill * .22;
  let best = null;
  // Jumps are tried now and after a short run-up, so the bot can run to a blade tip and leap from it.
  // A bot that has not moved forward for a while gets restless and tries riskier or backward moves.
  if (actor.z > (actor.raceBestZ ?? -Infinity) + 1) { actor.raceBestZ = actor.z; actor.raceBestAt = course.time; }
  const restless = Math.min(1, Math.max(0, course.time - (actor.raceBestAt ?? course.time) - 2.5) / 4);
  for (const [aimX, aimZ, reach] of aims) for (const jumpAt of actor.onGround ? (reach >= 4 ? [null, 0, .25, .5, EDGE] : [null, 0, .25]) : [null]) {
    const end = rollout(fans, actor, aimX, aimZ, jumpAt, horizon, settle, pace);
    let score;
    if (end.fell !== undefined) score = -100 + end.fell * 20;
    else score = (d0 - remaining(end.x, end.z)) * 3 - (end.beam ? 40 : 0) - (jumpAt !== null ? .8 : 0);
    // Sticking with the previous aim stops the bot from dithering between equal options.
    if (previous && Math.hypot(previous.aimX - aimX, previous.aimZ - aimZ) < .8) score += 1.5;
    // Weaker bots misjudge distances a little, which keeps the field spread out.
    score += (Math.random() - .5) * ((1 - skill) * 14 + restless * 24) - (reach === 0 ? restless * 8 : 0);
    if (!best || score > best.score) best = { score, aimX, aimZ, jumpAt };
  }
  if (best.jumpAt > 0) best.jumpAt += course.time;
  return { ...best, pace, until: course.time + .08 + (1 - skill) * .22 };
}
