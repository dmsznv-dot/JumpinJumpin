import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCourseState, COURSE} from './course.mjs';
import {initializeRacer, updateRace} from './race.mjs';
function racer(x=0,z=0) { return {x,z,y:0,vx:0,vz:0,vy:0,radius:.8,isPlayer:true,onGround:true}; }
test('falling respawns at latest checkpoint', () => {
  const a=racer(); initializeRacer(a); a.checkpoint=2; a.y=-11;
  updateRace(createCourseState(),[a],.016,10);
  assert.equal(a.z,COURSE.checkpoints[1].z); assert.equal(a.y,0); assert.equal(a.checkpoint,2);
});
test('finish requires checkpoint and ends after quota', () => {
  const a=racer(0,COURSE.finish.z); initializeRacer(a);
  let result=updateRace(createCourseState(),[a],.01,5);
  assert.equal(result.done,false);
  a.checkpoint=3; result=updateRace(createCourseState(),[a],.01,6);
  assert.equal(result.done,true); assert.equal(a.raceFinishTime,6);
});
test('timeout closes race even if no one finishes', () => {
  const a=racer(); initializeRacer(a);
  assert.equal(updateRace(createCourseState(),[a],.01,210).done,true);
});
test('bots complete the course at common simulation frame rates', () => {
  for (const dt of [1/30, 1/60, 1/120]) {
    const course=createCourseState();
    const actors=Array.from({length:16},(_,i)=>({id:`bot_${i}`, x:((i%5)-2)*2.2,z:-3+Math.floor(i/5)*2,y:0,vx:0,vy:0,vz:0,radius:.8,isPlayer:false,onGround:true}));
    actors.forEach(initializeRacer);
    for (let elapsed=0; elapsed<210; elapsed+=dt) updateRace(course,actors,dt,elapsed);
    assert.ok(actors.filter(a=>a.raceFinished).length >= 14, `too few bots finished at dt=${dt}`);
  }
});
test('racers get a small separating impulse on contact', () => {
  const a=racer(-.3,0), b=racer(.3,0); initializeRacer(a); initializeRacer(b);
  a.vx=2; b.vx=-2;
  updateRace(createCourseState(),[a,b],.01,1);
  assert.ok(a.knockVx < 0 && b.knockVx > 0);
  assert.ok(Math.abs(a.knockVx) <= 3.2 && Math.abs(b.knockVx) <= 3.2);
  assert.ok(b.x-a.x >= (a.radius+b.radius)*.85-1e-8);
});
test('finished racers and racers at different heights do not collide', () => {
  const a=racer(0,0), b=racer(.1,0); initializeRacer(a); initializeRacer(b);
  b.raceFinished=true; updateRace(createCourseState(),[a,b],.01,1);
  assert.equal(a.knockVx,0);
  b.raceFinished=false; b.y=3; updateRace(createCourseState(),[a,b],.01,2);
  assert.equal(a.knockVx,0);
});
