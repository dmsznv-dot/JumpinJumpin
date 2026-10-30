# Wardrobe revision — 2026-10-30

Based on main f52dc6c. Work is saved on codex/wardrobe-props-revision; main is unchanged.

## Implemented
- 8 new NVIDIA SimReady wearables: hardhat, teapot, extinguisher, mallet, bucket, croissant, baguette, waffle.
- 8 existing models rebuilt from original USD geometry as head/back props: hotdog, banana, corn, cupcake, strawberry, avocado, barrel, box. The old cube-wrap pipeline destroyed object identity.
- Removed headphones and 10 animal appendage placeholders. Removed 5 near-duplicate full suits (diver, robot, samurai, shark, dragon). Removed the donut: simplified source breaks into disconnected-looking pieces.
- Rejected toaster, kettle and wrench experiments after rendered review; these are not shipped.
- Five explicit SVG motifs replace misleading aliases: five-point stars, fluffy clouds, hypnotic rings, candy waves, harlequin diamonds. Seven other patterns retain attributed Hero Patterns artwork.
- Corrected vertical mask orientation and increased circuit print readability.
- Retired saved selections fall back to hat_none while progression is preserved. Updated bot presets.
- Asset loading keeps the body visible on slow/failed loads; meshes share cached geometry.
- Review gallery: characters/costumes.html, with front/back/side views, all cosmetics and prints.
- Attribution, source URLs and full CC BY 4.0 text are included in runtime packaging.

## Verification at checkpoint
- Character tests and GLB validation run locally. New tests cover retired IDs, selectable assets, self-contained GLBs, geometry budgets and face clearance.
- Browser screenshots reviewed for front/back props and all 12 print designs.
- After review, mallet rotated head-up, croissant rotated across head, strawberry rotated upright and waffle tilted to expose its face.

## Remaining before merging
- Recheck the final orientation changes in the gallery after a fresh reload; HTTP caching can retain old modules.
- Inspect all retained small procedural hats, and play a round with new accessories.
- Final mobile/performance review and release ZIP size check.
- glTF Transform final optimization has not been run; current assets are simplified self-contained GLBs from trimesh.

## Rebuild
Python 3.12 dependencies: usd-core, numpy, pillow, trimesh, fast-simplification, scipy.
Download each source listed in tools/costumes/props.json using tools/costumes/fetch.py.
Run: `python tools/costumes/build-props.py --cache /path/to/assets`.
Do not run the legacy build.py CLI: that is the previous cube-wrap pipeline. build-props.py currently imports its USD loading and palette helpers.
