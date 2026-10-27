import { LENGTH, LIMIT, zones, obstaclesAt, courseY, slimeY, FINISH_Y, SLABS } from './course.mjs';

export function createVisuals(THREE, c) {
  const root = new THREE.Group(), mats = [];
  const mat = (color, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, ...opts });
    mats.push(m);
    return m;
  };

  const pink = mat(0xff3585);
  const cyan = mat(0x28c8e8);
  const yellow = mat(0xffcf25);
  const purple = mat(0x8a3bd6);
  const darkWall = mat(0x35195e);
  const mint = mat(0x25e0a0);
  const orange = mat(0xff7722);
  const white = mat(0xffffff);
  const metal = mat(0x707590, { metalness: 0.7, roughness: 0.3 });

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

  // ==================== 1. SOLID MULTI-TIER FLOORS & MONOLITHS ====================
  // Underneath each floor: massive vertical skirts/monoliths extending down into the slime
  // Floor 1 (Start & Pushers):
  box(17, 1.0, 14, cyan, 0, -0.5, 0); // start pad
  box(17, 16.0, 14, darkWall, 0, -9.0, 0); // vertical base
  // Start yellow fences
  box(17, 1.2, 0.5, yellow, 0, 0.6, -7.0);
  box(0.5, 1.2, 14, yellow, -8.5, 0.6, 0);
  box(0.5, 1.2, 14, yellow, 8.5, 0.6, 0);

  // Floor 1 Runway
  box(9.6, 1.0, 14.5, cyan, 0, -0.5, 13.25);
  box(9.6, 16.0, 14.5, darkWall, 0, -9.0, 13.25);

  // Floor 1 Ramp 1 (Y: 0 -> 4.8)
  const ramp1Len = Math.hypot(12.5, 4.8);
  const ramp1Ang = Math.atan2(4.8, 12.5);
  box(9.6, 1.0, ramp1Len, yellow, 0, 1.9, 26.25, -ramp1Ang);
  box(9.6, 20.0, 12.5, darkWall, 0, -7.5, 26.25);

  // Floor 1 Pusher walkway (Y: 4.8)
  box(9.7, 1.0, 12.5, cyan, -1.65, 4.3, 38.25);
  box(9.7, 24.0, 12.5, darkWall, -1.65, -8.2, 38.25);
  // Pusher back-wall along X = -6.5
  box(1.2, 3.6, 12.5, purple, -6.5, 6.6, 38.25);

  // Turn 1 Pad (Y: 4.8 -> 5.5)
  box(12.5, 1.0, 12.0, pink, -10.25, 4.65, 44.0);
  cylinder(6.0, 6.0, 1.0, 24, pink, -13.0, 4.65, 44.0);
  cylinder(6.0, 6.0, 24.0, 24, darkWall, -13.0, -7.85, 44.0);

  // Floor 2: The Giant Boulder Ramp (Left X=-13 to Right X=+13, Y: 5.5 -> 11.2)
  // We segment the ramp into connected visual slabs
  const numSteps = 12;
  for (let i = 0; i < numSteps; i++) {
    const u0 = i / numSteps, u1 = (i + 1) / numSteps, um = (u0 + u1) * 0.5;
    const xm = -13 + 26 * um;
    const zm = 45 + 11 * um;
    const ym = 5.5 + 5.7 * um - 0.5;
    const w = 26 / numSteps + 0.3;
    box(w, 1.0, 9.2, i % 2 === 0 ? orange : yellow, xm, ym, zm);
    // side curbs
    box(w, 0.8, 0.4, pink, xm, ym + 0.8, zm - 4.4);
    box(w, 0.8, 0.4, pink, xm, ym + 0.8, zm + 4.4);
    // monolith underneath
    box(w, 24.0, 8.8, darkWall, xm, ym - 12.5, zm);
  }

  // Turn 2 Pad (Right X=13, Z=58, Y: 11.2)
  box(11.0, 1.0, 12.0, mint, 12.8, 10.7, 58.0);
  cylinder(5.8, 5.8, 1.0, 24, mint, 14.5, 10.7, 58.0);
  cylinder(5.8, 5.8, 28.0, 24, darkWall, 14.5, -3.8, 58.0);

  // Floor 3: Narrow Beams & Conveyor (Right X=+13 to Left X=-13, Y: 11.8 -> 17.2)
  for (let i = 0; i < numSteps; i++) {
    const u0 = i / numSteps, u1 = (i + 1) / numSteps, um = (u0 + u1) * 0.5;
    const xm = 13 - 26 * um;
    const zm = 60 + 12 * um;
    const ym = 11.8 + 5.4 * um - 0.5;
    const w = 26 / numSteps + 0.3;

    if (um >= 0.12 && um <= 0.48) {
      // Narrow yellow balance beams over gap!
      const offset = um < 0.28 ? 1.8 : 1.8 * (0.48 - um) / 0.20;
      if (offset > 0.4) {
        box(w, 0.9, 1.4, yellow, xm, ym, zm - offset);
        box(w, 0.9, 1.4, yellow, xm, ym, zm + offset);
      } else {
        box(w, 0.9, 2.0, yellow, xm, ym, zm);
      }
      box(w, 28.0, 1.2, darkWall, xm, ym - 14.5, zm);
    } else {
      // Conveyor section: bright cyan surface with dark stripes
      box(w, 1.0, 9.0, cyan, xm, ym, zm);
      box(w, 0.4, 8.2, purple, xm, ym + 0.35, zm); // conveyor belt
      box(w, 32.0, 8.8, darkWall, xm, ym - 16.5, zm);
    }
  }

  // Turn 3 Pad (Left X=-13, Z=74, Y: 17.2)
  box(11.0, 1.0, 12.0, pink, -12.8, 16.7, 74.0);
  cylinder(5.8, 5.8, 1.0, 24, pink, -14.5, 16.7, 74.0);
  cylinder(5.8, 5.8, 36.0, 24, darkWall, -14.5, -1.8, 74.0);

  // Floor 4: Hammers & Fast Pushers (Left X=-13 to Right X=+13, Y: 17.8 -> 23.2)
  for (let i = 0; i < numSteps; i++) {
    const u0 = i / numSteps, u1 = (i + 1) / numSteps, um = (u0 + u1) * 0.5;
    const xm = -13 + 26 * um;
    const zm = 76 + 12 * um;
    const ym = 17.8 + 5.4 * um - 0.5;
    const w = 26 / numSteps + 0.3;
    box(w, 1.0, 9.2, i % 2 === 0 ? purple : pink, xm, ym, zm);
    box(w, 40.0, 8.8, darkWall, xm, ym - 20.5, zm);
  }

  // Turn 4 Pad (Right X=13, Z=90, Y: 23.2)
  box(11.0, 1.0, 12.0, yellow, 12.8, 22.7, 90.0);
  cylinder(5.8, 5.8, 1.0, 24, yellow, 14.5, 22.7, 90.0);
  cylinder(5.8, 5.8, 44.0, 24, darkWall, 14.5, 0.2, 90.0);

  // Floor 5: Final Ramp to summit
  const f5Len = Math.hypot(12.0, 2.5);
  box(9.2, 1.0, f5Len, mint, 6.0, 24.3, 99.0, -0.21, -0.45);
  box(9.2, 44.0, 12.0, darkWall, 6.0, 1.5, 99.0);

  // Floor 5: Final stretch with pendulums (Y: 26.0)
  box(9.6, 1.0, 13.0, cyan, 0, 25.5, 111.5);
  box(9.6, 46.0, 13.0, darkWall, 0, 2.5, 111.5);

  // Floor 5: Grand Finish Arena & Podium (Y: 26.0)
  box(17.0, 1.2, 16.0, yellow, 0, 25.4, 125.0);
  box(17.0, 48.0, 16.0, darkWall, 0, 1.4, 125.0);
  // Finish podium
  box(8.0, 0.8, 6.0, pink, 0, 26.4, 126.0);
  box(5.0, 0.6, 4.0, mint, 0, 27.0, 126.0);

  // Finish Arch
  box(1.2, 7.5, 1.2, pink, -7.5, 29.5, 124.0);
  box(1.2, 7.5, 1.2, pink, 7.5, 29.5, 124.0);
  box(16.2, 1.4, 1.2, pink, 0, 33.5, 124.0);

  // "FINISH!" Banner
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

  // ==================== 2. THE RISING SLIME SEA ====================
  const slimeMesh = new THREE.Mesh(new THREE.CylinderGeometry(140, 140, 4.0, 48, 1, false), slimeMat);
  slimeMesh.position.set(0, slimeY(0) - 2.0, 60);
  root.add(slimeMesh);

  // ==================== 3. OBSTACLE MESHES ====================
  // 3a. Triangle bouncy bumpers (Floor 1)
  const bumperGroup = new THREE.Group();
  for (const b of [
    { x: -2.4, z: 12.0 }, { x: 2.4, z: 12.0 }, { x: 0.0, z: 16.5 }
  ]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.9, 3), yellow);
    m.position.set(b.x, 0.5, b.z);
    m.rotation.y = Math.PI / 6;
    m.castShadow = true;
    bumperGroup.add(m);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 16), pink);
    cap.position.set(b.x, 0.95, b.z);
    bumperGroup.add(cap);
  }
  root.add(bumperGroup);

  // 3b. Pushers on Floor 1 & Floor 4
  const pusherMeshes = [];
  const pusherSpecs = [
    // Floor 1 pushers
    { type: 'f1', z: 34.0, y: 5.4, wallX: -6.5, axis: 'x' },
    { type: 'f1', z: 37.5, y: 5.4, wallX: -6.5, axis: 'x' },
    { type: 'f1', z: 41.0, y: 5.4, wallX: -6.5, axis: 'x' },
    // Floor 4 pushers
    { type: 'f4', x: 8.5, y: 22.6, wallZ: 76 + 12 * ((8.5 - (-13)) / 26) - 3.2, axis: 'z' },
    { type: 'f4', x: 11.5, y: 23.0, wallZ: 76 + 12 * ((11.5 - (-13)) / 26) - 3.2, axis: 'z' }
  ];

  for (const spec of pusherSpecs) {
    const pGroup = new THREE.Group();
    // Arm (metal shaft)
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(spec.axis === 'x' ? 3.4 : 0.8, 0.6, spec.axis === 'x' ? 0.8 : 3.4), metal);
    shaft.castShadow = true;
    pGroup.add(shaft);
    // Punch pad (bright pink boxing glove style pad)
    const head = new THREE.Mesh(new THREE.BoxGeometry(spec.axis === 'x' ? 1.0 : 2.4, 1.4, spec.axis === 'x' ? 2.4 : 1.0), pink);
    head.position.set(spec.axis === 'x' ? 1.6 : 0, 0, spec.axis === 'x' ? 0 : 1.6);
    head.castShadow = true;
    pGroup.add(head);
    root.add(pGroup);
    pusherMeshes.push({ group: pGroup, spec });
  }

  // 3c. THE GIANT ROLLING BOULDER (Floor 2)
  const boulderMesh = new THREE.Group();
  const boulderSphere = new THREE.Mesh(
    new THREE.SphereGeometry(2.25, 24, 18),
    mat(0x9922ee, { roughness: 0.35, metalness: 0.3, emissive: 0x330066, emissiveIntensity: 0.3 })
  );
  boulderSphere.castShadow = true;
  boulderMesh.add(boulderSphere);
  // High-contrast equator stripes so rotation is crystal-clear
  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(2.26, 0.18, 12, 32),
    yellow
  );
  boulderMesh.add(stripe);
  const stripe2 = stripe.clone();
  stripe2.rotation.x = Math.PI / 2;
  boulderMesh.add(stripe2);
  root.add(boulderMesh);
  boulderMesh.visible = false;

  // Boulder Chute / Spawner arch at top of Floor 2 (X=13, Z=56, Y=11.2)
  const chuteGroup = new THREE.Group();
  chuteGroup.position.set(13.2, 11.2, 56.5);
  const arch1 = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.5, 12, 24, Math.PI), pink);
  arch1.rotation.y = Math.PI / 4;
  chuteGroup.add(arch1);
  root.add(chuteGroup);

  // 3d. Floor 4: Fast spinning mallets (pink hammers)
  const hammerMeshes = [];
  for (const x of [-6.0, 0.0, 6.0]) {
    const u = (x - (-13)) / 26;
    const z = 76 + 12 * u;
    const y = 17.8 + 5.2 * u + 0.9;

    const hGroup = new THREE.Group();
    hGroup.position.set(x, y, z);

    // Central hub
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.2, 16), yellow);
    hub.castShadow = true;
    hGroup.add(hub);

    // Rotating arm with mallets
    const armGroup = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.6, 0.6), cyan);
    bar.castShadow = true;
    armGroup.add(bar);

    // Mallet heads at each end
    const headL = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.4, 16), pink);
    headL.rotation.z = Math.PI / 2;
    headL.position.set(-4.0, 0, 0);
    headL.castShadow = true;
    armGroup.add(headL);

    const headR = headL.clone();
    headR.position.set(4.0, 0, 0);
    armGroup.add(headR);

    hGroup.add(armGroup);
    root.add(hGroup);
    hammerMeshes.push({ group: hGroup, armGroup, x, y, z });
  }

  // 3e. Floor 5: Swinging pendulums
  const pendulumMeshes = [];
  for (const z of [108.0, 114.0]) {
    const pGroup = new THREE.Group();
    pGroup.position.set(0, 34.0, z); // hanging from high overhead frame

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7.5, 8), metal);
    arm.position.y = -3.75;
    arm.castShadow = true;
    pGroup.add(arm);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 16), pink);
    ball.position.y = -7.5;
    ball.castShadow = true;
    pGroup.add(ball);

    root.add(pGroup);
    pendulumMeshes.push({ group: pGroup, z });
  }

  // Overhead suspension beam for pendulums
  box(14.0, 0.8, 10.0, darkWall, 0, 34.5, 111.0);

  return {
    root,
    update() {
      // 1. Rising slime height
      const currSlimeY = slimeY(c.time);
      slimeMesh.position.y = currSlimeY - 2.0;

      // 2. Crown rotating on podium
      crownGroup.rotation.y = c.time * 1.5;

      // 3. Pushers
      const obs = obstaclesAt(c.time, c);
      let pIdx = 0;
      for (const o of obs) {
        if (o.type === 'pusher' && pIdx < pusherMeshes.length) {
          const pm = pusherMeshes[pIdx];
          pm.group.position.set(o.x, o.y, o.z);
          pIdx++;
        }
      }

      // 4. The Giant Boulder
      if (c.boulder && c.boulder.active) {
        boulderMesh.visible = true;
        boulderMesh.position.set(c.boulder.x, c.boulder.y, c.boulder.z);
        boulderMesh.rotation.z = -c.boulder.rotZ;
        boulderMesh.rotation.y = c.time * 2.0;
      } else {
        boulderMesh.visible = false;
      }

      // 5. Spinning hammers
      for (let i = 0; i < hammerMeshes.length; i++) {
        const hm = hammerMeshes[i];
        hm.armGroup.rotation.y = -(c.time * 3.8 + hm.x);
      }

      // 6. Swinging pendulums
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
