import {avatarProfile,kitColor} from './avatar-profile.js?v=appearance-v29';
import {createSurface,recolorPixels,drawFrontMotionLayers} from './avatar-rendering.js?v=modular-motion-v2';
import {drawRareMotion} from './rare-avatar.js?v=cell-cleanup-v1';

const cache=new Map();
const JOY_OFFSETS=[[0,0],[4.75,0],[0,-26.599999999999998],[4.2749999999999995,-1.9]];
// Raised arms are an independent layer above the face and hairstyle.
const JOY_ARMS=[
 [[[315,280],[369,276],[382,360],[313,370]],[[487,276],[542,280],[552,370],[483,360]]],
 [[[105,177],[158,177],[211,258],[188,298],[135,255],[105,224]],[[400,177],[453,177],[457,224],[420,255],[373,298],[351,258]]],
 [[[239,142],[293,142],[361,229],[335,274],[271,221],[239,192]],[[567,142],[621,142],[623,192],[589,221],[535,274],[511,229]]],
 [[[150,262],[204,255],[216,344],[150,355]],[[366,255],[419,262],[423,355],[360,344]]]
];
const JOY_HEADS=[[298,35,280,250],[143,35,280,250],[298,8,280,250],[143,35,280,250]];
export const CELEBRATION_SIZE={width:420,height:550,paddingX:60,paddingY:40};
export function drawCelebration(ctx,image,x,y,height){
 const scale=height/470;
 ctx.imageSmoothingEnabled=false;
 // Keep the original 300x470 character registration; padding expands outward.
 ctx.drawImage(image,x-210*scale,y-510*scale,420*scale,550*scale);
}
export function celebrationTexture(atlas,value,{kit,goalkeeper=false,pose=1,dejected=false,baseOnly=false}={}){
 const profile=avatarProfile(value),index=((pose%4)+4)%4;
 const key=JSON.stringify([profile,kitColor(kit,goalkeeper),goalkeeper,index,dejected,baseOnly]);
 if(cache.has(key))return cache.get(key);
 const {width,height,paddingX,paddingY}=CELEBRATION_SIZE;
 const out=createSurface(atlas.avatar,width,height),ctx=out.getContext('2d');
 if(profile.rareCharacter&&!dejected){
  const inner=createSurface(atlas.avatar,300,470);
  drawRareMotion(inner.getContext('2d'),atlas.avatar.rare,profile,'celebrate',index/3,{loop:true});
  ctx.drawImage(inner,paddingX,paddingY);
  if(cache.size>=96)cache.delete(cache.keys().next().value);cache.set(key,out);return out;
 }
 const sheet=dejected?atlas.dejected:atlas.celebrate;
 const w=sheet.width/(dejected?1:2),h=sheet.height/(dejected?1:2);
 const body=createSurface(atlas.avatar,w,h),bc=body.getContext('2d');
 bc.drawImage(sheet,dejected?0:index%2*w,dejected?0:Math.floor(index/2)*h,w,h,0,0,w,h);
 const arms=dejected?null:createSurface(atlas.avatar,w,h);
 if(arms){
  const ac=arms.getContext('2d');ac.save();ac.beginPath();
  for(const polygon of JOY_ARMS[index]){polygon.forEach(([x,y],i)=>i?ac.lineTo(x,y):ac.moveTo(x,y));ac.closePath();}
  ac.clip();ac.drawImage(atlas.celebrateArms,index%2*w,Math.floor(index/2)*h,w,h,0,0,w,h);ac.restore();
  const ap=ac.getImageData(0,0,w,h);recolorPixels(ap.data,{skinTone:profile.skinTone,kit,goalkeeper});ac.putImageData(ap,0,0);
 }
 const box=dejected?[350,145,590,545]:JOY_HEADS[index],pixels=bc.getImageData(0,0,w,h);
 recolorPixels(pixels.data,{skinTone:profile.skinTone,kit,goalkeeper,recolorKit:!dejected});bc.putImageData(pixels,0,0);
 ctx.imageSmoothingEnabled=false;
 const scale=dejected?.42:.95;
 // A fixed body registration preserves the source jump instead of cancelling it.
 const reference=dejected?box:JOY_HEADS[0],offsetY=250-(reference[1]+reference[3])*scale;
 // Sad poses keep the head in front; joy arms are composited after the head.
 ctx.drawImage(body,paddingX+150-(box[0]+box[2]/2)*scale,paddingY+offsetY,w*scale,h*scale);
 const head=createSurface(atlas.avatar,300,470);
 drawFrontMotionLayers(head.getContext('2d'),atlas.avatar,profile,{expression:dejected?'sad':'happy'});
 if(!baseOnly)ctx.drawImage(head,paddingX+(dejected?0:JOY_OFFSETS[index][0]),paddingY+(dejected?0:JOY_OFFSETS[index][1]));
 // Independent raised-arm layer sits in front of the face and hair.
 if(!dejected){
  const dx=paddingX+150-(box[0]+box[2]/2)*scale,dy=paddingY+offsetY;
  // Restore both arms last so raised hands overlap the face naturally.
  ctx.drawImage(arms,dx,dy,w*scale,h*scale);
 }
 if(cache.size>=96)cache.delete(cache.keys().next().value);cache.set(key,out);return out;
}

