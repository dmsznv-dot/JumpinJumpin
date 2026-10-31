// Door Dash: seven walls of doors; some doors smash open, the rest are solid. Race to the finish (70% qualify).
// Layout follows the original: 7/7/7/6/5/4/3 doors per row with 5/3/2/2/2/2/1 breakable ones, then a drop
// onto the lower finish platform.
import { steerTo, skillOf, botNumber } from '../race-kit/obstacle-race.mjs';

export const LIMIT = 180;
// SCALE: walls, doors and distances are 1.5× their first version relative to the 1.6 m cube.
export const SCALE = 1.5;
export const HALF_WIDTH = 11 * SCALE;
export const ROWS = [[7, 5], [7, 3], [7, 2], [6, 2], [5, 2], [4, 2], [3, 1]].map(([doors, real], i) => ({ z: (14 + i * 12) * SCALE, doors, real }));
export const DOOR = { width: 2.3 * SCALE, height: 3.2 * SCALE, thick: .5 * SCALE, wall: 4.2 * SCALE };
export const UPPER_END = ROWS[ROWS.length - 1].z + 6 * SCALE; // the upper deck ends here; the finish platform is lower
export const LOWER_Y = -4 * SCALE, FINISH_Z = UPPER_END + 22 * SCALE;
export const START = { z1: -7 * SCALE, z2: 3 * SCALE };

// Seeded so a round can be replayed in tests; the game passes a random seed.
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

export function createDoorDash(seed = Date.now()) {
  const rand = rng(seed >>> 0);
  const rows = ROWS.map((row, r) => {
    const span = HALF_WIDTH * 2 / row.doors;
    const order = [...Array(row.doors).keys()].sort(() => rand() - .5);
    const real = new Set(order.slice(0, row.real));
    const doors = [...Array(row.doors).keys()].map(i => ({
      row: r, index: i, x: -HALF_WIDTH + span * (i + .5), real: real.has(i), broken: false, fall: 0, shake: 0
    }));
    // Wall pieces between and beside doors.
    const walls = [];
    let left = -HALF_WIDTH - .6;
    for (const d of doors) { walls.push({ x1: left, x2: d.x - DOOR.width / 2, y1: 0, y2: DOOR.wall, z1: row.z - DOOR.thick / 2, z2: row.z + DOOR.thick / 2, wall: true }); left = d.x + DOOR.width / 2; }
    walls.push({ x1: left, x2: HALF_WIDTH + .6, y1: 0, y2: DOOR.wall, z1: row.z - DOOR.thick / 2, z2: row.z + DOOR.thick / 2, wall: true });
    // The lintel above the doors closes the wall up to its full height.
    walls.push({ x1: -HALF_WIDTH - .6, x2: HALF_WIDTH + .6, y1: DOOR.height, y2: DOOR.wall, z1: row.z - DOOR.thick / 2, z2: row.z + DOOR.thick / 2, wall: true });
    for (const d of doors) d.box = { x1: d.x - DOOR.width / 2, x2: d.x + DOOR.width / 2, y1: 0, y2: DOOR.height, z1: row.z - DOOR.thick / 2 + .05, z2: row.z + DOOR.thick / 2 - .05, door: d };
    return { ...row, index: r, doors, walls: walls.filter(w => w.x2 - w.x1 > .01) };
  });
  // Side barriers keep racers on the deck (as in the show).
  const sides = [-1, 1].map(s => ({ x1: s < 0 ? -HALF_WIDTH - 1.2 : HALF_WIDTH, x2: s < 0 ? -HALF_WIDTH : HALF_WIDTH + 1.2, y1: LOWER_Y, y2: 3.3, z1: START.z1, z2: FINISH_Z + 4, wall: true }));
  const course = {
    time: 0, rows, sides, events: [],
    advance(dt) {
      this.time += dt;
      for (const row of rows) for (const d of row.doors) {
        if (d.broken) d.fall = Math.min(1, d.fall + dt * 3);
        d.shake = Math.max(0, d.shake - dt * 3);
      }
    },
    floorAt(x, z) {
      if (Math.abs(x) > HALF_WIDTH + .2) return null;
      if (z >= START.z1 && z <= UPPER_END) return 0;
      if (z > UPPER_END && z <= FINISH_Z + 4) return LOWER_Y;
      return null;
    },
    solids() {
      const out = [...sides];
      for (const row of rows) { out.push(...row.walls); for (const d of row.doors) if (!d.broken) out.push(d.box); }
      return out;
    },
    onHit(actor, box, impact, nx, nz) {
      const d = box.door;
      if (!d) return;
      if (d.real && impact > 2.2) { // smash through: the door falls flat and stays open
        d.broken = true; this.events.push({ type: 'break', door: d, by: actor });
        return;
      }
      if (impact > 1.5 && d.shake < .5) { // fake door: bounce off
        d.shake = 1; this.events.push({ type: 'bounce', door: d, by: actor });
        actor.knockVx += nx * 5; actor.knockVz += nz * 6; actor.vy = Math.max(actor.vy, 3); actor.onGround = false;
        actor.squash = .3;
      }
      if (!actor.isPlayer) (actor.doorTried ??= new Set()).add(d);
    },
    respawn(actor) { return { x: actor.x * .5, y: actor.z > UPPER_END ? LOWER_Y : 0, z: Math.min(Math.max(actor.z, START.z1 + 1), FINISH_Z) }; },
    finished(actor) { return actor.z >= FINISH_Z && actor.y < LOWER_Y + 1; },
    decide(actor) { return doorBot(this, actor); }
  };
  return course;
}

// ---------- Bots ----------
// Bots do not know which doors are real. They take a door they have seen broken, otherwise try an untried door
// close to their line; a solid door they bounced off is remembered. Stronger bots notice broken doors from further away.
function doorBot(course, actor) {
  const skill = skillOf(actor), id = botNumber(actor);
  const row = course.rows.find(r => actor.z < r.z + DOOR.thick / 2 + .3);
  if (!row) return { ...steerTo(actor, actor.x * .6, FINISH_Z + 2, .8 + skill * .2), jump: false };
  const sight = 5 + skill * 12, tried = actor.doorTried ??= new Set();
  let door = actor.doorTarget;
  const seenBroken = row.doors.filter(d => d.broken && Math.abs(row.z - actor.z) < sight);
  if (!door || door.row !== row.index || tried.has(door) || (seenBroken.length && !door.broken && skill > .45)) {
    const pool = seenBroken.length ? seenBroken : row.doors.filter(d => !tried.has(d));
    const choices = pool.length ? pool : row.doors;
    // Prefer doors near the bot's line; a little randomness spreads the crowd over the row.
    let best = null, bestScore = Infinity;
    for (const d of choices) {
      const score = Math.abs(d.x - actor.x) + ((Math.sin(id * 12.9898 + d.index * 78.233 + course.time * .1) + 1) * (2.5 - skill * 1.5));
      if (score < bestScore) { bestScore = score; best = d; }
    }
    door = actor.doorTarget = best;
  }
  const pace = .8 + skill * .2;
  const lined = Math.abs(actor.x - door.x) < DOOR.width * .3;
  // Line up in front of the door, then run straight through it.
  const target = lined || actor.z > row.z - 1.2 ? { x: door.x, z: row.z + 2.5 } : { x: door.x, z: Math.min(actor.z + 3, row.z - 1.6) };
  const s = steerTo(actor, target.x, target.z, pace);
  // Bounced back into the crowd: a hop clears the pile-up.
  return { ...s, jump: actor.onGround && actor.knockVz < -3 && skill > .6 };
}

