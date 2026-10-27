import { COURSE, surfaceAt, beamHit } from './course.mjs';

// A central route leaves side fans available as alternative paths for players.
const ROUTE = [
  {x:-6,z:10}, {x:0,z:23}, {x:0,z:37},
  {x:0,z:48}, {x:0,z:64}, {x:0,z:76},
  {x:0,z:87}, {x:-6,z:99}, {x:0,z:110}, {x:0,z:115},
  {x:-6,z:126}, {x:0,z:141}, {x:0,z:154}
];
export function resetBotRoute(actor) {
  const checkpointZ = actor.checkpoint > 0 ? COURSE.checkpoints[actor.checkpoint-1].z : 0;
  actor.raceWaypoint = ROUTE.findIndex(p => p.z > checkpointZ + 1);
  if (actor.raceWaypoint < 0) actor.raceWaypoint = ROUTE.length - 1;
}
export function botRaceDecision(course, actor) {
  if (!Number.isInteger(actor.raceWaypoint)) resetBotRoute(actor);
  let target = ROUTE[actor.raceWaypoint];
  if (Math.hypot(target.x-actor.x, target.z-actor.z) < 2.3 && actor.raceWaypoint < ROUTE.length - 1) {
    actor.raceWaypoint++; target = ROUTE[actor.raceWaypoint];
  }
  const dx = target.x-actor.x, dz = target.z-actor.z;
  const d = Math.hypot(dx,dz) || 1;
  const dirX = dx/d, dirZ = dz/d;
  const lookahead = surfaceAt(course, actor.x + dirX*.65, actor.z + dirZ*.65);
  const imminentBeam = course.fans.some(f => beamHit(f, { ...actor, x:actor.x+dirX, z:actor.z+dirZ }));
  return { x: dirX, z: dirZ, jump: actor.onGround && (!lookahead || imminentBeam) };
}
