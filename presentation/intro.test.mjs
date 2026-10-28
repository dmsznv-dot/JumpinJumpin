import {test} from 'node:test';import assert from 'node:assert/strict';import {introFrame} from './intro.mjs';
test('all level flyovers end at the player camera and stay finite',()=>{
 const p={x:3,y:7,z:-2},yaw=Math.PI/2;
 for(const kind of ['big-fans','roll-out','jump-showdown','hex']){
  for(let t=0;t<=1;t+=.05){const f=introFrame(kind,t,p,yaw,14,8,34);for(const v of [...Object.values(f.position),...Object.values(f.look)])assert.ok(Number.isFinite(v));}
  const f=introFrame(kind,1,p,yaw,14,8,34);assert.ok(Math.abs(f.position.x-17)<1e-8);assert.ok(Math.abs(f.look.z+2)<1e-8);
 }
});
test('Big Fans flyover begins at finish before returning to start',()=>{
 const p={x:0,y:0,z:0};const start=introFrame('big-fans',0,p,Math.PI,14,8);const middle=introFrame('big-fans',.5,p,Math.PI,14,8);assert.ok(start.look.z>middle.look.z);
});
