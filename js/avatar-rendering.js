import {loadRareAssets} from './rare-avatar.js';
import { avatarProfile, SKIN_TONES, HAIR_COLORS, kitColor } from './avatar-profile.js?v=appearance-v29';
import { HAIR_PARTS } from './avatar-hair-parts.js?v=appearance-v29';
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
export const MOTION_HAIR_REGISTERED=[0,3,4,5,6,12];
export const MOTION_HAIR_SCALE={x:1.10,y:1.08,anchorX:210,anchorY:180};
export function drawHair(ctx,assets,profile,view,box) {
  if(view==='quarter'&&assets.quarterHair?.[profile.hairStyle]){
    const image=assets.quarterHair[profile.hairStyle];
    // Newly drawn overlays retain the same square registration as the motion head.
    const [x,y,w,h]=box,offset=assets.quarterHairOffsets?.[profile.hairStyle]||0;
    const fit=MOTION_HAIR_SCALE;
    const dest=assets.quarterHairRegistered?.includes(profile.hairStyle)?box:[x+fit.anchorX*(1-fit.x)*w/300,y+(fit.anchorY*(1-fit.y)+offset+4)*h/300,w*fit.x,h*fit.y];
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
  const fit=view==='front'?({3:{scale:.83,x:0,y:7},4:{scale:.82,x:0,y:7,height:(.85*1.10)/.82},5:{scale:.90,x:0,y:4,height:1.0444},8:{scale:.83,x:0,y:7},11:{scale:1.06,x:-8,y:-6},15:{scale:.85,x:0,y:5,height:1.0588},16:{scale:1.06,x:-25,y:-14},17:{scale:1,x:0,y:0,height:.78}}[profile.hairStyle]||{}):{y:0};
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
// The same atlas eyebrows are used in portraits and motion faces.
export const AVATAR_BROWS=[null,[[595,670,46,27],[702,670,46,26]],[[1023,662,49,23],[1151,662,50,23]]];
const QUARTER_EYES=[[316,332,44,102],[457,306,44,102]];
const equalEyeHeads=new WeakMap();
function equalEyeQuarterHead(assets){
  const original=assets.quarterHead;
  if(equalEyeHeads.has(original))return equalEyeHeads.get(original);
  const surface=createSurface(assets,original.width,original.height);
  if(!surface)return original;
  const ctx=surface.getContext('2d');ctx.drawImage(original,0,0);
  const data=ctx.getImageData(0,0,surface.width,surface.height),pixels=data.data;
  const sx=surface.width/592,sy=surface.height/560;
  const originalPixels=pixels.slice();
  // Remove only the two eye colour masks. Preserve all alpha and surrounding skin.
  for(const [bx,by,bw,bh,lx,rx]of [[309,320,57,114,304,369],[449,293,59,128,444,513]]){
    for(let y=Math.floor(by*sy);y<Math.ceil((by+bh)*sy);y++){
      const left=(y*surface.width+Math.floor(lx*sx))*4,right=(y*surface.width+Math.ceil(rx*sx))*4;
      for(let x=Math.floor(bx*sx);x<Math.ceil((bx+bw)*sx);x++){
        const k=(y*surface.width+x)*4;
        if(pixels[k+3]){
          const t=(x-lx*sx)/((rx-lx)*sx);
          for(let c=0;c<3;c++)pixels[k+c]=Math.round(originalPixels[left+c]*(1-t)+originalPixels[right+c]*t);
        }
      }
    }
  }
  // Scale the same far-eye mask into both slots; retain the face's existing alpha.
  for(const [ex,ey,ew,eh]of QUARTER_EYES){
    const width=Math.round(ew*sx),height=Math.round(eh*sy);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const source=((Math.round(297*sy)+Math.floor(y*120*sy/height))*surface.width+Math.round(453*sx)+Math.floor(x*51*sx/width))*4;
      const target=((Math.round(ey*sy)+y)*surface.width+Math.round(ex*sx)+x)*4;
      if(Math.max(originalPixels[source],originalPixels[source+1],originalPixels[source+2])<40)
        for(let c=0;c<3;c++)pixels[target+c]=originalPixels[source+c];
    }
  }
  ctx.putImageData(data,0,0);
  equalEyeHeads.set(original,surface);return surface;
}
function glassesRim(ctx,x,y,w,h){
  ctx.moveTo(x+w*.14,y);ctx.lineTo(x+w*.82,y-h*.025);
  ctx.quadraticCurveTo(x+w,y-h*.025,x+w,y+h*.13);
  ctx.lineTo(x+w*.93,y+h*.85);ctx.quadraticCurveTo(x+w*.91,y+h,x+w*.76,y+h);
  ctx.lineTo(x+w*.20,y+h);ctx.quadraticCurveTo(x+w*.06,y+h,x+w*.04,y+h*.85);
  ctx.lineTo(x,y+h*.15);ctx.quadraticCurveTo(x,y,x+w*.14,y);ctx.closePath();
}
function drawQuarterGlasses(ctx,eyes,scale,temples){
  const spacing=eyes[1][0]+eyes[1][2]/2-eyes[0][0]-eyes[0][2]/2;
  const border=4.5*scale;
  const tilt=Math.atan2(eyes[1][1]+eyes[1][3]/2-eyes[0][1]-eyes[0][3]/2,spacing);
  const lenses=eyes.map(([x,y,w,h],side)=>{
    const width=spacing*(side===0?1.12:1.00),center=x+w/2+(side===0?-7:7)*scale;
    return [center-width/2,y-6*scale,width,h+12*scale];
  });
  ctx.save();ctx.strokeStyle='#252b30';ctx.fillStyle='#252b30';ctx.lineWidth=5*scale;ctx.lineCap='round';
  const point=([x,y,w,h],px,py)=>{
    const dx=px-w/2,dy=py-h/2;
    return [x+w/2+dx*Math.cos(tilt)-dy*Math.sin(tilt),y+h/2+dx*Math.sin(tilt)+dy*Math.cos(tilt)];
  };
  // The rims, bridge and arms use the same slanted face plane.
  lenses.forEach((lens,side)=>{
    const [x,y,w,h]=lens,temple=temples?.[side];
    if(temple){ctx.beginPath();ctx.moveTo(...temple);ctx.lineTo(...point(lens,side===0?0:w,h*.22));ctx.stroke();}
  });
  const [near,far]=lenses;
  const a=point(near,near[2],near[3]*.20),b=point(far,0,far[3]*.20);
  ctx.beginPath();ctx.moveTo(...a);ctx.quadraticCurveTo((a[0]+b[0])/2,(a[1]+b[1])/2-2*scale,...b);ctx.stroke();
  for(const [x,y,w,h]of lenses){
    ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(tilt);
    ctx.beginPath();glassesRim(ctx,-w/2,-h/2,w,h);glassesRim(ctx,-w/2+border,-h/2+border,w-border*2,h-border*2);ctx.fill('evenodd');ctx.restore();
  }
  ctx.restore();
}
export function drawGlasses(ctx,eyes,{scale=1,quarter=false,temples}={}) {
  if(quarter){drawQuarterGlasses(ctx,eyes,scale,temples);return;}
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
  for(const [lens,side]of [[left,-1],[right,1]]){const [x,y,w,h]=lens,edge=side<0?x:x+w;ctx.beginPath();ctx.moveTo(edge,y+h*.23);const temple=temples?.[side<0?0:1];ctx.lineTo(...(temple||[edge+side*w*.18,y+h*.12]));ctx.stroke();}
  ctx.restore();
}
export function drawQuarterHead(ctx,assets,value,box) {
  const profile=avatarProfile(value),[x,y,w,h]=box;
  const head=[x+w*.13,y+h*.14,w*.78,h*.86];
  const hairBox=assets.quarterHair?box:[x+w*.01,y+h*.01,w*.98,h];
  const headImage=equalEyeQuarterHead(assets);
  const headRect=[0,0,headImage.width,headImage.height];
  const headOptions={skinTone:profile.skinTone,recolorKit:false};
  // New motion hair assets already contain transparent ear and face openings.
  // Paint their alpha directly; legacy polygon clips cut away the new side locks.
  paintPart(ctx,assets,headImage,headRect,head,headOptions);
  drawHair(ctx,assets,profile,'quarter',hairBox);
  const eyes=QUARTER_EYES.map(([ex,ey,ew,eh])=>[head[0]+head[2]*ex/592,head[1]+head[3]*ey/560,head[2]*ew/592,head[3]*eh/560]);
  eyes.forEach(([ex,ey,ew,eh],side)=>{
    const brow=AVATAR_BROWS[profile.face]?.[side];
    if(brow&&assets.parts){
      const bx=ex-ew*.48,by=ey-eh*.60,bw=ew*1.89,bh=eh*.457;
      if(profile.face===1){
        ctx.save();ctx.translate(bx+bw/2,by+bh/2);ctx.rotate(-Math.PI/15);
        ctx.scale(side===0?1:-1,1);
        ctx.drawImage(assets.parts,...AVATAR_BROWS[1][0],-bw/2,-bh/2,bw,bh);ctx.restore();
      }else ctx.drawImage(assets.parts,...brow,bx,by,bw,bh);
    }
  });
  if(profile.glasses)drawGlasses(ctx,eyes,{scale:w/300,quarter:true,temples:[[x+w*.34,y+h*.66],[x+w*.89,y+h*.62]]});
}
let promise;
export function loadAvatarAssets() {
  if(!promise)promise=(async()=>{
    const image=async path=>{const source=new Image();source.src=new URL(path,import.meta.url).href;await source.decode();return source;};
    const [parts,hair,quarterHead,keeper,mohawkFront,mohawkQuarter,shortfadeFront,shortfadeQuarter]=await Promise.all([image('../assets/avatars/player-parts-v1.png'),image('../assets/avatars/player-hair-v3.webp'),image('../assets/avatars/player-head-quarter-v3.webp'),image('../assets/avatars/keeper-catch-v1.png'),image('../assets/avatars/mohawk-front-v3.webp'),image('../assets/avatars/mohawk-quarter-v1.webp'),image('../assets/avatars/shortfade-front-v1.webp'),image('../assets/avatars/shortfade-quarter-v1.webp')]);
    const quarterHair=await Promise.all(Array.from({length:20},(_,i)=>image('../assets/avatars/motion-hair-'+String(i+1).padStart(2,'0')+(MOTION_HAIR_REGISTERED.includes(i)?'-v3.webp':'-v2.webp'))));
    return {rare:await loadRareAssets(),parts,hair,quarterHead,keeper,mohawkFront,mohawkQuarter,shortfadeFront,shortfadeQuarter,quarterHair,quarterHairRegistered:MOTION_HAIR_REGISTERED,quarterHairOffsets:MOTION_HAIR_OFFSETS};
  })();
  return promise;
}
