// Gate Crash: rows of gates slide up and down; run through while a gate is down. Rows get faster and less
// regular, spinning bars sweep the gaps between rows, and the last row sits at the bottom of a slime slide
// where the gates alternate slowly. Race to the finish (70% qualify, 1:40 as in the show).
import { steerTo, skillOf, botNumber, SPEED } from '../race-kit/obstacle-race.mjs';

export const LIMIT = 100;
export const HALF_WIDTH = 9;
export const GATE = { width: 3.0, height: 3.2, thick: .7, travel: .45 }; // travel: seconds to slide fully up or down
export const SLIDE = { z1: 104, z2: 120, drop: 6 };                       // slime downhill before the final row
export const FINISH_Z = 136;
export const START = { z1: -7, z2: 3 };
// period (s), share of the cycle a gate is down, phase step between neighbours
export const ROWS = [
  { z: 16, period: 4.2, open: .5, step: .37 },
  { z: 34, period: 3.8, open: .44, step: .61 },
  { z: 52, period: 3.2, open: .4, step: .29 },
  { z: 70, period: 2.8, open: .36, step: .83 },
  { z: 88, period: 2.4, open: .33, step: .47 },
  { z: 125, period: 5.2, open: .45, step: .5, final: true } // final: neighbours alternate
];
export const SPINNERS = [{ z: 8, x: 0 }, { z: 25, x: -4.5 }, { z: 25, x: 4.5 }, { z: 43, x: 0 }, { z: 61, x: -4.5 }, { z: 61, x: 4.5 }, { z: 79, x: 0 }, { z: 97, x: -4.5 }, { z: 97, x: 4.5 }]
  .map((s, i) => ({ ...s, arm: 4.2, y: .55, omega: (i % 2 ? -1 : 1) * (1.5 + i * .08) }));

// Height of a gate's top edge: 0 = down (open), GATE.height = up (closed).
export function gateHeight(row, gate, t) {
  const u = (((t / row.period + gate.phase) % 1) + 1) % 1, ramp = GATE.travel / row.period;
  if (u < row.open) return 0;                                      // down
  if (u < row.open + ramp) return (u - row.open) / ramp * GATE.height; // rising
  if (u < 1 - ramp) return GATE.height;                            // up
  return (1 - u) / ramp * GATE.height;                             // lowering
}
export const gateOpen = (row, gate, t) => gateHeight(row, gate, t) < .3;

export function floorY(z) {
  if (z <= SLIDE.z1) return 0;
  if (z < SLIDE.z2) return -SLIDE.drop * (z - SLIDE.z1) / (SLIDE.z2 - SLIDE.z1);
  return -SLIDE.drop;
}

export function createGateCrash() {
  const count = 5, span = HALF_WIDTH * 2 / count;
  const rows = ROWS.map((row, r) => {
    const gates = [...Array(count).keys()].map(i => ({
      row: r, index: i, x: -HALF_WIDTH + span * (i + .5),
      phase: row.final ? (i % 2) * .5 : ((i * row.step) % 1 + (r * .17)) % 1
    }));
    const y0 = floorY(row.z);
    // Posts between gates and at the edges.
    const posts = [];
    for (let i = 0; i <= count; i++) {
      const x = -HALF_WIDTH + span * i;
      posts.push({ x1: x - (span - GATE.width) / 2 - .02, x2: x + (span - GATE.width) / 2 + .02, y1: y0, y2: y0 + 4.4, z1: row.z - GATE.thick / 2, z2: row.z + GATE.thick / 2, post: true });
    }
    return { ...row, index: r, y0, gates, posts };
  });
  const sides = [-1, 1].map(s => ({ x1: s < 0 ? -HALF_WIDTH - 1.2 : HALF_WIDTH, x2: s < 0 ? -HALF_WIDTH : HALF_WIDTH + 1.2, y1: -SLIDE.drop - 1, y2: 2.2, z1: START.z1, z2: FINISH_Z + 4, wall: true }));
  const course = {
    time: 0, rows, sides, spinners: SPINNERS.map(s => ({ ...s, angle: s.z * .3 })), events: [],
    advance(dt) {
      this.time += dt;
      for (const s of this.spinners) s.angle += s.omega * dt;
      for (const row of rows) for (const g of row.gates) g.h = gateHeight(row, g, this.time);
    },
    floorAt(x, z) {
      if (Math.abs(x) > HALF_WIDTH + .2 || z < START.z1 || z > FINISH_Z + 4) return null;
      return floorY(z);
    },
    solids() {
      const out = [...sides];
      for (const row of rows) {
        out.push(...row.posts);
        for (const g of row.gates) {
          const h = g.h ?? gateHeight(row, g, this.time);
          if (h > .3) out.push({ x1: g.x - GATE.width / 2, x2: g.x + GATE.width / 2, y1: row.y0 + h - GATE.height, y2: row.y0 + h, z1: row.z - GATE.thick / 2, z2: row.z + GATE.thick / 2, gate: g });
        }
      }
      return out;
    },
    onHit(actor, box, impact, nx, nz) {
      if (!box.gate || impact < 1.5) return;
      // Crashing into a raised gate throws the racer back.
      actor.knockVz += nz * 6; actor.knockVx += nx * 2; actor.vy = Math.max(actor.vy, 3.5); actor.onGround = false; actor.squash = .3;
      this.events.push({ type: 'crash', gate: box.gate, by: actor });
    },
    push(actor, dt) {
      // Slime slide: slippery and pulls downhill.
      if (actor.onGround && actor.z > SLIDE.z1 && actor.z < SLIDE.z2) actor.knockVz += 9 * dt;
      // Spinning bars knock racers that do not jump over them.
      for (const s of this.spinners) {
        if (actor.y > floorY(s.z) + s.y + .35) continue;
        const dx = actor.x - s.x, dz = actor.z - s.z, c = Math.cos(s.angle), sn = Math.sin(s.angle);
        const along = dx * c + dz * sn, across = -dx * sn + dz * c;
        if (Math.abs(along) > s.arm || Math.abs(across) > .35 + actor.radius * .6 || (actor.barHit ?? 0) > this.time) continue;
        const dir = Math.sign(s.omega) * Math.sign(along || 1);
        actor.knockVx += -sn * dir * 7; actor.knockVz += c * dir * 7; actor.vy = 4; actor.onGround = false;
        actor.barHit = this.time + .6; this.events.push({ type: 'bar', by: actor });
      }
    },
    respawn(actor) { return { x: 0, y: floorY(Math.min(actor.z, SLIDE.z1 - 2)), z: Math.min(actor.z, SLIDE.z1 - 2) }; },
    finished(actor) { return actor.z >= FINISH_Z; },
    decide(actor) { return gateBot(this, actor); }
  };
  course.advance(0);
  return course;
}

// ---------- Bots ----------
// For the next row a bot predicts every gate's height at the moment it would arrive and picks the gate that is
// down soonest after that (counting the sideways run). It lines up in front, waits if needed and goes when the
// gate will stay down long enough. It hops over a spinning bar about to sweep it. Skill sets reaction and margin.
function gateBot(course, actor) {
  const skill = skillOf(actor), id = botNumber(actor), pace = .82 + skill * .18, v = SPEED * pace;
  const row = course.rows.find(r => actor.z < r.z + GATE.thick / 2 + .2);
  let jump = barAhead(course, actor, .18 + (1 - skill) * .12);
  if (!row) return { ...steerTo(actor, actor.x * .7, FINISH_Z + 3, pace), jump };
  const margin = .5 - skill * .25; // seconds the gate must stay down after the bot reaches it
  const pass = (g, t) => { for (let k = 0; k <= 4; k++) if (!gateOpen(row, g, t + k * margin / 4 + .05)) return false; return true; };
  if (!actor.gatePlan || actor.gatePlan.row !== row.index || course.time > actor.gatePlan.until) {
    let best = null;
    for (const g of row.gates) {
      const run = Math.hypot(g.x - actor.x, row.z - 1.1 - actor.z) / v;
      let wait = 0;
      while (wait < row.period && !pass(g, course.time + run + wait)) wait += .1;
      // Weaker bots misread the timing a little.
      const score = run + wait + Math.abs(Math.sin(id * 3.7 + g.index * 1.9)) * (1 - skill) * 1.2;
      if (!best || score < best.score) best = { gate: g, score };
    }
    actor.gatePlan = { row: row.index, gate: best.gate, until: course.time + .25 + (1 - skill) * .35 };
  }
  const g = actor.gatePlan.gate, front = row.z - 1.1 - GATE.thick / 2;
  const lined = Math.abs(actor.x - g.x) < GATE.width * .28;
  const eta = Math.max(0, front + 1.4 - actor.z) / v;
  if (lined && pass(g, course.time + eta)) return { ...steerTo(actor, g.x, row.z + 2.5, pace), jump };
  // Not yet: line up just in front of the gate and wait there.
  return { ...steerTo(actor, g.x, Math.min(front, actor.z + 4), pace), jump };
}
function barAhead(course, actor, lead) {
  if (!actor.onGround) return false;
  for (const s of course.spinners) {
    if (Math.hypot(actor.x - s.x, actor.z - s.z) > s.arm + 1) continue;
    const a = s.angle + s.omega * lead, dx = actor.x + actor.vx * lead - s.x, dz = actor.z + actor.vz * lead - s.z;
    if (Math.abs(-dx * Math.sin(a) + dz * Math.cos(a)) < .9 && Math.abs(dx * Math.cos(a) + dz * Math.sin(a)) < s.arm) return true;
  }
  return false;
}
