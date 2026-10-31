import { PAD_HALF_WIDTH, FINISH_Z } from './course.mjs';
import { PALETTE, candyMaterial, softMaterial, roundedSlabGeometry, inflatableArch, balloonField } from '../presentation/fg-style.mjs';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { scaleUV } from '../door-dash/visuals.mjs';

// Big plain see-saws across the course in alternating show colours (none pink: the slime below is pink), yellow fulcrums merged
// into one mesh, big prints only on the start (chevrons) and the finish (checks).
const PLANK_COLORS = [PALETTE.cyan, PALETTE.yellow, PALETTE.violet, PALETTE.mint, PALETTE.orange];
export function createSeeSawVisuals(THREE, course) {
  const root = new THREE.Group(), owned = [];
  const keep = (mesh, parent = root) => { parent.add(mesh); owned.push(mesh.geometry); return mesh; };

  for (const pad of course.pads) {
    const mat = pad.kind === 'start' ? candyMaterial(THREE, 'chevron', PALETTE.cyan, 0x8fe9f7, 10)
      : pad.kind === 'finish' ? candyMaterial(THREE, 'check', PALETTE.violet, PALETTE.violetLight, 6)
      : softMaterial(THREE, PALETTE.yellow, .45);
    const slab = keep(new THREE.Mesh(roundedSlabGeometry(THREE, PAD_HALF_WIDTH * 2, pad.z2 - pad.z1, 1, 1), mat));
    slab.position.set(0, 0, (pad.z1 + pad.z2) / 2); slab.receiveShadow = true;
  }

  // Planks lie across the course and roll about an axis along it: rotation.z = -angle (course: +angle drops +x).
  // Neighbours that touch get different colours so every seam is readable.
  const plankMats = PLANK_COLORS.map(c => softMaterial(THREE, c, .45));
  const planks = course.planks.map(p => {
    const pivot = new THREE.Group(); pivot.position.set(p.x, 0, p.z); root.add(pivot);
    const twin = course.planks.filter(q => q.row === p.row).indexOf(p);
    const slab = keep(new THREE.Mesh(roundedSlabGeometry(THREE, p.length, p.depth, 1, .8), plankMats[(p.row * 2 + twin) % plankMats.length]), pivot);
    slab.castShadow = slab.receiveShadow = true;
    return pivot;
  });
  // Fulcrums (triangular stands along the course under each pivot) never move: one merged mesh.
  const stands = course.planks.map(p => {
    // A 3-sided cylinder laid along Z is a triangular prism; turning it half a turn puts an edge on top.
    const g = new THREE.CylinderGeometry(1.6, 1.6, p.depth * .8, 3, 1); g.rotateX(Math.PI / 2); g.rotateZ(Math.PI);
    g.translate(p.x, -2.6, p.z); return g;
  });
  keep(new THREE.Mesh(mergeGeometries(stands), softMaterial(THREE, PALETTE.white, .5)));
  stands.forEach(g => g.dispose());

  const finish = keep(new THREE.Mesh(new THREE.PlaneGeometry(PAD_HALF_WIDTH * 2, 2), candyMaterial(THREE, 'check', 0x2b1a5a, PALETTE.white, 2)));
  finish.rotation.x = -Math.PI / 2; finish.position.set(0, .03, FINISH_Z); scaleUV(finish.geometry, PAD_HALF_WIDTH * 2, 2);
  const arch = inflatableArch(THREE, { width: PAD_HALF_WIDTH * 2 + .8, height: 10, a: PALETTE.violet, b: PALETTE.white, label: 'ФИНИШ!', labelBg: PALETTE.purple });
  arch.position.set(0, 0, FINISH_Z); root.add(arch);
  arch.traverse(o => { if (o.geometry) owned.push(o.geometry); });

  const spots = [];
  for (let z = 4; z < FINISH_Z; z += 18) for (const side of [-1, 1]) spots.push({ x: side * (PAD_HALF_WIDTH + 7 + (z % 3)), y: 1 + (z % 4), z: z + side * 3, r: 1.3 + (z % 3) * .2 });
  const balloons = balloonField(THREE, spots);
  root.add(balloons.mesh); owned.push(balloons.mesh.geometry);

  const update = () => {
    course.planks.forEach((p, i) => { planks[i].rotation.z = -p.angle; });
    balloons.update(course.time);
  };
  update();
  return {
    root, update, celebrateFinish() {},
    dispose() { owned.forEach(g => g.dispose()); balloons.mesh.dispose(); root.traverse(o => { if (o.material?.userData.owned) { o.material.map?.dispose(); o.material.dispose(); } }); }
  };
}
