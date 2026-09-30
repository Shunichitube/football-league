import test from 'node:test';
import assert from 'node:assert/strict';
import {MOTIONS,motionFrame,drawMotion} from '../js/player-motion.js';
test('motion cycles visit every frame and wrap to the first frame',()=>{
 for(const [name,motion] of Object.entries(MOTIONS)){
  assert.deepEqual(motion.frames.map((_,i)=>motionFrame(name,(i+.01)/motion.fps)),motion.frames);
  assert.equal(motionFrame(name,motion.frames.length/motion.fps),motion.frames[0]);
 }
});
test('left-facing frames mirror the same atlas cell',()=>{
 const calls=[];const ctx={canvas:{width:480,height:480},clearRect(){},save(){},restore(){},translate(...v){calls.push(['translate',...v]);},scale(...v){calls.push(['scale',...v]);},drawImage(...v){calls.push(['drawImage',...v]);}};
 drawMotion(ctx,{width:1600,height:800},'run',0,{direction:'left'});
 assert.deepEqual(calls[0],['translate',480,0]);assert.deepEqual(calls[1],['scale',-1,1]);
 assert.deepEqual(calls[2].slice(2,6),[800,0,400,400]);
});
