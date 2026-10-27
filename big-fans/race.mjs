import { COURSE, advanceCourse, surfaceAt, carryActor, checkpointAt, respawnPosition, beamHit } from './course.mjs';
import { botRaceDecision, resetBotRoute } from './bot.mjs';

export function initializeRacer(actor) {
  actor.checkpoint = 0;
  actor.raceFinished = false;
  actor.raceBeamCooldown = 0;
  actor.raceBumpCooldown = 0;
  if (!actor.isPlayer) resetBotRoute(actor);
}

// This owns race-only rules. Rendering and player input remain in the game loop.
export function updateRace(course, actors, dt, elapsed, limit = 210) {
  advanceCourse(course, dt);
  for (const actor of actors) {
    if (actor.raceFinished) continue;
    actor.raceBeamCooldown = Math.max(0, (actor.raceBeamCooldown || 0) - dt);
    actor.raceBumpCooldown = Math.max(0, (actor.raceBumpCooldown || 0) - dt);
    if (actor.onGround) {
      const carried = carryActor(surfaceAt(course, actor.x, actor.z), actor, dt);
      actor.x = carried.x; actor.z = carried.z;
    }
    if (!actor.isPlayer) {
      const decision = botRaceDecision(course, actor);
      const rate = Math.min(1, dt * 6);
      actor.vx += (decision.x * 7.2 - actor.vx) * rate;
      actor.vz += (decision.z * 7.2 - actor.vz) * rate;
      actor.facing = Math.atan2(decision.x, decision.z);
      if (decision.jump && actor.onGround) { actor.vy = 12.4; actor.onGround = false; }
    }
    const oldY = actor.y;
    actor.x += (actor.vx + (actor.knockVx || 0)) * dt;
    actor.z += (actor.vz + (actor.knockVz || 0)) * dt;
    actor.knockVx = (actor.knockVx || 0) * Math.max(0, 1 - dt * 5);
    actor.knockVz = (actor.knockVz || 0) * Math.max(0, 1 - dt * 5);
    actor.vy -= 30 * dt;
    actor.y += actor.vy * dt;
    const surface = surfaceAt(course, actor.x, actor.z);
    actor.onGround = false;
    if (surface && actor.vy <= 0 && oldY >= -0.3 && actor.y <= 0) {
      actor.y = 0; actor.vy = 0; actor.onGround = true; actor.jumpCount = 0;
    }
    if (actor.raceBeamCooldown <= 0) {
      const hit = course.fans.find(f => beamHit(f, actor));
      if (hit) {
        const direction = Math.sign(hit.beamSpeed);
        actor.knockVx = -Math.sin(hit.beamAngle) * direction * 8;
        actor.knockVz = Math.cos(hit.beamAngle) * direction * 8;
        actor.vy = 4; actor.onGround = false; actor.raceBeamCooldown = .7;
      }
    }
    if (actor.y < -10) {
      Object.assign(actor, respawnPosition(actor.checkpoint), {vx:0,vz:0,vy:0,knockVx:0,knockVz:0,onGround:true,jumpCount:0});
      if (!actor.isPlayer) {
        // Slightly different restart positions prevent bots from synchronising after a fall.
        const botNumber = Number(String(actor.id || '').replace(/\D/g, '')) || 0;
        actor.x += ((botNumber % 5) - 2) * 0.55;
        resetBotRoute(actor);
      }
    }
    actor.checkpoint = checkpointAt(actor.x, actor.z, actor.checkpoint);
    if (actor.checkpoint === 3 && Math.abs(actor.x) < COURSE.finish.halfWidth && actor.z >= COURSE.finish.z) {
      actor.raceFinished = true; actor.raceFinishTime = elapsed;
    }
  }
  // Resolve soft body contact after all racers have moved. Finished racers no longer obstruct the course.
  for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) {
    const a = actors[i], b = actors[j];
    if (!a.alive && a.alive !== undefined || !b.alive && b.alive !== undefined || a.raceFinished || b.raceFinished || Math.abs(a.y - b.y) > 1.8) continue;
    let dx = b.x - a.x, dz = b.z - a.z;
    let distance = Math.hypot(dx, dz);
    const minDistance = (a.radius + b.radius) * 0.85;
    if (distance >= minDistance) continue;
    if (distance < 1e-5) { dx = 1; dz = 0; distance = 1e-5; }
    const nx = dx / Math.hypot(dx, dz), nz = dz / Math.hypot(dx, dz);
    const separation = (minDistance - distance) * .5;
    a.x -= nx * separation; a.z -= nz * separation;
    b.x += nx * separation; b.z += nz * separation;
    if (a.raceBumpCooldown <= 0 && b.raceBumpCooldown <= 0) {
      const closing = Math.max(0, (a.vx - b.vx) * nx + (a.vz - b.vz) * nz);
      const impulse = Math.min(3.2, 1.2 + closing * .16);
      a.knockVx = (a.knockVx || 0) - nx * impulse;
      a.knockVz = (a.knockVz || 0) - nz * impulse;
      b.knockVx = (b.knockVx || 0) + nx * impulse;
      b.knockVz = (b.knockVz || 0) + nz * impulse;
      a.squash = Math.max(a.squash || 0, .10); b.squash = Math.max(b.squash || 0, .10);
      a.raceBumpCooldown = b.raceBumpCooldown = .22;
    }
  }
  const finished = actors.filter(a => a.raceFinished).sort((a,b) => a.raceFinishTime-b.raceFinishTime);
  const quota = Math.max(1, Math.ceil(actors.length * .7));
  return { finished, quota, done: finished.length >= quota || elapsed >= limit };
}
