import test from 'node:test';
import assert from 'node:assert/strict';
import {DISPLAY_KEY,DISPLAY_EVENT,DISPLAY_VIEW_EVENT,DISPLAY_REFERENCE_KEY,displayReference,displayGeometry,fixedDisplayEnabled,setFixedDisplay,mountDisplayFrame} from '../js/display-settings.js';

test('FHD, QHD and 4K share exactly the same 2560x1440 layout',()=>{
 for(const [width,height,scale] of [[1920,1080,.75],[2560,1440,1],[3840,2160,1.5]]){
  assert.deepEqual(displayGeometry(width,height,true),{width:2560,height:1440,scale,left:0,top:0});
 }
 assert.deepEqual(displayGeometry(1920,1200,true),{width:2560,height:1440,scale:.75,left:0,top:60});
 assert.deepEqual(displayGeometry(390,844,false),{width:390,height:844,scale:1,left:0,top:0});
});

test('display checkbox persists independently of game saves and notifies the host',()=>{
 const data=new Map(),messages=[];
 const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 const win={localStorage:storage,location:{origin:'https://example.test'},parent:{postMessage:(...args)=>messages.push(args)}};
 assert.equal(fixedDisplayEnabled(storage),false);
 setFixedDisplay(true,win);assert.equal(fixedDisplayEnabled(storage),true);
 assert.deepEqual(messages.at(-1),[{type:DISPLAY_EVENT,enabled:true},win.location.origin]);
 setFixedDisplay(false,win);assert.equal(data.get(DISPLAY_KEY),'false');
 assert.equal(fixedDisplayEnabled({getItem(){throw Error('blocked');}}),false);
});

test('host resizes one live frame, accepts only its messages and preserves the game URL',()=>{
 const listeners={},frame={style:{},contentWindow:{}},values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};let mounts=0;
 const win={innerWidth:1920,innerHeight:1080,localStorage:storage,location:{href:'https://example.test/?room=ABC',origin:'https://example.test'},addEventListener:(key,handler)=>listeners[key]=handler};
 const doc={createElement:()=>frame,querySelectorAll:()=>[],documentElement:{style:{}},body:{style:{},replaceChildren(node){assert.equal(node,frame);mounts++;}}};
 mountDisplayFrame(win,doc);
 const initialSrc=frame.src;assert.equal(new URL(initialSrc).searchParams.get('room'),'ABC');
 assert.equal(new URL(initialSrc).searchParams.get('game-frame'),'1');assert.equal(frame.style.width,'1920px');
 const message={source:frame.contentWindow,origin:win.location.origin,data:{type:DISPLAY_EVENT,enabled:true}};
 listeners.message({...message,source:{}});assert.equal(frame.style.width,'1920px');
 listeners.message({...message,origin:'https://other.test'});assert.equal(frame.style.width,'1920px');
 listeners.message(message);assert.equal(frame.style.width,'1920px');assert.equal(frame.style.transform,'scale(1)' );
 win.innerWidth=3840;win.innerHeight=2160;listeners.resize();assert.equal(frame.style.transform,'scale(2)');
 listeners.message({...message,data:{type:DISPLAY_EVENT,enabled:false}});assert.equal(frame.style.width,'3840px');
 assert.equal(frame.src,initialSrc);assert.equal(mounts,1);
 assert.deepEqual(displayReference(storage),{width:1920,height:1080});
 listeners.message(message);assert.deepEqual(displayReference(storage),{width:3840,height:2160});
 storage.setItem(DISPLAY_KEY,'true');
 win.innerWidth=1920;win.innerHeight=1080;mountDisplayFrame(win,doc);
 assert.equal(frame.style.width,'3840px');assert.equal(frame.style.transform,'scale(0.5)');
});

 test('window reference fills the original shape and preserves its layout at other resolutions',()=>{
 const reference={width:2560,height:1300};
 for(const scale of [.75,1,1.5])assert.deepEqual(displayGeometry(2560*scale,1300*scale,true,reference),{...reference,scale,left:0,top:0});
 assert.equal(displayReference({getItem:()=>JSON.stringify(reference)}).height,1300);
 assert.equal(displayReference({getItem:()=>'{broken'}),null);
 assert.equal(displayReference({getItem:()=>JSON.stringify({width:0,height:1})}),null);
 });

test('phone keeps one QHD frame, switches only draft to its native viewport and respects safe areas',()=>{
 const listeners={},frame={style:{},contentWindow:{}},values=new Map([[DISPLAY_REFERENCE_KEY,JSON.stringify({width:1920,height:1000})]]);
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const win={innerWidth:932,innerHeight:430,localStorage:storage,matchMedia:()=>({matches:true}),location:{href:'https://example.test/?room=PHONE',origin:'https://example.test'},addEventListener:(key,fn)=>listeners[key]=fn,
 getComputedStyle:()=>({paddingLeft:'20px',paddingRight:'20px',paddingTop:'0px',paddingBottom:'10px'})};
 const doc={createElement:()=>frame,querySelectorAll:()=>[],documentElement:{style:{}},body:{style:{},replaceChildren(){}}};
 mountDisplayFrame(win,doc);
 const src=frame.src;
 assert.equal(new URL(src).searchParams.get('mobile-layout'),'1');
 assert.equal(frame.style.width,'2560px');assert.equal(frame.style.height,'1440px');
 const message={source:frame.contentWindow,origin:win.location.origin,data:{type:DISPLAY_VIEW_EVENT,view:'draft'}};
 listeners.message({...message,origin:'https://other.test'});assert.equal(frame.style.width,'2560px');
 listeners.message(message);assert.equal(frame.style.width,'892px');assert.equal(frame.style.height,'420px');assert.equal(frame.style.transform,'scale(1)');
 win.innerWidth=844;win.innerHeight=390;listeners.resize();assert.equal(frame.style.width,'804px');
 listeners.message({...message,data:{type:DISPLAY_VIEW_EVENT,view:'qhd'}});assert.equal(frame.style.width,'2560px');
 assert.equal(frame.src,src);assert.deepEqual(displayReference(storage),{width:1920,height:1000});
});
