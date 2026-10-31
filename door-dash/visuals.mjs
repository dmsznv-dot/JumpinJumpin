import { HALF_WIDTH, DOOR, UPPER_END, LOWER_Y, FINISH_Z, START } from './course.mjs';
import { PALETTE, candyMaterial, softMaterial, roundedSlabGeometry, inflatableArch, balloonField, roundedRectShape } from '../presentation/fg-style.mjs';
import { boxesMesh, instances } from '../race-kit/visual-kit.mjs';

// Walls in show colours, identical cream doors (no tell-tale marks), plain decks; the only print is the finish.
const ROW_COLORS = [PALETTE.violet, PALETTE.cyan, PALETTE.purple, PALETTE.orange, PALETTE.mint, PALETTE.violet, PALETTE.yellow];
export function createDoorDashVisuals(THREE, course) {
  const root = new THREE.Group(), owned = [];
  const keep = mesh => { root.add(mesh); owned.push(mesh.geometry); return mesh; };

  const upper = keep(new THREE.Mesh(roundedSlabGeometry(THREE, HALF_WIDTH * 2 + .4, UPPER_END - START.z1, 1.4, 1.2), softMaterial(THREE, PALETTE.lilac, .5)));
  upper.position.set(0, 0, (START.z1 + UPPER_END) / 2); upper.receiveShadow = true;
  const lower = keep(new THREE.Mesh(roundedSlabGeometry(THREE, HALF_WIDTH * 2 + .4, FINISH_Z + 4 - UPPER_END, 1.4, 1.2), softMaterial(THREE, PALETTE.mint, .5)));
  lower.position.set(0, LOWER_Y, (UPPER_END + FINISH_Z + 4) / 2); lower.receiveShadow = true;
  // Big chevrons on the start pad point the way.
  const start = keep(new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, START.z2 - START.z1), candyMaterial(THREE, 'chevron', PALETTE.cyan, 0x8fe9f7, 11)));
  start.rotation.x = -Math.PI / 2; start.position.set(0, .02, (START.z1 + START.z2) / 2);
  scaleUV(start.geometry, HALF_WIDTH * 2, START.z2 - START.z1);
  const finish = keep(new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, 3), candyMaterial(THREE, 'check', 0x2b1a5a, PALETTE.white, 3)));
  finish.rotation.x = -Math.PI / 2; finish.position.set(0, LOWER_Y + .02, FINISH_Z + 1.5);
  scaleUV(finish.geometry, HALF_WIDTH * 2, 3);

  // All walls and side barriers: one mesh.
  const boxes = [];
  course.rows.forEach((row, r) => row.walls.forEach(w => boxes.push({ ...w, color: ROW_COLORS[r % ROW_COLORS.length] })));
  course.sides.forEach(s => boxes.push({ ...s, y1: LOWER_Y - .7, color: PALETTE.violet }));
  keep(boxesMesh(THREE, boxes, { bevel: .12 }));

  // Doors: one instanced mesh, pivot at the bottom so a broken door tips over forwards.
  const doors = course.rows.flatMap(r => r.doors);
  const doorGeo = new THREE.ExtrudeGeometry(roundedRectShape(THREE, DOOR.width - .08, DOOR.height - .05, .35), { depth: DOOR.thick - .14, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 2, curveSegments: 6 });
  doorGeo.translate(0, (DOOR.height - .05) / 2, -(DOOR.thick - .14) / 2);
  const doorMesh = keep(instances(THREE, doorGeo, softMaterial(THREE, 0xfff1dc, .45), doors.length));
  doorMesh.castShadow = true;
  // A round porthole on every door, the same on real and fake ones.
  const knobGeo = new THREE.CylinderGeometry(DOOR.width * .18, DOOR.width * .18, DOOR.thick + .04, 24); knobGeo.rotateX(Math.PI / 2); knobGeo.translate(0, DOOR.height * .66, 0);
  const knobMesh = keep(instances(THREE, knobGeo, softMaterial(THREE, PALETTE.sky, .3), doors.length));

  const arch = inflatableArch(THREE, { width: HALF_WIDTH * 2 + .8, height: 10, a: PALETTE.violet, b: PALETTE.white, label: 'ФИНИШ!', labelBg: PALETTE.purple });
  arch.position.set(0, LOWER_Y, FINISH_Z); root.add(arch);
  arch.traverse(o => { if (o.geometry) owned.push(o.geometry); });

  const spots = [];
  for (let z = 4; z < FINISH_Z; z += 12) for (const side of [-1, 1]) spots.push({ x: side * (HALF_WIDTH + 6 + (z % 3)), y: 1 + (z % 4), z: z + side * 3, r: 1.3 + (z % 3) * .2 });
  const balloons = balloonField(THREE, spots);
  root.add(balloons.mesh); owned.push(balloons.mesh.geometry);

  const update = () => {
    doors.forEach((d, i) => {
      // Broken: tips over and lies flat. Fake door hit: a short wobble.
      const tip = d.fall * Math.PI / 2 * .98, wobble = Math.sin(course.time * 38) * d.shake * .06;
      const z = course.rows[d.row].z + (d.broken ? DOOR.thick / 2 : 0);
      doorMesh.place(i, d.x, 0, z, tip + wobble, 0, wobble * .5);
      knobMesh.place(i, d.x, 0, z, tip + wobble, 0, wobble * .5);
    });
    doorMesh.instanceMatrix.needsUpdate = knobMesh.instanceMatrix.needsUpdate = true;
    balloons.update(course.time);
  };
  update();
  return {
    root, update, celebrateFinish() {},
    dispose() {
      owned.forEach(g => g.dispose()); doorMesh.dispose(); knobMesh.dispose(); balloons.mesh.dispose();
      root.traverse(o => { if (o.material?.userData.owned || o.material?.vertexColors) { o.material.map?.dispose(); o.material.dispose(); } });
    }
  };
}
// PlaneGeometry UVs are 0..1; patterns are authored per metre.
export function scaleUV(geometry, w, h) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
}
