import {test} from 'node:test';import assert from 'node:assert/strict';
import {createRollout,advanceRollout,sampleSurface,carryRacer,hitWall,RADIUS,RING_WIDTH} from './rollout.mjs';
test('five neighbours rotate in opposite directions',()=>{const c=createRollout();advanceRollout(c,1);assert.ok(c.rings[0].angle>0);assert.ok(c.rings[1].angle<.03);assert.equal(c.rings.length,5)});
test('surface matches drum curvature and rejects outside boundaries and holes',()=>{const c=createRollout();c.rings.forEach(r=>r.angle=0);assert.equal(sampleSurface(c,0,0).y,0);assert.equal(sampleSurface(c,100,0),null);assert.equal(sampleSurface(c,0,RADIUS),null);const r=c.rings[2];r.angle=-r.gap*Math.PI*2/16-.01;assert.equal(sampleSurface(c,0,0),null)});
test('standing actor is carried with the drum',()=>{const c=createRollout();const a={x:-2*RING_WIDTH,z:0,y:0,onGround:true};carryRacer(c,a,.1);assert.ok(a.z>0);assert.ok(a.y<0)});
test('a racer cannot tunnel through a wall between frames',()=>{const a={z:2,y:0,vz:8};const s={y:0,wallAngle:0};assert.equal(hitWall(s,a,-2),true);assert.ok(a.z<0)});

test('rotation speeds up progressively and spawn positions are solid',()=>{
 const c=createRollout(); for(let i=0;i<24;i++){const x=(((i+2)%5)-2)*RING_WIDTH;const z=(Math.floor(i/5)-1.5)*2.2;assert.ok(sampleSurface(c,x,z),`spawn ${i} over gap`);}
 const initial=c.rings[0].angle;advanceRollout(c,1);const slow=c.rings[0].angle-initial;c.time=89;const before=c.rings[0].angle;advanceRollout(c,1);assert.ok(c.rings[0].angle-before>slow*2);
});
test('bots compensate roller movement and do not hop needlessly', async()=>{
 const {botDecision}=await import('./rollout.mjs');const c=createRollout();
 const a={id:'bot_0',x:0,z:0,y:0,vx:0,vz:0,vy:0,onGround:true};
 assert.equal(botDecision(c,a).jump,false);
 for(let t=0;t<4;t+=1/60){advanceRollout(c,1/60);const d=botDecision(c,a);a.vx+=(d.vx-a.vx)*.12;a.vz+=(d.vz-a.vz)*.12;if(d.jump&&a.onGround){a.vy=12.4;a.onGround=false;}
  carryRacer(c,a,1/60);const oldY=a.y,oldZ=a.z;a.x+=a.vx/60;a.z+=a.vz/60;a.vy-=.5;a.y+=a.vy/60;const s=sampleSurface(c,a.x,a.z);a.onGround=false;
  if(s&&a.vy<=0&&oldY>=s.y-.65&&a.y<=s.y+.08){a.y=s.y;a.vy=0;a.onGround=true;}hitWall(s,a,oldZ);}
 assert.ok(a.y>-1&&Math.abs(a.z)<3,`bot drifted off the top: z=${a.z.toFixed(2)} y=${a.y.toFixed(2)}`);
});
test('a field of bots survives the opening of the round', async()=>{
 const {botDecision}=await import('./rollout.mjs');const c=createRollout();
 const bots=Array.from({length:10},(_,i)=>({id:'bot_'+i,x:(((i+2)%5)-2)*RING_WIDTH,z:(Math.floor(i/5)-1)*2,y:0,vx:0,vz:0,vy:0,onGround:true}));
 bots.forEach(a=>a.y=sampleSurface(c,a.x,a.z)?.y??0);
 for(let t=0;t<30;t+=1/30){advanceRollout(c,1/30);for(const a of bots){if(a.y<-10)continue;const d=botDecision(c,a);a.vx+=(d.vx-a.vx)*.21;a.vz+=(d.vz-a.vz)*.21;if(d.jump&&a.onGround){a.vy=12.4;a.onGround=false;}
  carryRacer(c,a,1/30);const oldY=a.y,oldZ=a.z;a.x+=a.vx/30;a.z+=a.vz/30;a.vy-=1;a.y+=a.vy/30;const s=sampleSurface(c,a.x,a.z);a.onGround=false;
  if(s&&a.vy<=0&&oldY>=s.y-.65&&a.y<=s.y+.08){a.y=s.y;a.vy=0;a.onGround=true;}hitWall(s,a,oldZ);}}
 assert.ok(bots.filter(a=>a.y>-10).length>=8);
});
