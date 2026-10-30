import test from 'node:test';
import assert from 'node:assert/strict';
import {deadzone,sampleGamepad,createGamepadReader} from './gamepad.mjs';
const pad=(axes=[],pressed=[],index=0)=>({connected:true,index,id:'test',mapping:'standard',axes,buttons:Array.from({length:16},(_,i)=>({pressed:pressed.includes(i)}))});
test('deadzone suppresses drift and preserves analog range',()=>{assert.equal(deadzone(.1),0);assert.equal(deadzone(-1),-1);assert.equal(deadzone(NaN),0);assert.ok(deadzone(.6)>0&&deadzone(.6)<1);});
test('dpad works and diagonal movement is normalized',()=>{const s=sampleGamepad(pad([1,1],[12,15]));assert.ok(Math.abs(Math.hypot(s.x,s.y)-1)<1e-9);assert.ok(s.x>0&&s.y<0);});
test('held buttons fire once; disconnect clears movement; reconnect works',()=>{const read=createGamepadReader();assert.equal(read([pad([], [0])]).pressed[0],true);assert.equal(read([pad([], [0])]).pressed[0],false);assert.equal(read([]),null);assert.equal(read([pad([], [0],2)]).pressed[0],true);});
