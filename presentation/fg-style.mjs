// Shared look for the show levels: bright sky with puffy clouds, candy patterns, soft inflatable shapes.
// Everything is generated in code (canvas patterns, extrusions), so the build stays small and needs no extra assets.

export const PALETTE = {
  pink: 0xff4fa3, hotPink: 0xff2a85, cyan: 0x37d8f0, yellow: 0xffd93b, purple: 0x8b5cf6,
  lilac: 0xc4a7ff, mint: 0x5ee6b8, orange: 0xff9f2e, white: 0xfdfbff, sky: 0x8fd8ff
};
const css = hex => '#' + hex.toString(16).padStart(6, '0');

// ---------- Sky ----------
// Gradient dome + one instanced cloud mesh (a single draw call for all clouds). Radius stays inside camera.far (320).
export function createSky(THREE, { top = 0x3aa8f5, horizon = 0xc7f0ff, bottom = 0xffd6ec } = {}) {
  const root = new THREE.Group();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.75, h), 0.8)) : mix(horizon, bottom, smoothstep(0.0, -0.35, h));
          // soft sun glow
          float sun = pow(max(dot(vDir, normalize(vec3(0.35, 0.55, -0.75))), 0.0), 48.0);
          gl_FragColor = vec4(c + vec3(1.0, 0.95, 0.8) * sun * 0.55, 1.0);
          #include <colorspace_fragment>
        }`
    })
  );
  dome.renderOrder = -10; dome.frustumCulled = false;
  root.add(dome);

  const puff = new THREE.IcosahedronGeometry(1, 2);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xcfe6ff, emissiveIntensity: .35, fog: false });
  const puffs = [], rnd = mulberry(7);
  for (let c = 0; c < 46; c++) {
    const a = c / 46 * Math.PI * 2 + rnd() * .1, dist = 135 + rnd() * 120;
    // A band of clouds below the course (the show floats in the sky) and a higher band around it.
    const y = c % 3 === 0 ? -50 - rnd() * 35 : 14 + rnd() * 60, size = 7 + rnd() * 9;
    const n = 4 + Math.floor(rnd() * 4);
    for (let p = 0; p < n; p++) {
      const s = size * (.55 + rnd() * .5);
      puffs.push([Math.cos(a) * dist + (p - n / 2) * size * .7, y + rnd() * size * .35, Math.sin(a) * dist + (rnd() - .5) * size * .8, s, s * .72]);
    }
  }
  const clouds = new THREE.InstancedMesh(puff, cloudMat, puffs.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  puffs.forEach(([x, y, z, s, sy], i) => { m.compose(v.set(x, y, z), q, sc.set(s, sy, s)); clouds.setMatrixAt(i, m); });
  clouds.frustumCulled = false;
  root.add(clouds);
  return {
    root,
    // The sky travels with the camera (it sits inside the camera's far plane), clouds drift slowly.
    update(t, camera) { root.position.set(camera.position.x, 0, camera.position.z); clouds.rotation.y = t * .004; },
    setColors(t2, h2, b2) { const u = dome.material.uniforms; u.top.value.setHex(t2); u.horizon.value.setHex(h2); u.bottom.value.setHex(b2); }
  };
}

// ---------- Patterns ----------
const patternCache = new Map();
// kind: stripes | bands | check | dots | chevron | hexdots
export function patternTexture(THREE, kind, a, b) {
  const key = `${kind}:${a}:${b}`;
  if (patternCache.has(key)) return patternCache.get(key);
  const size = 256, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = css(a); g.fillRect(0, 0, size, size); g.fillStyle = css(b);
  if (kind === 'stripes') {
    for (let i = -size; i < size * 2; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 32, 0); g.lineTo(i + 32 - size, size); g.lineTo(i - size, size); g.fill(); }
  } else if (kind === 'bands') {
    for (let i = 0; i < size; i += 64) g.fillRect(0, i, size, 32);
  } else if (kind === 'check') {
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64);
  } else if (kind === 'dots') {
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) { g.beginPath(); g.arc(x * 64 + 32 + (y % 2) * 32, y * 64 + 32, 15, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.arc(0, 32, 15, 0, Math.PI * 2); g.arc(0, 160, 15, 0, Math.PI * 2); g.fill();
  } else if (kind === 'chevron') {
    g.lineWidth = 34; g.strokeStyle = css(b); g.lineJoin = 'round';
    for (let y = -64; y < size + 64; y += 128) { g.beginPath(); g.moveTo(-10, y + 96); g.lineTo(128, y); g.lineTo(266, y + 96); g.stroke(); }
  }
  // Soft vignette inside each tile reads as stitched padding.
  if (kind === 'check' || kind === 'dots') { g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.strokeRect(2, 2, size - 4, size - 4); }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  patternCache.set(key, tex);
  return tex;
}

const materialCache = new Map();
// Candy material: pattern in world units (`scale` metres per tile) for geometry whose UVs are in metres.
export function candyMaterial(THREE, kind, a, b, scale = 4, { roughness = .5, emissive = 0x000000 } = {}) {
  const key = `${kind}:${a}:${b}:${scale}:${roughness}:${emissive}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const map = patternTexture(THREE, kind, a, b).clone();
  map.needsUpdate = true; map.repeat.set(1 / scale, 1 / scale);
  const mat = new THREE.MeshStandardMaterial({ map, roughness, emissive });
  materialCache.set(key, mat);
  return mat;
}
const plainCache = new Map();
export function softMaterial(THREE, color, roughness = .48) {
  const key = color + ':' + roughness;
  if (!plainCache.has(key)) plainCache.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return plainCache.get(key);
}

// ---------- Soft shapes ----------
export function roundedRectShape(THREE, w, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  r = Math.min(r, w / 2, d / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// Pillowy slab: top face at y=0, rounded corners and bevelled edges, UVs in metres.
export function roundedSlabGeometry(THREE, w, d, h, r = .6) {
  const bevel = Math.min(.22, h * .35);
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(THREE, w - bevel * 2, d - bevel * 2, Math.max(.05, r - bevel)), {
    depth: Math.max(.01, h - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6
  });
  geo.rotateX(Math.PI / 2); // extrusion runs down from y = 0
  geo.translate(0, -bevel, 0);
  return geo;
}
// Foam tube (padded rail) lying along X. Decor pieces skip the shadow pass (each caster is another draw call).
export function foamRail(THREE, length, radius, material) {
  const geo = new THREE.CapsuleGeometry(radius, Math.max(.01, length - radius * 2), 4, 10);
  geo.rotateZ(Math.PI / 2);
  return new THREE.Mesh(geo, material);
}
// Candy-cane support column: diagonal stripes on a cylinder read as a spiral.
export function candyColumn(THREE, height, radius, a = PALETTE.white, b = PALETTE.pink) {
  const geo = new THREE.CylinderGeometry(radius, radius * 1.12, height, 18, 1, true);
  const around = Math.max(1, Math.round(radius * 4)), along = height / 1.4, uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * around, uv.getY(i) * along);
  return new THREE.Mesh(geo, candyMaterial(THREE, 'stripes', a, b, 1));
}

// ---------- Show props ----------
// Inflatable arch with a banner; the course passes underneath (no collision, purely visual).
export function inflatableArch(THREE, { width = 16, height = 7, a = PALETTE.pink, b = PALETTE.white, label = '', labelBg = PALETTE.purple, tube = .75 } = {}) {
  const group = new THREE.Group();
  const span = width / 2;
  const mat = candyMaterial(THREE, 'bands', a, b, 1);
  // Two upright tubes and a half-torus across the top.
  const legH = Math.max(.5, height - span * .55);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(tube, legH, 6, 14), mat);
    leg.position.set(side * span, legH / 2, 0); group.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(tube * 1.35, 16, 10), softMaterial(THREE, PALETTE.yellow));
    foot.scale.y = .6; foot.position.set(side * span, .15, 0); group.add(foot);
  }
  const top = new THREE.Mesh(new THREE.TorusGeometry(span, tube, 12, 36, Math.PI), mat);
  top.scale.y = .55; top.position.y = legH; group.add(top);
  if (label) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const g = canvas.getContext('2d');
    g.fillStyle = css(labelBg); g.beginPath(); g.roundRect(6, 6, 1012, 244, 60); g.fill();
    g.strokeStyle = css(PALETTE.yellow); g.lineWidth = 14; g.stroke();
    g.fillStyle = '#fff'; g.font = '900 150px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 16; g.strokeStyle = 'rgba(40,10,80,.55)'; g.strokeText(label, 512, 136); g.fillText(label, 512, 136);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    // Two one-sided planes so the label reads correctly from both sides of the arch.
    const bw = Math.min(width * .62, 10), bannerMat = Object.assign(new THREE.MeshBasicMaterial({ map: tex }), { userData: { owned: true } });
    const bannerGeo = new THREE.PlaneGeometry(bw, bw / 4);
    for (const flip of [0, Math.PI]) {
      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      banner.rotation.y = flip; banner.position.set(0, legH + span * .55 - .2, flip ? -.02 : .02); group.add(banner);
    }
  }
  return group;
}
// Bobbing balloons / beach balls around a level (one instanced draw call per colour set).
export function balloonField(THREE, spots, { colors = [PALETTE.pink, PALETTE.cyan, PALETTE.yellow, PALETTE.purple, PALETTE.mint], radius = 1.4 } = {}) {
  const geo = new THREE.SphereGeometry(1, 20, 14);
  geo.scale(1, 1.18, 1);
  const mat = new THREE.MeshStandardMaterial({ roughness: .25, metalness: .05 });
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  const color = new THREE.Color(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  spots.forEach((p, i) => mesh.setColorAt(i, color.setHex(colors[i % colors.length])));
  const base = spots.map(p => ({ ...p, r: (p.r || radius) }));
  const place = t => {
    base.forEach((p, i) => { m.compose(v.set(p.x, p.y + Math.sin(t * 1.3 + i * 1.7) * .35, p.z), q, s.setScalar(p.r)); mesh.setMatrixAt(i, m); });
    mesh.instanceMatrix.needsUpdate = true;
  };
  place(0);
  return { mesh, update: place };
}

function mulberry(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
