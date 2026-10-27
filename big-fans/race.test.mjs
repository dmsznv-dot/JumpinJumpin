import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCourseState} from './course.mjs';
import {initializeRacer, updateRace} from './race.mjs';
function racer(x=0,z=0) { return {x,z,y:0,vx:0,vz:0,vy:0,radius:.8,isPlayer:true,onGround:true}; }
test('falling respawns at latest checkpoint', () => {
  const a=racer(); initializeRacer(a); a.checkpoint=2; a.y=-11;
  updateRace(createCourseState(),[a],.016,10);
  assert.equal(a.z,76); assert.equal(a.y,0); assert.equal(a.checkpoint,2);
});
test('finish requires checkpoint and ends after quota', () => {
  const a=racer(0,154); initializeRacer(a);
  let result=updateRace(createCourseState(),[a],.01,5);
  assert.equal(result.done,false);
  a.checkpoint=3; result=updateRace(createCourseState(),[a],.01,6);
  assert.equal(result.done,true); assert.equal(a.raceFinishTime,6);
});
test('timeout closes race even if no one finishes', () => {
  const a=racer(); initializeRacer(a);
  assert.equal(updateRace(createCourseState(),[a],.01,210).done,true);
});
