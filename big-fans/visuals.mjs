import { COURSE } from './course.mjs';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { PALETTE, candyMaterial, softMaterial, roundedSlabGeometry, foamRail, candyColumn, inflatableArch, balloonField } from '../presentation/fg-style.mjs';

// Three.js is supplied by the existing game so the level does not load a second engine.
export function createCourseVisuals(THREE, course) {
  const root = new THREE.Group();
  const owned = []; // geometries created here (materials are shared through the style cache)
  const add = (mesh, parent = root) => { parent.add(mesh); if (mesh.geometry) owned.push(mesh.geometry); return mesh; };
  const white = softMaterial(THREE, PALETTE.white), yellow = softMaterial(THREE, PALETTE.yellow, .4);

  // Pads: pillowy slabs. Only start and finish carry a print, and a big one, so the level never competes
  // with the contestants' own patterns; checkpoints are plain colour.
  const floors = [
    candyMaterial(THREE, 'chevron', PALETTE.cyan, 0x7fe6f5, 10),
    softMaterial(THREE, PALETTE.yellow, .45),
    softMaterial(THREE, PALETTE.lilac, .45),
    softMaterial(THREE, PALETTE.mint, .45),
    candyMaterial(THREE, 'check', PALETTE.violet, PALETTE.violetLight, 7)
  ];
  const railMat = softMaterial(THREE, PALETTE.violet, .45);
  [COURSE.start, ...COURSE.checkpoints, COURSE.finish].forEach((pad, i) => {
    const slab = add(new THREE.Mesh(roundedSlabGeometry(THREE, pad.halfWidth * 2, pad.halfLength * 2, .8, 1.1), floors[i]));
    slab.position.set(pad.x, 0, pad.z); slab.receiveShadow = true; slab.castShadow = true;
    // Half-sunk foam trim along the open sides; purely visual, the edge is still an edge.
    for (const side of [-1, 1]) {
      const rail = add(foamRail(THREE, pad.halfLength * 2 - 1.4, .2, railMat));
      rail.rotation.y = Math.PI / 2; rail.position.set(pad.x + side * (pad.halfWidth - .15), -.08, pad.z);
    }
    for (const side of [-1, 1]) {
      const leg = add(candyColumn(THREE, 9, .45, PALETTE.white, i % 2 ? PALETTE.cyan : PALETTE.violet));
      leg.position.set(pad.x + side * (pad.halfWidth - 1.6), -5.3, pad.z);
    }
  });
  // Only the finish gets an arch: arches over the start and checkpoints filled the screen behind the player.
  const arches = [[COURSE.finish.z, 'ФИНИШ!', PALETTE.violet, PALETTE.purple]];
  for (const [z, label, a, bg] of arches) {
    const arch = inflatableArch(THREE, { width: 19.2, height: 7.4, a, b: PALETTE.white, label, labelBg: bg });
    arch.position.set(0, 0, z); root.add(arch);
    arch.traverse(o => { if (o.geometry) owned.push(o.geometry); });
  }
  // Checkered finish line (one printed strip).
  const line = add(new THREE.Mesh(new THREE.PlaneGeometry(15.6, 1.6), candyMaterial(THREE, 'check', 0x2b1a5a, PALETTE.white, 1.6)));
  line.rotation.x = -Math.PI / 2; line.position.set(0, .03, COURSE.finish.z + .9);
  line.geometry.attributes.uv.array.forEach((v, k, arr) => { arr[k] = v * (k % 2 ? 1.6 : 15.6); });

  // Confetti that keeps floating over the finish.
  const decorations = [];
  const confettiGeo = new THREE.BoxGeometry(.2, .34, .04); owned.push(confettiGeo);
  const confetti = new THREE.InstancedMesh(confettiGeo, new THREE.MeshStandardMaterial({ roughness: .5 }), 24);
  const confettiColor = new THREE.Color(), dummy = new THREE.Object3D();
  for (let i = 0; i < 24; i++) {
    const a = i * 2.399, radius = 3 + (i % 4) * 1.3;
    confetti.setColorAt(i, confettiColor.setHex([PALETTE.pink, PALETTE.cyan, PALETTE.yellow, PALETTE.white][i % 4]));
    decorations.push({ x: Math.cos(a) * radius, baseY: 6 + (i % 5) * .7, z: COURSE.finish.z + Math.sin(a) * 1.5, phase: i * .8 });
  }
  root.add(confetti);
  // Balloons line the course on both sides, well clear of the side fans.
  const spots = [];
  for (let z = 6; z < COURSE.finish.z; z += 13) for (const side of [-1, 1]) spots.push({ x: side * (21 + (z % 3)), y: 1 + (z % 5), z: z + side * 3, r: 1.3 + (z % 4) * .2 });
  const balloons = balloonField(THREE, spots);
  root.add(balloons.mesh); owned.push(balloons.mesh.geometry);

  // Violet and cyan blades: both stand out against the pink slime below.
  const bladeMats = [softMaterial(THREE, PALETTE.violet, .45), softMaterial(THREE, PALETTE.cyan, .45)];
  const hubMat = softMaterial(THREE, PALETTE.yellow, .4);
  const metal = softMaterial(THREE, 0x6f86c9, .4);
  const fanVisuals = course.fans.map((fan, i) => {
    const group = new THREE.Group(); group.position.set(fan.x, 0, fan.z); root.add(group);
    const rotor = new THREE.Group(); group.add(rotor);
    const hub = add(new THREE.Mesh(roundedHub(THREE, fan.hubRadius), hubMat), rotor);
    hub.castShadow = true; hub.receiveShadow = true;
    const engine = add(new THREE.Mesh(new THREE.CylinderGeometry(fan.hubRadius * .72, fan.hubRadius * .52, 1.3, 20), metal), rotor);
    engine.position.y = -1.13;
    const cap = add(new THREE.Mesh(new THREE.TorusGeometry(fan.hubRadius * .75, .1, 8, 28), white), rotor);
    cap.rotation.x = Math.PI / 2; cap.position.y = .02;
    // Blades are tapered to match the widening collision surface; a small bevel softens them like foam.
    // All blades (and all tip bumpers) of a fan are merged: one draw call each instead of four.
    const bladeGeos = [], tipGeos = [];
    for (let n = 0; n < fan.blades; n++) {
      const shape = new THREE.Shape(), bv = .1;
      shape.moveTo(fan.hubRadius, -fan.innerHalfWidth + bv); shape.lineTo(fan.radius - bv, -fan.outerHalfWidth + bv);
      shape.lineTo(fan.radius - bv, fan.outerHalfWidth - bv); shape.lineTo(fan.hubRadius, fan.innerHalfWidth - bv); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: .3, bevelEnabled: true, bevelSize: bv, bevelThickness: bv, bevelSegments: 2 });
      // Extruded XY -> horizontal XZ with its top at y=0.
      geo.rotateX(Math.PI / 2); geo.translate(0, -bv, 0);
      const a = n * Math.PI * 2 / fan.blades;
      bladeGeos.push(geo.rotateY(-a));
      // Soft bumper on the blade tip.
      const tip = new THREE.CapsuleGeometry(.2, fan.outerHalfWidth * 2 - .4, 4, 10);
      tip.rotateZ(Math.PI / 2); tip.rotateY(-a + Math.PI / 2); tip.translate(Math.cos(a) * (fan.radius - .1), -.12, Math.sin(a) * (fan.radius - .1));
      tipGeos.push(tip);
    }
    const blades = add(new THREE.Mesh(mergeGeometries(bladeGeos), bladeMats[i % 2]), rotor);
    blades.castShadow = true; blades.receiveShadow = true;
    add(new THREE.Mesh(mergeGeometries(tipGeos), softMaterial(THREE, PALETTE.yellow, .4)), rotor);
    [...bladeGeos, ...tipGeos].forEach(g => g.dispose());
    let sweeper = null;
    if (fan.beam) {
      sweeper = new THREE.Group(); group.add(sweeper);
      const barMat = candyMaterial(THREE, 'bands', PALETTE.purple, PALETTE.white, 3.2 / (fan.radius * 2));
      const bar = add(new THREE.Mesh(new THREE.CylinderGeometry(.275, .275, fan.radius * 2, 24), barMat), sweeper);
      bar.rotation.z = Math.PI / 2; bar.position.y = .52; bar.castShadow = true;
      const boss = add(new THREE.Mesh(new THREE.CylinderGeometry(.52, .56, 1.0, 24), yellow), sweeper);
      boss.position.y = .5;
      for (const side of [-1, 1]) {
        const end = add(new THREE.Mesh(new THREE.SphereGeometry(.34, 16, 12), softMaterial(THREE, PALETTE.yellow)), sweeper);
        end.position.set(side * fan.radius, .52, 0);
      }
    }
    return { rotor, sweeper };
  });
  let party = 0;
  return {
    root,
    celebrateFinish() { party = 1; },
    update() {
      const spin = party ? 3 : 1;
      decorations.forEach(({ x, baseY, z, phase }, i) => {
        dummy.position.set(x, baseY + Math.sin(course.time * 1.6 * spin + phase) * .28, z);
        dummy.rotation.z = course.time * .6 * spin + phase; dummy.updateMatrix(); confetti.setMatrixAt(i, dummy.matrix);
      });
      confetti.instanceMatrix.needsUpdate = true;
      balloons.update(course.time);
      course.fans.forEach((fan, i) => {
        fanVisuals[i].rotor.rotation.y = -fan.angle;
        if (fanVisuals[i].sweeper) fanVisuals[i].sweeper.rotation.y = -fan.beamAngle;
      });
    },
    dispose() {
      owned.forEach(g => g.dispose()); balloons.mesh.dispose(); confetti.material.dispose(); confetti.dispose();
      root.traverse(o => { if (o.material?.userData.owned) { o.material.map?.dispose(); o.material.dispose(); } });
    }
  };
}
// Hub: a cushion with a rounded top edge, top face at y = 0.
function roundedHub(THREE, r) {
  const pts = [new THREE.Vector2(0, -.5), new THREE.Vector2(r, -.5)];
  for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(r - .18 + Math.cos(a) * .18, -.18 + Math.sin(a) * .18)); }
  pts.push(new THREE.Vector2(0, 0));
  return new THREE.LatheGeometry(pts, 32);
}
