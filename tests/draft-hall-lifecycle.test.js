import test from 'node:test';
import assert from 'node:assert/strict';
import {mountDraftHall} from '../js/draft-hall.js';

// A late image load must not revive a venue after navigating to the auction.
test('draft venue releases its buffer and listeners, including navigation during image loading',async t=>{
 const names=['Image','document','innerWidth','innerHeight','devicePixelRatio','matchMedia','addEventListener','removeEventListener','requestAnimationFrame','cancelAnimationFrame'];
 const original=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 t.after(()=>{for(const [name,descriptor] of original){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
 const images=[],listeners=new Set();let frames=0;
 const add=(name,callback)=>listeners.add(callback),remove=(name,callback)=>listeners.delete(callback);
 class ImageStub{constructor(){images.push(this);}set src(value){this.url=value;}get src(){return this.url;}}
 Object.assign(globalThis,{Image:ImageStub,innerWidth:2560,innerHeight:1440,devicePixelRatio:3,
 document:{hidden:false,documentElement:{classList:{contains:()=>true}},addEventListener:add,removeEventListener:remove},
 matchMedia:()=>({matches:true,addEventListener:add,removeEventListener:remove}),addEventListener:add,removeEventListener:remove,
 requestAnimationFrame:()=>++frames,cancelAnimationFrame:()=>{}});
 const gradient={addColorStop(){}},ctx=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(target,key)=>target[key]||(()=>{})});
 const canvas=()=>({isConnected:true,width:0,height:0,dataset:{},getContext:()=>ctx});
 const first=canvas(),pending=mountDraftHall(first);images[0].onload();const dispose=await pending;
 assert.equal(first.width,1280);assert.equal(first.height,720);assert.ok(listeners.size>0);
 dispose();assert.equal(first.width,1);assert.equal(first.height,1);assert.equal(images[0].src,'');assert.equal(listeners.size,0);
 const late=canvas(),loading=mountDraftHall(late);late.isConnected=false;images[1].onload();await loading;
 assert.equal(late.width,1);assert.equal(late.height,1);assert.equal(images[1].src,'');assert.equal(listeners.size,0);assert.equal(frames,0);
});
