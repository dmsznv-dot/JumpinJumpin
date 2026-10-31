// Roll On: four sections of rings that spin around the course axis, carrying racers sideways. Rings have holes,
// low walls and doughnut bumpers that turn with them (two holes per ring: one double, one single sector). Section 1: 3 rings; 2: 4 faster rings; 3: 6 rings stepping
// down like a staircase; 4: two big drums rolling toward the racers, then a platform swinging side to side
// over the gap to the finish. Race to the finish (70% qualify, 2:00).
import { steerTo, skillOf, botNumber, SPEED, JUMP, GRAVITY } from '../race-kit/obstacle-race.mjs';

export const LIMIT = 120;
// SCALE: rings, drums, pads and the platform are 1.5× their first version relative to the 1.6 m cube. Spin rates
// are divided by SCALE so a ring's surface still carries you sideways at the same speed.
export const SCALE = 1.5;
export const RING = { radius: 7 * SCALE, width: 5.2 * SCALE, gap: .3 * SCALE, sectors: 16, walk: 5.6 * SCALE };
export const PAD_HALF_WIDTH = 7 * SCALE;
// Section 4 drums roll toward the racers. Only their crown is walkable (usable × radius each side of the top),
// so the drop to the drum's edge stays below a jump and the platform after it can sit at that edge height.
export const DRUM = { radius: 9 * SCALE, halfWidth: 7 * SCALE, speed: 4.2, usable: .45 };
export const DRUM_DROP = DRUM.radius - Math.sqrt(DRUM.radius ** 2 - (DRUM.radius * DRUM.usable) ** 2);
export const SWING = { halfWidth: 2.4 * SCALE, amp: 5 * SCALE, freq: .6 };
const TAU = Math.PI * 2, SECTOR = TAU / RING.sectors;
const wrap = a => ((a % TAU) + TAU) % TAU;

export function buildLayout() {
  const pads = [{ z1: -7 * SCALE, z2: 3 * SCALE, y: 0, kind: 'start' }], rings = [], drums = [];
  let z = 3 * SCALE + RING.gap, y = 0, n = 0;
  const section = (count, speed, drop, kind, s) => {
    for (let i = 0; i < count; i++, n++) {
      y -= drop * SCALE;
      rings.push({ section: s, z: z + RING.width / 2, y, omega: (n % 2 ? -1 : 1) * speed / SCALE,
        hole: (n * 5 + 3) % RING.sectors, hole2: (n * 5 + 11) % RING.sectors, wall: (n * 7 + 11) % RING.sectors, bumper: s < 2 ? (n * 3 + 7) % RING.sectors : -1, phase: n * .9 });
      z += RING.width + RING.gap;
    }
    y -= .6 * SCALE;
    pads.push({ z1: z, z2: z + 6 * SCALE, y, kind, index: s + 1 });
    z += 6 * SCALE + RING.gap;
  };
  section(3, .38, 0, 'checkpoint', 0);
  section(4, .55, 0, 'checkpoint', 1);
  section(6, .45, .7, 'checkpoint', 2);
  const crown = DRUM.radius * DRUM.usable;
  for (let i = 0; i < 2; i++) { drums.push({ z: z + crown, y, index: i }); z += crown * 2; }
  y -= DRUM_DROP; // the swing and the finish sit level with the drums' edge
  // Gaps around the swinging platform stay a short hop (2 m).
  const swing = { z1: z + 2, z2: z + 2 + 4 * SCALE, y };
  z = swing.z2 + 2;
  pads.push({ z1: z, z2: z + 12 * SCALE, y, kind: 'finish' });
  return { pads, rings, drums, swing, finishZ: z + 4 };
}
export const LAYOUT = buildLayout();
export const FINISH_Z = LAYOUT.finishZ;

// --- Geometry at time offset dt (0 = now): used by the physics and by the bots' predictions ---
function ringAt(rings, z) { return rings.find(r => Math.abs(z - r.z) <= RING.width / 2); }
function ringSurface(r, x, dt) {
  if (Math.abs(x) > RING.walk) return null;
  const local = wrap(Math.asin(x / RING.radius) - (r.angle + r.omega * dt));
  const sector = Math.floor(local / SECTOR);
  if (sector === r.hole || sector === (r.hole + 1) % RING.sectors || sector === r.hole2) return null;
  return r.y - RING.radius + Math.sqrt(RING.radius * RING.radius - x * x);
}
// Features (wall, bumper) sit at a sector's middle; return their x on top of the ring, or null when out of sight.
function featureX(r, sector, dt) {
  if (sector < 0) return null;
  const a = wrap((sector + .5) * SECTOR + r.angle + r.omega * dt + Math.PI) - Math.PI;
  return Math.abs(a) < 1.0 ? RING.radius * Math.sin(a) : null;
}
function drumSurface(d, x, z) {
  const dz = z - d.z;
  if (Math.abs(x) > DRUM.halfWidth || Math.abs(dz) > DRUM.radius * DRUM.usable) return null;
  return d.y - DRUM.radius + Math.sqrt(DRUM.radius * DRUM.radius - dz * dz);
}
function swingX(time) { return SWING.amp * Math.sin(time * SWING.freq); }

export function createRollOn() {
  const L = LAYOUT, rings = L.rings.map(r => ({ ...r, angle: r.phase })), pads = L.pads.map(p => ({ ...p }));
  const course = {
    time: 0, rings, pads, drums: L.drums, swing: L.swing, racers: [],
    advance(dt) { this.time += dt; for (const r of rings) r.angle += r.omega * dt; },
    floorAtTime(x, z, dt = 0) {
      for (const p of pads) if (z >= p.z1 && z <= p.z2 && Math.abs(x) <= PAD_HALF_WIDTH) return p.y;
      const r = ringAt(rings, z);
      if (r) return ringSurface(r, x, dt);
      for (const d of L.drums) { const y = drumSurface(d, x, z); if (y !== null) return y; }
      const s = L.swing;
      if (z >= s.z1 && z <= s.z2 && Math.abs(x - swingX(this.time + dt)) <= SWING.halfWidth) return s.y;
      return null;
    },
    floorAt(x, z) { return this.floorAtTime(x, z, 0); },
    solidsAt(dt = 0) {
      const out = [];
      for (const r of rings) {
        const wx = featureX(r, r.wall, dt);
        if (wx !== null) { const y = r.y - RING.radius + Math.sqrt(RING.radius ** 2 - wx * wx); out.push({ x1: wx - .25, x2: wx + .25, y1: y - .5, y2: y + 1.1, z1: r.z - RING.width / 2, z2: r.z + RING.width / 2, wall: true }); }
        const bx = featureX(r, r.bumper, dt);
        if (bx !== null) { const y = r.y - RING.radius + Math.sqrt(RING.radius ** 2 - bx * bx); out.push({ x1: bx - 1.2, x2: bx + 1.2, y1: y - .4, y2: y + 1, z1: r.z - 1.2, z2: r.z + 1.2, bumper: true }); }
      }
      return out;
    },
    solids() { return this.solidsAt(0); },
    onHit(actor, box, impact, nx, nz) {
      if (box.bumper && impact > .5) { actor.knockVx += nx * 7; actor.knockVz += nz * 7; actor.vy = Math.max(actor.vy, 3); actor.onGround = false; actor.squash = .3; }
    },
    carry(actor, dt) {
      const r = ringAt(rings, actor.z);
      if (r && Math.abs(actor.x) <= RING.walk) {
        const a = Math.asin(Math.max(-1, Math.min(1, actor.x / RING.radius))) + r.omega * dt;
        actor.x = RING.radius * Math.sin(a);
        return;
      }
      for (const d of L.drums) if (drumSurface(d, actor.x, actor.z) !== null) { actor.z -= DRUM.speed * dt; return; }
      const s = L.swing;
      // advance() already moved the clock for this substep, so the platform's last step is time-dt -> time.
      if (actor.z >= s.z1 && actor.z <= s.z2) actor.x += swingX(this.time) - swingX(this.time - dt);
    },
    push(actor) {
      for (const p of pads) if (p.kind === 'checkpoint' && actor.z >= p.z1 && actor.z <= p.z2) actor.rollCheckpoint = Math.max(actor.rollCheckpoint || 0, p.index);
    },
    respawn(actor) {
      const pad = pads.find(p => p.kind === 'checkpoint' && p.index === actor.rollCheckpoint) || pads[0], n = botNumber(actor);
      return { x: ((n % 5) - 2) * 2.6, y: pad.y, z: (pad.z1 + pad.z2) / 2 + ((n % 3) - 1) * .8 };
    },
    finished(actor) { return actor.z >= FINISH_Z && actor.y > pads[pads.length - 1].y - 1; },
    decide(actor) { return rollOnBot(this, actor); }
  };
  return course;
}

// ---------- Bots ----------
// Every few tenths of a second a bot tries a set of moves (sideways speed × forward speed × jump) against the
// predicted rings, walls, drums and the swinging platform, and keeps the one that gets furthest without falling
// or running into a wall. Skill sets pace, reaction time and how much it misjudges.
const STEP = 1 / 15, HORIZON = 1.2;
function rollout(course, actor, vx, vz, jump) {
  let x = actor.x, y = actor.y, z = actor.z, vy = actor.vy || 0, gx = actor.vx || 0, gz = actor.vz || 0, grounded = actor.onGround, hit = 0;
  if (jump && grounded) { vy = JUMP; grounded = false; }
  const blend = 1 - Math.exp(-6 * STEP);
  for (let t = 0; t < HORIZON; t += STEP) {
    if (grounded) {
      const r = ringAt(course.rings, z);
      if (r && Math.abs(x) <= RING.walk) x = RING.radius * Math.sin(Math.asin(Math.max(-1, Math.min(1, x / RING.radius))) + r.omega * STEP);
      else if (course.drums.some(d => drumSurface(d, x, z) !== null)) z -= DRUM.speed * STEP;
    }
    gx += (vx - gx) * blend; gz += (vz - gz) * blend;
    x += gx * STEP; z += gz * STEP;
    const floor = course.floorAtTime(x, z, t + STEP);
    if (grounded && (floor === null || floor < y - .65)) grounded = false;
    if (grounded) y = floor;
    else {
      const oldY = y; vy -= GRAVITY * STEP; y += vy * STEP;
      if (floor !== null && vy <= 0 && y <= floor + .15 && oldY >= floor - .65) { y = floor; vy = 0; grounded = true; }
      else if (y < actor.y - 2.5 && (floor === null || y < floor - 1)) return { fell: t };
    }
    for (const b of course.solidsAt(t)) if (x > b.x1 - .6 && x < b.x2 + .6 && z > b.z1 - .6 && z < b.z2 + .6 && y < b.y2 - .05) { hit++; break; }
  }
  return { x, z, hit, grounded };
}
function rollOnBot(course, actor) {
  const skill = skillOf(actor), pace = .82 + skill * .18, v = SPEED * pace;
  const plan = actor.rollOnPlan;
  if (plan && course.time < plan.until) {
    const jump = plan.jump && actor.onGround;
    plan.jump = false; // a planned hop fires once
    return { x: plan.vx / SPEED, z: plan.vz / SPEED, jump };
  }
  // Aim at the middle of the course (rings are safest near the top), forward as fast as it stays safe.
  const id = botNumber(actor);
  let best = null;
  for (const sx of [-1, -.5, 0, .5, 1]) for (const fz of [1, .6, 0, -.4]) for (const jump of actor.onGround ? [false, true] : [false]) {
    const end = rollout(course, actor, sx * v, fz * v, jump);
    let score;
    if (end.fell !== undefined) score = -100 + end.fell * 30;
    else score = (end.z - actor.z) * 3 - end.hit * 12 - Math.abs(end.x) * .35 - (jump ? .6 : 0) - (end.grounded ? 0 : 1.5);
    score += Math.sin(id * 7.1 + sx * 3 + fz * 5 + course.time * .3) * (1 - skill) * 6;
    if (!best || score > best.score) best = { score, vx: sx * v, vz: fz * v, jump };
  }
  actor.rollOnPlan = { ...best, jump: false, until: course.time + .1 + (1 - skill) * .25 };
  return { x: best.vx / SPEED, z: best.vz / SPEED, jump: best.jump && actor.onGround };
}
