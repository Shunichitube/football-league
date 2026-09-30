import test from 'node:test';
import assert from 'node:assert/strict';
import {MOTIONS,motionFrame,drawMotion,limbPose} from '../js/player-motion.js';
test('motion cycles visit every frame and wrap to the first frame',()=>{
 for(const [name,motion] of Object.entries(MOTIONS)){
  assert.deepEqual(motion.frames.map((_,i)=>motionFrame(name,(i+.01)/motion.fps)),motion.frames);
  assert.equal(motionFrame(name,motion.frames.length/motion.fps),motion.frames[0]);
 }
});
test('left-facing rig mirrors every part in the same coordinate space',()=>{
 const calls=[];const ctx={canvas:{width:480,height:480},clearRect(){},save(){},restore(){},rotate(){},translate(...v){calls.push(['translate',...v]);},scale(...v){calls.push(['scale',...v]);},drawImage(...v){calls.push(['drawImage',...v]);}};
 drawMotion(ctx,{width:1600,height:800},'run',0,{direction:'left'});
 assert.deepEqual(calls[0],['translate',240,240]);assert.ok(calls[1][1]<0);assert.ok(calls[1][2]>0);
 assert.equal(calls.filter(c=>c[0]==='drawImage').length,6);
});
test('feet swap lead at half-cycle and arms oppose the matching leg',()=>{
 for(const motion of ['run','dribble']){
  const frequency=motion==='run'?2:1.5;
  const first=limbPose(motion,.25/frequency),second=limbPose(motion,.75/frequency);
  assert.ok(first.nearLeg<0&&first.farLeg>0);
  assert.ok(second.nearLeg>0&&second.farLeg<0);
  assert.ok(first.nearArm>0&&first.farArm<0);
  assert.ok(second.nearArm<0&&second.farArm>0);
 }
});
