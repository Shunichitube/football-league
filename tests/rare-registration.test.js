import test from 'node:test';
import assert from 'node:assert/strict';
import {rareFramePlacement,drawRarePortrait,rareMotionFrame} from '../js/rare-avatar.js';

test('approved Kong and robot four-frame movement loops identically for running and dribbling',()=>{
 for(const kind of ['king_kong','robot'])for(const motion of ['run','dribble']){
  assert.deepEqual([0,1,2,3,4,5,6,7].map(i=>rareMotionFrame(kind,motion,(i+.01)/8)),[2,3,4,5,2,3,4,5]);
  assert.equal(rareMotionFrame(kind,motion,10,false),5);
 }
 assert.equal(rareMotionFrame('king_kong','shoot',0),6);
 assert.equal(rareMotionFrame('king_kong','idle',0),0);
});

test('rare animations fit square, portrait and landscape canvases without stretching or clipping',()=>{
 for(const [width,height] of [[480,480],[300,470],[420,550],[160,90],[90,160]]){
  for(const bounds of [{left:10,top:170,right:290,bottom:450},{left:5,top:30,right:270,bottom:465}]){
   const p=rareFramePlacement(bounds,300,470,width,height),scale=p.width/300;
   assert.ok(Math.abs(scale-p.height/470)<1e-12);
   assert.ok(p.x+bounds.left*scale>=width*.05-1e-9);
   assert.ok(p.x+bounds.right*scale<=width*.95+1e-9);
   assert.ok(p.y+bounds.top*scale>=height*.05-1e-9);
   assert.ok(Math.abs(p.y+bounds.bottom*scale-height*.95)<1e-9);
  }
 }
});

test('portrait preserves its aspect ratio when the destination is square',()=>{
 const source={width:300,height:470},calls=[];
 const ctx={canvas:{width:200,height:200},clearRect(){},drawImage(...args){calls.push(args);}};
 assert.equal(drawRarePortrait(ctx,{robot:{portrait:source}},{rareCharacter:'robot'}),true);
 const [,x,y,width,height]=calls[0];
 assert.equal(height,200);assert.equal(y,0);assert.ok(x>0);
 assert.ok(Math.abs(width/height-300/470)<1e-12);
});
