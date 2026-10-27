import {test} from 'node:test';import assert from 'node:assert/strict';import {courseY,slimeY,surface,LENGTH,LIMIT,obstaclesAt,botDecision,createCourse} from './course.mjs';
test('slime rises through the finish by the time limit',()=>{assert.ok(slimeY(0)<0);assert.ok(Math.abs(slimeY(LIMIT)-courseY(LENGTH))<1e-9)});
test('surface contains gaps and narrow beams',()=>{assert.equal(surface(0,66),null);assert.equal(surface(0,101),null);assert.notEqual(surface(2.1,101),null);assert.notEqual(surface(0,110),null);assert.equal(surface(8,110),null)});
test('obstacles move and bot targets the path',()=>{let a=obstaclesAt(0),b=obstaclesAt(1);assert.notEqual(a[4].x,b[4].x);assert.ok(botDecision(createCourse(),{id:'bot_0',x:0,z:0,onGround:true}).vz>0)});
