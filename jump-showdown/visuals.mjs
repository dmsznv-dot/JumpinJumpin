import {
  NUM_SECTORS,
  SECTOR_ANGLE,
  INNER_RADIUS,
  OUTER_RADIUS,
  SECTOR_GAP
} from './showdown.mjs';

export function createShowdownVisuals(THREE, course) {
  const root = new THREE.Group();
  const mats = [];

  const mat = (col, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.38, metalness: 0.12, ...opts });
    mats.push(m);
    return m;
  };

  const pink = mat(0xff2a85, { roughness: 0.32 });
  const cyan = mat(0x00e5ff, { roughness: 0.32 });
  const yellow = mat(0xffe600, { roughness: 0.28 });
  const darkMetal = mat(0x35517b, { roughness: 0.55, metalness: 0.35 });
  const chrome = mat(0xd0d8e8, { roughness: 0.18, metalness: 0.85 });
  const woodGreen = mat(0x00e676, { roughness: 0.35 });
  const stitchMat = mat(0xffffff, { roughness: 0.55 });
  const hazardOrange = mat(0xff9100, { roughness: 0.35 });
  const sirenOff = mat(0x4a0e1c, { roughness: 0.6 });
  const sirenOn = mat(0xff1744, { emissive: 0xff1744, emissiveIntensity: 1.8 });

  // 1. ==================== 8 SECTOR PLATFORMS (WEDGES) ====================
  const sectorGroups = [];
  const sectorSirens = [];

  for (let i = 0; i < NUM_SECTORS; i++) {
    const sGroup = new THREE.Group();
    root.add(sGroup);
    sectorGroups.push(sGroup);

    const isEven = i % 2 === 0;
    const topMat = isEven ? pink : cyan;
    const rimMat = isEven ? cyan : pink;

    // Build custom 3D wedge geometry with rounded borders and thickness
    const arcSegments = 16;
    const halfGapAngle = (SECTOR_GAP * 0.5) / ((INNER_RADIUS + OUTER_RADIUS) * 0.5);
    const aStart = course.sectors[i].angleStart + halfGapAngle;
    const aEnd = course.sectors[i].angleEnd - halfGapAngle;

    // Platform top & bottom vertices
    const shape = new THREE.Shape();
    // Inner arc
    shape.absarc(0, 0, INNER_RADIUS + 0.1, aStart, aEnd, false);
    // Outer arc
    shape.absarc(0, 0, OUTER_RADIUS - 0.1, aEnd, aStart, true);

    const extrudeSettings = {
      depth: 1.2,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.08,
      bevelThickness: 0.08
    };

    const wedgeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    wedgeGeo.rotateX(Math.PI / 2); // Lay horizontal
    // Rotation puts the top at y=0 and the extrusion below it. A second
    // downward translation would place the visible floor below the collider.

    const wedgeMesh = new THREE.Mesh(wedgeGeo, topMat);
    wedgeMesh.receiveShadow = true;
    wedgeMesh.castShadow = true;
    sGroup.add(wedgeMesh);

    // Fine seams give the large wedges a soft padded-mat finish.
    const seamLength=OUTER_RADIUS-INNER_RADIUS-1.6;
    const seam=new THREE.Mesh(new THREE.BoxGeometry(seamLength,.018,.06), stitchMat);
    const seamAngle=(aStart+aEnd)*.5, seamRadius=(INNER_RADIUS+OUTER_RADIUS)*.5;
    seam.position.set(Math.cos(seamAngle)*seamRadius,.025,Math.sin(seamAngle)*seamRadius);
    seam.rotation.y=-seamAngle;sGroup.add(seam);

    // Hazard warning curb along outer perimeter
    const curbGeo = new THREE.TorusGeometry(OUTER_RADIUS - 0.25, 0.22, 8, 14, aEnd - aStart);
    curbGeo.rotateX(Math.PI / 2);
    curbGeo.rotateY(-aStart);
    const curbMesh = new THREE.Mesh(curbGeo, yellow);
    curbMesh.position.y = 0.08;
    curbMesh.castShadow = true;
    sGroup.add(curbMesh);

    // Inner rim curb
    const innerCurbGeo = new THREE.TorusGeometry(INNER_RADIUS + 0.25, 0.18, 8, 14, aEnd - aStart);
    innerCurbGeo.rotateX(Math.PI / 2);
    innerCurbGeo.rotateY(-aStart);
    const innerCurbMesh = new THREE.Mesh(innerCurbGeo, rimMat);
    innerCurbMesh.position.y = 0.06;
    sGroup.add(innerCurbMesh);

    // Heavy support undercarriage pylon
    const midAngle = (aStart + aEnd) * 0.5;
    const midRadius = (INNER_RADIUS + OUTER_RADIUS) * 0.55;
    const pylonX = Math.cos(midAngle) * midRadius;
    const pylonZ = Math.sin(midAngle) * midRadius;

    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 26, 16), darkMetal);
    pylon.position.set(pylonX, -14, pylonZ);
    sGroup.add(pylon);

    // Emergency warning siren beacon on outer edge
    const sirenPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8), darkMetal);
    const sirenOuterR = OUTER_RADIUS - 0.55;
    const sirenX = Math.cos(midAngle) * sirenOuterR;
    const sirenZ = Math.sin(midAngle) * sirenOuterR;
    sirenPole.position.set(sirenX, 0.6, sirenZ);
    sGroup.add(sirenPole);

    const sirenCap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), sirenOff);
    sirenCap.position.set(sirenX, 1.25, sirenZ);
    sGroup.add(sirenCap);

    sectorSirens.push(sirenCap);
  }

  // 2. ==================== CENTRAL MOTORIZED SPINDLE ====================
  const centerHubGroup = new THREE.Group();
  centerHubGroup.position.set(0, 0, 0);
  root.add(centerHubGroup);

  // Base motor column
  const baseCol = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.1, 6.0, 28), darkMetal);
  baseCol.position.y = -3.0;
  baseCol.castShadow = true;
  centerHubGroup.add(baseCol);

  // Chrome upper spindle
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.4, 4.2, 28), chrome);
  spindle.position.y = 2.1;
  spindle.castShadow = true;
  centerHubGroup.add(spindle);
  for(const y of [1.45,3.25]){
    const trim=new THREE.Mesh(new THREE.TorusGeometry(2.18,.075,10,40),yellow);
    trim.rotation.x=Math.PI/2;trim.position.y=y;centerHubGroup.add(trim);
  }

  // Top dome crown
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), yellow);
  dome.position.y = 4.2;
  centerHubGroup.add(dome);

  // Rotating spire antenna with beacon
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 8), pink);
  spire.position.y = 6.9;
  centerHubGroup.add(spire);

  // 3. ==================== LOWER SWEEPER (LOW ROLLER) ====================
  // Spins around central spindle at Y = 0.78, players must jump over it!
  const lowBarPivot = new THREE.Group();
  root.add(lowBarPivot);

  // Hub collar
  const lowCollar = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.9, 24), yellow);
  lowCollar.position.y = 0.78;
  lowBarPivot.add(lowCollar);
  const lowRim=new THREE.Mesh(new THREE.TorusGeometry(2.5,.09,10,40),pink);
  lowRim.rotation.x=Math.PI/2;lowRim.position.y=1.23;lowBarPivot.add(lowRim);

  // Connecting steel boom
  const lowArmLen = OUTER_RADIUS - 0.2;
  const lowRollerRadius = 0.38;

  // The rotating cylindrical padded roller
  const lowRollerGroup = new THREE.Group();
  lowRollerGroup.position.set(lowArmLen * 0.5, 0.78, 0);
  lowBarPivot.add(lowRollerGroup);

  const rollerGeo = new THREE.CylinderGeometry(lowRollerRadius, lowRollerRadius, lowArmLen - 2.4, 24);
  rollerGeo.rotateZ(Math.PI / 2); // orient along X
  const rollerMesh = new THREE.Mesh(rollerGeo, woodGreen);
  rollerMesh.castShadow = true;
  lowRollerGroup.add(rollerMesh);

  // Spiral hazard stripes on the lower roller
  const stripeCount = 9;
  for (let s = 0; s < stripeCount; s++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(lowRollerRadius + 0.015, 0.05, 8, 20), yellow);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = ((s / stripeCount) - 0.5) * (lowArmLen - 3.0);
    lowRollerGroup.add(ring);
  }

  // End cap bumper on the roller tip
  const lowEndCap = new THREE.Mesh(new THREE.SphereGeometry(lowRollerRadius * 1.15, 16, 16), pink);
  lowEndCap.position.x = lowArmLen - 1.2;
  lowEndCap.position.y = 0.78;
  lowBarPivot.add(lowEndCap);

  // 4. ==================== UPPER SWEEPER (HIGH OVERHEAD ARM) ====================
  // Spins overhead at Y = 2.30, catches players who jump during double-bar overlap!
  const highBarPivot = new THREE.Group();
  root.add(highBarPivot);

  const highCollar = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.8, 24), mat(0x2979ff, { roughness: 0.25 }));
  highCollar.position.y = 2.30;
  highBarPivot.add(highCollar);
  const highRim=new THREE.Mesh(new THREE.TorusGeometry(2.3,.08,10,40),yellow);
  highRim.rotation.x=Math.PI/2;highRim.position.y=2.7;highBarPivot.add(highRim);

  const highArmLen = OUTER_RADIUS - 0.5;
  const highRadius = 0.32;

  // High arm crossbeam
  const highArmGeo = new THREE.CylinderGeometry(highRadius, highRadius, highArmLen - 2.2, 20);
  highArmGeo.rotateZ(Math.PI / 2);
  const highArmMesh = new THREE.Mesh(highArmGeo, mat(0x1565c0, { roughness: 0.3 }));
  highArmMesh.position.set(highArmLen * 0.5, 2.30, 0);
  highArmMesh.castShadow = true;
  highBarPivot.add(highArmMesh);

  // Raised coloured rings make the padded beam's motion easier to read.
  for (let s=0; s<8; s++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(highRadius+.01, .035, 8, 20), yellow);
    ring.rotation.y = Math.PI/2;
    ring.position.set(1.6 + s*(highArmLen-3.2)/7, 2.30, 0);
    highBarPivot.add(ring);
  }

  // High arm overhead warning lights and tip
  const highEndTip = new THREE.Mesh(new THREE.SphereGeometry(highRadius * 1.2, 14, 14), mat(0xff1744, { emissive: 0xff1744, emissiveIntensity: 1.2 }));
  highEndTip.position.set(highArmLen - 1.1, 2.30, 0);
  highBarPivot.add(highEndTip);

  // Counterweight on the opposite side of high arm
  const counterWeight = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.2), darkMetal);
  counterWeight.position.set(-3.3, 2.30, 0);
  counterWeight.castShadow = true;
  highBarPivot.add(counterWeight);

  return {
    root,
    update() {
      // 1. Sweeper rotations
      lowBarPivot.rotation.y = -course.lowBar.angle;
      highBarPivot.rotation.y = -course.highBar.angle;

      // Roller self-spinning around longitudinal axis
      rollerMesh.rotation.x = course.time * 8.0;

      // 2. Sector platform states & animations
      for (let i = 0; i < NUM_SECTORS; i++) {
        const s = course.sectors[i];
        const sGroup = sectorGroups[i];
        const siren = sectorSirens[i];

        if (s.state === 'dropped') {
          sGroup.visible = false;
        } else {
          sGroup.visible = true;
          sGroup.position.y = s.yOffset;
          // Tilt downwards when falling
          sGroup.rotation.z = Math.sin(s.angleMid) * s.pitchOffset;
          sGroup.rotation.x = -Math.cos(s.angleMid) * s.pitchOffset;

          // Warning siren flashing
          if (s.state === 'warning') {
            const flash = Math.sin(s.sirenFlash) > 0;
            siren.material = flash ? sirenOn : sirenOff;
          } else {
            siren.material = sirenOff;
          }
        }
      }
    },
    dispose() {
      root.traverse(o => {
        if (o.geometry) o.geometry.dispose();
      });
      mats.forEach(m => m.dispose());
    }
  };
}

