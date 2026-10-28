// Jump Showdown: circular arena with 8 dropping platform sectors and two spinning sweepers.
// Based on Fall Guys Jump Showdown (wiki & video reference).

export const NUM_SECTORS = 8;
export const TAU = Math.PI * 2;
export const SECTOR_ANGLE = TAU / NUM_SECTORS; // 45 degrees per wedge
export const INNER_RADIUS = 3.2;  // central hub cutout
export const OUTER_RADIUS = 14.8; // outer perimeter
export const SECTOR_GAP = 0.32;   // physical slit gap between adjacent sectors
export const LIMIT = 180;         // max match duration (3 minutes)

export const wrapAngle = a => ((a % TAU) + TAU) % TAU;

// Pre-planned schedule for dropping sectors over time, leaving exactly 2 safe sectors at the climax.
// Format: [triggerTimeSec, maxDrops]
export const DROP_SCHEDULE = [
  { triggerTime: 12.0, dropCount: 1 },
  { triggerTime: 26.0, dropCount: 2 },
  { triggerTime: 42.0, dropCount: 3 },
  { triggerTime: 62.0, dropCount: 4 },
  { triggerTime: 84.0, dropCount: 5 },
  { triggerTime: 108.0, dropCount: 6 } // 6 dropped = 2 sectors remaining!
];

export function createShowdown() {
  const sectors = [];
  for (let i = 0; i < NUM_SECTORS; i++) {
    const angleStart = i * SECTOR_ANGLE;
    const angleEnd = (i + 1) * SECTOR_ANGLE;
    const angleMid = angleStart + SECTOR_ANGLE * 0.5;
    sectors.push({
      index: i,
      angleStart,
      angleEnd,
      angleMid,
      state: 'solid', // 'solid' | 'warning' | 'falling' | 'dropped'
      warningTimer: 0,
      fallTimer: 0,
      yOffset: 0,
      pitchOffset: 0,
      sirenFlash: 0
    });
  }

  return {
    time: 0,
    sectors,
    droppedTotal: 0,
    nextDropIdx: 0,
    // Lower sweeper (low green roller): waist-height, must be jumped over!
    lowBar: {
      y: 0.78,
      radius: 0.38,
      length: OUTER_RADIUS + 0.5,
      angle: 0.0,
      omega: 0.72 // speeds up progressively to ~2.2 rad/s
    },
    // Upper sweeper (high overhead arm): overhead height, rotates at different speed!
    highBar: {
      y: 2.30,
      radius: 0.32,
      length: OUTER_RADIUS + 0.5,
      angle: Math.PI * 0.85,
      omega: 0.98 // speeds up to ~3.0 rad/s
    }
  };
}

export function speedMultiplier(t) {
  // Starts at 1.0, scales smoothly to 2.8x by t=140s
  return 1.0 + Math.min(1.8, Math.max(0, t / 140) * 1.8);
}

export function advanceShowdown(c, dt) {
  c.time += dt;
  const spd = speedMultiplier(c.time);

  // 1. Advance sweepers
  c.lowBar.omega = (0.72 + Math.min(1.48, (c.time / 140) * 1.48)) * 1.0;
  c.highBar.omega = c.lowBar.omega * 1.36; // different speed creates periodic double-decker overlaps!

  c.lowBar.previousAngle = c.lowBar.angle;
  c.highBar.previousAngle = c.highBar.angle;
  c.lowBar.angle = wrapAngle(c.lowBar.angle + c.lowBar.omega * dt);
  c.highBar.angle = wrapAngle(c.highBar.angle + c.highBar.omega * dt);

  // 2. Check sector drop schedule
  if (c.nextDropIdx < DROP_SCHEDULE.length && c.time >= DROP_SCHEDULE[c.nextDropIdx].triggerTime) {
    const targetDropCount = DROP_SCHEDULE[c.nextDropIdx].dropCount;
    c.nextDropIdx++;

    // Pick a solid sector to start warning shake
    const solidSectors = c.sectors.filter(s => s.state === 'solid');
    // Ensure we never drop more than 6 sectors (at least 2 always remain)
    if (solidSectors.length > 2 && c.droppedTotal < targetDropCount) {
      // Pick random solid sector
      const pick = solidSectors[Math.floor(Math.random() * solidSectors.length)];
      pick.state = 'warning';
      pick.warningTimer = 4.2; // 4.2 seconds warning shake & siren before dropping!
    }
  }

  // 3. Advance sector states & animations
  for (const s of c.sectors) {
    if (s.state === 'warning') {
      s.warningTimer -= dt;
      s.sirenFlash = (s.sirenFlash + dt * 12) % TAU;
      // Rumbling shake up/down:
      s.yOffset = Math.sin(c.time * 38) * 0.08;
      if (s.warningTimer <= 0) {
        s.state = 'falling';
        s.fallTimer = 0;
        c.droppedTotal++;
      }
    } else if (s.state === 'falling') {
      s.fallTimer += dt;
      // Accelerate downwards into slime:
      s.yOffset -= 24.0 * s.fallTimer * dt;
      // Tilt downwards outward:
      s.pitchOffset += 0.45 * dt;
      if (s.yOffset < -25.0) {
        s.state = 'dropped';
      }
    } else if (s.state === 'solid') {
      s.yOffset = 0;
      s.pitchOffset = 0;
    }
  }
}

export function getSectorAt(course, x, z) {
  const dist = Math.hypot(x, z);
  if (dist < INNER_RADIUS + 0.02 || dist > OUTER_RADIUS - 0.02) return null;
  const rawAngle = Math.atan2(z, x); // -PI..PI
  const theta = wrapAngle(rawAngle); // 0..TAU
  const idx = Math.min(NUM_SECTORS - 1, Math.floor(theta / SECTOR_ANGLE));
  const sector = course.sectors[idx];

  // Check physical slit gap between adjacent sectors
  const relAngle = Math.abs(theta - sector.angleMid);
  const halfSectorAngle = SECTOR_ANGLE * 0.5;
  const angularDistToEdge = halfSectorAngle - relAngle;
  const inGap = angularDistToEdge < (SECTOR_GAP * 0.5) / ((INNER_RADIUS + OUTER_RADIUS) * 0.5);
  return { sector, dist, theta, inGap, idx };
}

export function sampleSurface(course, x, z) {
  const info = getSectorAt(course, x, z);
  if (!info) return null;
  if (info.inGap) return null; // character steps into the empty slit gap!

  const s = info.sector;
  if (s.state === 'dropped') return null;
  if (s.state === 'falling' && s.yOffset < -1.8) return null;

  return {
    sector: s,
    y: s.yOffset,
    dist: info.dist,
    theta: info.theta
  };
}

// Continuous collision between actor and rotating sweepers
export function checkSweeperHit(course, actor) {
  if (!actor || !actor.alive) return null;

  const dist = Math.hypot(actor.x, actor.z);
  if (dist < INNER_RADIUS - 0.8 || dist > OUTER_RADIUS + 0.8) return null;

  const actorTheta = wrapAngle(Math.atan2(actor.z, actor.x));
  const actorY = actor.y;
  const sweptDistance = bar => {
    const now = Math.abs(wrapAngle(actorTheta - bar.angle + Math.PI) - Math.PI);
    if (bar.previousAngle === undefined) return now;
    const travel = wrapAngle(bar.angle - bar.previousAngle);
    const fromStart = wrapAngle(actorTheta - bar.previousAngle);
    if (fromStart <= travel) return 0;
    const start = Math.abs(wrapAngle(actorTheta - bar.previousAngle + Math.PI) - Math.PI);
    return Math.min(now, start);
  };

  // 1. Lower Sweeper (Low Roller):
  // Character must jump over it (a.y >= 1.25)
  const dThetaLow = sweptDistance(course.lowBar);
  const arcDistLow = dist * dThetaLow;
  const hitDistLow = course.lowBar.radius + actor.radius * 0.72; // ~0.95m

  if (arcDistLow < hitDistLow) {
    // If actor jumped high enough: clean clearance!
    if (actorY >= course.lowBar.y + course.lowBar.radius + 0.12) {
      // Cleared low bar safely!
    } else if (actorY <= course.lowBar.y + course.lowBar.radius + 0.65) {
      // HIT BY LOWER ROLLER!
      const tangX = -Math.sin(course.lowBar.angle);
      const tangZ = Math.cos(course.lowBar.angle);
      const radX = actor.x / (dist || 1);
      const radZ = actor.z / (dist || 1);
      const hitSpeed = 7.0 + course.lowBar.omega * dist * 0.85;

      return {
        bar: 'low',
        knockVx: tangX * hitSpeed + radX * 4.5,
        knockVz: tangZ * hitSpeed + radZ * 4.5,
        vy: 4.5,
        squash: 0.35
      };
    }
  }

  // 2. Upper Sweeper (High Overhead Arm):
  // Character is safe on ground (a.y <= 0.45); hit if jumping in mid-air (a.y in [1.35, 3.2])
  const dThetaHigh = sweptDistance(course.highBar);
  const arcDistHigh = dist * dThetaHigh;
  const hitDistHigh = course.highBar.radius + actor.radius * 0.72;

  if (arcDistHigh < hitDistHigh) {
    if (actorY <= 0.45) {
      // Ducked safely under high bar!
    } else if (actorY > 0.45 && actorY <= course.highBar.y + course.highBar.radius + 0.8) {
      // HIT BY UPPER OVERHEAD ARM IN MID-AIR!
      const tangX = -Math.sin(course.highBar.angle);
      const tangZ = Math.cos(course.highBar.angle);
      const radX = actor.x / (dist || 1);
      const radZ = actor.z / (dist || 1);
      const hitSpeed = 9.0 + course.highBar.omega * dist * 0.9;

      return {
        bar: 'high',
        knockVx: tangX * hitSpeed + radX * 5.5,
        knockVz: tangZ * hitSpeed + radZ * 5.5,
        vy: 2.5,
        squash: 0.40
      };
    }
  }

  return null;
}

// Bot AI: evacuation when sector shakes, jumping low sweeper with high-bar overlap awareness
export function botDecision(course, actor) {
  const idNum = Number(String(actor.id || '').replace(/\D/g, '')) || 0;
  const elite = idNum <= 3;

  const info = getSectorAt(course, actor.x, actor.z);
  const currentSector = info ? info.sector : null;

  // 1. Sector Evacuation: if on a warning or falling sector, flee to nearest solid sector!
  if (currentSector && (currentSector.state === 'warning' || currentSector.state === 'falling')) {
    // Find adjacent solid sectors (left or right)
    let bestTargetSector = null;
    let minIdxDiff = 99;

    for (let offset = 1; offset < NUM_SECTORS; offset++) {
      for (const dir of [1, -1]) {
        const checkIdx = (currentSector.index + offset * dir + NUM_SECTORS) % NUM_SECTORS;
        const candidate = course.sectors[checkIdx];
        if (candidate.state === 'solid') {
          bestTargetSector = candidate;
          minIdxDiff = offset;
          break;
        }
      }
      if (bestTargetSector) break;
    }

    if (bestTargetSector) {
      const targetR = 9.0;
      const targetX = Math.cos(bestTargetSector.angleMid) * targetR;
      const targetZ = Math.sin(bestTargetSector.angleMid) * targetR;
      const dx = targetX - actor.x;
      const dz = targetZ - actor.z;
      const len = Math.hypot(dx, dz) || 1;
      const speed = elite ? 7.2 : 6.4;

      // Jump when crossing sector gaps
      const jump = actor.onGround && (info.inGap || Math.abs(wrapAngle(info.theta - bestTargetSector.angleMid)) > 0.3);
      return {
        vx: (dx / len) * speed,
        vz: (dz / len) * speed,
        jump
      };
    }
  }

  // 2. Center positioning on current safe sector
  const targetR = 8.5 + (idNum % 3) * 1.8; // distribute bots radially [8.5, 10.3, 12.1]
  const secMid = currentSector ? currentSector.angleMid : Math.atan2(actor.z, actor.x);
  const idealX = Math.cos(secMid) * targetR;
  const idealZ = Math.sin(secMid) * targetR;

  let dx = idealX - actor.x;
  let dz = idealZ - actor.z;
  const distToIdeal = Math.hypot(dx, dz);

  let vx = 0, vz = 0;
  if (distToIdeal > 0.4) {
    const s = 4.2;
    vx = (dx / distToIdeal) * s;
    vz = (dz / distToIdeal) * s;
  }

  // 3. Sweeper jump timing
  const actorDist = Math.hypot(actor.x, actor.z);
  const actorTheta = wrapAngle(Math.atan2(actor.z, actor.x));

  // Time until lower sweeper reaches actor
  // Sweeper rotates clockwise (increasing theta)
  const angleToLow = wrapAngle(actorTheta - course.lowBar.angle);
  const timeToLow = angleToLow / (course.lowBar.omega || 1);

  // Time until high sweeper reaches actor
  const angleToHigh = wrapAngle(actorTheta - course.highBar.angle);
  const timeToHigh = angleToHigh / (course.highBar.omega || 1);

  // Jump trigger: low bar is approaching within ~0.26s
  const lowBarIncoming = timeToLow > 0.02 && timeToLow < (elite ? 0.28 : 0.24);

  // Overlap danger: will high bar hit us if we jump?
  const highBarOverlap = Math.abs(timeToLow - timeToHigh) < 0.22;

  let jump = false;
  if (actor.onGround && lowBarIncoming) {
    if (!highBarOverlap || !elite) {
      // Safe to jump!
      jump = true;
    } else {
      // High bar is overlapping! Elite bot dives or jumps early/late to thread the needle
      jump = timeToLow < 0.16;
    }
  }

  return { vx, vz, jump };
}

export function getRemainingSectors(course) {
  return course.sectors.filter(s => s.state === 'solid' || s.state === 'warning');
}

