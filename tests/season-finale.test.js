import test from 'node:test';
import assert from 'node:assert/strict';
import {finaleKind,finaleFrame,podiumPositions,conveyorMatches,conveyorFrame} from '../js/season-finale.js';

test('conveyor selects ten owned snapshots from multiplayer fixtures without modifying results',()=>{
 const snapshots=Array.from({length:10},(_,i)=>[
  {round:i+1,fixture:{homeId:1,awayId:2,home:{id:1,name:'Home'},away:{id:2,name:'Away'}},result:{score:{home:i%3,away:1}}},
  {round:i+1,fixture:{homeId:3,awayId:4},result:{score:{home:0,away:0}}}
 ]).flat();
 const before=JSON.stringify(snapshots);
 const selected=conveyorMatches([...snapshots].reverse().concat(snapshots[0]),1);
 assert.equal(selected.length,10);assert.equal(selected[0].round,1);assert.equal(selected[9].round,10);
 assert.deepEqual(selected.slice(0,3).map(m=>m.outcome),['loss','draw','win']);
 assert.deepEqual(conveyorMatches(snapshots,2).slice(0,3).map(m=>m.outcome),['win','draw','loss']);
 assert.equal(JSON.stringify(snapshots),before);
 assert.equal(conveyorFrame(selected,0).index,0);
 assert.equal(conveyorFrame(selected,2.4).index,1);
 assert.equal(conveyorFrame(selected,23.99).index,9);
 assert.deepEqual(conveyorFrame(selected,24),{done:true,duration:24});
 assert.deepEqual(conveyorFrame([],0),{done:true,duration:0});
});

test('all six ranks use the approved goal, parry and standing catch outcomes',()=>{
 assert.deepEqual([1,2,3,4,5,6].map(finaleKind),['goal','parry','parry','catch','catch','catch']);
 for(const rank of [1,2,3,4,5,6]){
  assert.equal(finaleFrame(rank,.5).scene,'shoot');
  assert.equal(finaleFrame(rank,1.8).scene,'flight');
  assert.equal(finaleFrame(rank,2.5).white,1);
  assert.equal(finaleFrame(rank,2.5).ready,false);
 }
});
test('goal reveals net impact separately and waits for the second dissolve before Next',()=>{
 assert.equal(finaleFrame(1,3.4).scene,'impact');
 assert.equal(finaleFrame(1,3.4).white,0);
 assert.equal(finaleFrame(1,4.5).white,1);
 assert.equal(finaleFrame(1,4.9).ready,false);
 assert.deepEqual(finaleFrame(1,5.1),{scene:'celebrate',white:0,ready:true});
});
test('saved and parried shots hold the white screen until the user advances',()=>{
 for(const rank of [2,3,4,5,6]){
  assert.equal(finaleFrame(rank,3.4).scene,rank<=3?'parry':'catch');
  assert.equal(finaleFrame(rank,4.2).ready,false);
  assert.deepEqual(finaleFrame(rank,5),{scene:'white',white:1,ready:true});
  assert.deepEqual(finaleFrame(rank,120),{scene:'white',white:1,ready:true});
 }
});
test('podium centers every roster size and caps the display at twelve',()=>{
 assert.deepEqual(podiumPositions(0),[]);
 for(let n=1;n<=12;n++){
  const positions=podiumPositions(n);assert.equal(positions.length,n);
  assert.equal((positions[0].x+positions.at(-1).x)/2,836);
  assert.ok(positions.every(p=>p.y===700&&p.x>150&&p.x<1522));
 }
 assert.deepEqual(podiumPositions(13),podiumPositions(12));
});
