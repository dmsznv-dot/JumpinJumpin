import { COURSE, advanceCourse, surfaceAt, carryActor, checkpointAt, respawnPosition, beamHit } from './course.mjs';
import { botRaceDecision, resetBotRoute } from './bot.mjs';

export function initializeRacer(actor) {
  actor.checkpoint = 0;
  actor.raceFinished = false;
  actor.raceBeamCooldown = 0;
  if (!actor.isPlayer) resetBotRoute(actor);
}

// This owns race-only rules. Rendering and player input remain in the game loop.
export function updateRace(course, actors, dt, elapsed, limit = 210) {
  advanceCourse(course, dt);
  for (const actor of actors) {
    if (actor.raceFinished) continue;
    actor.raceBeamCooldown = Math.max(0, (actor.raceBeamCooldown || 0) - dt);
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
      if (!actor.isPlayer) resetBotRoute(actor);
    }
    actor.checkpoint = checkpointAt(actor.x, actor.z, actor.checkpoint);
    if (actor.checkpoint === 3 && Math.abs(actor.x) < COURSE.finish.halfWidth && actor.z >= COURSE.finish.z) {
      actor.raceFinished = true; actor.raceFinishTime = elapsed;
    }
  }
  const finished = actors.filter(a => a.raceFinished).sort((a,b) => a.raceFinishTime-b.raceFinishTime);
  const quota = Math.max(1, Math.ceil(actors.length * .7));
  return { finished, quota, done: finished.length >= quota || elapsed >= limit };
}
