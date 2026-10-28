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
  const crossed = (previousZ-wallZ)*(actor.z-wallZ) <= 0;
  if (Math.abs(surface.wallAngle) > 1.15 || (!crossed && Math.abs(actor.z-wallZ) > .55)) return false;
  actor.z = wallZ + (previousZ <= wallZ ? -.58 : .58);
  actor.vz *= -.2;
  return true;
}
export function botDecision(course, actor) {
  const id = Number(String(actor.id || '').replace(/\D/g,'')) || 0;
  const isChampion = id === 0;
  const elite = id < 4;
  const speedup = speedMultiplier(course.time);
  const current = sampleSurface(course, actor.x, actor.z);
  const drift = current ? current.ring.speed * speedup * Math.sqrt(Math.max(0,RADIUS*RADIUS-actor.z*actor.z)) : 0;
  const targetZ = isChampion ? 0 : Math.sin(course.time*.12 + id*1.31)*1.1;
  const vz = Math.max(-6.4,Math.min(6.4,-drift + (targetZ-actor.z)*1.6));
  const options = [-1,0,1].map(step => {
    const x = Math.max(-RING_WIDTH*2.3, Math.min(RING_WIDTH*2.3, actor.x+step*RING_WIDTH*.72));
    let score=0;
    for(const future of (elite ? [.4,1,1.8,2.6] : [.4,1,1.6])) {
      const predicted = {rings:course.rings.map(r=>({...r,angle:r.angle+r.speed*speedup*future}))};
      const z=actor.z+(vz+drift)*Math.min(future,.7);
      const surface=sampleSurface(predicted,x,z);
      if(!surface) score-=14; else {
        score+=4;
        if(Math.abs(surface.wallAngle-surface.angle)<.22) score-=6;
      }
    }
    if(step===0)score+=elite?2:1;
    if(Math.abs(x)>RING_WIDTH*2.1)score-=1;
    return {step,x,score};
  });
  const best=options.reduce((a,b)=>b.score>a.score?b:a);
  const vx=best.step?Math.sign(best.x-actor.x)*(elite?6.2:5.2):0;
  const wallNear=!!current && Math.abs(current.wallAngle-current.angle)<.20;
  const hopDue=!isChampion && course.time>=(actor.rollNextJump ?? (6+id*.4));
  const jump=actor.onGround && (wallNear || (hopDue && current && Math.abs(actor.z)<RADIUS*.3));
  if(jump)actor.rollNextJump=course.time+8+(id%4);
  return {vx,vz,jump};
}

