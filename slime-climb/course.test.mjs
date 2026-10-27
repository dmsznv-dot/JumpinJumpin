import {test} from 'node:test';import assert from 'node:assert/strict';import {courseY,slimeY,surface,LENGTH,LIMIT,obstaclesAt,botDecision,createCourse,advanceCourse,obstacleContact} from './course.mjs';
test('slime rises through the finish by the time limit',()=>{assert.ok(slimeY(0)<0);assert.ok(Math.abs(slimeY(LIMIT)-courseY(LENGTH))<1e-9)});
test('surface contains gaps and narrow beams',()=>{assert.equal(surface(0,66),null);assert.equal(surface(0,101),null);assert.notEqual(surface(2.1,101),null);assert.notEqual(surface(0,110),null);assert.equal(surface(8,110),null)});
test('obstacles move and bot targets the path',()=>{let a=obstaclesAt(0),b=obstaclesAt(1);assert.notEqual(a[4].x,b[4].x);assert.ok(botDecision(createCourse(),{id:'bot_0',x:0,z:0,onGround:true}).vz>0)});
test('bot can navigate the beam merge within the time limit',()=>{
 const c=createCourse(),a={id:'bot_0',x:2.1,z:98,y:courseY(98),vx:0,vz:0,vy:0,onGround:true};
 for(let i=0;i<1200&&a.z<116;i++){let dt=1/60;advanceCourse(c,dt);let d=botDecision(c,a);a.vx+=(d.vx-a.vx)*dt*7;a.vz+=(d.vz-a.vz)*dt*7;let old=a.y;a.x+=a.vx*dt;a.z+=a.vz*dt;a.vy-=30*dt;a.y+=a.vy*dt;const y=surface(a.x,a.z);a.onGround=false;if(y!==null&&a.vy<=0&&old>=y-.8&&a.y<=y+.12){a.y=y;a.vy=0;a.onGround=true;}if(a.y<courseY(98)-8)break;}
 assert.ok(a.z>=116,`bot fell at z=${a.z.toFixed(1)}, x=${a.x.toFixed(1)}`);
});
test('elite bot can finish a complete race under the rising slime',()=>{
 const c=createCourse(),a={id:'bot_0',x:0,z:-4,y:0,vx:0,vz:0,vy:0,kx:0,kz:0,onGround:true,cool:0};let done=false;
 for(let t=0;t<LIMIT;t+=1/60){const dt=1/60;advanceCourse(c,dt);a.cool=Math.max(0,a.cool-dt);const d=botDecision(c,a);a.vx+=(d.vx-a.vx)*dt*7;a.vz+=(d.vz-a.vz)*dt*7;if(d.jump&&a.onGround){a.vy=12.4;a.onGround=false;}const old=a.y;a.x+=(a.vx+a.kx)*dt;a.z+=(a.vz+a.kz)*dt;if(a.onGround&&a.z>=77&&a.z<97)a.z-=2.3*dt;a.kx*=1-dt*4;a.kz*=1-dt*4;a.vy-=30*dt;a.y+=a.vy*dt;const y=surface(a.x,a.z);a.onGround=false;if(y!==null&&a.vy<=0&&old>=y-.8&&a.y<=y+.12){a.y=y;a.vy=0;a.onGround=true;}
 if(a.cool<=0)for(const o of obstaclesAt(t)){if(Math.abs(a.y-courseY(o.z))>2)continue;const {dx,dz}=obstacleContact(o,a.x,a.z),dist=Math.hypot(dx,dz),r=o.radius+.44;if(dist<r&&dist>.001){const nx=dx/dist,nz=dz/dist;a.x+=nx*(r-dist);a.z+=nz*(r-dist);a.kx=nx*(o.type==='hammer'?8:5);a.kz=nz*(o.type==='ball'?8:5);a.vy=3.2;a.onGround=false;a.cool=.5;break;}}
 if(a.z>=LENGTH&&Math.abs(a.x)<7&&a.y>=courseY(LENGTH)-1){done=true;break;}if(a.y<=slimeY(t))break;
 }
 assert.ok(done,`bot failed at z=${a.z.toFixed(1)}`);
});
