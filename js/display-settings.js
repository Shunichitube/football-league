export const DISPLAY_KEY='football-league:fixed-display';
export const DISPLAY_VIEW_EVENT='football-league:display-view';
export const DISPLAY_EVENT='football-league:fixed-display';
export function mobileDisplayEnabled(win=window){
 return !!win.matchMedia?.('(pointer: coarse)').matches && Math.min(win.innerWidth,win.innerHeight)<=768;
}
export function gameEntryMode(win=window){
 return mobileDisplayEnabled(win)||new URL(win.location.href).searchParams.get('game-frame')==='1'?'game':'host';
}
export function reportDisplayView(win=window,doc=document){
 const view=doc.querySelector('main.screen-draft .draft-card-grid')?'draft':'qhd';
 win.parent.postMessage({type:DISPLAY_VIEW_EVENT,view},win.location.origin);
}
export const DISPLAY_REFERENCE_KEY='football-league:display-reference';
export function displayReference(storage=globalThis.localStorage){
 try{
  const value=JSON.parse(storage.getItem(DISPLAY_REFERENCE_KEY));
  return value&&[value.width,value.height].every(n=>Number.isFinite(n)&&n>0&&n<=32768)?{width:value.width,height:value.height}:null;
 }catch{return null;}
}
export function fixedDisplayEnabled(storage=globalThis.localStorage){
 try{return storage.getItem(DISPLAY_KEY)==='true';}catch{return false;}
}
export function setFixedDisplay(enabled,win=window){
 try{win.localStorage.setItem(DISPLAY_KEY,String(!!enabled));}catch{}
 win.parent.postMessage({type:DISPLAY_EVENT,enabled:!!enabled},win.location.origin);
}
export function displayGeometry(width,height,fixed,reference={width:2560,height:1440}){
 if(!fixed)return {width,height,scale:1,left:0,top:0};
 const scale=Math.min(width/reference.width,height/reference.height);
 return {...reference,scale,left:(width-reference.width*scale)/2,top:(height-reference.height*scale)/2};
}
export function mountDisplayFrame(win=window,doc=document){
 const mobile=mobileDisplayEnabled(win);
 let view='qhd';
 let enabled=fixedDisplayEnabled(win.localStorage);
 let reference=displayReference(win.localStorage);
 const capture=()=>{
  reference={width:win.innerWidth,height:win.innerHeight};
  try{win.localStorage.setItem(DISPLAY_REFERENCE_KEY,JSON.stringify(reference));}catch{}
 };
 if(enabled&&!reference&&!mobile)capture();
 const frame=doc.createElement('iframe'),url=new URL(win.location.href);
 if(mobile)url.searchParams.set('mobile-layout','1');
 url.searchParams.set('game-frame','1');frame.src=url.href;frame.title='FOOTBALL LEAGUE';
 frame.allow='autoplay; fullscreen';
 frame.style.cssText='position:absolute;border:0;transform-origin:0 0;display:block;';
 for(const sheet of doc.querySelectorAll('link[rel="stylesheet"]'))sheet.remove();
 doc.documentElement.style.cssText='width:100%;height:100%;overflow:hidden;background:#07121c;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
 doc.body.style.cssText='width:100%;height:100%;margin:0;overflow:hidden;background:#07121c;';
 doc.body.replaceChildren(frame);
 let laidOut=false;
 const resize=()=>{
  // Pinch zoom changes the visual viewport, not the game layout. Rebuilding
  // large iframe surfaces during a gesture can cause a mobile rendering spike.
  if(laidOut&&mobile&&win.visualViewport?.scale>1.01)return;
  const style=win.getComputedStyle?.(doc.documentElement);
  const inset=key=>parseFloat(style?.[key])||0;
  const left=inset('paddingLeft'),top=inset('paddingTop');
  const width=win.innerWidth-left-inset('paddingRight'),height=win.innerHeight-top-inset('paddingBottom');
  const size=mobile?displayGeometry(width,height,view!=='draft'):displayGeometry(width,height,enabled,reference||undefined);
  size.left+=left;size.top+=top;
  Object.assign(frame.style,{width:`${size.width}px`,height:`${size.height}px`,left:`${size.left}px`,top:`${size.top}px`,transform:`scale(${size.scale})`});
  laidOut=true;
 };
 win.addEventListener('resize',resize);
 win.visualViewport?.addEventListener('resize',resize);
 win.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.origin!==win.location.origin)return;
  if(event.data?.type===DISPLAY_VIEW_EVENT){
   if(mobile&&['draft','qhd'].includes(event.data.view)){view=event.data.view;resize();}
   return;
  }
  if(event.data?.type!==DISPLAY_EVENT)return;
  if(mobile)return;
  if(event.data.enabled===true&&!enabled)capture();
  enabled=event.data.enabled===true;resize();
 });
 win.addEventListener('storage',event=>{
  if([DISPLAY_KEY,DISPLAY_REFERENCE_KEY].includes(event.key)){
   reference=displayReference(win.localStorage);enabled=fixedDisplayEnabled(win.localStorage);
   if(enabled&&!reference&&!mobile)capture();resize();
  }
 });
 resize();return frame;
}
