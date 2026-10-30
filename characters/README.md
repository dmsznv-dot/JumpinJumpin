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
