# Sketch runner prototype

New player character based on the supplied turnaround reference. Existing bot models remain available for comparison.

- 22 named bones; 9 indexed skinned meshes. Parts use rigid bone weights.
- Eight animation clips: idle, run, jump, fall, dive, land, win, wave.
- Preview: `characters/preview.html`; game: `index.html`.
- Export: `node characters/tools/export.mjs`. Output: `assets/models/sketch-runner.glb`.
- Tests: `node --test characters/character.test.mjs`.
- Existing costumes are not adapted to this prototype.

The exporter is Three.js r170 GLTFExporter, https://github.com/mrdoob/three.js/blob/r170/examples/jsm/exporters/GLTFExporter.js, distributed under the MIT license (see tools/THREE-LICENSE.txt). Runtime uses the repository Three.js vendor file.

## Cube runner

`cube-character.mjs` is the playable model from the yellow cube turnaround. Ten bones, four materials, eight clips, unit scale in meters, feet origin at ground, facing +Z. Model geometry is visual only; existing gameplay collision remains authoritative. `setColors({shell,face,boots})` independently recolors materials. Runtime procedural skeletal poses match the baked GLB clips. Old outfits are not adapted. Export with `node characters/tools/export-cube.mjs`.

## Cube wardrobe and emotes

35 entries: none, 26 top accessories and 8 enclosing costumes. Cosmetics attach to Body. Existing saved outfit IDs are preserved. Palette and pattern selection is applied consistently to lobby, player and bots. Square-face projected 256px motifs cover the shell and leave the face untouched; skin and boots use independent materials.

Eleven animation clips include dance/sit/look. Runtime lobby mode cycles greeting, idle, dance, idle, sitting, idle, curiosity and idle at six-second intervals, easing pose transitions. Research and source links: ANIMATION-RESEARCH.md. No downloaded humanoid clips are included.

## Model-sheet refinement and performance

Continuous contoured shell: 1.62 × 1.57 × 1.16 m, gently rounded front and back, shallow face recess. Face center z=0.54, lip z=0.58, eye spacing 0.70 m with shallow dark discs. Accessories and enclosing suits fit the thicker body. Base mesh reduced from 17,056 to 8,328 triangles, and from 28,592 to 4,694 vertices.

Round celebrations now stop gameplay and reject duplicate starts; timed particles and screen confetti are cleaned up. Frame limits: gameplay 60 FPS, lobby/results 30 FPS; hidden page skips simulation/rendering. Render target capped at 2 million pixels and DPR 1.5; shadow map 1024². These bound GPU work, not a guarantee of a particular temperature on every device.

## Print and rounding revision

Outer corner radius increased from 0.37 to 0.48 m without changing the gameplay footprint. Previous per-vertex dominant-axis UVs were removed. Print coordinates now follow one continuous body-space wrap around the rounded sides with an integer repeat count to close the back seam. Top/bottom caps fade to the base color, avoiding folded motifs at singularities. The face is a separate unprinted material.

Twelve original SVG artworks from Hero Patterns are rasterized locally to shared 1024² R8 masks with mipmaps and anisotropic filtering. Palette colors are uniforms, so contestants share both mask textures and shader programs. Fully enclosing suits use the same print method with coordinates baked into body space. No external runtime requests. Attribution: PRINT-LICENSE.md and settings.

The downloadable GLB contains the base character and skeletal clips. Palette-driven prints are runtime materials.

## Model sheet v2 (turnaround match)

Proportions are now measured from the four-view model sheet (front / left side / back / three-quarter) and checked with `characters/turnaround.html` (`?hat=dino&pattern=polka&c1=65bd7a`). Dimensions live in `CUBE` (`cube-shape.mjs`):

- Body 1.62 × 1.57 × 1.34 m. The previous 1.16 m depth was too flat; the side view gives depth ≈ 0.85 × height.
- Every edge is a superellipse: radius 0.61, power 3.3. The sheet silhouettes fit it within 2 px, while the old circular 0.48 corner was off by up to 22 px.
- The face window (1.075 × 0.605) sits 0.085 behind a raised yellow lip.
- Straight legs 0.16 m thick, ±0.21 m apart. 0.377 m of leg shows under the body, of which the lower 44% is a coral boot (#f2596e) with a crisp cuff. Feet touch y = 0.

Full-body costumes are the body shell inflated by 0.06 (`cubeShellGeometry(T,{grow})`), so they keep the pillowy silhouette and open exactly around the face. Front and back accessory parts follow the deeper body. Print wrapping uses the new horizontal section (`WRAP` in `cube-print.mjs`).

Base character is now 6,616 triangles and 3,760 vertices, down from 8,328 and 4,694.
