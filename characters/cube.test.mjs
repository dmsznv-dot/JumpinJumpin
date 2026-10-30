import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {createCubeCharacter,createCharacterClips} from './cube-character.mjs';
const THREE=await import('data:text/javascript;base64,'+Buffer.from(await fs.readFile(new URL('../vendor/three.module.min.js',import.meta.url))).toString('base64'));
test('cube has ten bound bones, solid geometry and independent colors',()=>{const r=createCubeCharacter(THREE);assert.equal(r.skeleton.bones.length,10);assert.equal(r.meshes.length,4);for(const m of r.meshes){assert.ok(m.isSkinnedMesh);for(const v of m.geometry.attributes.position.array)assert.ok(Number.isFinite(v));}const face=r.materials.skin.color.getHex();r.setColors({shell:'#60cce5'});assert.equal(r.materials.shell.color.getHex(),0x60cce5);assert.equal(r.materials.skin.color.getHex(),face);r.dispose();});
test('all eleven exported motions validate and animated feet stay finite',()=>{const r=createCubeCharacter(THREE);const clips=createCharacterClips(THREE,r);assert.equal(clips.length,11);for(const c of clips){assert.ok(c.validate());for(const t of c.tracks)for(const v of t.values)assert.ok(Number.isFinite(v));}r.animate(.2,{pose:'run',speed:7});assert.notEqual(r.bones.LeftLeg.rotation.x,0);r.dispose();});

import {CUBE_COSMETICS} from './cube-wardrobe.mjs';
test('every accessory fits a cube rig, full costumes replace the whole original shell',()=>{
 assert.ok(CUBE_COSMETICS.filter(c=>!c.full&&c.hat!=='none').length>10);
 for(const c of CUBE_COSMETICS){const r=createCubeCharacter(THREE,{skin:{hat:c.hat,c1:0xffdb20,c2:0xf53867,pattern:'polka'}});assert.equal(r.accessory.parent,r.bones.Body);if(c.full)assert.equal(r.meshes.find(m=>m.name==='Character_shell').visible,false);r.accessory.traverse(o=>{if(o.geometry)for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));});r.dispose();}
});
import {cubeShellGeometry,cubeFaceGeometry} from './cube-shape.mjs';
test('rounded shell matches card proportions and leaves a real shallow face recess',()=>{
 const g=cubeShellGeometry(THREE);g.computeBoundingBox();const size=g.boundingBox.getSize(new THREE.Vector3());assert.ok(Math.abs(size.x-1.62)<.001);assert.ok(Math.abs(size.y-1.57)<.001);assert.ok(Math.abs(size.z-1.34)<.001);
 const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial());m.updateMatrixWorld(true);
 const centerRay=new THREE.Raycaster(new THREE.Vector3(0,0,2),new THREE.Vector3(0,0,-1));const sideRay=new THREE.Raycaster(new THREE.Vector3(.70,0,2),new THREE.Vector3(0,0,-1));
 assert.ok(centerRay.intersectObject(m).every(h=>h.point.z<0));assert.ok(sideRay.intersectObject(m)[0].point.z>.5);
 const face=cubeFaceGeometry(THREE);for(const v of face.attributes.position.array)assert.ok(Number.isFinite(v));g.dispose();face.dispose();m.material.dispose();
});
