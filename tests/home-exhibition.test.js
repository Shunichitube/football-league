import test from 'node:test';
import assert from 'node:assert/strict';
import {homeExhibitionFrame,sampleHomePath} from '../js/season-three/home-exhibition.js';
test('a completed move stops exactly and holds its destination without inertia',()=>{
 const points=[[0,0,0],[2,3,1],[4,3,1]];
 for(const time of [2,2.1,3.9])assert.deepEqual(sampleHomePath(points,time),{x:3,z:1,vx:0,vz:0});
 const a=homeExhibitionFrame(16),b=homeExhibitionFrame(16.1);
 assert.equal(a.actors[4].motion,'idle');assert.equal(a.actors[4].x,b.actors[4].x);
});
test('off-ball players move independently and a defender closes the carrier',()=>{
 const a=homeExhibitionFrame(1.8);
 assert.ok(a.actors[4].vx>0);assert.ok(a.actors[9].vx<0);assert.equal(a.actors[2].motion,'idle');
 const initial=homeExhibitionFrame(0),marking=homeExhibitionFrame(2.5);
 const distance=f=>Math.hypot(f.actors[9].x-f.actors[4].x,f.actors[9].z-f.actors[4].z);
 assert.ok(distance(marking)<distance(initial));
});
test('both keepers remain at their goals and every halted player idles',()=>{
 for(let time=0;time<52;time+=.25){const f=homeExhibitionFrame(time);assert.equal(f.actors.length,10);
 for(const i of [0,5]){assert.equal(f.actors[i].x,i===0?-18.5:18.5);assert.equal(f.actors[i].z,0);}
 for(const p of f.actors)if(!p.vx&&!p.vz&&!['catch','shoot'].includes(p.motion))assert.equal(p.motion,'idle');}
});
test('possession changes and loop boundaries do not teleport players',()=>{
 for(const time of [26,52]){const a=homeExhibitionFrame(time-1e-5),b=homeExhibitionFrame(time);
 a.actors.forEach((p,i)=>assert.deepEqual([p.x,p.z],[b.actors[i].x,b.actors[i].z]));}
});

test('kick direction points to the attacking goal throughout the shot for both teams',()=>{
 for(const start of [16.5,42.5])for(const dt of [0,.3,.8]){const f=homeExhibitionFrame(start+dt),i=start<26?4:9,p=f.actors[i];assert.equal(p.motion,'shoot');assert.equal(p.x+p.kickX,start<26?18.5:-18.5);assert.equal(p.z+p.kickZ,0);}
});
