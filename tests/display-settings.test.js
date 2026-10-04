import test from 'node:test';
import assert from 'node:assert/strict';
import {DISPLAY_KEY,DISPLAY_EVENT,displayGeometry,fixedDisplayEnabled,setFixedDisplay,mountDisplayFrame} from '../js/display-settings.js';

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
 const listeners={},frame={style:{},contentWindow:{}},storage={getItem:()=>null};let mounts=0;
 const win={innerWidth:1920,innerHeight:1080,localStorage:storage,location:{href:'https://example.test/?room=ABC',origin:'https://example.test'},addEventListener:(key,handler)=>listeners[key]=handler};
 const doc={createElement:()=>frame,querySelectorAll:()=>[],documentElement:{style:{}},body:{style:{},replaceChildren(node){assert.equal(node,frame);mounts++;}}};
 mountDisplayFrame(win,doc);
 const initialSrc=frame.src;assert.equal(new URL(initialSrc).searchParams.get('room'),'ABC');
 assert.equal(new URL(initialSrc).searchParams.get('game-frame'),'1');assert.equal(frame.style.width,'1920px');
 const message={source:frame.contentWindow,origin:win.location.origin,data:{type:DISPLAY_EVENT,enabled:true}};
 listeners.message({...message,source:{}});assert.equal(frame.style.width,'1920px');
 listeners.message({...message,origin:'https://other.test'});assert.equal(frame.style.width,'1920px');
 listeners.message(message);assert.equal(frame.style.width,'2560px');assert.equal(frame.style.transform,'scale(0.75)');
 win.innerWidth=3840;win.innerHeight=2160;listeners.resize();assert.equal(frame.style.transform,'scale(1.5)');
 listeners.message({...message,data:{type:DISPLAY_EVENT,enabled:false}});assert.equal(frame.style.width,'3840px');
 assert.equal(frame.src,initialSrc);assert.equal(mounts,1);
});
