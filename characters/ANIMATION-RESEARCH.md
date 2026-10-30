# Cube animation research

Reviewed Quaternius Universal Animation Library (https://quaternius.com/packs/universalanimationlibrary.html): humanoid rig, CC0, GLB/FBX/Blend, locomotion, sitting and emotes. Also reviewed Kenney Animated Characters Protagonists (https://kenney.nl/assets/animated-characters-protagonists), CC0 humanoid characters.

These rigs require retargeting. A cubic character with no arms cannot directly use the shoulder, elbow, wrist or humanoid torso tracks. No external animation files have been bundled or claimed as imported.

Chosen implementation: original skeletal poses tailored to the ten-bone cube, with eased pose changes, alternating footwork, body anticipation, sitting with legs forward, bowing greeting, curiosity and dancing. Eleven exported motions, plus a runtime lobby sequence. Existing physics controls movement; animation never changes the collision proxy.

Cosmetics are original procedural meshes. Four base materials and square face UV projections; patterned shell uses a 256x256 RGBA texture. Full outfits replace the visible shell with an enclosing front/back/side shell and a face opening; space/diving/robot outfits add a transparent visor. Hats attach to Body and inherit skeletal motion.
