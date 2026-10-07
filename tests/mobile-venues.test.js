import test from 'node:test';
import assert from 'node:assert/strict';

test('phone title and draft use static venue art without allocating a canvas or a 3D host',async t=>{
 const names=['document','addEventListener','innerWidth','innerHeight','scrollY','getComputedStyle'];
 const original=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 t.after(()=>{for(const [name,descriptor] of original){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
 let phase='title';const events={},classes=new Set(),properties=new Map();
 const grid={getBoundingClientRect:()=>({top:380})},dock={getBoundingClientRect:()=>({top:1320})};
 const app={querySelector(selector){
  if(selector.includes('.draft-card-grid'))return phase==='draft'?grid:null;
  if(selector.includes('.draft-action-dock'))return phase==='draft'?dock:null;
  if(selector.includes('.arena-title'))return phase==='title'?{}:null;
  if(selector.includes('main.screen-draft'))return phase==='draft'?{}:null;
  return null;
 }};
 Object.assign(globalThis,{innerWidth:2560,innerHeight:1440,scrollY:0,getComputedStyle:()=>({marginTop:'0px'}),addEventListener(){},
 document:{documentElement:{classList:{contains:name=>name==='mobile-layout'}},
 querySelector:selector=>selector==='#app'?app:null,
 createElement(){assert.fail('mobile venue must not allocate a hidden canvas or 3D host');},
 addEventListener:(name,fn)=>events[name]=fn,
 body:{style:{setProperty:(name,value)=>properties.set(name,value)},classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name)}}}});
 await import('../js/arena-background.js?test=mobile-static');
 assert.ok(classes.has('arena-active'));assert.ok(classes.has('arena-fallback'));
 phase='draft';events['football-league:view-rendered']();
 assert.ok(classes.has('draft-hall-active'));assert.ok(!classes.has('arena-fallback'));
 assert.ok(properties.has('--draft-podium-y'));assert.ok(properties.has('--draft-grid-height'));
});
