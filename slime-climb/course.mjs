// Slime Climb: multi-tier switchback tower obstacle course inspired by Fall Guys.
// The course ascends in 5 distinct vertical floors with hairpin turns, moving pushers,
// a giant rolling boulder on the second-floor ramp, narrow balance beams, conveyor belt,
// fast spinning mallets, swinging pendulums, and rising pink slime.

export const LENGTH = 124;
export const LIMIT = 135;
export const TRACK_HALF = 8;
export const FINISH_Y = 26.0;

export const zones = [
  { name: 'Старт и бамперы', floor: 1, fromZ: -6, toZ: 20, y: 0, type: 'bumpers' },
  { name: 'Первые толкатели', floor: 1, fromZ: 20, toZ: 44, y: 4.8, type: 'pushers' },
  { name: 'Разворот 1', floor: 1, fromZ: 40, toZ: 50, y: 5.2, type: 'turn' },
  { name: 'Склон с гигантским шаром', floor: 2, fromZ: 44, toZ: 58, y: 8.5, type: 'boulder_ramp' },
  { name: 'Разворот 2', floor: 2, fromZ: 52, toZ: 64, y: 11.2, type: 'turn' },
  { name: 'Узкие балки и конвейер', floor: 3, fromZ: 60, toZ: 74, y: 14.5, type: 'conveyor' },
  { name: 'Разворот 3', floor: 3, fromZ: 70, toZ: 82, y: 17.2, type: 'turn' },
  { name: 'Молоты и быстрые блоки', floor: 4, fromZ: 76, toZ: 92, y: 20.5, type: 'hammers' },
  { name: 'Разворот 4', floor: 4, fromZ: 88, toZ: 98, y: 23.2, type: 'turn' },
  { name: 'Финальный подъем и маятники', floor: 5, fromZ: 98, toZ: 118, y: 25.5, type: 'pendulums' },
  { name: 'Финишная арена', floor: 5, fromZ: 118, toZ: 134, y: 26.0, type: 'finish' }
];

export function courseY(z) {
  if (z < 20) return 0;
  if (z < 32) return (z - 20) * 0.4;
  if (z < 44) return 4.8;
  if (z < 58) return 5.2 + (z - 44) * (6.0 / 14);
  if (z < 74) return 11.2 + (z - 58) * (6.0 / 16);
  if (z < 92) return 17.2 + (z - 74) * (6.0 / 18);
  if (z < 110) return 23.2 + (z - 92) * (2.8 / 18);
  return FINISH_Y;
}

export function slimeY(t) {
  return -4.0 + Math.min(t, LIMIT) * (FINISH_Y + 4.5) / LIMIT;
}

// Pushers use authentic Fall Guys punchy piston motion:
// Idle -> explosive snap punch out -> hold -> smooth retract
export function pusherExtension(t, phaseOffset = 0) {
  const period = 1.5;
  const tau = ((t + phaseOffset) % period + period) % period;
  if (tau < 0.65) return 0; // retracted
  if (tau < 0.85) return (tau - 0.65) / 0.2; // FAST EXPLOSIVE PUNCH OUT
  if (tau < 1.15) return 1.0; // held extended
  return Math.max(0, 1.0 - (tau - 1.15) / 0.35); // smooth retract
}

// ==================== MULTI-TIER SURFACE COLLISION ====================
export const SLABS = [
  // Floor 1: Start pad
  { id: 'f1_start', x1: -8.5, x2: 8.5, z1: -8.0, z2: 6.5, y1: 0, y2: 0, axis: 'z' },
  // Floor 1: Runway with bumpers
  { id: 'f1_runway', x1: -4.8, x2: 4.8, z1: 6.0, z2: 20.5, y1: 0, y2: 0, axis: 'z' },
  // Floor 1: Ramp 1 up to pushers
  { id: 'f1_ramp', x1: -4.8, x2: 4.8, z1: 20.0, z2: 32.5, y1: 0, y2: 4.8, axis: 'z' },
  // Floor 1: Pusher walkway
  { id: 'f1_pushers', x1: -6.5, x2: 3.2, z1: 32.0, z2: 44.5, y1: 4.8, y2: 4.8, axis: 'z' },
  // Turn 1 Pad (U-turn on the left with generous overlap)
  { id: 'f1_turn1', x1: -16.5, x2: -1.0, z1: 38.0, z2: 50.0, y1: 4.8, y2: 5.4, axis: 'x_rev' },

  // Floor 2: The Giant Boulder Ramp (Left X=-14 to Right X=+14, rising Y=5.2 to 11.2)
  { id: 'f2_boulder_ramp', type: 'ramp_param', x1: -14.0, x2: 14.0, zCenter0: 45, zCenter1: 56, halfWidth: 5.2, y1: 5.2, y2: 11.2 },
  // Turn 2 Pad (U-turn on the right)
  { id: 'f2_turn2', x1: 5.0, x2: 18.0, z1: 52.0, z2: 64.0, y1: 11.2, y2: 11.8, axis: 'x' },

  // Floor 3: Narrow Beams & Conveyor (slopes from Right X=+14 to Left X=-14, rising Y=11.8 to 17.2)
  { id: 'f3_corridor', type: 'f3_beams_conveyor', x1: -14.0, x2: 14.0, zCenter0: 60, zCenter1: 72, halfWidth: 5.2, y1: 11.8, y2: 17.2 },
  // Turn 3 Pad (U-turn on the left)
  { id: 'f3_turn3', x1: -18.0, x2: -5.0, z1: 68.0, z2: 80.0, y1: 17.2, y2: 17.8, axis: 'x_rev' },

  // Floor 4: Hammers & Fast Pushers (slopes from Left X=-14 to Right X=+14, rising Y=17.8 to 23.2)
  { id: 'f4_corridor', type: 'ramp_param', x1: -14.0, x2: 14.0, zCenter0: 76, zCenter1: 88, halfWidth: 5.2, y1: 17.8, y2: 23.2 },
  // Turn 4 Pad (U-turn on the right towards summit)
  { id: 'f4_turn4', x1: 5.0, x2: 18.0, z1: 84.0, z2: 96.0, y1: 23.2, y2: 24.0, axis: 'x' },

  // Floor 5: Final Ramp to summit
  { id: 'f5_ramp', x1: -4.5, x2: 14.0, z1: 94.0, z2: 106.0, y1: 24.0, y2: 26.0, axis: 'diag' },
  // Floor 5: Final stretch with pendulums
  { id: 'f5_stretch', x1: -5.5, x2: 5.5, z1: 104.0, z2: 118.0, y1: 26.0, y2: 26.0, axis: 'z' },
  // Floor 5: Grand Finish Arena & Podium
  { id: 'f5_finish', x1: -8.5, x2: 8.5, z1: 117.5, z2: 134.0, y1: 26.0, y2: 26.0, axis: 'z' }
];

export function surface(x, z, currentY = null) {
  let bestY = null;

  for (const slab of SLABS) {
    let y = null;

    if (slab.type === 'ramp_param') {
      if (x >= slab.x1 && x <= slab.x2) {
        const u = (x - slab.x1) / (slab.x2 - slab.x1);
        const zMid = slab.zCenter0 + (slab.zCenter1 - slab.zCenter0) * u;
        if (Math.abs(z - zMid) <= slab.halfWidth) {
          y = slab.y1 + (slab.y2 - slab.y1) * u;
        }
      }
    } else if (slab.type === 'f3_beams_conveyor') {
      if (x >= slab.x1 && x <= slab.x2) {
        const u = (slab.x2 - x) / (slab.x2 - slab.x1);
        const zMid = slab.zCenter0 + (slab.zCenter1 - slab.zCenter0) * u;
        const dz = Math.abs(z - zMid);
        // Beams section (u in [0.12, 0.48]): narrow parallel beams with gap in center
        if (u >= 0.12 && u <= 0.48) {
          const beamOffset = u < 0.28 ? 1.8 : 1.8 * (0.48 - u) / 0.20;
          if (Math.abs(dz - beamOffset) < 1.35) {
            y = slab.y1 + (slab.y2 - slab.y1) * u;
          }
        } else if (dz <= slab.halfWidth) {
          y = slab.y1 + (slab.y2 - slab.y1) * u;
        }
      }
    } else {
      if (x >= slab.x1 && x <= slab.x2 && z >= slab.z1 && z <= slab.z2) {
        if (slab.axis === 'z') {
          const ratio = (z - slab.z1) / (slab.z2 - slab.z1);
          y = slab.y1 + (slab.y2 - slab.y1) * ratio;
        } else if (slab.axis === 'x') {
          const ratio = (x - slab.x1) / (slab.x2 - slab.x1);
          y = slab.y1 + (slab.y2 - slab.y1) * ratio;
        } else if (slab.axis === 'x_rev') {
          const ratio = (slab.x2 - x) / (slab.x2 - slab.x1);
          y = slab.y1 + (slab.y2 - slab.y1) * ratio;
        } else if (slab.axis === 'diag') {
          const rz = (z - slab.z1) / (slab.z2 - slab.z1);
          const rx = (slab.x2 - x) / (slab.x2 - slab.x1);
          y = slab.y1 + (slab.y2 - slab.y1) * Math.min(1, Math.max(0, (rz + rx) * 0.5));
        } else {
          y = slab.y1;
        }
      }
    }

    if (y !== null) {
      if (currentY === null) {
        if (bestY === null || y > bestY) bestY = y;
      } else {
        // Only select surfaces near or below feet (up to +1.2 step up onto ramps)
        if (y <= currentY + 1.2) {
          if (bestY === null || y > bestY) bestY = y;
        } else if (bestY === null && y <= currentY + 3.2) {
          bestY = y;
        }
      }
    }
  }

  return bestY;
}

// ==================== COURSE STATE & GIANT BOULDER ====================
export function createCourse() {
  return {
    time: 0,
    boulder: {
      active: false,
      progress: 0,
      cooldown: 0,
      radius: 2.25,
      x: 13,
      y: 11.5,
      z: 56,
      rotZ: 0
    }
  };
}

export function advanceCourse(c, dt, actors = []) {
  c.time += dt;
  if (!c.boulder) {
    c.boulder = { active: false, progress: 0, cooldown: 0, radius: 2.25, x: 13, y: 11.5, z: 56, rotZ: 0 };
  }
  const b = c.boulder;
  if (b.cooldown > 0) b.cooldown -= dt;

  // Trigger: if boulder is idle and off cooldown, does any contestant approach Floor 2?
  if (!b.active && b.cooldown <= 0) {
    const someoneApproaching = actors.some(a => a.alive && (
      (a.z >= 34 && a.y >= 4.2 && a.x <= -3) ||
      (a.y >= 5.0 && a.y <= 12.0 && a.z >= 42 && a.z <= 58)
    ));
    if (someoneApproaching) {
      b.active = true;
      b.progress = 0;
    }
  }

  if (b.active) {
    b.progress += dt * 0.28;
    const u = 1 - Math.min(1, b.progress);
    b.x = -13 + 26 * u;
    b.z = 45 + 11 * u;
    b.y = 5.4 + 5.8 * u + b.radius * 0.85;
    b.rotZ += dt * 7.5;

    if (b.progress >= 1.25) {
      b.active = false;
      b.cooldown = 5.0;
    }
  }
}

// ==================== OBSTACLES AT TIME T ====================
export function obstaclesAt(t, courseState = null) {
  const out = [];

  // Floor 1: Yellow triangular bouncy bumpers
  out.push({ type: 'bumper', x: -2.4, y: 0.8, z: 12.0, radius: 1.0 });
  out.push({ type: 'bumper', x: 2.4, y: 0.8, z: 12.0, radius: 1.0 });
  out.push({ type: 'bumper', x: 0.0, y: 0.8, z: 16.5, radius: 1.0 });

  // Floor 1: Wall pushers (punching from left wall X=-6.5 towards +X)
  for (const z of [34.0, 37.5, 41.0]) {
    const ext = pusherExtension(t, z * 0.3);
    const x = -6.2 + ext * 3.6;
    out.push({ type: 'pusher', x, y: 5.4, z, radius: 1.35, ext });
  }

  // Floor 2: The Giant Rolling Boulder (ONE big ball on the second tier!)
  if (courseState && courseState.boulder && courseState.boulder.active) {
    const b = courseState.boulder;
    out.push({ type: 'ball', x: b.x, y: b.y, z: b.z, radius: b.radius, rotZ: b.rotZ, isGiant: true });
  }

  // Floor 3: Obstacle pillars on the conveyor belt
  for (const x of [-6.0, -9.0]) {
    const u = (13 - x) / 26;
    const z = 60 + 12 * u;
    const y = 11.8 + 5.2 * u + 0.8;
    out.push({ type: 'bumper', x, y, z, radius: 0.95 });
  }

  // Floor 4: Fast spinning mallets (pink double-headed hammers)
  for (const x of [-6.0, 0.0, 6.0]) {
    const u = (x - (-13)) / 26;
    const z = 76 + 12 * u;
    const y = 17.8 + 5.2 * u + 0.9;
    out.push({ type: 'hammer', x, y, z, angle: t * 3.8 + x, radius: 0.65, length: 4.2 });
  }

  // Floor 4: Fast pushers near top of tier 4
  for (const x of [8.5, 11.5]) {
    const u = (x - (-13)) / 26;
    const zBase = 76 + 12 * u;
    const y = 17.8 + 5.2 * u + 0.8;
    const ext = pusherExtension(t, x * 0.4);
    const z = zBase - 3.2 + ext * 3.2;
    out.push({ type: 'pusher', x, y, z, radius: 1.35, ext });
  }

  // Floor 5: Swinging pendulums guarding the final stretch
  for (const z of [108.0, 114.0]) {
    const swingX = Math.sin(t * 2.8 + z * 0.6) * 4.2;
    out.push({ type: 'pendulum', x: swingX, y: 27.2, z, radius: 1.25 });
  }

  return out;
}

export function obstacleContact(o, x, z) {
  if (o.type !== 'hammer') return { dx: x - o.x, dz: z - o.z };
  const dx = x - o.x, dz = z - o.z, ux = Math.cos(o.angle), uz = Math.sin(o.angle);
  const along = Math.max(-o.length, Math.min(o.length, dx * ux + dz * uz));
  return { dx: dx - ux * along, dz: dz - uz * along };
}

// ==================== WAYPOINTS & BOT AI NAVIGATION ====================
export const WAYPOINTS = [
  { x: 0, z: -2, y: 0 },
  { x: 0, z: 12, y: 0 },
  { x: 0, z: 20, y: 0 },
  { x: 0, z: 32, y: 4.8 },
  { x: -1.5, z: 39, y: 4.8 },
  { x: -10.0, z: 42, y: 5.2 },   // Turn 1 approach
  { x: -12.5, z: 45, y: 5.2 },   // Turn 1 apex
  { x: -10.0, z: 47, y: 5.8 },   // Floor 2 entrance
  { x: 0.0, z: 50.5, y: 8.3 },   // Floor 2 ramp center
  { x: 10.0, z: 54.5, y: 10.4 }, // Floor 2 ramp upper
  { x: 13.0, z: 58.0, y: 11.2 }, // Turn 2 apex
  { x: 10.0, z: 62.0, y: 12.4 }, // Floor 3 entrance
  { x: 0.0, z: 66.0, y: 14.4 },  // Floor 3 mid
  { x: -10.0, z: 70.0, y: 16.4 },// Floor 3 Conveyor
  { x: -13.0, z: 74.0, y: 17.2 },// Turn 3 apex
  { x: -10.0, z: 78.5, y: 18.5 },// Floor 4 entrance
  { x: 0.0, z: 82.0, y: 20.6 },  // Floor 4 mid
  { x: 10.0, z: 85.5, y: 22.6 }, // Floor 4 upper
  { x: 13.0, z: 90.0, y: 23.2 }, // Turn 4 apex
  { x: 6.0, z: 98.0, y: 24.8 },  // Final ramp
  { x: 0.0, z: 106.0, y: 26.0 }, // Final stretch
  { x: 0.0, z: 116.0, y: 26.0 }, // Finish approach
  { x: 0.0, z: 125.0, y: 26.0 }  // Finish line!
];

export function botDecision(c, a) {
  const elite = a.id === 'bot_0' || a.id === 'bot_1';

  if (a.wpIdx === undefined) a.wpIdx = 0;

  // Advance waypoint index as the bot reaches or passes waypoints
  while (a.wpIdx < WAYPOINTS.length - 1) {
    const wp = WAYPOINTS[a.wpIdx];
    const d = Math.hypot(wp.x - a.x, wp.z - a.z);
    if (d < 3.2 || (a.wpIdx === 0 && a.z > wp.z)) {
      a.wpIdx++;
    } else {
      break;
    }
  }

  const target = WAYPOINTS[a.wpIdx];
  let targetX = target.x;
  let targetZ = target.z;

  // Obstacle evasion
  const obstacles = obstaclesAt(c.time + 0.35, c);
  for (const o of obstacles) {
    if (Math.abs(a.y - o.y) > 2.0) continue;
    const dx = a.x - o.x;
    const dz = a.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d < o.radius + 1.8) {
      if (o.type === 'ball') {
        // Dodge the giant boulder: step towards the ramp edge!
        targetZ = o.z + (dz >= 0 ? 3.2 : -3.2);
      } else if (o.type === 'pusher') {
        // Steer away from the wall
        targetX = a.x > o.x ? o.x + o.radius + 1.5 : o.x - o.radius - 1.5;
      } else if (o.type === 'hammer') {
        targetX += dx > 0 ? 1.5 : -1.5;
      }
    }
  }

  const dx = targetX - a.x;
  const dz = targetZ - a.z;
  const len = Math.hypot(dx, dz);

  const speed = elite ? 7.0 : 6.0;
  let vx = 0, vz = 0;
  if (len > 0.1) {
    vx = (dx / len) * speed;
    vz = (dz / len) * speed;
  }

  const jump = a.onGround && (
    (a.z >= 19 && a.z <= 21) ||
    (a.y >= 11.5 && a.y <= 13.0 && Math.abs(a.x) < 2.0)
  );

  return { vx, vz, jump };
}
