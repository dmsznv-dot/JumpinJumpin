// Optional post-processing: ambient occlusion (GTAO) grounds characters and props, a gentle bloom lifts
// highlights (sun glints, slime, neon). Off by default on phones; the player can switch it in settings.
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from '../vendor/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from '../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from '../vendor/jsm/postprocessing/ShaderPass.js';

// Phones and tablets: touch-first, small screen or few CPU cores.
export function isLowPowerDevice() {
  if (typeof matchMedia === 'undefined') return false;
  const touch = matchMedia('(pointer: coarse)').matches, small = Math.min(innerWidth, innerHeight) < 600;
  return touch || small || (navigator.hardwareConcurrency || 8) <= 4;
}

export function createPostFX(THREE, renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio();
  // Half-float HDR target with 4× MSAA: the composer keeps the same anti-aliasing as direct rendering.
  const target = new THREE.WebGLRenderTarget(size.x * ratio, size.y * ratio, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(ratio); composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));

  const ao = new GTAOPass(scene, camera, size.x, size.y);
  ao.output = GTAOPass.OUTPUT.Default;
  ao.blendIntensity = .85;
  // Small radius: contact shadows under cubes, in corners of walls and doors, around hex tiles.
  ao.updateGtaoMaterial({ radius: .55, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1, rings: 2, samples: 12 });
  // GTAO's own pass hides only points and lines, so transparent decals (drop shadows under the cubes, banners)
  // and the sky dome went into its depth/normal buffer as solid geometry. A blob shadow floating over a curved
  // ring then darkened a square around itself, flickering as the ring turned. Keep only opaque, depth-writing
  // meshes in the AO pass.
  ao.overrideVisibility = function () {
    const cache = this._visibilityCache;
    this.scene.traverse(object => {
      cache.set(object, object.visible);
      const m = object.material;
      if (object.isPoints || object.isLine || (m && !Array.isArray(m) && (m.transparent || m.depthWrite === false))) object.visible = false;
    });
  };
  composer.addPass(ao);

  // Safety net before bloom: a NaN/Inf pixel (a broken normal in some model) would be blurred by bloom into
  // flickering black squares across the screen. Replace non-finite values and clamp extreme highlights.
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        bvec4 bad = bvec4(c.r != c.r || abs(c.r) > 1e4, c.g != c.g || abs(c.g) > 1e4, c.b != c.b || abs(c.b) > 1e4, c.a != c.a);
        if (any(bad)) c = vec4(0.0, 0.0, 0.0, 1.0);
        gl_FragColor = vec4(min(c.rgb, vec3(32.0)), c.a);
      }`
  }));

  // Only values above ~1.0 (HDR, before tone mapping) bloom: sun glints, emissive slime, neon bands — not the sky.
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), .32, .45, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass()); // tone mapping + sRGB, as the renderer does without post

  const fx = {
    enabled: true, composer,
    setEnabled(on) { fx.enabled = on; },
    resize() {
      const s = renderer.getSize(new THREE.Vector2());
      composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(s.x, s.y);
    },
    render(dt) { composer.render(dt); },
    dispose() { composer.dispose(); target.dispose(); ao.dispose(); bloom.dispose(); }
  };
  return fx;
}
