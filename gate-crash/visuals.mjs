import { HALF_WIDTH, GATE, SLIDE, FINISH_Z, START, floorY } from './course.mjs';
import { PALETTE, candyMaterial, softMaterial, roundedSlabGeometry, inflatableArch, balloonField } from '../presentation/fg-style.mjs';
import { boxesMesh, instances, roundedBoxGeometry } from '../race-kit/visual-kit.mjs';
import { scaleUV } from '../door-dash/visuals.mjs';

// Plain decks and posts; the gates — the hazard — are the one bold print (two broad stripes per gate).
export function createGateCrashVisuals(THREE, course) {
  const root = new THREE.Group(), owned = [];
  const keep = mesh => { root.add(mesh); owned.push(mesh.geometry); return mesh; };
  const width = HALF_WIDTH * 2 + .4;

  const deck = keep(new THREE.Mesh(roundedSlabGeometry(THREE, width, SLIDE.z1 - START.z1, 1.4, 1.2), softMaterial(THREE, 0x8ccfff, .5)));
  deck.position.set(0, 0, (START.z1 + SLIDE.z1) / 2); deck.receiveShadow = true;
  // Glossy pink slime slide down to the final row.
  const len = Math.hypot(SLIDE.z2 - SLIDE.z1, SLIDE.drop);
  const slide = keep(new THREE.Mesh(roundedSlabGeometry(THREE, width, len + .6, 1.2, .6), new THREE.MeshStandardMaterial({ color: PALETTE.hotPink, emissive: 0x7a0040, emissiveIntensity: .25, roughness: .15 })));
  slide.position.set(0, -SLIDE.drop / 2, (SLIDE.z1 + SLIDE.z2) / 2); slide.rotation.x = Math.atan2(SLIDE.drop, SLIDE.z2 - SLIDE.z1); slide.receiveShadow = true;
  owned.push(slide.material);
  const bottom = keep(new THREE.Mesh(roundedSlabGeometry(THREE, width, FINISH_Z + 4 - SLIDE.z2, 1.4, 1.2), softMaterial(THREE, PALETTE.mint, .5)));
  bottom.position.set(0, -SLIDE.drop, (SLIDE.z2 + FINISH_Z + 4) / 2); bottom.receiveShadow = true;
  const start = keep(new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, START.z2 - START.z1), candyMaterial(THREE, 'chevron', PALETTE.yellow, 0xfff0a0, 9)));
  start.rotation.x = -Math.PI / 2; start.position.set(0, .02, (START.z1 + START.z2) / 2); scaleUV(start.geometry, HALF_WIDTH * 2, START.z2 - START.z1);
  const line = keep(new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, 3), candyMaterial(THREE, 'check', 0x2b1a5a, PALETTE.white, 3)));
  line.rotation.x = -Math.PI / 2; line.position.set(0, -SLIDE.drop + .02, FINISH_Z + 1.5); scaleUV(line.geometry, HALF_WIDTH * 2, 3);

  // Posts, gate headers and side barriers: one mesh.
  const boxes = [];
  course.rows.forEach(row => {
    row.posts.forEach(p => boxes.push({ ...p, color: PALETTE.purple }));
    boxes.push({ x1: -HALF_WIDTH - .3, x2: HALF_WIDTH + .3, y1: row.y0 + 4.4, y2: row.y0 + 5.1, z1: row.z - GATE.thick / 2 - .05, z2: row.z + GATE.thick / 2 + .05, color: PALETTE.yellow });
  });
  course.sides.forEach(s => boxes.push({ ...s, color: PALETTE.violet }));
  keep(boxesMesh(THREE, boxes, { bevel: .12 }));

  const gates = course.rows.flatMap(r => r.gates.map(g => ({ g, row: r })));
  const gateMat = candyMaterial(THREE, 'stripes', 0xff5a4f, 0xffd0c8, 2); // two broad stripes per gate face
  const gateMesh = keep(instances(THREE, roundedBoxGeometry(THREE, GATE.width - .06, GATE.height, GATE.thick - .1, .12), gateMat, gates.length));
  gateMesh.castShadow = true;

  // Spinning bars: static posts (instanced) and bars (instanced, rotated every frame).
  const n = course.spinners.length;
  const postGeo = new THREE.CylinderGeometry(.35, .5, 1.1, 16); postGeo.translate(0, .55, 0);
  const posts = keep(instances(THREE, postGeo, softMaterial(THREE, PALETTE.yellow, .4), n));
  const bars = keep(instances(THREE, new THREE.CapsuleGeometry(.3, course.spinners[0].arm * 2 - .6, 4, 12).rotateZ(Math.PI / 2), candyMaterial(THREE, 'bands', PALETTE.purple, PALETTE.white, .25), n));
  course.spinners.forEach((s, i) => posts.place(i, s.x, floorY(s.z), s.z));
  posts.instanceMatrix.needsUpdate = true;

  const arch = inflatableArch(THREE, { width: HALF_WIDTH * 2 + .8, height: 7.4, a: PALETTE.violet, b: PALETTE.white, label: 'ФИНИШ!', labelBg: PALETTE.purple });
  arch.position.set(0, -SLIDE.drop, FINISH_Z); root.add(arch);
  arch.traverse(o => { if (o.geometry) owned.push(o.geometry); });
  const spots = [];
  for (let z = 4; z < FINISH_Z; z += 13) for (const side of [-1, 1]) spots.push({ x: side * (HALF_WIDTH + 6 + (z % 3)), y: floorY(z) + 1 + (z % 4), z: z + side * 3, r: 1.3 + (z % 3) * .2 });
  const balloons = balloonField(THREE, spots);
  root.add(balloons.mesh); owned.push(balloons.mesh.geometry);

  const update = () => {
    // Only the part above the deck is drawn: a lowered gate disappears into the floor instead of hanging below it.
    gates.forEach(({ g, row }, i) => { const h = Math.max(.001, g.h ?? 0); gateMesh.place(i, g.x, row.y0 + h / 2, row.z, 0, 0, 0, 1, h / GATE.height, 1); });
    course.spinners.forEach((s, i) => bars.place(i, s.x, floorY(s.z) + s.y, s.z, 0, -s.angle, 0));
    gateMesh.instanceMatrix.needsUpdate = bars.instanceMatrix.needsUpdate = true;
    balloons.update(course.time);
  };
  update();
  return {
    root, update, celebrateFinish() {},
    dispose() {
      owned.forEach(g => g.dispose()); gateMesh.dispose(); posts.dispose(); bars.dispose(); balloons.mesh.dispose();
      root.traverse(o => { if (o.material?.userData.owned || o.material?.vertexColors) { o.material.map?.dispose(); o.material.dispose(); } });
    }
  };
}
