export const DISPLAY_KEY='football-league:fixed-display';
export const DISPLAY_EVENT='football-league:fixed-display';
export function fixedDisplayEnabled(storage=globalThis.localStorage){
 try{return storage.getItem(DISPLAY_KEY)==='true';}catch{return false;}
}
export function setFixedDisplay(enabled,win=window){
 try{win.localStorage.setItem(DISPLAY_KEY,String(!!enabled));}catch{}
 win.parent.postMessage({type:DISPLAY_EVENT,enabled:!!enabled},win.location.origin);
}
export function displayGeometry(width,height,fixed){
 if(!fixed)return {width,height,scale:1,left:0,top:0};
 const scale=Math.min(width/2560,height/1440);
 return {width:2560,height:1440,scale,left:(width-2560*scale)/2,top:(height-1440*scale)/2};
}
export function mountDisplayFrame(win=window,doc=document){
 let enabled=fixedDisplayEnabled(win.localStorage);
 const frame=doc.createElement('iframe'),url=new URL(win.location.href);
 url.searchParams.set('game-frame','1');frame.src=url.href;frame.title='FOOTBALL LEAGUE';
 frame.allow='autoplay; fullscreen';
 frame.style.cssText='position:absolute;border:0;transform-origin:0 0;display:block;';
 for(const sheet of doc.querySelectorAll('link[rel="stylesheet"]'))sheet.remove();
 doc.documentElement.style.cssText='width:100%;height:100%;overflow:hidden;background:#07121c;';
 doc.body.style.cssText='width:100%;height:100%;margin:0;overflow:hidden;background:#07121c;';
 doc.body.replaceChildren(frame);
 const resize=()=>{
  const size=displayGeometry(win.innerWidth,win.innerHeight,enabled);
  Object.assign(frame.style,{width:`${size.width}px`,height:`${size.height}px`,left:`${size.left}px`,top:`${size.top}px`,transform:`scale(${size.scale})`});
 };
 win.addEventListener('resize',resize);
 win.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.origin!==win.location.origin||event.data?.type!==DISPLAY_EVENT)return;
  enabled=event.data.enabled===true;resize();
 });
 win.addEventListener('storage',event=>{if(event.key===DISPLAY_KEY){enabled=fixedDisplayEnabled(win.localStorage);resize();}});
 resize();return frame;
}
