import { avatarProfile, SKIN_TONES, kitColor } from './avatar-profile.js';
import { HAIR_PARTS } from './avatar-hair-parts.js';
const rgb = hex => hex.slice(1).match(/../g).map(n => parseInt(n,16));
export function recolorPixels(pixels, { skinTone = 0, kit, goalkeeper = false, recolorKit = true } = {}) {
  const skin = rgb(SKIN_TONES[avatarProfile({skinTone}).skinTone].color), uniform = rgb(kitColor(kit, goalkeeper));
  for (let i=0; i<pixels.length; i+=4) {
    if (!pixels[i+3]) continue;
    const [r,g,b] = [pixels[i],pixels[i+1],pixels[i+2]];
    if (recolorKit && b>35 && b>r*1.45 && b>g*1.08) {
      const light = b/255, white = Math.min(.5, r/b);
      for(let c=0;c<3;c++) pixels[i+c] = Math.round((uniform[c]*(1-white)+255*white)*light);
    } else if (r>105 && g>55 && b>25 && r>g*1.12 && g>b*1.13 && g/r>.47 && b/r>.20) {
      pixels[i]=Math.min(255,Math.round(r*skin[0]/255));
      pixels[i+1]=Math.min(255,Math.round(g*skin[1]/190));
      pixels[i+2]=Math.min(255,Math.round(b*skin[2]/137));
    }
  }
  return pixels;
}
export function createSurface(assets,width,height) {
  if (assets?.createCanvas) return assets.createCanvas(Math.ceil(width),Math.ceil(height));
  if(typeof document==='undefined') return null;
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(width);canvas.height=Math.ceil(height);return canvas;
}
const tinted = new WeakMap();
export function tintedPart(assets,image,rect,options) {
  let cache=tinted.get(image);if(!cache){cache=new Map();tinted.set(image,cache);}
  const key=JSON.stringify([rect,options]);if(cache.has(key))return cache.get(key);
  const surface=createSurface(assets,rect[2],rect[3]);if(!surface)return null;
  const ctx=surface.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,...rect,0,0,rect[2],rect[3]);
  const data=ctx.getImageData(0,0,surface.width,surface.height);recolorPixels(data.data,options);ctx.putImageData(data,0,0);
  if(cache.size>=80)cache.delete(cache.keys().next().value);cache.set(key,surface);return surface;
}
export function paintPart(ctx,assets,image,rect,dest,options) {
  const surface=tintedPart(assets,image,rect,options);
  if(surface)ctx.drawImage(surface,...dest);else ctx.drawImage(image,...rect,...dest);
}
export function drawHair(ctx,assets,profile,view,box) {
  const part=HAIR_PARTS[profile.hairStyle][view];
  const tall=[5,17].includes(profile.hairStyle);
  const extra=[14,16,19].includes(profile.hairStyle)?1.08:1;
  const width=box[2]*extra;
  const naturalHeight=width*part[3]/part[2];
  const height=view==='quarter'?Math.min(naturalHeight,box[3]*(tall?.82:.74)):naturalHeight;
  const left=box[0]+(box[2]-width)/2;
  const top=Math.max(0,box[1]-(tall?box[3]*.12:0));
  ctx.drawImage(assets.hair,...part,left,top,width,height);
}
export function drawGlasses(ctx,eyes,{scale=1}={}) {
  ctx.save();ctx.strokeStyle='#202631';ctx.lineWidth=Math.max(2,3*scale);ctx.lineJoin='miter';
  const [left,right]=eyes;
  for(const [x,y,w,h] of eyes)ctx.strokeRect(x-w*.6,y-h*.12,w*2.2,h*1.2);
  ctx.beginPath();ctx.moveTo(left[0]+left[2]*1.6,left[1]+left[3]*.2);ctx.lineTo(right[0]-right[2]*.6,right[1]+right[3]*.2);ctx.stroke();ctx.restore();
}
export function drawQuarterHead(ctx,assets,value,box) {
  const profile=avatarProfile(value),[x,y,w,h]=box;
  const head=[x+w*.13,y+h*.14,w*.78,h*.86];
  paintPart(ctx,assets,assets.quarterHead,[0,0,assets.quarterHead.width,assets.quarterHead.height],head,{skinTone:profile.skinTone,recolorKit:false});
  drawHair(ctx,assets,profile,'quarter',[x+w*.01,y+h*.01,w*.98,h]);
  const eyes=[[head[0]+head[2]*.55,head[1]+head[3]*.58,head[2]*.087,head[3]*.19],[head[0]+head[2]*.785,head[1]+head[3]*.545,head[2]*.087,head[3]*.19]];
  if(profile.face){ctx.save();ctx.strokeStyle='#38231d';ctx.lineWidth=w*.013;eyes.forEach(([ex,ey,ew],side)=>{ctx.beginPath();ctx.moveTo(ex-ew*.15,ey-h*.035+(profile.face===1&&side===0?-h*.02:0));ctx.lineTo(ex+ew*1.2,ey-h*.035+(profile.face===1&&side===1?-h*.02:0));ctx.stroke();});ctx.restore();}
  if(profile.glasses)drawGlasses(ctx,eyes,{scale:w/300});
}
let promise;
export function loadAvatarAssets() {
  if(!promise)promise=(async()=>{
    const image=async path=>{const source=new Image();source.src=new URL(path,import.meta.url).href;await source.decode();return source;};
    const [parts,hair,quarterHead,keeper]=await Promise.all([image('../assets/avatars/player-parts-v1.png'),image('../assets/avatars/player-hair-v3.webp'),image('../assets/avatars/player-head-quarter-v3.webp'),image('../assets/avatars/keeper-catch-v1.png')]);
    return {parts,hair,quarterHead,keeper};
  })();
  return promise;
}
