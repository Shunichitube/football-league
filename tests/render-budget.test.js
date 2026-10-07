import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileRendering,renderPixelRatio} from '../js/render-budget.js';

test('phone QHD keeps the layout while reducing drawing-buffer area sixteenfold',()=>{
 const width=2560,height=1440;
 const mobile=renderPixelRatio(width,height,3,true),desktop=renderPixelRatio(width,height,3,false);
 assert.equal(mobile,.5);assert.equal(desktop,2);
 assert.equal(width*mobile,1280);assert.equal(height*mobile,720);
 assert.equal((desktop/mobile)**2,16);
});

test('all mobile viewport sizes remain within the pixel budget, desktop density is preserved',()=>{
 for(const [width,height] of [[932,430],[844,390],[390,844],[2560,1440],[3840,2160]]){
  const ratio=renderPixelRatio(width,height,3,true);
  assert.ok(Math.max(width,height)*ratio<=1280);
  assert.ok(ratio>0);
 }
 assert.equal(renderPixelRatio(2560,1440,1,false),1);
 assert.equal(mobileRendering(),false);
 assert.equal(mobileRendering({documentElement:{classList:{contains:value=>value==='mobile-layout'}}}),true);
});
