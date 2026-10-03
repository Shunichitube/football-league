import test from 'node:test';
import assert from 'node:assert/strict';
import {seasonReelMatches,seasonReelFrame,startingFive} from '../js/season-reel.js';
import {finaleFrame} from '../js/season-finale.js';

test('catch ranks reveal a caught-ball scene after whiteout; parry ranks stay white',()=>{
 for(const rank of [4,5,6]){
  assert.equal(finaleFrame(rank,4.5).white,1);assert.equal(finaleFrame(rank,4.5).ready,false);
  assert.deepEqual(finaleFrame(rank,5.2),{scene:'catch',white:0,ready:true});
 }
 for(const rank of [2,3])assert.deepEqual(finaleFrame(rank,5.2),{scene:'white',white:1,ready:true});
});
test('results are withheld until the breakthrough, steal or stalemate has played',()=>{
 for(const outcome of ['win','loss','draw'])for(const type of ['dribble','pass']){
  const matches=[{outcome,type}];
  assert.equal(seasonReelFrame(matches,2.5).resultReady,false);
  assert.equal(seasonReelFrame(matches,outcome==='loss'?4:6).resultReady,true);
 }
});

test('actual results choose six patterns, reset streaks and remain immutable',()=>{
 const outcomes=['win','win','draw','win','loss','loss','draw','win','win','win'];
 const source=outcomes.map((outcome,i)=>({outcome,round:i+1,goals:outcome==='win'?2:0,against:outcome==='draw'?0:1,opponent:{id:2,name:'Opponent'}}));
 const before=JSON.stringify(source),matches=seasonReelMatches(source);
 assert.equal(JSON.stringify(source),before);
 assert.deepEqual(matches.map(m=>m.streak),[1,2,0,1,0,0,0,1,2,3]);
 assert.deepEqual(matches.filter(m=>m.outcome==='loss').map(m=>m.type),['dribble','pass']);
 assert.deepEqual(matches.filter(m=>m.outcome==='draw').map(m=>m.type),['dribble','pass']);
 let time=0;for(const [index,m] of matches.entries()){const f=seasonReelFrame(matches,time+.01);assert.equal(f.index,index);assert.equal(f.match.round,m.round);assert.equal(f.match.opponent.name,'Opponent');time+=m.outcome==='loss'?5:7;}
 assert.deepEqual(seasonReelFrame(matches,time),{done:true,duration:66});
 assert.deepEqual(seasonReelFrame([],0),{done:true,duration:0});
});
test('all five roles use the chosen starters, including reversed midfield slots',()=>{
 const roster=['GK','DF','MF','MF','FW','MF'].map((primaryPosition,id)=>({id,primaryPosition}));
 assert.deepEqual(startingFive({roster,lineup:[0,1,3,2,4]}).map(p=>p.id),[0,1,3,2,4]);
 assert.deepEqual(startingFive({roster,lineup:[0,1,2,2,4]}).map(p=>p.id),[0,1,2,3,4]);
 assert.deepEqual(startingFive(null),[undefined,undefined,undefined,undefined,undefined]);
});
test('beaten defenders pause then chase continuously in both win patterns',()=>{
 for(const type of ['dribble','pass']){
  const matches=[{outcome:'win',type}];
  const react=type==='dribble'?4.1:4.2;
  const wait=seasonReelFrame(matches,react-.01),start=seasonReelFrame(matches,react),chase=seasonReelFrame(matches,react+.7);
  assert.equal(wait.rival.motion,'idle');assert.equal(chase.rival.motion,'run');assert.equal(chase.rival.heading,1);
  assert.ok(Math.abs(start.rival.x-wait.rival.x)<.01);assert.ok(chase.rival.x>start.rival.x);
 }
});
