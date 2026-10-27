import { LENGTH, LIMIT, zones, obstaclesAt, courseY, slimeY, FINISH_Y, SLABS } from './course.mjs';

export function createVisuals(THREE, c) {
  const root = new THREE.Group(), mats = [];
  const mat = (color, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, ...opts });
    mats.push(m);
    return m;
  };

  const glossyYellow = mat(0xffcf25, { roughness: 0.1, metalness: 0.15, emissive: 0x443300, emissiveIntensity: 0.2 });
  const glossyPink = mat(0xff2277, { roughness: 0.12, metalness: 0.15, emissive: 0x330015, emissiveIntensity: 0.2 });
  const pink = mat(0xff3585);
  const cyan = mat(0x28c8e8);
  const yellow = mat(0xffcf25);
  const purple = mat(0x8a3bd6);
  const darkWall = mat(0x35195e);
  const mint = mat(0x25e0a0);
  const orange = mat(0xff7722);
  const white = mat(0xffffff, { roughness: 0.2 });
  const metal = mat(0x707590, { metalness: 0.75, roughness: 0.25 });
  const wood = mat(0xbb7733, { roughness: 0.6, metalness: 0.05 });

  const slimeMat = mat(0xff1875, {
    emissive: 0xd9005c,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.92,
    roughness: 0.2
  });

  function box(w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    if (rx) o.rotation.x = rx;
    if (ry) o.rotation.y = ry;
    if (rz) o.rotation.z = rz;
    o.castShadow = true;
    o.receiveShadow = true;
    root.add(o);
    return o;
  }

  function cylinder(rt, rb, h, segs, m, x, y, z, rx = 0, rz = 0) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), m);
    o.position.set(x, y, z);
    if (rx) o.rotation.x = rx;
    if (rz) o.rotation.z = rz;
    o.castShadow = true;
    o.receiveShadow = true;
    root.add(o);
    return o;
  }

  // ==================== 1. FLOOR 1: START, BUMPERS & REAL STAIRS ====================
  // Start pad
  box(17, 1.0, 14, cyan, 0, -0.5, 0);
  box(17, 16.0, 14, darkWall, 0, -9.0, 0);
  // Yellow start fences
  box(17, 1.2, 0.5, yellow, 0, 0.6, -7.0);
  box(0.5, 1.2, 14, yellow, -8.5, 0.6, 0);
  box(0.5, 1.2, 14, yellow, 8.5, 0.6, 0);

  // Runway with chevron arrows
  box(9.6, 1.0, 14.5, cyan, 0, -0.5, 13.25);
  box(9.6, 16.0, 14.5, darkWall, 0, -9.0, 13.25);

  // Requirement 2: REAL STEPPED STAIRCASE (replacing the black cube!)
  // 6 distinct steps rising from Y=0 to Y=4.8
  const numStairs1 = 6;
  const stairDepth = 12.5 / numStairs1; // ~2.08
  for (let i = 0; i < numStairs1; i++) {
    const zStep = 20.0 + (i + 0.5) * stairDepth;
    const yStep = (i + 1) * 0.8;
    // Step tread (horizontal walkable step)
    box(9.6, 0.8, stairDepth + 0.1, i % 2 === 0 ? yellow : cyan, 0, yStep - 0.4, zStep);
    // Step riser front
    box(9.6, 0.8, 0.25, pink, 0, yStep - 0.4, zStep - stairDepth * 0.5);
    // Solid foundation under each step
    box(9.6, 18.0, stairDepth, darkWall, 0, yStep - 9.8, zStep);
  }
  // Side handrails along the staircase
  box(0.4, 1.2, 12.5, yellow, -4.8, 3.0, 26.25);
  box(0.4, 1.2, 12.5, yellow, 4.8, 3.0, 26.25);

  // Floor 1 Pusher walkway (Y: 4.8)
  box(10.0, 1.0, 11.5, cyan, -1.5, 4.3, 37.75);
  box(10.0, 24.0, 11.5, darkWall, -1.5, -8.2, 37.75);
  // Pusher back-wall along X = -6.5
  box(1.4, 3.8, 11.5, purple, -6.5, 6.7, 37.75);

  // Requirement 4: Open wide walkway connecting pushers directly to Turn 1
  box(10.5, 1.0, 5.5, cyan, -1.75, 4.3, 45.75);
  box(10.5, 24.0, 5.5, darkWall, -1.75, -8.2, 45.75);

  // Turn 1 Pad (U-turn on the left, Y: 4.8 -> 5.2)
  box(13.5, 1.0, 12.0, pink, -9.75, 4.65, 46.0);
  cylinder(6.0, 6.0, 1.0, 24, pink, -12.5, 4.65, 46.0);
  cylinder(6.0, 6.0, 24.0, 24, darkWall, -12.5, -7.85, 46.0);
  // Outer safety railing around Turn 1
  box(0.4, 1.2, 12.0, yellow, -16.5, 5.65, 46.0);
  box(13.5, 1.2, 0.4, yellow, -9.75, 5.65, 52.0);

  // Staircase from Turn 1 leading up to Floor 2 ramp (Y: 5.2 -> 5.6)
  box(6.0, 0.4, 6.0, yellow, -10.5, 5.2, 49.0);

  // ==================== 2. FLOOR 2: THE GIANT BOULDER RAMP ====================
  const numSteps = 12;
  for (let i = 0; i < numSteps; i++) {
    const u0 = i / numSteps, u1 = (i + 1) / numSteps, um = (u0 + u1) * 0.5;
    const xm = -14 + 28 * um;
    const zm = 45 + 11 * um;
    const ym = 5.4 + 5.8 * um - 0.5;
    const w = 28 / numSteps + 0.3;
    box(w, 1.0, 10.4, i % 2 === 0 ? orange : yellow, xm, ym, zm);
    // side safety curbs
    box(w, 0.8, 0.5, pink, xm, ym + 0.8, zm - 5.0);
    box(w, 0.8, 0.5, pink, xm, ym + 0.8, zm + 5.0);
    // monolith underneath
    box(w, 24.0, 10.0, darkWall, xm, ym - 12.5, zm);
  }

  // Boulder Cradle / Launch Arch at the top of Floor 2 (X=14, Z=56, Y=11.2)
  const chuteGroup = new THREE.Group();
  chuteGroup.position.set(13.5, 11.2, 56.5);
  const archTorus = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.6, 12, 24, Math.PI), pink);
  archTorus.rotation.y = Math.PI / 4;
  chuteGroup.add(archTorus);
  root.add(chuteGroup);

  // Turn 2 Pad (Right X=13, Z=58, Y: 11.2)
  box(13.0, 1.0, 12.0, mint, 11.5, 10.7, 58.0);
  cylinder(6.0, 6.0, 1.0, 24, mint, 14.0, 10.7, 58.0);
  cylinder(6.0, 6.0, 28.0, 24, darkWall, 14.0, -3.8, 58.0);

  // ==================== 3. FLOOR 3: ROTATING CYLINDERS & PIT ====================
  // Requirement 5: TWO LONG ROTATING CYLINDERS (Brevna) from X=14 down to X=0
  // Lower Pit platform underneath the cylinders at Y=9.8
  box(16.0, 1.0, 10.0, mat(0x183040), 7.0, 9.3, 63.0);
  box(16.0, 28.0, 10.0, darkWall, 7.0, -5.2, 63.0);
  // Pit recovery stairs leading back up to the cylinders entrance
  box(4.0, 0.8, 4.0, yellow, 14.5, 10.2, 60.5);
  box(4.0, 1.6, 3.0, cyan, 14.5, 11.0, 58.5);

  // The 2 rotating cylinders (mesh references for update)
  const logMesh1 = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 14.0, 24), wood);
  logMesh1.rotation.z = Math.PI / 2;
  logMesh1.position.set(7.0, 11.6, 61.5);
  logMesh1.castShadow = true;
  root.add(logMesh1);

  const logMesh2 = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 14.0, 24), wood);
  logMesh2.rotation.z = Math.PI / 2;
  logMesh2.position.set(7.0, 11.6, 64.5);
  logMesh2.castShadow = true;
  root.add(logMesh2);

  // Spiral hazard stripes on logs for clear rotation feedback
  const logStripeMat = mat(0xffdf25, { roughness: 0.3 });
  for (let s = 0; s < 5; s++) {
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.08, 8, 20), logStripeMat);
    ring1.rotation.y = Math.PI / 2;
    ring1.position.set(2.0 + s * 2.5 - 7.0, 0, 0);
    logMesh1.add(ring1);
    const ring2 = ring1.clone();
    logMesh2.add(ring2);
  }

  // End bearing pedestals for the rotating cylinders
  box(1.2, 2.4, 6.0, metal, 14.0, 11.2, 63.0);
  box(1.2, 2.4, 6.0, metal, 0.0, 11.2, 63.0);

  // Second half of Floor 3: Conveyor section from X=0 down to X=-14
  for (let i = 0; i < 7; i++) {
    const um = (i + 0.5) / 7;
    const xm = 0.0 - 14.0 * um;
    const zm = 66.0 + 6.0 * um;
    const ym = 14.5 + 2.7 * um - 0.5;
    box(2.2, 1.0, 10.0, cyan, xm, ym, zm);
    box(2.0, 0.3, 8.8, purple, xm, ym + 0.4, zm); // conveyor surface
    box(2.2, 32.0, 10.0, darkWall, xm, ym - 16.5, zm);
  }

  // Turn 3 Pad (Left X=-13, Z=74, Y: 17.2)
  box(13.0, 1.0, 12.0, pink, -11.5, 16.7, 74.0);
  cylinder(6.0, 6.0, 1.0, 24, pink, -14.0, 16.7, 74.0);
  cylinder(6.0, 6.0, 36.0, 24, darkWall, -14.0, -1.8, 74.0);

  // ==================== 4. FLOOR 4: FAST SPINNERS & WALL PUSHERS ====================
  for (let i = 0; i < numSteps; i++) {
    const u0 = i / numSteps, u1 = (i + 1) / numSteps, um = (u0 + u1) * 0.5;
    const xm = -14 + 28 * um;
    const zm = 76 + 12 * um;
    const ym = 17.8 + 5.4 * um - 0.5;
    const w = 28 / numSteps + 0.3;
    box(w, 1.0, 10.4, i % 2 === 0 ? purple : pink, xm, ym, zm);
    box(w, 40.0, 10.0, darkWall, xm, ym - 20.5, zm);
  }

  // Turn 4 Pad (Right X=13, Z=90, Y: 23.2)
  box(13.0, 1.0, 12.0, yellow, 11.5, 22.7, 90.0);
  cylinder(6.0, 6.0, 1.0, 24, yellow, 14.0, 22.7, 90.0);
  cylinder(6.0, 6.0, 44.0, 24, darkWall, 14.0, 0.2, 90.0);

  // ==================== 5. FLOOR 5: SUMMIT, FINISH ARCH & CROWN ====================
  const f5Len = Math.hypot(12.0, 2.5);
  box(9.6, 1.0, f5Len, mint, 6.0, 24.3, 99.0, -0.21, -0.45);
  box(9.6, 44.0, 12.0, darkWall, 6.0, 1.5, 99.0);

  // Final stretch with pendulums (Y: 26.0)
  box(9.6, 1.0, 14.0, cyan, 0, 25.5, 111.0);
  box(9.6, 46.0, 14.0, darkWall, 0, 2.5, 111.0);

  // Grand Finish Arena & Podium (Y: 26.0)
  box(17.0, 1.2, 16.0, yellow, 0, 25.4, 125.0);
  box(17.0, 48.0, 16.0, darkWall, 0, 1.4, 125.0);
  box(8.0, 0.8, 6.0, pink, 0, 26.4, 126.0);
  box(5.0, 0.6, 4.0, mint, 0, 27.0, 126.0);

  // Finish Arch
  box(1.2, 7.5, 1.2, pink, -7.5, 29.5, 124.0);
  box(1.2, 7.5, 1.2, pink, 7.5, 29.5, 124.0);
  box(16.2, 1.4, 1.2, pink, 0, 33.5, 124.0);

  const cnv = document.createElement('canvas');
  cnv.width = 512; cnv.height = 128;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle = '#ff1a75'; ctx.fillRect(0, 0, 512, 128);
  ctx.lineWidth = 10; ctx.strokeStyle = '#ffcf25'; ctx.strokeRect(5, 5, 502, 118);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 84px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('FINISH!', 256, 92);
  const signTex = new THREE.CanvasTexture(cnv);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshBasicMaterial({ map: signTex });
  mats.push(signMat);
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 2.6), signMat);
  signMesh.rotation.y = Math.PI;
  signMesh.position.set(0, 34.6, 123.4);
  root.add(signMesh);

  // Rotating Golden Crown above the Finish Podium
  const crownGroup = new THREE.Group();
  crownGroup.position.set(0, 29.2, 126.0);
  const crownBand = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.0, 0.7, 16, 1, true), yellow);
  crownGroup.add(crownBand);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 4), yellow);
    spike.position.set(Math.cos(a) * 1.15, 0.7, Math.sin(a) * 1.15);
    crownGroup.add(spike);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), pink);
    gem.position.set(Math.cos(a) * 1.15, 1.15, Math.sin(a) * 1.15);
    crownGroup.add(gem);
  }
  root.add(crownGroup);

  // ==================== 6. THE RISING SLIME SEA ====================
  const slimeMesh = new THREE.Mesh(new THREE.CylinderGeometry(140, 140, 4.0, 48, 1, false), slimeMat);
  slimeMesh.position.set(0, slimeY(0) - 2.0, 60);
  root.add(slimeMesh);

  // ==================== 7. DYNAMIC OBSTACLE MESHES ====================
  // Requirement 1: Three Glossy Triangular Bumpers on Floor 1
  const bumperGroup = new THREE.Group();
  for (const b of [
    { x: -2.3, z: 11.5 }, { x: 2.3, z: 11.5 }, { x: 0.0, z: 16.5 }
  ]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 1.1, 3), glossyYellow);
    m.position.set(b.x, 0.55, b.z);
    m.rotation.y = Math.PI / 6;
    m.castShadow = true;
    bumperGroup.add(m);

    // Glossy rubber bumper rim
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.42, 0.35, 3), glossyPink);
    rim.position.set(b.x, 0.35, b.z);
    rim.rotation.y = Math.PI / 6;
    bumperGroup.add(rim);

    // Chevron cap on top
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.15, 16), white);
    cap.position.set(b.x, 1.15, b.z);
    bumperGroup.add(cap);
  }
  root.add(bumperGroup);

  // Requirement 3: Snappy Piston Pushers with Big Punch Pads
  const pusherMeshes = [];
  for (const z of [34.0, 37.5, 41.0]) {
    const pGroup = new THREE.Group();
    // Accordion / piston shaft
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.6, 0.7), metal);
    shaft.castShadow = true;
    pGroup.add(shaft);
    // Big thick pink boxing-glove style punch pad
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.6, 2.5), glossyPink);
    head.position.set(2.1, 0, 0);
    head.castShadow = true;
    pGroup.add(head);
    // Yellow hazard warning stripe on pad
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.35, 2.52), yellow);
    head.add(stripe);

    root.add(pGroup);
    pusherMeshes.push({ group: pGroup, z });
  }

  // Requirement 4: The Giant Rolling Boulder (Floor 2)
  const boulderMesh = new THREE.Group();
  const boulderSphere = new THREE.Mesh(
    new THREE.SphereGeometry(2.25, 24, 18),
    mat(0x9922ee, { roughness: 0.3, metalness: 0.3, emissive: 0x330066, emissiveIntensity: 0.35 })
  );
  boulderSphere.castShadow = true;
  boulderMesh.add(boulderSphere);
  // Vibrant yellow hazard equator rings
  const bRing1 = new THREE.Mesh(new THREE.TorusGeometry(2.26, 0.18, 12, 32), yellow);
  boulderMesh.add(bRing1);
  const bRing2 = bRing1.clone();
  bRing2.rotation.x = Math.PI / 2;
  boulderMesh.add(bRing2);
  root.add(boulderMesh);
  boulderMesh.position.set(13.0, 11.5 + 2.25 * 0.85, 56.0); // visible at top initially

  // Requirement 6: Fast Spinning Hammers with Double-Headed Mallets
  const hammerMeshes = [];
  for (const x of [-6.0, 0.0, 6.0]) {
    const u = (x - (-13)) / 26;
    const z = 76 + 12 * u;
    const y = 17.8 + 5.2 * u + 0.9;

    const hGroup = new THREE.Group();
    hGroup.position.set(x, y, z);

    // Heavy yellow steel hub
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 16), glossyYellow);
    hub.castShadow = true;
    hGroup.add(hub);

    // Rotating arm
    const armGroup = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.65, 0.65), metal);
    bar.castShadow = true;
    armGroup.add(bar);

    // Double-headed mallets at ends
    const headL = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.6, 16), glossyPink);
    headL.rotation.z = Math.PI / 2;
    headL.position.set(-4.2, 0, 0);
    headL.castShadow = true;
    armGroup.add(headL);

    const capL = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 16), yellow);
    capL.rotation.z = Math.PI / 2;
    capL.position.set(-5.05, 0, 0);
    armGroup.add(capL);

    const headR = headL.clone();
    headR.position.set(4.2, 0, 0);
    armGroup.add(headR);

    const capR = capL.clone();
    capR.position.set(5.05, 0, 0);
    armGroup.add(capR);

    hGroup.add(armGroup);
    root.add(hGroup);
    hammerMeshes.push({ group: hGroup, armGroup, x, y, z });
  }

  // Floor 5: Swinging pendulums
  const pendulumMeshes = [];
  for (const z of [108.0, 114.0]) {
    const pGroup = new THREE.Group();
    pGroup.position.set(0, 34.0, z);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7.5, 8), metal);
    arm.position.y = -3.75;
    arm.castShadow = true;
    pGroup.add(arm);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 16), glossyPink);
    ball.position.y = -7.5;
    ball.castShadow = true;
    pGroup.add(ball);
    root.add(pGroup);
    pendulumMeshes.push({ group: pGroup, z });
  }

  return {
    root,
    update() {
      // 1. Rising slime
      slimeMesh.position.y = slimeY(c.time) - 2.0;

      // 2. Crown rotation
      crownGroup.rotation.y = c.time * 1.5;

      // 3. Rotating cylinders (Brevna)
      logMesh1.rotation.x = c.logAngle1 || 0;
      logMesh2.rotation.x = c.logAngle2 || 0;

      // 4. Pushers
      const obs = obstaclesAt(c.time, c);
      let pIdx = 0;
      for (const o of obs) {
        if (o.type === 'pusher_box' && pIdx < pusherMeshes.length) {
          pusherMeshes[pIdx].group.position.set(o.x, o.y, o.z);
          pIdx++;
        }
      }

      // 5. The Giant Boulder
      if (c.boulder && c.boulder.active) {
        boulderMesh.visible = true;
        boulderMesh.position.set(c.boulder.x, c.boulder.y, c.boulder.z);
        boulderMesh.rotation.z = -c.boulder.rotZ;
        boulderMesh.rotation.y = c.time * 2.0;
      } else {
        // Stays docked at the top in its chute before trigger
        boulderMesh.visible = true;
        boulderMesh.position.set(13.0, 11.2 + 2.25 * 0.85, 56.0);
      }

      // 6. Fast spinning hammers
      for (let i = 0; i < hammerMeshes.length; i++) {
        const hm = hammerMeshes[i];
        hm.armGroup.rotation.y = -(c.time * 4.2 + hm.x);
      }

      // 7. Swinging pendulums
      for (let i = 0; i < pendulumMeshes.length; i++) {
        const pm = pendulumMeshes[i];
        const swingAngle = Math.sin(c.time * 2.8 + pm.z * 0.6) * 0.55;
        pm.group.rotation.z = swingAngle;
      }
    },
    dispose() {
      root.traverse(o => o.geometry?.dispose());
      mats.forEach(m => m.dispose());
      signTex.dispose();
    }
  };
}
