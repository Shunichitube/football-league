import test from 'node:test';
import assert from 'node:assert/strict';
import {homeExhibitionFrame} from '../js/season-three/home-exhibition.js';

test('players stop exactly at the end of each move and immediately idle',()=>{
 for(const stop of [8,16,24,34,42,50]){
  const a=homeExhibitionFrame(stop),b=homeExhibitionFrame(stop+.1);
  a.actors.forEach((p,i)=>{assert.equal(p.x,b.actors[i].x);assert.equal(p.z,b.actors[i].z);assert.equal(p.vx,0);assert.equal(p.vz,0);assert.equal(p.motion,'idle');});
 }
});
test('movement is slow and uniform in both directions; keepers stay before the goals',()=>{
 for(const time of [3,14,21,29,40,47]){
  const a=homeExhibitionFrame(time),b=homeExhibitionFrame(time+.1);
  assert.equal(a.actors.length,10);
  a.actors.forEach((p,i)=>{
   assert.ok(Math.abs((b.actors[i].x-p.x)/.1-p.vx)<1e-10);
   assert.ok(Math.hypot(p.vx,p.vz)*.6<1.21);
   if(i%5===0){assert.equal(p.x,i===0?-18.5:18.5);assert.equal(p.z,0);}
  });
 }
});
test('possession changes and loop boundaries do not teleport players',()=>{
 for(const time of [26,52]){
  const before=homeExhibitionFrame(time-1e-5),after=homeExhibitionFrame(time);
  before.actors.forEach((p,i)=>assert.deepEqual([p.x,p.z],[after.actors[i].x,after.actors[i].z]));
 }
});
