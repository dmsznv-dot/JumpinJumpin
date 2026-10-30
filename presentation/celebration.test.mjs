import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
function harness(){let sounds=0,bursts=0,completed=0;const timers=[];const el={classList:{add(){},remove(){}}};const state={phase:'playing',player:{x:0,y:0,z:0}};const ctx={state,document:{getElementById:()=>el},sfx:{play:()=>sounds++},spawnParticles3D(){},launchScreenConfetti:()=>bursts++,setTimeout:(f)=>{timers.push(f);return timers.length;},clearTimeout(){},Math};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function showCelebrationOverlay('),source.indexOf('function triggerWinnerCelebration(')),ctx);return {ctx,state,timers,get counts(){return {sounds,bursts,completed}},show:()=>ctx.showCelebrationOverlay({onComplete:()=>{completed++;state.phase='gameover';}})};}
test('end-of-round overlay freezes gameplay and plays one burst and sound under repeated calls',()=>{const h=harness();for(let i=0;i<120;i++)h.show();assert.equal(h.state.phase,'round_result');assert.equal(h.counts.sounds,1);assert.equal(h.counts.bursts,1);assert.equal(h.timers.length,1);h.timers[0]();assert.equal(h.counts.completed,1);assert.equal(h.state.phase,'gameover');});

test('nameplates default off, migrate old implicit true and preserve explicit opt-in',()=>{
 const fn=source.slice(source.indexOf('function loadSaveData()'),source.indexOf('function saveGameData()'));
 for(const [saved,want]of [[null,false],[{showNameplates:true},false],[{showNameplates:true,nameplatePreferenceSet:true},true]]){
 const ctx={STORAGE_KEY:'save',localStorage:{getItem:()=>saved?JSON.stringify(saved):null}};vm.createContext(ctx);vm.runInContext(fn,ctx);assert.equal(ctx.loadSaveData().showNameplates,want);
 }
});
