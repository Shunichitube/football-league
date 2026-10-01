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

import {eraseOriginalHead} from '../js/avatar-motion-parts.js';
test('head removal preserves shirt, glove and raised arm inside the head bounds',()=>{
 const width=60,height=60,pixels=new Uint8ClampedArray(width*height*4);
 const put=(x,y,color)=>pixels.set([...color,255],(y*width+x)*4);
 for(let y=2;y<30;y++)for(let x=10;x<40;x++)put(x,y,[149,83,38]);
 for(let y=42;y<55;y++)for(let x=20;x<40;x++)put(x,y,[15,55,230]);
 for(let y=43;y<53;y++)for(let x=5;x<15;x++)put(x,y,[240,240,245]);
 for(let y=43;y<53;y++)for(let x=40;x<50;x++)put(x,y,[253,177,117]);
 const original=pixels.slice();eraseOriginalHead(pixels,width,height,[0,0,60,50]);
 assert.equal(pixels[(10*width+20)*4+3],0);
 for(const[x,y]of [[25,44],[10,44],[44,44],[25,54]])assert.deepEqual(pixels.slice((y*width+x)*4,(y*width+x)*4+4),original.slice((y*width+x)*4,(y*width+x)*4+4));
});
