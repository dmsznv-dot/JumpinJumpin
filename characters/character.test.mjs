import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {createSketchCharacter,createCharacterClips,POSES} from './sketch-character.mjs';
const THREE=await import('data:text/javascript;base64,'+Buffer.from(await fs.readFile(new URL('../vendor/three.module.min.js',import.meta.url))).toString('base64'));
test('model has a bound skeleton with valid weights and finger bones',()=>{
 const rig=createSketchCharacter(THREE);assert.ok(rig.skeleton.bones.length>=20);assert.ok(rig.bones.LeftFingers);assert.ok(rig.bones.RightShin);
 for(const m of rig.meshes){assert.ok(m.isSkinnedMesh);assert.equal(m.skeleton,rig.skeleton);const weights=m.geometry.attributes.skinWeight,indices=m.geometry.attributes.skinIndex;for(let i=0;i<weights.count;i++){assert.equal(weights.getX(i),1);assert.ok(indices.getX(i)<rig.skeleton.bones.length);}}
 rig.dispose();
});
test('all motion clips are finite and actually move the rig',()=>{
 const rig=createSketchCharacter(THREE),clips=createCharacterClips(THREE,rig);assert.deepEqual(clips.map(c=>c.name),POSES);
 for(const c of clips){assert.ok(c.validate());assert.ok(c.tracks.some(t=>new Set(t.values).size>4));for(const t of c.tracks)for(const value of t.values)assert.ok(Number.isFinite(value));}
 const start=rig.bones.LeftLeg.rotation.x;rig.animate(.2,{pose:'run',speed:7});assert.notEqual(rig.bones.LeftLeg.rotation.x,start);rig.dispose();
});
