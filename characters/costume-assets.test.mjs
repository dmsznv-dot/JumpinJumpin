import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {COSTUME_ASSETS} from './costume-manifest.mjs';
import {CUBE_COSMETICS} from './cube-wardrobe.mjs';

test('retired placeholders are absent and every manifest item is selectable',()=>{
 const retired=['headphones','fox','rabbit','cat','bear','panda','cow','frog','chicken','bee','owl','diver','robot','samurai','shark','dragon'];
 for(const id of retired)assert.ok(!CUBE_COSMETICS.some(c=>c.hat===id),id);
 for(const [id,c] of Object.entries(COSTUME_ASSETS)){
  assert.ok(CUBE_COSMETICS.some(item=>item.hat===id&&!item.full),id);
  assert.ok(['head','back'].includes(c.slot));
 }
});

test('wearables are self-contained, bounded GLBs with faces clear and moderate budgets',()=>{
 for(const [id,c] of Object.entries(COSTUME_ASSETS)){
  const b=fs.readFileSync(new URL('../'+c.file,import.meta.url));
  assert.equal(b.toString('utf8',0,4),'glTF');assert.equal(b.readUInt32LE(8),b.length);
  const gltf=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
  assert.ok(!gltf.images?.length,`${id}: no runtime texture dependencies`);
  assert.ok(gltf.buffers.every(b=>!b.uri));assert.ok(b.length<100_000,id);
  let tris=0;
  for(const mesh of gltf.meshes)for(const p of mesh.primitives){
   const a=gltf.accessors[p.attributes.POSITION];assert.ok(a.min.every(Number.isFinite)&&a.max.every(Number.isFinite));
   if(c.slot==='head')assert.ok(a.min[1]>.6,`${id}: clear of the eyes`);
   if(c.slot==='back')assert.ok(a.max[2]<-.67,`${id}: behind the body`);
   assert.ok(a.max[0]-a.min[0]<2&&a.max[1]-a.min[1]<2,id);
   tris+=(p.indices!==undefined?gltf.accessors[p.indices].count:a.count)/3;
  }
  assert.equal(tris,c.tris,id);assert.ok(tris<=4500,`${id}: polygon budget`);
 }
});
