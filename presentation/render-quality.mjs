// Engine look and performance: colour pipeline, image-based lighting from the show sky, a shadow frustum that
// follows the action, and resolution that adapts to the device's frame time.

// Khronos PBR Neutral keeps the saturated toy colours (ACES pulls bright pinks and yellows toward grey).
export function setupColour(THREE, renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
}

// Soft studio/sky environment baked once with PMREM: gives every PBR surface gentle reflections and fill light
// in the sky's own colours (blue from above, warm pink bounce from the slime below, a bright sun spot).
export function bakeSkyEnvironment(THREE, renderer, { top = 0x5ab8ff, horizon = 0xe4f6ff, bottom = 0xffb3d8, sun = [0.35, 0.55, -0.75] } = {}) {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) }, sun: { value: new THREE.Vector3(...sun).normalize() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sun; varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 c = h > 0.0 ? mix(horizon, top, smoothstep(0.0, 0.8, h)) : mix(horizon, bottom, smoothstep(0.0, -0.5, h));
        c += vec3(1.0, 0.92, 0.8) * (pow(max(dot(vDir, sun), 0.0), 64.0) * 6.0 + pow(max(dot(vDir, sun), 0.0), 6.0) * 0.35);
        gl_FragColor = vec4(c, 1.0);
      }`
  }));
  env.add(dome);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, 0.02);
  pmrem.dispose(); dome.geometry.dispose(); dome.material.dispose();
  return target.texture;
}

// The directional light's shadow box rides with the camera focus, so long courses keep crisp shadows end to end.
export function followShadow(light, focus, offset) {
  light.position.set(focus.x + offset.x, focus.y + offset.y, focus.z + offset.z);
  light.target.position.set(focus.x, focus.y, focus.z);
  light.target.updateMatrixWorld();
}

// Resolution scaling: after ~2 s of slow frames drop the pixel ratio a notch, after ~4 s of fast frames raise it.
export class AdaptiveResolution {
  // onChange(ratio): after the pixel ratio moved; onStarved(): still too slow at the lowest ratio.
  constructor(renderer, { min = 0.75, max = 2, budgetMs = 1000 / 58, onChange = null, onStarved = null } = {}) {
    Object.assign(this, { renderer, min, max, budgetMs, avg: budgetMs, slow: 0, fast: 0, cap: max, onChange, onStarved });
    this.ratio = Math.min(max, renderer.getPixelRatio());
  }
  // cap: the most pixels we want for this screen (e.g. dpr limited by total pixel count)
  setCap(cap) { this.cap = Math.max(this.min, Math.min(this.max, cap)); if (this.ratio > this.cap) this.apply(this.cap); }
  apply(ratio) {
    ratio = Math.round(ratio * 4) / 4;
    if (ratio === this.ratio) return false;
    this.ratio = ratio; this.renderer.setPixelRatio(ratio); // resizes the drawing buffer, keeps the CSS size
    this.onChange?.(ratio);
    return true;
  }
  // frameMs: real time since the previous rendered frame (frames are scheduled at 60 or 30 fps).
  update(frameMs, targetMs) {
    if (!(frameMs > 0) || frameMs > 250) return; // tab switch or hitch
    const budget = (targetMs || this.budgetMs) * 1.12;
    this.avg += (frameMs - this.avg) * .08;
    if (this.avg > budget) { this.slow += frameMs; this.fast = 0; } else if (this.avg < budget * .8) { this.fast += frameMs; this.slow = 0; } else { this.slow = this.fast = 0; }
    if (this.slow > 2000) {
      if (this.ratio > this.min) this.apply(Math.max(this.min, this.ratio - .25)); else this.onStarved?.();
      this.slow = 0; this.avg = budget * .9;
    }
    if (this.fast > 4000 && this.ratio < this.cap) { this.apply(Math.min(this.cap, this.ratio + .25)); this.fast = 0; }
  }
}
