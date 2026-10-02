import test from 'node:test';
import assert from 'node:assert/strict';
import {retainPrimarySprite} from '../js/rare-avatar.js';

test('neighbour-cell pieces disappear while the character, diagonal tail and soft edge keep their pixels',()=>{
 const width=12,height=12,data=new Uint8ClampedArray(width*height*4);
 const put=(x,y,alpha=255)=>data.set([60,120,30,alpha],(y*width+x)*4);
 for(let y=2;y<8;y++)for(let x=2;x<6;x++)put(x,y);
 put(6,8);put(7,9);put(1,3,10);put(10,5);put(10,6);put(4,11);
 const before=data.slice();retainPrimarySprite(data,width,height);
 for(const [x,y]of [[2,2],[5,7],[6,8],[7,9],[1,3]]){
  const n=(y*width+x)*4;assert.deepEqual(data.slice(n,n+4),before.slice(n,n+4));
 }
 for(const [x,y]of [[10,5],[10,6],[4,11]])assert.equal(data[(y*width+x)*4+3],0);
});
test('empty transparent frames remain unchanged',()=>{
 const data=new Uint8ClampedArray(16);assert.deepEqual(retainPrimarySprite(data,2,2),new Uint8ClampedArray(16));
});
