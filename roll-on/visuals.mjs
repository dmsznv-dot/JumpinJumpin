import { RING, PAD_HALF_WIDTH, DRUM, SWING, FINISH_Z } from './course.mjs';
import { PALETTE, candyMaterial, softMaterial, roundedSlabGeometry, inflatableArch, balloonField } from '../presentation/fg-style.mjs';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { scaleUV } from '../door-dash/visuals.mjs';

// Rings in plain show colours (no pink over the pink slime), walls and doughnut bumpers ride on them; the two
// drums carry broad diagonal stripes so their rolling is easy to read.
const RING_COLORS = [PALETTE.cyan, PALETTE.violet, PALETTE.yellow, PALETTE.mint, PALETTE.orange];
const SECTOR = Math.PI * 2 / RING.sectors;

// One ring: thick shell sectors (holes left out), built in ring-local angles (0 = top, toward +x).
function ringGeometry(THREE, ring) {
  const pos = [], idx = [], R = RING.radius, r = R - .7, hw = RING.width / 2 - .05, steps = 3;
  for (let s = 0; s < RING.sectors; s++) {
    if (s === ring.hole || s === (ring.hole + 1) % RING.sectors || s === ring.hole2) continue;
    const base = pos.length / 3;
    for (let j = 0; j <= steps; j++) {
      const a = (s + j / steps) * SECTOR, sx = Math.sin(a), cy = Math.cos(a);
      pos.push(R * sx, R * cy, -hw, R * sx, R * cy, hw, r * sx, r * cy, -hw, r * sx, r * cy, hw);
    }
    for (let j = 0; j < steps; j++) {
      const k = base + j * 4, n = k + 4;
      idx.push(k, k + 1, n, k + 1, n + 1, n, k + 2, n + 2, k + 3, k + 3, n + 2, n + 3, k, n, k + 2, k + 2, n, n + 2, k + 1, k + 3, n + 1, k + 3, n + 3, n + 1);
    }
    const e = base + steps * 4;
    idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3, e, e + 1, e + 2, e + 1, e + 3, e + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function createRollOnVisuals(THREE, course) {
  const root = new THREE.Group(), owned = [];
  const keep = (mesh, parent = root) => { parent.add(mesh); owned.push(mesh.geometry); return mesh; };

  for (const pad of course.pads) {
    const mat = pad.kind === 'start' ? candyMaterial(THREE, 'chevron', PALETTE.yellow, 0xfff0a0, 9)
      : pad.kind === 'finish' ? candyMaterial(THREE, 'check', PALETTE.violet, PALETTE.violetLight, 6) : softMaterial(THREE, PALETTE.lilac, .45);
    const slab = keep(new THREE.Mesh(roundedSlabGeometry(THREE, PAD_HALF_WIDTH * 2, pad.z2 - pad.z1, 1, 1), mat));
    slab.position.set(0, pad.y, (pad.z1 + pad.z2) / 2); slab.receiveShadow = true;
  }

  // Rings: group rotation.z = -angle maps ring-local angles to the course (see course.mjs ringSurface).
  const wallMat = softMaterial(THREE, PALETTE.white, .45), bumperMat = softMaterial(THREE, PALETTE.yellow, .35);
  const rings = course.rings.map((ring, i) => {
    const group = new THREE.Group(); group.position.set(0, ring.y - RING.radius, ring.z); root.add(group);
    const shell = keep(new THREE.Mesh(ringGeometry(THREE, ring), softMaterial(THREE, RING_COLORS[i % RING_COLORS.length], .45)), group);
    shell.receiveShadow = true;
    const at = (sector, lift) => { const a = (sector + .5) * SECTOR; return [(RING.radius + lift) * Math.sin(a), (RING.radius + lift) * Math.cos(a), -a]; };
    const [wx, wy, wa] = at(ring.wall, .55);
    const wall = keep(new THREE.Mesh(new THREE.BoxGeometry(.5, 1.1, RING.width - .2), wallMat), group);
    wall.position.set(wx, wy, 0); wall.rotation.z = wa; wall.castShadow = true;
    if (ring.bumper >= 0) {
      const [bx, by, ba] = at(ring.bumper, .35);
      const donut = keep(new THREE.Mesh(new THREE.TorusGeometry(.62, .32, 10, 20).rotateX(Math.PI / 2), bumperMat), group);
      donut.position.set(bx, by, 0); donut.rotation.z = ba; donut.castShadow = true;
    }
    return group;
  });

  // Drums: axis along X, top rolls toward the racers; UVs stretched so the stripes stay broad.
  const drumMat = candyMaterial(THREE, 'stripes', PALETTE.violet, PALETTE.violetLight, 1);
  const drums = course.drums.map(d => {
    const g = new THREE.CylinderGeometry(DRUM.radius, DRUM.radius, DRUM.halfWidth * 2, 48, 1, true);
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 18, uv.getY(k) * 4);
    g.rotateZ(Math.PI / 2);
    const mesh = keep(new THREE.Mesh(g, drumMat)); mesh.position.set(0, d.y - DRUM.radius, d.z); mesh.receiveShadow = true;
    return mesh;
  });
  const sw = course.swing;
  const swing = keep(new THREE.Mesh(roundedSlabGeometry(THREE, SWING.halfWidth * 2, sw.z2 - sw.z1, .6, .5), softMaterial(THREE, PALETTE.cyan, .45)));
  swing.position.set(0, sw.y, (sw.z1 + sw.z2) / 2); swing.castShadow = swing.receiveShadow = true;

  const finish = keep(new THREE.Mesh(new THREE.PlaneGeometry(PAD_HALF_WIDTH * 2, 2), candyMaterial(THREE, 'check', 0x2b1a5a, PALETTE.white, 2)));
  const finishPad = course.pads[course.pads.length - 1];
  finish.rotation.x = -Math.PI / 2; finish.position.set(0, finishPad.y + .03, FINISH_Z); scaleUV(finish.geometry, PAD_HALF_WIDTH * 2, 2);
  const arch = inflatableArch(THREE, { width: PAD_HALF_WIDTH * 2 + .8, height: 7.4, a: PALETTE.violet, b: PALETTE.white, label: 'ФИНИШ!', labelBg: PALETTE.purple });
  arch.position.set(0, finishPad.y, FINISH_Z); root.add(arch);
  arch.traverse(o => { if (o.geometry) owned.push(o.geometry); });

  const spots = [];
  for (let z = 4; z < FINISH_Z; z += 12) for (const side of [-1, 1]) spots.push({ x: side * (RING.radius + 6 + (z % 3)), y: -2 + (z % 4), z: z + side * 3, r: 1.3 + (z % 3) * .2 });
  const balloons = balloonField(THREE, spots);
  root.add(balloons.mesh); owned.push(balloons.mesh.geometry);

  const update = () => {
    course.rings.forEach((r, i) => { rings[i].rotation.z = -r.angle; });
    drums.forEach(m => { m.rotation.x = -course.time * DRUM.speed / DRUM.radius; });
    swing.position.x = SWING.amp * Math.sin(course.time * SWING.freq);
    balloons.update(course.time);
  };
  update();
  return {
    root, update, celebrateFinish() {},
    dispose() { owned.forEach(g => g.dispose()); balloons.mesh.dispose(); root.traverse(o => { if (o.material?.userData.owned) { o.material.map?.dispose(); o.material.dispose(); } }); }
  };
}
