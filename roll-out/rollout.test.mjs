import {test} from 'node:test';import assert from 'node:assert/strict';
import {createRollout,advanceRollout,sampleSurface,carryRacer,hitWall,RADIUS,RING_WIDTH} from './rollout.mjs';
test('five neighbours rotate in opposite directions',()=>{const c=createRollout();advanceRollout(c,1);assert.ok(c.rings[0].angle>0);assert.ok(c.rings[1].angle<.03);assert.equal(c.rings.length,5)});
test('surface matches drum curvature and rejects outside boundaries and holes',()=>{const c=createRollout();c.rings.forEach(r=>r.angle=0);assert.equal(sampleSurface(c,0,0).y,0);assert.equal(sampleSurface(c,100,0),null);assert.equal(sampleSurface(c,0,RADIUS),null);const r=c.rings[2];r.angle=-r.gap*Math.PI*2/16-.01;assert.equal(sampleSurface(c,0,0),null)});
test('standing actor is carried with the drum',()=>{const c=createRollout();const a={x:-2*RING_WIDTH,z:0,y:0,onGround:true};carryRacer(c,a,.1);assert.ok(a.z>0);assert.ok(a.y<0)});
test('a racer cannot tunnel through a wall between frames',()=>{const a={z:2,y:0,vz:8};const s={y:0,wallAngle:0};assert.equal(hitWall(s,a,-2),true);assert.ok(a.z<0)});

test('rotation speeds up progressively and spawn positions are solid',()=>{
 const c=createRollout(); for(let i=0;i<15;i++){const x=(((i+2)%5)-2)*RING_WIDTH;const z=(Math.floor(i/5)-1)*1.25;assert.ok(sampleSurface(c,x,z),`spawn ${i} over gap`);}
 const initial=c.rings[0].angle;advanceRollout(c,1);const slow=c.rings[0].angle-initial;c.time=89;const before=c.rings[0].angle;advanceRollout(c,1);assert.ok(c.rings[0].angle-before>slow*2);
});
test('bots compensate roller movement and champion is cautious', async()=>{
 const {botDecision}=await import('./rollout.mjs');const c=createRollout();
 const a={id:'bot_0',x:0,z:0,onGround:true};const decision=botDecision(c,a);
 assert.ok(decision.vz<0);assert.equal(decision.jump,false);
});

