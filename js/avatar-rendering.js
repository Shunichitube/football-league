import { avatarProfile, SKIN_TONES, HAIR_COLORS, kitColor } from './avatar-profile.js?v=appearance-v21';
import { HAIR_PARTS } from './avatar-hair-parts.js?v=appearance-v21';
const rgb = hex => hex.slice(1).match(/../g).map(n => parseInt(n,16));
export function recolorPixels(pixels, { skinTone = 0, kit, goalkeeper = false, recolorKit = true, hairColor, frontKeeperBody = false, partWidth = 256 } = {}) {
  const skin = rgb(SKIN_TONES[avatarProfile({skinTone}).skinTone].color), uniform = rgb(kitColor(kit, goalkeeper));
  for (let i=0; i<pixels.length; i+=4) {
    if (!pixels[i+3]) continue;
    const [r,g,b] = [pixels[i],pixels[i+1],pixels[i+2]];
    const px=(i/4)%partWidth,py=Math.floor(i/4/partWidth);
    // Source ear/neck shadows include near-red pixels with almost no green or blue.
    const isSkin=r>30&&r>g*1.12&&g>=b&&r>b*1.25;
    if(frontKeeperBody&&isSkin&&py>30&&py<115&&(px<72||px>184)){
      const shade=Math.min(1,r/255);pixels[i]=Math.round(240*shade);pixels[i+1]=Math.round(245*shade);pixels[i+2]=Math.round(255*shade);continue;
    }
    if(frontKeeperBody&&py>90&&py<148&&px>60&&px<196&&r>110&&g>110&&b>110&&Math.max(r,g,b)-Math.min(r,g,b)<75){
      const shade=Math.max(r,g,b)/255;pixels[i]=Math.round(43*shade);pixels[i+1]=Math.round(47*shade);pixels[i+2]=Math.round(54*shade);continue;
    }
    if(hairColor!==undefined){
      if(r>30&&r>g*1.15&&g>b*1.1){const target=rgb(HAIR_COLORS[avatarProfile({hairColor}).hairColor].color),light=r/149;for(let c=0;c<3;c++)pixels[i+c]=Math.min(255,Math.round(target[c]*light));}
      continue;
    }
    if (recolorKit && b>35 && b>r*1.45 && b>g*1.08) {
      const light = b/255, white = Math.min(.5, r/b);
      for(let c=0;c<3;c++) pixels[i+c] = Math.round((uniform[c]*(1-white)+255*white)*light);
    } else if (isSkin) {
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
// Registration of the newly drawn motion overlays to the supplied 300px head.
export const MOTION_HAIR_OFFSETS=[-10,-10,-10,-10,-10,-12,-10,-10,-10,-10,-10,-10,-10,-12,-10,-10,-10,-10,-10,-10];
export const MOTION_HAIR_SCALE={x:1.10,y:1.08,anchorX:210,anchorY:180};
export function drawHair(ctx,assets,profile,view,box) {
  if(view==='quarter'&&assets.quarterHair?.[profile.hairStyle]){
    const image=assets.quarterHair[profile.hairStyle];
    // Newly drawn overlays retain the same square registration as the motion head.
    const [x,y,w,h]=box,offset=assets.quarterHairOffsets?.[profile.hairStyle]||0;
    const fit=MOTION_HAIR_SCALE;
    const dest=[x+fit.anchorX*(1-fit.x)*w/300,y+(fit.anchorY*(1-fit.y)+offset+4)*h/300,w*fit.x,h*fit.y];
    paintPart(ctx,assets,image,[0,0,image.width,image.height],dest,{hairColor:profile.hairColor,recolorKit:false});
    return;
  }
  const replacement=profile.hairStyle===5?assets['mohawk'+(view==='front'?'Front':'Quarter')]:profile.hairStyle===15?assets['shortfade'+(view==='front'?'Front':'Quarter')]:null;
  const image=replacement||assets.hair;
  const part=replacement?[0,0,image.width,image.height]:HAIR_PARTS[profile.hairStyle][view];
  if(view==='front'&&profile.hairStyle===5&&replacement){
    // Stretch upward by 12% around the 150px temple anchor; keep width and ear alignment.
    paintPart(ctx,assets,image,part,[box[0]-35*box[2]/230,box[1]-38*box[3]/220,300*box[2]/230,336*box[3]/220],{hairColor:profile.hairColor,recolorKit:false});
    return;
  }
  const tall=[5,17].includes(profile.hairStyle);
  // Tall hair stays inside the canvas; reduce its height to raise the hairline.
  // Negative top offsets previously clamped to zero and had no effect.
  const fit=view==='front'?({3:{scale:.83,x:0,y:7},4:{scale:.83,x:0,y:7},5:{scale:.90,x:0,y:4,height:1.0444},8:{scale:.83,x:0,y:7},11:{scale:1.06,x:-8,y:-6},15:{scale:.85,x:0,y:5,height:1.0588},16:{scale:1.06,x:-25,y:-14},17:{scale:1,x:0,y:0,height:.78}}[profile.hairStyle]||{}):{y:0};
  const extra=([14,16,19].includes(profile.hairStyle)?1.08:1)*(view==='front'?1.04:1);
  const width=box[2]*extra*(fit.scale||1);
  const naturalHeight=width*part[3]/part[2];
  const height=(view==='quarter'?Math.min(naturalHeight,box[3]*(tall?.82:.74)):naturalHeight)*(fit.height||1);
  const left=box[0]+(box[2]-width)/2+(fit.x||0)*box[2]/230;
  const top=view==='quarter'?box[1]+fit.y*box[3]/220:Math.max(0,box[1]-(tall?box[3]*.12:0)+(fit.y||0)*box[3]/220)+(fit.shiftY||0)*box[3]/220;
  // Preserve the independently drawn ears underneath every hairstyle.
  const earClip=view==='front'&&typeof ctx.clip==='function';
  if(earClip){
    ctx.save();ctx.beginPath();ctx.rect(-10000,-10000,20000,20000);
    if(view==='front'){
      for(const center of [16,214]){ctx.moveTo(box[0]+(center+10)*box[2]/230,box[1]+164*box[3]/220);ctx.ellipse(box[0]+center*box[2]/230,box[1]+164*box[3]/220,10*box[2]/230,30*box[3]/220,0,0,Math.PI*2);}
    }else{
      ctx.moveTo(box[0]+box[2]*.32,box[1]+box[3]*.75);ctx.ellipse(box[0]+box[2]*.25,box[1]+box[3]*.75,box[2]*.07,box[3]*.11,0,0,Math.PI*2);
    }
    ctx.clip('evenodd');
  }
  paintPart(ctx,assets,image,part,[left,top,width,height],{hairColor:profile.hairColor,recolorKit:false});
  if(earClip)ctx.restore();
}
export function drawGlasses(ctx,eyes,{scale=1}={}) {
  ctx.save();ctx.strokeStyle='#252b30';ctx.lineWidth=Math.max(2.5,6*scale);ctx.lineJoin='round';ctx.lineCap='round';
  const lenses=eyes.map(([x,y,w,h],side)=>[x-w*1.4+(side===0?-w*.2:w*.2),y-h*.24,w*3.8,h*1.38]);
  for(const [x,y,w,h] of lenses){
    ctx.beginPath();ctx.moveTo(x+w*.18,y);ctx.quadraticCurveTo(x+w*.5,y-h*.08,x+w*.82,y);
    ctx.quadraticCurveTo(x+w,y,x+w*.98,y+h*.25);ctx.lineTo(x+w*.88,y+h*.78);
    ctx.quadraticCurveTo(x+w*.84,y+h,x+w*.65,y+h);ctx.lineTo(x+w*.25,y+h);
    ctx.quadraticCurveTo(x+w*.08,y+h,x+w*.04,y+h*.78);ctx.lineTo(x,y+h*.25);
    ctx.quadraticCurveTo(x,y,x+w*.18,y);ctx.stroke();
  }
  const [left,right]=lenses;
  ctx.beginPath();ctx.moveTo(left[0]+left[2]*.98,left[1]+left[3]*.25);
  ctx.quadraticCurveTo((left[0]+left[2]+right[0])/2,(left[1]+right[1])/2+left[3]*.12,right[0],right[1]+right[3]*.25);ctx.stroke();
  for(const [lens,side]of [[left,-1],[right,1]]){const [x,y,w,h]=lens,edge=side<0?x:x+w;ctx.beginPath();ctx.moveTo(edge,y+h*.23);ctx.lineTo(edge+side*w*.18,y+h*.12);ctx.stroke();}
  ctx.restore();
}
export function drawQuarterHead(ctx,assets,value,box) {
  const profile=avatarProfile(value),[x,y,w,h]=box;
  const head=[x+w*.13,y+h*.14,w*.78,h*.86];
  const hairBox=assets.quarterHair?box:[x+w*.01,y+h*.01,w*.98,h];
  const headRect=[0,0,assets.quarterHead.width,assets.quarterHead.height];
  const headOptions={skinTone:profile.skinTone,recolorKit:false};
  // New motion hair assets already contain transparent ear and face openings.
  // Paint their alpha directly; legacy polygon clips cut away the new side locks.
  paintPart(ctx,assets,assets.quarterHead,headRect,head,headOptions);
  drawHair(ctx,assets,profile,'quarter',hairBox);
  const eyes=[[head[0]+head[2]*.55,head[1]+head[3]*.58,head[2]*.087,head[3]*.19],[head[0]+head[2]*.785,head[1]+head[3]*.545,head[2]*.087,head[3]*.19]];
  if(profile.face){ctx.save();ctx.strokeStyle='#38231d';ctx.lineWidth=w*.013;eyes.forEach(([ex,ey,ew],side)=>{ctx.beginPath();ctx.moveTo(ex-ew*.15,ey-h*.035+(profile.face===1&&side===0?-h*.02:0));ctx.lineTo(ex+ew*1.2,ey-h*.035+(profile.face===1&&side===1?-h*.02:0));ctx.stroke();});ctx.restore();}
  if(profile.glasses)drawGlasses(ctx,eyes,{scale:w/300});
}
let promise;
export function loadAvatarAssets() {
  if(!promise)promise=(async()=>{
    const image=async path=>{const source=new Image();source.src=new URL(path,import.meta.url).href;await source.decode();return source;};
    const [parts,hair,quarterHead,keeper,mohawkFront,mohawkQuarter,shortfadeFront,shortfadeQuarter]=await Promise.all([image('../assets/avatars/player-parts-v1.png'),image('../assets/avatars/player-hair-v3.webp'),image('../assets/avatars/player-head-quarter-v3.webp'),image('../assets/avatars/keeper-catch-v1.png'),image('../assets/avatars/mohawk-front-v3.webp'),image('../assets/avatars/mohawk-quarter-v1.webp'),image('../assets/avatars/shortfade-front-v1.webp'),image('../assets/avatars/shortfade-quarter-v1.webp')]);
    const quarterHair=await Promise.all(Array.from({length:20},(_,i)=>image('../assets/avatars/motion-hair-'+String(i+1).padStart(2,'0')+'-v2.webp')));
    return {parts,hair,quarterHead,keeper,mohawkFront,mohawkQuarter,shortfadeFront,shortfadeQuarter,quarterHair,quarterHairOffsets:MOTION_HAIR_OFFSETS};
  })();
  return promise;
}
