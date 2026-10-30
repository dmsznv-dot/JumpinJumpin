// Dumps the cube's suit shell (body inflated by the suit offset, face window included) for build.py,
// with every ring resampled to `points` evenly spaced vertices — that sets the costume's polygon budget.
// Usage: node tools/costumes/shell.mjs <suit> <points> > shell.json
import fs from 'node:fs/promises';
import {cubeShellGeometry} from '../../characters/cube-shape.mjs';
const root = new URL('../../', import.meta.url);
const THREE = await import('data:text/javascript;base64,' + Buffer.from(await fs.readFile(new URL('vendor/three.module.min.js', root))).toString('base64'));
const suit = Number(process.argv[2] ?? .06), points = Number(process.argv[3] ?? 36);
const src = cubeShellGeometry(THREE, {grow: suit}).attributes.position.array;
const per = 52, rings = (src.length / 3 - 1) / per; // roundedContour(…,12): 4 corners × 13 points
const position = [], index = [];
for (let k = 0; k < rings; k++) {
  const ring = [];
  for (let j = 0; j < per; j++) ring.push([src[(k * per + j) * 3], src[(k * per + j) * 3 + 1], src[(k * per + j) * 3 + 2]]);
  // Arc-length resampling of the closed contour.
  const len = [0];
  for (let j = 1; j <= per; j++) { const a = ring[j - 1], b = ring[j % per]; len.push(len[j - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  for (let i = 0, j = 0; i < points; i++) {
    const s = i / points * len[per];
    while (len[j + 1] < s) j++;
    const t = (s - len[j]) / ((len[j + 1] - len[j]) || 1), a = ring[j], b = ring[(j + 1) % per];
    position.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2]);
  }
}
for (let k = 0; k < rings - 1; k++) for (let j = 0; j < points; j++) {
  const a = k * points + j, b = k * points + (j + 1) % points, c = a + points, d = b + points;
  index.push(a, b, c, b, d, c);
}
const centre = rings * points;
position.push(src[src.length - 3], src[src.length - 2], src[src.length - 1]);
for (let j = 0; j < points; j++) index.push(centre, (j + 1) % points, j);
process.stdout.write(JSON.stringify({suit, points, position, index}));
