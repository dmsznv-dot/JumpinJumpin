import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,chooseTrack} from './tracks.mjs';
test('eight themes have complete four-bar arrangements',()=>{
  assert.equal(TRACKS.length,8);
  for(const t of TRACKS){assert.equal(t.bass.length,4);assert.equal(t.chords.length,4);assert.equal(t.lead.length,4);for(const bar of t.lead)assert.equal(bar.length,8);}
  assert.equal(new Set(TRACKS.map(t=>t.name)).size,8);
});
test('selection reaches every track and never immediately repeats',()=>{
  for(let prev=0;prev<9;prev++){
    const choices=new Set();for(let n=0;n<8;n++) choices.add(chooseTrack(prev,()=> (n+.5)/8));
    assert.equal(choices.size,8);assert.ok(!choices.has(prev));
  }
});
