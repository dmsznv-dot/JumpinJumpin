// Shared rules for straight obstacle races (Door Dash, Gate Crash): movement, floors, box obstacles,
// contact between racers, finish quota. A course supplies the level-specific parts:
//   advance(dt)                         moving parts (doors falling, gates sliding); course.racers holds the field
//   floorAt(x, z, y)                    walkable height under a point, or null over a gap
//   solids()                            axis-aligned boxes {x1,x2,y1,y2,z1,z2} that block racers
//   onHit(actor, box, impact, nx, nz)   called when a racer runs into a box (impact = closing speed)
//   push(actor, dt)                     optional extra forces (conveyor, slope, spinning bars)
//   respawn(actor)                      position after a fall
//   finished(actor)                     true once the racer crossed the finish
//   decide(actor)                       bot input {x, z, jump} (direction scaled 0..1)
//   carry(actor, dt)                    optional: move a grounded racer with the surface under it (rings, belts)
//   stepUp                              optional: highest ledge a racer walks up without jumping (default 0.65 m)
export const SPEED = 7.2, JUMP = 12.4, GRAVITY = 30, RADIUS = .8, HEIGHT = 1.6;
const SUBSTEP = 1 / 60; // dives cover ~0.25 m per substep, less than any door or gate is thick

export function initRacer(actor) {
  Object.assign(actor, { raceFinished: false, raceBumpCooldown: 0, knockVx: actor.knockVx || 0, knockVz: actor.knockVz || 0, vy: actor.vy || 0 });
  if (!actor.radius) actor.radius = RADIUS;
}

// Circle (racer footprint) against a box in the XZ plane; returns the push-out normal or null.
export function boxContact(box, x, z, r) {
  const cx = Math.max(box.x1, Math.min(box.x2, x)), cz = Math.max(box.z1, Math.min(box.z2, z));
  let dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
  if (d >= r) return null;
  if (d < 1e-6) { // centre inside the box: leave by the nearest face
    const exits = [[x - box.x1, -1, 0], [box.x2 - x, 1, 0], [z - box.z1, 0, -1], [box.z2 - z, 0, 1]].sort((a, b) => a[0] - b[0])[0];
    return { nx: exits[1], nz: exits[2], depth: exits[0] + r };
  }
  return { nx: dx / d, nz: dz / d, depth: r - d };
}

function stepOne(course, actor, dt) {
  actor.raceBumpCooldown = Math.max(0, actor.raceBumpCooldown - dt);
  if (!actor.isPlayer) {
    const d = course.decide(actor);
    const rate = Math.min(1, dt * 6);
    actor.vx += (d.x * SPEED - actor.vx) * rate;
    actor.vz += (d.z * SPEED - actor.vz) * rate;
    if (Math.hypot(d.x, d.z) > .05) actor.facing = Math.atan2(d.x, d.z);
    if (d.jump && actor.onGround) { actor.vy = JUMP; actor.onGround = false; }
  }
  if (actor.onGround) course.carry?.(actor, dt);
  course.push?.(actor, dt);
  const oldX = actor.x, oldY = actor.y, oldZ = actor.z, step = course.stepUp ?? .65;
  actor.x += (actor.vx + actor.knockVx) * dt;
  actor.z += (actor.vz + actor.knockVz) * dt;
  const decay = Math.max(0, 1 - dt * 5);
  actor.knockVx *= decay; actor.knockVz *= decay;
  actor.vy -= GRAVITY * dt;
  actor.y += actor.vy * dt;
  let floor = course.floorAt(actor.x, actor.z, oldY);
  // A surface edge more than a step above the feet is a wall (e.g. two tilted see-saws meeting): no walking into it.
  if (floor !== null && floor > oldY + step) {
    const before = course.floorAt(oldX, oldZ, oldY);
    if (before === null || before < floor - step) {
      actor.x = oldX; actor.z = oldZ; actor.vx = actor.vz = actor.knockVx = actor.knockVz = 0;
      actor.blockedAt = course.time;
      floor = before;
    }
  }
  actor.onGround = false;
  if (floor !== null && actor.vy <= 0 && oldY >= floor - step && actor.y <= floor + .15) {
    actor.y = floor; actor.vy = 0; actor.onGround = true; actor.jumpCount = 0;
  }
  for (const box of course.solids()) {
    if (actor.y >= box.y2 - .05 || actor.y + HEIGHT <= box.y1) continue;
    const c = boxContact(box, actor.x, actor.z, actor.radius);
    if (!c) continue;
    actor.x += c.nx * c.depth; actor.z += c.nz * c.depth;
    const impact = -((actor.vx + actor.knockVx) * c.nx + (actor.vz + actor.knockVz) * c.nz);
    if (impact > 0) { // stop the motion into the box
      actor.vx += impact * c.nx; actor.vz += impact * c.nz;
      course.onHit?.(actor, box, impact + (actor.isDiving ? 4 : 0), c.nx, c.nz);
    }
  }
  if (actor.y < -14) {
    Object.assign(actor, course.respawn(actor), { vx: 0, vy: 0, vz: 0, knockVx: 0, knockVz: 0, onGround: true });
  }
  if (course.finished(actor)) { actor.raceFinished = true; actor.raceFinishTime = course.time; }
}

// Advances the course and every racer; returns the race state like big-fans/race.mjs.
export function updateObstacleRace(course, actors, dt, elapsed, { limit = 180, share = .7 } = {}) {
  const steps = Math.max(1, Math.ceil(dt / SUBSTEP)), h = dt / steps;
  course.racers = actors; // courses that react to weight (see-saws) read who stands where
  for (let s = 0; s < steps; s++) {
    course.advance(h);
    for (const actor of actors) if (!actor.raceFinished) stepOne(course, actor, h);
  }
  // Soft contact after everyone moved; finished racers leave the course.
  for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) {
    const a = actors[i], b = actors[j];
    if (a.raceFinished || b.raceFinished || Math.abs(a.y - b.y) > 1.8) continue;
    let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    const min = (a.radius + b.radius) * .85;
    if (d >= min) continue;
    if (d < 1e-5) { dx = 1; dz = 0; d = 1; }
    const nx = dx / d, nz = dz / d, sep = (min - Math.min(d, min)) * .5;
    a.x -= nx * sep; a.z -= nz * sep; b.x += nx * sep; b.z += nz * sep;
    if (a.raceBumpCooldown <= 0 && b.raceBumpCooldown <= 0) {
      const impulse = Math.min(3, 1.1 + Math.max(0, (a.vx - b.vx) * nx + (a.vz - b.vz) * nz) * .15);
      a.knockVx -= nx * impulse; a.knockVz -= nz * impulse; b.knockVx += nx * impulse; b.knockVz += nz * impulse;
      a.squash = Math.max(a.squash || 0, .1); b.squash = Math.max(b.squash || 0, .1);
      a.raceBumpCooldown = b.raceBumpCooldown = .22;
    }
  }
  const finished = actors.filter(a => a.raceFinished).sort((a, b) => a.raceFinishTime - b.raceFinishTime);
  const quota = Math.max(1, Math.ceil(actors.length * share));
  return { finished, quota, done: finished.length >= quota || elapsed >= limit };
}

export function botNumber(actor) { return Number(String(actor.id || '').replace(/\D/g, '')) || 0; }
export function skillOf(actor) { return actor.botSkill ?? Math.max(.55, 1 - botNumber(actor) * .03); }
// Unit-ish steering toward a point, easing in over the last metre.
export function steerTo(actor, x, z, pace = 1) {
  const dx = x - actor.x, dz = z - actor.z, d = Math.hypot(dx, dz);
  if (d < .12) return { x: 0, z: 0 };
  const k = Math.min(pace, d / 1.0) / d;
  return { x: dx * k, z: dz * k };
}
