import test from 'node:test';
import assert from 'node:assert/strict';
import {MOTIONS,motionFrame,drawMotion} from '../js/player-motion.js';
test('motion cycles visit every frame and wrap to the first frame',()=>{
 for(const [name,motion] of Object.entries(MOTIONS)){
  assert.deepEqual(motion.frames.map((_,i)=>motionFrame(name,(i+.01)/motion.fps)),motion.frames);
  assert.equal(motionFrame(name,motion.frames.length/motion.fps),motion.frames[0]);
 }
});
test('running draws one complete frame from each cell of the new sheet',()=>{
 const base={width:1774,height:887},run={width:1254,height:1254};
 const calls=[];const ctx={canvas:{width:480,height:480},clearRect(){},save(){},restore(){},translate(){},scale(){},drawImage(...v){calls.push(v);}};
 for(let i=0;i<4;i++)drawMotion(ctx,{base,run},'run',(i+.01)/8);
 assert.equal(calls.length,4);
 calls.forEach((c,i)=>{assert.equal(c[0],run);assert.deepEqual(c.slice(1,5),[(i%2)*627,Math.floor(i/2)*627,627,627]);});
 calls.length=0;drawMotion(ctx,{base,run},'idle',0);assert.equal(calls[0][0],base);
 calls.length=0;drawMotion(ctx,{base,run},'dribble',0);assert.equal(calls[0][0],base);
});
test('left-facing animation mirrors the whole frame',()=>{
 const transforms=[];const ctx={canvas:{width:480,height:480},clearRect(){},save(){},restore(){},translate(...v){transforms.push(v);},scale(...v){transforms.push(v);},drawImage(){}};
 drawMotion(ctx,{base:{width:1774,height:887},run:{width:1254,height:1254}},'run',0,{direction:'left'});
 assert.deepEqual(transforms,[[480,0],[-1,1]]);
});
