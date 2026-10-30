import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {createCubeCharacter,createCharacterClips} from './cube-character.mjs';
const THREE=await import('data:text/javascript;base64,'+Buffer.from(await fs.readFile(new URL('../vendor/three.module.min.js',import.meta.url))).toString('base64'));
test('cube has ten bound bones, solid geometry and independent colors',()=>{const r=createCubeCharacter(THREE);assert.equal(r.skeleton.bones.length,10);assert.equal(r.meshes.length,4);for(const m of r.meshes){assert.ok(m.isSkinnedMesh);for(const v of m.geometry.attributes.position.array)assert.ok(Number.isFinite(v));}const face=r.materials.skin.color.getHex();r.setColors({shell:'#60cce5'});assert.equal(r.materials.shell.color.getHex(),0x60cce5);assert.equal(r.materials.skin.color.getHex(),face);r.dispose();});
test('all eleven exported motions validate and animated feet stay finite',()=>{const r=createCubeCharacter(THREE);const clips=createCharacterClips(THREE,r);assert.equal(clips.length,11);for(const c of clips){assert.ok(c.validate());for(const t of c.tracks)for(const v of t.values)assert.ok(Number.isFinite(v));}r.animate(.2,{pose:'run',speed:7});assert.notEqual(r.bones.LeftLeg.rotation.x,0);r.dispose();});

import {CUBE_COSMETICS,patternPixels} from './cube-wardrobe.mjs';
test('every accessory fits a cube rig, full costumes replace the whole original shell',()=>{
 assert.ok(CUBE_COSMETICS.filter(c=>!c.full&&c.hat!=='none').length>10);
 for(const c of CUBE_COSMETICS){const r=createCubeCharacter(THREE,{skin:{hat:c.hat,c1:0xffdb20,c2:0xf53867,pattern:'polka'}});assert.equal(r.accessory.parent,r.bones.Body);if(c.full)assert.equal(r.meshes.find(m=>m.name==='Character_shell').visible,false);r.accessory.traverse(o=>{if(o.geometry)for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));});r.dispose();}
});
test('square patterns are distinct, two-colour and opaque',()=>{const fingerprints=new Set();for(const p of ['plain','belly','stripes','polka','flames','stars','lightning','rings','diamonds']){const data=patternPixels(0xffdb20,0xf53867,p,32);assert.equal(data.length,4096);for(let i=3;i<data.length;i+=4)assert.equal(data[i],255);fingerprints.add(Buffer.from(data).toString('base64'));}assert.equal(fingerprints.size,9);});
