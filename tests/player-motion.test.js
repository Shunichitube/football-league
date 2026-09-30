import test from 'node:test';
import assert from 'node:assert/strict';
import {MOTIONS,motionFrame,drawMotion} from '../js/player-motion.js';
test('motion cycles visit every frame and wrap to the first frame',()=>{
 for(const [name,motion] of Object.entries(MOTIONS)){
  assert.deepEqual(motion.frames.map((_,i)=>motionFrame(name,(i+.01)/motion.fps)),motion.frames);
  assert.equal(motionFrame(name,motion.frames.length/motion.fps),motion.loop===false?motion.frames.at(-1):motion.frames[0]);
  assert.equal(motionFrame(name,motion.frames.length/motion.fps,{loop:true}),motion.frames[0]);
 }
});
test('eight running frames alternate preserved key poses and new in-betweens',()=>{
 const base={width:1774,height:887},run={width:1254,height:1254},inbetweens={width:1254,height:1254},correctedSix={width:1254,height:1254};
 const calls=[];const ctx={canvas:{width:480,height:480},clearRect(){},save(){},restore(){},translate(){},scale(){},drawImage(...v){calls.push(v);}};
 for(let i=0;i<8;i++)drawMotion(ctx,{base,run,inbetweens,correctedSix},'run',(i+.01)/16);
 assert.equal(calls.length,8);
 calls.forEach((c,i)=>{assert.equal(c[0],i===5?correctedSix:i%2?inbetweens:run);const source=Math.floor(i/2);assert.deepEqual(c.slice(1,5),[(source%2)*627,Math.floor(source/2)*627,627,627]);});
 calls.length=0;drawMotion(ctx,{base,run,inbetweens,correctedSix},'idle',0);assert.equal(calls[0][0],base);
 calls.length=0;drawMotion(ctx,{base,run,inbetweens,correctedSix},'dribble',0);assert.equal(calls[0][0],run);
});
test('left-facing animation mirrors the whole frame',()=>{
 const transforms=[];const ctx={canvas:{width:480,height:480},clearRect(){},save(){},restore(){},translate(...v){transforms.push(v);},scale(...v){transforms.push(v);},drawImage(){}};
 drawMotion(ctx,{base:{width:1774,height:887},run:{width:1254,height:1254}},'run',0,{direction:'left'});
 assert.deepEqual(transforms,[[480,0],[-1,1]]);
});
test('actions stop at the final pose and right-foot shooting is never mirrored',()=>{
 const transforms=[],calls=[];
 const ctx={canvas:{width:480,height:480},clearRect(){},save(){},restore(){},translate(...v){transforms.push(v);},scale(...v){transforms.push(v);},drawImage(...v){calls.push(v);}};
 for(const motion of ['shoot','catch','dive']){
  const sheet={width:1254,height:1254};
  assert.equal(motionFrame(motion,10),3);
  assert.equal(motionFrame(motion,-1),0);
  drawMotion(ctx,{[motion]:sheet},motion,10,{direction:'left'});
  assert.deepEqual(calls.at(-1).slice(1,5),[627,627,627,627]);
  if(motion==='shoot')assert.deepEqual(transforms,[]);
 }
 assert.equal(transforms.length,4);
});
