// See Saw: big see-saws lying across the course. Their pivot runs along the track, so they roll left/right toward
// whichever side carries more weight; on a steep plank you slide sideways and can drop into the slime (back to the
// last checkpoint). Section 1: rows one behind another with gaps; section 2: rows shifted sideways; after the second
// checkpoint see-saws meet edge to edge — two side by side in a row, and several rows touching with no gap, where a
// tilted neighbour can stand up as a ledge you must jump. Race to the finish (70% qualify, 3:00).
import { steerTo, skillOf, botNumber } from '../race-kit/obstacle-race.mjs';

export const LIMIT = 180;
export const MAX_TILT = .56;                 // ~32°
export const PAD_HALF_WIDTH = 12;
export const DEPTH = 7;                      // plank size along the course
const GAP = 1.8, SEAM = .1;
export const START = { z1: -7, z2: 3 };

// Row recipes: planks as [centre x, length across]; gap: false = touches the previous row.
const PLAN = [
  { section: 0, rows: [[[0, 18]], [[0, 18]], [[0, 18]], [[0, 18]]] },
  { section: 1, rows: [[[-4.5, 18]], [[4.5, 18]], [[-4.5, 18]], [[4.5, 18]], [[-4.5, 18]]] },
  { section: 2, rows: [
    { planks: [[-6.1, 12], [6.1, 12]] },
    { planks: [[-3, 18]], gap: false },
    { planks: [[-6.1, 12], [6.1, 12]], gap: false },
    { planks: [[4, 18]] },
    { planks: [[-6.1, 12], [6.1, 12]], gap: false },
    { planks: [[-4, 18]], gap: false },
    { planks: [[-6.1, 12], [6.1, 12]] }
  ] }
];

export function buildLayout() {
  const pads = [{ z1: START.z1, z2: START.z2, kind: 'start' }], planks = [];
  let z = START.z2, row = 0;
  PLAN.forEach(({ section, rows }, s) => {
    rows.forEach(spec => {
      const list = Array.isArray(spec) ? spec : spec.planks, joined = !Array.isArray(spec) && spec.gap === false;
      z += joined ? SEAM : GAP;
      list.forEach(([x, length]) => planks.push({ section, row, x, z: z + DEPTH / 2, length, depth: DEPTH, joined }));
      z += DEPTH; row++;
    });
    const last = s === PLAN.length - 1;
    z += GAP;
    pads.push({ z1: z, z2: z + (last ? 14 : 7), kind: last ? 'finish' : 'checkpoint', index: s + 1 });
    z += last ? 14 : 7;
  });
  return { pads, planks, finishZ: pads[pads.length - 1].z1 + 4 };
}
export const LAYOUT = buildLayout();
export const FINISH_Z = LAYOUT.finishZ;

// Height of a plank's top at world x (positive angle rolls the +x side down).
export const plankY = (p, x) => -(x - p.x) * Math.tan(p.angle || 0);
const onPlank = (p, x, z) => Math.abs(x - p.x) <= p.length / 2 && Math.abs(z - p.z) <= p.depth / 2;

export function createSeeSaw() {
  const pads = LAYOUT.pads.map(p => ({ ...p })), planks = LAYOUT.planks.map(p => ({ ...p, angle: 0, spin: 0, load: 0 }));
  const course = {
    time: 0, pads, planks, racers: [], stepUp: 1.0,
    advance(dt) {
      this.time += dt;
      for (const p of planks) p.torque = 0, p.load = 0;
      for (const a of this.racers) {
        if (!a.onGround || a.raceFinished) continue;
        const p = planks.find(q => onPlank(q, a.x, a.z) && Math.abs(a.y - plankY(q, a.x)) < .5);
        if (p) { p.torque += a.x - p.x; p.load++; }
      }
      for (const p of planks) {
        // Weight against a spring back to level, damped; one racer near an end rolls it all the way over.
        const inertia = 10 + p.load * .8;
        p.spin += ((p.torque - 6 * p.angle - 2.8 * p.spin) / inertia) * dt;
        p.angle += p.spin * dt;
        if (Math.abs(p.angle) > MAX_TILT) { p.angle = Math.sign(p.angle) * MAX_TILT; p.spin = 0; }
      }
    },
    floorAt(x, z) {
      if (Math.abs(x) <= PAD_HALF_WIDTH) for (const p of pads) if (z >= p.z1 && z <= p.z2) return 0;
      for (const p of planks) if (onPlank(p, x, z)) return plankY(p, x);
      return null;
    },
    solids() { return []; },
    push(actor, dt) {
      for (const p of pads) if (p.kind === 'checkpoint' && actor.z >= p.z1 && actor.z <= p.z2 && Math.abs(actor.x) <= PAD_HALF_WIDTH) actor.seeCheckpoint = Math.max(actor.seeCheckpoint || 0, p.index);
      if (!actor.onGround) return;
      const p = planks.find(q => onPlank(q, actor.x, actor.z));
      if (p) actor.knockVx += 22 * Math.sin(p.angle) * dt; // slide toward the low side
    },
    respawn(actor) {
      const pad = pads.find(p => p.kind === 'checkpoint' && p.index === actor.seeCheckpoint) || pads[0];
      const n = botNumber(actor);
      return { x: ((n % 5) - 2) * 2.6, y: 0, z: (pad.z1 + pad.z2) / 2 + ((n % 3) - 1) * 1.2 };
    },
    finished(actor) { return actor.z >= FINISH_Z && Math.abs(actor.x) <= PAD_HALF_WIDTH && actor.y > -1; },
    decide(actor) { return seeSawBot(this, actor); }
  };
  return course;
}

// ---------- Bots ----------
// Pick the plank in the next row that lines up best and is not crowded, and cross it on its HIGH side: standing
// there pulls a tipped see-saw back toward level instead of sliding off the low end. Hop gaps at the edge and hop
// a seam that stands up as a ledge. Weaker bots balance late and pick crowded planks more often.
function seeSawBot(course, actor) {
  const skill = skillOf(actor), pace = .82 + skill * .18, id = botNumber(actor);
  const lead = .14;
  const edge = actor.onGround && course.floorAt(actor.x + actor.vx * lead, actor.z + Math.max(actor.vz, 2) * lead) === null;
  const ledge = actor.onGround && course.time - (actor.blockedAt ?? -9) < .25;
  const jump = edge || ledge;
  const nextRow = course.planks.filter(p => p.z - p.depth / 2 > actor.z - .2);
  const nextPad = course.pads.find(p => p.z1 > actor.z - .5);
  const rowZ = nextRow.length ? Math.min(...nextRow.map(p => p.z)) : null;
  if (rowZ === null || (nextPad && nextPad.z1 < rowZ - 1)) {
    const tz = nextPad ? nextPad.z2 + (nextPad.kind === 'finish' ? 3 : -1) : FINISH_Z + 3;
    return { ...steerTo(actor, actor.x * .7, Math.max(tz, actor.z + 3), pace), jump };
  }
  const row = nextRow.filter(p => p.z === rowZ);
  if (!actor.seeTarget || !row.includes(actor.seeTarget)) {
    let best = null;
    for (const p of row) {
      const crowd = course.racers.filter(a => a !== actor && !a.raceFinished && onPlank(p, a.x, a.z)).length;
      const score = Math.abs(p.x - actor.x) * .6 + crowd * (.6 + skill) + ((id * 7 + p.x) % 3) * (1 - skill);
      if (!best || score < best.score) best = { p, score };
    }
    actor.seeTarget = best.p;
  }
  const p = actor.seeTarget, half = p.length / 2 - 1.6;
  // The higher side of a tipped plank: aim further up the steeper it is (skilled bots react more).
  const highSide = -Math.sign(p.angle) * Math.min(half, Math.abs(p.angle) * (6 + skill * 8));
  const x = Math.max(p.x - half, Math.min(p.x + half, p.x + highSide + ((id % 3) - 1) * 1.2));
  return { ...steerTo(actor, x, p.z + p.depth / 2 + 1.5, pace), jump };
}
