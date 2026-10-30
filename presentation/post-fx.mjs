// Optional post-processing: ambient occlusion (GTAO) grounds characters and props, a gentle bloom lifts
// highlights (sun glints, slime, neon). Off by default on phones; the player can switch it in settings.
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from '../vendor/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from '../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js';

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
  composer.addPass(ao);

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
