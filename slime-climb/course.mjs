// Slime Climb: Authentic Fall Guys obstacle course.
// Multi-tier switchback tower with glossy bouncers, real stepped stairs,
// snappy punchy pushers with AABB collision, Floor 2 staircase-triggered Giant Boulder,
// 2 rotating cylinders with a lower recovery pit, fast spinning hammers with instant swat,
// and rising pink slime.

export const LENGTH = 124;
export const LIMIT = 135;
export const TRACK_HALF = 8;
export const FINISH_Y = 26.0;

export const zones = [
  { name: 'Старт и бамперы', floor: 1, fromZ: -6, toZ: 20, y: 0, type: 'bumpers' },
  { name: 'Лестница на 1 этаж', floor: 1, fromZ: 20, toZ: 32, y: 2.4, type: 'stairs' },
  { name: 'Первые толкатели', floor: 1, fromZ: 32, toZ: 43, y: 4.8, type: 'pushers' },
  { name: 'Разворот 1 и подъем', floor: 1, fromZ: 40, toZ: 52, y: 5.2, type: 'turn' },
  { name: 'Склон с гигантским шаром', floor: 2, fromZ: 44, toZ: 58, y: 8.5, type: 'boulder_ramp' },
  { name: 'Разворот 2', floor: 2, fromZ: 52, toZ: 64, y: 11.2, type: 'turn' },
  { name: 'Вращающиеся бревна и яма', floor: 3, fromZ: 58, toZ: 68, y: 12.2, type: 'rotating_logs' },
  { name: 'Конвейер', floor: 3, fromZ: 66, toZ: 76, y: 15.5, type: 'conveyor' },
  { name: 'Разворот 3', floor: 3, fromZ: 70, toZ: 82, y: 17.2, type: 'turn' },
  { name: 'Молоты и быстрые блоки', floor: 4, fromZ: 76, toZ: 92, y: 20.5, type: 'hammers' },
  { name: 'Разворот 4', floor: 4, fromZ: 88, toZ: 98, y: 23.2, type: 'turn' },
  { name: 'Финальный подъем и маятники', floor: 5, fromZ: 98, toZ: 118, y: 25.5, type: 'pendulums' },
  { name: 'Финишная арена', floor: 5, fromZ: 118, toZ: 134, y: 26.0, type: 'finish' }
];

export function courseY(z) {
  if (z < 20) return 0;
  if (z < 32) return 0.8 * Math.min(6, Math.floor((z - 20) / 2) + 1);
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

export function pusherExtension(t, phaseOffset = 0) {
  const period = 1.45;
  const tau = ((t + phaseOffset) % period + period) % period;
  if (tau < 0.60) return 0; // retracted
  if (tau < 0.80) return (tau - 0.60) / 0.20; // explosive punch out
  if (tau < 1.10) return 1.0; // held extended
  return Math.max(0, 1.0 - (tau - 1.10) / 0.35); // smooth retract
}

// ==================== MULTI-TIER SURFACE COLLISION ====================
export const SLABS = [
  // Floor 1: Start pad
  { id: 'f1_start', x1: -8.5, x2: 8.5, z1: -8.0, z2: 6.5, y1: 0, y2: 0, axis: 'z' },
  // Floor 1: Runway with bumpers
  { id: 'f1_runway', x1: -4.8, x2: 4.8, z1: 6.0, z2: 20.5, y1: 0, y2: 0, axis: 'z' },
  // Floor 1: Real stepped stairs (6 distinct steps) up to pusher walkway
  { id: 'f1_stairs', type: 'stairs_z', x1: -4.8, x2: 4.8, z1: 20.0, z2: 32.5, numSteps: 6, yStart: 0.8, yStep: 0.8 },
  // Floor 1: Pusher walkway
  { id: 'f1_pushers', x1: -6.5, x2: 3.5, z1: 32.0, z2: 43.5, y1: 4.8, y2: 4.8, axis: 'z' },
  // Floor 1: Open walkway connecting pushers to Turn 1
  { id: 'f1_walkway', x1: -7.0, x2: 3.5, z1: 43.0, z2: 48.0, y1: 4.8, y2: 5.0, axis: 'z' },
  // Turn 1 Pad (U-turn on the left with generous area)
  { id: 'f1_turn1', x1: -16.5, x2: -3.0, z1: 40.0, z2: 52.0, y1: 4.8, y2: 5.2, axis: 'x_rev' },
  // Staircase leading from Turn 1 onto Floor 2 ramp
  { id: 'f1_stairs2', x1: -13.5, x2: -7.5, z1: 46.0, z2: 52.0, y1: 5.2, y2: 5.6, axis: 'x' },

  // Floor 2: The Giant Boulder Ramp (Left X=-14 to Right X=+14, rising Y=5.4 to 11.2)
  { id: 'f2_boulder_ramp', type: 'ramp_param', x1: -14.0, x2: 14.0, zCenter0: 45, zCenter1: 56, halfWidth: 5.5, y1: 5.4, y2: 11.2 },
  // Turn 2 Pad (U-turn on the right)
  { id: 'f2_turn2', x1: 5.0, x2: 18.0, z1: 52.0, z2: 64.0, y1: 11.2, y2: 11.8, axis: 'x' },

  // Floor 3: TWO ROTATING CYLINDERS (Brevna) from X=14 down to X=0
  { id: 'f3_logs', type: 'rotating_logs', x1: 0.0, x2: 14.0, z1: 59.5, z2: 66.5, yAxis: 11.6, radius: 0.85 },
  // Floor 3: Lower Pit / Recovery Deck underneath the rotating cylinders
  { id: 'f3_pit', x1: 0.0, x2: 12.5, z1: 60.0, z2: 66.0, y1: 9.8, y2: 9.8, axis: 'z' },
  // Floor 3: Pit Recovery Stairs leading back up to the cylinders entrance
  { id: 'f3_pit_stairs', x1: 12.5, x2: 16.0, z1: 58.0, z2: 63.0, y1: 9.8, y2: 11.8, axis: 'z_rev' },
  // Floor 3: Platform connecting rotating cylinders exit to conveyor
  { id: 'f3_log_exit', x1: -4.0, x2: 1.5, z1: 58.0, z2: 70.0, y1: 12.0, y2: 14.5, axis: 'x_rev' },
  // Floor 3: Conveyor section from X=0 down to X=-14 (y1 at x=-14 is 17.2, y2 at x=-1 is 14.5)
  { id: 'f3_conveyor', type: 'ramp_param', x1: -14.0, x2: -1.0, zCenter0: 64, zCenter1: 72, halfWidth: 6.0, y1: 17.2, y2: 14.5 },
  // Turn 3 Pad (U-turn on the left)
  { id: 'f3_turn3', x1: -18.0, x2: -10.0, z1: 68.0, z2: 80.0, y1: 17.2, y2: 17.8, axis: 'x_rev' },

  // Floor 4: Hammers & Fast Pushers (Left X=-14 to Right X=+14, rising Y=17.8 to 23.2)
  { id: 'f4_corridor', type: 'ramp_param', x1: -14.0, x2: 14.0, zCenter0: 76, zCenter1: 88, halfWidth: 5.5, y1: 17.8, y2: 23.2 },
  // Turn 4 Pad (U-turn on the right towards summit)
  { id: 'f4_turn4', x1: 7.0, x2: 18.0, z1: 84.0, z2: 98.0, y1: 23.2, y2: 24.2, axis: 'x' },

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

    if (slab.type === 'stairs_z') {
      if (x >= slab.x1 && x <= slab.x2 && z >= slab.z1 && z <= slab.z2) {
        const step = Math.min(slab.numSteps - 1, Math.floor((z - slab.z1) / ((slab.z2 - slab.z1) / slab.numSteps)));
        y = slab.yStart + step * slab.yStep;
      }
    } else if (slab.type === 'rotating_logs') {
      if (x >= slab.x1 && x <= slab.x2) {
        const dz1 = Math.abs(z - 61.5);
        const dz2 = Math.abs(z - 64.5);
        const dzMin = Math.min(dz1, dz2);
        if (dzMin <= slab.radius) {
          const dy = Math.sqrt(Math.max(0, slab.radius * slab.radius - dzMin * dzMin));
          y = slab.yAxis + dy;
        }
      }
    } else if (slab.type === 'ramp_param') {
      if (x >= slab.x1 && x <= slab.x2) {
        const u = (x - slab.x1) / (slab.x2 - slab.x1);
        const zMid = slab.zCenter0 + (slab.zCenter1 - slab.zCenter0) * u;
        if (Math.abs(z - zMid) <= slab.halfWidth) {
          y = slab.y1 + (slab.y2 - slab.y1) * u;
        }
      }
    } else {
      if (x >= slab.x1 && x <= slab.x2 && z >= slab.z1 && z <= slab.z2) {
        if (slab.axis === 'z') {
          const ratio = (z - slab.z1) / (slab.z2 - slab.z1);
          y = slab.y1 + (slab.y2 - slab.y1) * ratio;
        } else if (slab.axis === 'z_rev') {
          const ratio = (slab.z2 - z) / (slab.z2 - slab.z1);
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
        // Priority 1: surfaces at or below feet (walkable surfaces)
        if (y <= currentY + 0.8) {
          if (bestY === null || bestY > currentY + 0.8 || y > bestY) {
            bestY = y;
          }
        } else if (bestY === null || bestY > currentY + 0.8) {
          // Priority 2: surfaces slightly above feet (stepping up onto ramps)
          if (y <= currentY + 2.5) {
            if (bestY === null || y < bestY) {
              bestY = y;
            }
          }
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
    logAngle1: 0,
    logAngle2: 0,
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
  c.logAngle1 = (c.logAngle1 || 0) + dt * 2.2;
  c.logAngle2 = (c.logAngle2 || 0) - dt * 2.2;

  if (!c.boulder) {
    c.boulder = { active: false, progress: 0, cooldown: 0, radius: 2.25, x: 13, y: 11.5, z: 56, rotZ: 0 };
  }
  const b = c.boulder;
  if (b.cooldown > 0) b.cooldown -= dt;

  // Requirement 4: The Giant Ball starts rolling ONLY when the first living character
  // actually steps onto the staircase / ramp leading up to Floor 2!
  if (!b.active && b.cooldown <= 0) {
    const someoneSteppedOnRamp = actors.some(a => a.alive && (
      (a.y >= 5.1 && a.z >= 45 && a.z <= 58 && a.x >= -12.5) ||
      (a.y >= 5.5 && a.z >= 43 && a.z <= 58)
    ));
    if (someoneSteppedOnRamp) {
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
      b.cooldown = 5.5;
    }
  }
}

// ==================== OBSTACLES AT TIME T ====================
export function obstaclesAt(t, courseState = null) {
  const out = [];

  // Requirement 1: Three solid glossy bouncy triangular bumpers on Floor 1 runway
  out.push({ type: 'bumper_tri', x: -2.3, y: 0.6, z: 11.5, radius: 1.25 });
  out.push({ type: 'bumper_tri', x: 2.3, y: 0.6, z: 11.5, radius: 1.25 });
  out.push({ type: 'bumper_tri', x: 0.0, y: 0.6, z: 16.5, radius: 1.25 });

  // Requirement 3: Snappy punchy pushers with exact bounding boxes
  for (const z of [34.0, 37.5, 41.0]) {
    const ext = pusherExtension(t, z * 0.35);
    const xMax = -6.2 + ext * 4.4;
    out.push({
      type: 'pusher_box',
      x: xMax - 0.6,
      xMax,
      y: 5.4,
      z,
      zMin: z - 1.25,
      zMax: z + 1.25,
      ext,
      radius: 1.35
    });
  }

  // Requirement 4: The Giant Rolling Boulder (Floor 2)
  if (courseState && courseState.boulder && courseState.boulder.active) {
    const b = courseState.boulder;
    out.push({ type: 'ball', x: b.x, y: b.y, z: b.z, radius: b.radius, rotZ: b.rotZ, isGiant: true });
  }

  // Requirement 6: Fast spinning hammers on Floor 4 with exact mallet coordinates
  const hammerAngle = t * 4.2;
  for (const x of [-6.0, 0.0, 6.0]) {
    const u = (x - (-13)) / 26;
    const z = 76 + 12 * u;
    const y = 17.8 + 5.2 * u + 0.9;
    const a = hammerAngle + x;
    const armLen = 4.2;
    const head1 = { x: x + Math.cos(a) * armLen, z: z + Math.sin(a) * armLen };
    const head2 = { x: x - Math.cos(a) * armLen, z: z - Math.sin(a) * armLen };
    out.push({
      type: 'hammer_dynamic',
      x,
      y,
      z,
      angle: a,
      armLen,
      headRadius: 0.95,
      head1,
      head2,
      omega: 4.2
    });
  }

  // Floor 4: Fast pushers near upper tier
  for (const x of [8.5, 11.5]) {
    const u = (x - (-13)) / 26;
    const zBase = 76 + 12 * u;
    const y = 17.8 + 5.2 * u + 0.8;
    const ext = pusherExtension(t, x * 0.4);
    const z = zBase - 3.2 + ext * 3.4;
    out.push({ type: 'pusher', x, y, z, radius: 1.35, ext });
  }

  // Floor 5: Swinging pendulums
  for (const z of [108.0, 114.0]) {
    const swingX = Math.sin(t * 2.8 + z * 0.6) * 4.2;
    out.push({ type: 'pendulum', x: swingX, y: 27.2, z, radius: 1.25 });
  }

  return out;
}

export function obstacleContact(o, x, z) {
  if (o.type === 'hammer_dynamic') {
    const dx1 = x - o.head1.x, dz1 = z - o.head1.z, d1 = Math.hypot(dx1, dz1);
    const dx2 = x - o.head2.x, dz2 = z - o.head2.z, d2 = Math.hypot(dx2, dz2);
    if (d1 < d2) return { dx: dx1, dz: dz1, dist: d1, hitHead: 1 };
    return { dx: dx2, dz: dz2, dist: d2, hitHead: 2 };
  }
  return { dx: x - o.x, dz: z - o.z };
}

// ==================== WAYPOINTS & BOT AI NAVIGATION ====================
export const WAYPOINTS = [
  { x: 0, z: -2, y: 0 },
  { x: 0, z: 12, y: 0 },
  { x: 0, z: 20, y: 0 },
  { x: 0, z: 32, y: 4.8 },       // Top of stepped stairs
  { x: -1.5, z: 39, y: 4.8 },    // Pusher alley 1
  { x: -1.5, z: 44, y: 4.8 },    // Walkway past pushers
  { x: -10.0, z: 44, y: 5.2 },   // Turn 1 approach
  { x: -12.5, z: 47, y: 5.2 },   // Turn 1 apex
  { x: -10.0, z: 48.5, y: 5.6 }, // Floor 2 entrance stairs
  { x: 0.0, z: 50.5, y: 8.3 },   // Floor 2 ramp center (boulder ramp)
  { x: 10.0, z: 54.5, y: 10.4 }, // Floor 2 ramp upper
  { x: 13.5, z: 58.0, y: 11.2 }, // Turn 2 apex
  { x: 13.5, z: 61.5, y: 11.8 }, // Turn 2 entry to cylinder 1 (squared up)
  { x: 11.0, z: 61.5, y: 12.2 }, // Rotating cylinder 1 start
  { x: 6.0, z: 61.5, y: 12.2 },  // Rotating cylinder 1 mid
  { x: 0.5, z: 61.5, y: 12.2 },  // Rotating cylinder 1 end
  { x: -2.0, z: 63.5, y: 13.5 }, // Exit platform connecting log to conveyor
  { x: -5.0, z: 66.5, y: 14.8 }, // Floor 3 Conveyor
  { x: -10.0, z: 70.0, y: 16.4 },// Floor 3 Conveyor end
  { x: -13.0, z: 74.0, y: 17.2 },// Turn 3 apex
  { x: -10.0, z: 78.5, y: 18.5 },// Floor 4 entrance
  { x: 0.0, z: 82.0, y: 20.6 },  // Floor 4 mid (hammers)
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

  // If the bot fell into the recovery pit under the cylinders (y in [9.0, 10.1]):
  // Steer towards the pit recovery stairs at X=14.5, Z=59
  if (a.y >= 9.0 && a.y <= 10.1 && a.x >= 0.0 && a.x <= 12.0 && a.z >= 59 && a.z <= 67) {
    const dx = 14.5 - a.x, dz = 59.0 - a.z;
    const len = Math.hypot(dx, dz);
    return { vx: (dx / (len || 1)) * 6.5, vz: (dz / (len || 1)) * 6.5, jump: a.onGround && a.x > 12 };
  }

  // Advance waypoint index
  while (a.wpIdx < WAYPOINTS.length - 1) {
    const wp = WAYPOINTS[a.wpIdx];
    const d = Math.hypot(wp.x - a.x, wp.z - a.z);
    // Tighter acceptance radius when aligning to enter the narrow rotating cylinders
    const threshold = (a.wpIdx === 11 || a.wpIdx === 12) ? 1.4 : 3.0;
    if (d < threshold || (a.wpIdx === 0 && a.z > wp.z)) {
      a.wpIdx++;
    } else {
      break;
    }
  }

  const target = WAYPOINTS[a.wpIdx];
  const dx = target.x - a.x;
  const dz = target.z - a.z;
  const len = Math.hypot(dx, dz);

  const speed = elite ? 7.2 : 6.2;
  let vx = 0, vz = 0;
  if (len > 0.1) {
    vx = (dx / len) * speed;
    vz = (dz / len) * speed;
  }

  // 1. Уклонение от глянцевых треугольных бамперов на старте (Z in [10, 18])
  if (a.z >= 9.5 && a.z <= 17.5) {
    if (Math.hypot(a.x - 0.0, a.z - 16.5) < 1.7) {
      vx += (a.x >= 0 ? 3.0 : -3.0);
    } else if (Math.hypot(a.x - (-2.3), a.z - 11.5) < 1.7) {
      vx += 3.2;
    } else if (Math.hypot(a.x - 2.3, a.z - 11.5) < 1.7) {
      vx -= 3.2;
    }
  }

  // 2. Уклонение от боксерских толкателей на 1 этаже (Z in [33, 43])
  if (a.z >= 33.0 && a.z <= 42.5 && a.x < -0.8) {
    // Держимся правой стороны прохода, чтобы толкатели не сбросили в слайм
    vx += 2.5;
  }

  // 3. Активная компенсация вращения цилиндров (бревен) на 3 этаже
  if (a.x >= 1.0 && a.x <= 13.0 && a.y >= 11.4 && a.y <= 13.0) {
    if (Math.abs(a.z - 61.5) < 0.95) {
      // Цилиндр сносит в +Z, бот активно удерживает центр цилиндра
      vz -= 1.8;
    } else if (Math.abs(a.z - 64.5) < 0.95) {
      // Цилиндр сносит в -Z
      vz += 1.8;
    }
  }

  // 4. Уклонение от катящегося гигантского шара на 2 этаже
  if (c && c.boulder && c.boulder.active && a.y >= 5.2 && a.y <= 11.5 && Math.abs(a.z - c.boulder.z) < 7.0) {
    // Если шар близко, смещаемся к безопасному краю рампы
    const avoidDir = (a.x > c.boulder.x) ? 3.5 : -3.5;
    vx += avoidDir;
  }

  const jump = a.onGround && (
    (a.z >= 19 && a.z <= 21) ||
    (a.y >= 5.0 && a.y <= 5.4 && a.x >= -12 && a.x <= -8)
  );

  return { vx, vz, jump };
}
