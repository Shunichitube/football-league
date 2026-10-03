import {celebrationFrame} from './celebration-layers.js?v=motion-ui-v13';
import {MOTION_HAIR_LAYOUTS,SHOOT_DRAW_PADDING} from './motion-hair-layout.js?v=motion-ui-v13';
import {hairAdjustmentRevision} from './motion-hair-adjustments.js?v=motion-ui-v13';
import {avatarProfile,kitColor} from './avatar-profile.js?v=appearance-v29';
import {createSurface,recolorPixels,drawFrontMotionLayers} from './avatar-rendering.js?v=modular-motion-v2';
import {drawRareMotion} from './rare-avatar.js?v=cell-cleanup-v1';

const cache=new Map();
export const CELEBRATION_SIZE={width:420,height:550,paddingX:60,paddingY:40};
export function drawCelebration(ctx,image,x,y,height){
 const scale=height/470;
 ctx.imageSmoothingEnabled=false;
 // Keep the original 300x470 character registration; padding expands outward.
 ctx.drawImage(image,x-210*scale,y-510*scale,420*scale,550*scale);
}
export function celebrationTexture(atlas,value,{kit,goalkeeper=false,pose=1,dejected=false,baseOnly=false}={}){
 const profile=avatarProfile(value),index=((pose%4)+4)%4;
 const key=JSON.stringify([profile,kitColor(kit,goalkeeper),goalkeeper,index,dejected,baseOnly,dejected?'':hairAdjustmentRevision('celebrate')]);
 if(cache.has(key))return cache.get(key);
 const {width,height,paddingX,paddingY}=CELEBRATION_SIZE;
 const out=createSurface(atlas.avatar,width,height),ctx=out.getContext('2d');
 if(profile.rareCharacter&&!dejected){
  const inner=createSurface(atlas.avatar,300,470);
  drawRareMotion(inner.getContext('2d'),atlas.avatar.rare,profile,'celebrate',index/3,{loop:true});
  ctx.drawImage(inner,paddingX,paddingY);
  if(cache.size>=96)cache.delete(cache.keys().next().value);cache.set(key,out);return out;
 }
 if(!dejected){
  const image=celebrationFrame(atlas,profile,index,{kit,goalkeeper,baseOnly}),head=MOTION_HAIR_LAYOUTS.celebrate.boxes[index],scale=.85;
  ctx.drawImage(image,210-(SHOOT_DRAW_PADDING+head[0]+head[2]/2)*scale,30-SHOOT_DRAW_PADDING*scale,image.width*scale,image.height*scale);
  if(cache.size>=96)cache.delete(cache.keys().next().value);cache.set(key,out);return out;
 }
 const sheet=atlas.dejected;
 const w=sheet.width,h=sheet.height,body=createSurface(atlas.avatar,w,h),bc=body.getContext('2d');
 bc.drawImage(sheet,0,0);const pixels=bc.getImageData(0,0,w,h);
 recolorPixels(pixels.data,{skinTone:profile.skinTone,kit,goalkeeper,recolorKit:false});bc.putImageData(pixels,0,0);
 ctx.imageSmoothingEnabled=false;const box=[350,145,590,545],scale=.42,offsetY=250-(box[1]+box[3])*scale;
 ctx.drawImage(body,paddingX+150-(box[0]+box[2]/2)*scale,paddingY+offsetY,w*scale,h*scale);
 const head=createSurface(atlas.avatar,300,470);drawFrontMotionLayers(head.getContext('2d'),atlas.avatar,profile,{expression:'sad'});
 if(!baseOnly)ctx.drawImage(head,paddingX,paddingY);
 if(cache.size>=96)cache.delete(cache.keys().next().value);cache.set(key,out);return out;
}

