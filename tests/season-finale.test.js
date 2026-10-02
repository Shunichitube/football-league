import test from 'node:test';
import assert from 'node:assert/strict';
import {finaleKind,finaleFrame,podiumPositions,conveyorMatches,conveyorFrame,conveyorCast,conveyorBlocking,CONVEYOR_LAYOUT} from '../js/season-finale.js';

test('central and foreground reserve follow the actual FW, MF1 and MF2 lineup',()=>{
 const roster=['GK','DF','MF','MF','FW'].map((primaryPosition,id)=>({id,primaryPosition}));
 assert.deepEqual(conveyorCast({roster,lineup:[0,1,3,2,4]}).map(p=>p.id),[4,3,2]);
 const matches=['loss','loss','loss','win'].map(outcome=>({outcome}));
 const first=conveyorBlocking(matches,0);
 assert.equal(first.central.motion,'idle');assert.equal(first.reserve.motion,'idle');
 assert.ok(first.reserve.y>first.central.y);assert.equal(first.central.role,0);
 const stolen=conveyorBlocking(matches,.95);
 assert.equal(stolen.departed.motion,'idle');assert.ok(stolen.departed.x<480);
 assert.equal(stolen.central.role,1);assert.equal(stolen.central.motion,'idle');
 const kick=conveyorBlocking(matches,1.08);assert.equal(kick.rival.motion,'shoot');
 const pickup=conveyorBlocking(matches,1.65);
 assert.equal(pickup.central.role,1);assert.equal(pickup.central.motion,'dribble');
 assert.equal(pickup.replacement.role,2);assert.equal(pickup.replacement.motion,'run');
 const next=conveyorBlocking(matches,2.4);
 assert.equal(next.central.role,1);assert.equal(next.reserve.role,2);
 assert.equal(next.waiting[0].role,0);assert.ok(next.waiting[0].x<stolen.departed.x);
 assert.deepEqual([0,2.4,4.8,7.2].map(t=>conveyorBlocking(matches,t+.01).central.role%3),[0,1,2,0]);
 const win=conveyorBlocking([{outcome:'win'}],.9);
 assert.ok(win.central.y<first.central.y);assert.equal(win.central.motion,'dribble');
 assert.equal(conveyorBlocking([{outcome:'win'}],.2).central.motion,'idle');
});

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

test('reserve waits in the left foreground and replacements run in from the left',()=>{
 const matches=[{outcome:'loss'},{outcome:'win'}],L=CONVEYOR_LAYOUT;
 const first=conveyorBlocking(matches,0);
 assert.equal(first.reserve.x,79);assert.equal(first.reserve.y,505);
 assert.equal(first.reserve.motion,'idle');
 const entering=conveyorBlocking(matches,1.5);
 assert.ok(entering.replacement.x<0);assert.equal(entering.replacement.direction,'right');
 const moving=conveyorBlocking(matches,1.8);
 assert.ok(moving.replacement.x>entering.replacement.x);
 assert.ok(moving.replacement.x<L.reserveX);
 assert.ok(moving.central.x>L.reserveX);assert.equal(moving.central.direction,'right');
 const arrived=conveyorBlocking(matches,2.25);
 assert.equal(arrived.replacement.x,L.reserveX);assert.equal(arrived.replacement.motion,'idle');
 const next=conveyorBlocking(matches,2.4);
 assert.equal(next.reserve.x,arrived.replacement.x);assert.equal(next.reserve.role,arrived.replacement.role);
});
