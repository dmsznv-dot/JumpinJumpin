// Helpers for obstacle-race visuals: many static boxes as ONE mesh (vertex colours), moving parts as instances.
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

// boxes: [{x1,x2,y1,y2,z1,z2,color}] -> a single mesh, one draw call however many walls and posts there are.
export function boxesMesh(THREE, boxes, { roughness = .5, bevel = .08 } = {}) {
  const color = new THREE.Color();
  const geos = boxes.map(b => {
    const w = b.x2 - b.x1, h = b.y2 - b.y1, d = b.z2 - b.z1;
    const g = roundedBoxGeometry(THREE, w, h, d, Math.min(bevel, w / 2 - .01, h / 2 - .01, d / 2 - .01));
    g.translate((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2, (b.z1 + b.z2) / 2);
    color.setHex(b.color);
    const c = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) { c[i] = color.r; c[i + 1] = color.g; c[i + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  });
  const merged = mergeGeometries(geos);
  geos.forEach(g => g.dispose());
  const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness }));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// Box with softly bevelled edges (an extruded rounded rectangle), centred on the origin; non-indexed, so all merge together.
export function roundedBoxGeometry(THREE, w, h, d, r = .08) {
  if (r <= .005) return new THREE.BoxGeometry(w, h, d).toNonIndexed();
  const s = new THREE.Shape(), x = -w / 2 + r, y = -h / 2 + r, iw = w - 2 * r, ih = h - 2 * r;
  s.moveTo(x, y - r); s.lineTo(x + iw, y - r); s.quadraticCurveTo(x + iw + r, y - r, x + iw + r, y);
  s.lineTo(x + iw + r, y + ih); s.quadraticCurveTo(x + iw + r, y + ih + r, x + iw, y + ih + r);
  s.lineTo(x, y + ih + r); s.quadraticCurveTo(x - r, y + ih + r, x - r, y + ih); s.lineTo(x - r, y); s.quadraticCurveTo(x - r, y - r, x, y - r);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, d - 2 * r), bevelEnabled: true, bevelSize: r * .9, bevelThickness: r, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  return g; // ExtrudeGeometry is already non-indexed, like the BoxGeometry branch above
}

// InstancedMesh helper: place(i, x, y, z, rx, ry, rz, sx, sy, sz).
export function instances(THREE, geometry, material, count) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  mesh.place = (i, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };
  return mesh;
}
