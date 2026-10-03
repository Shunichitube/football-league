import {avatarProfile} from './avatar-profile.js?v=appearance-v29';
import {createSurface,recolorPixels,frontMotionHairBox,drawFrontMotionHair,drawFrontMotionFace} from './avatar-rendering.js?v=motion-ui-v24';
import {MOTION_HAIR_LAYOUTS,SHOOT_DRAW_PADDING} from './motion-hair-layout.js?v=motion-ui-v24';
import {readHairAdjustments,effectiveHairAdjustment} from './motion-hair-adjustments.js?v=motion-ui-v24';
export function celebrationHairBox(assets,profile,head,adjustment){
 const [x,y,w,h]=frontMotionHairBox(assets,profile),[hx,hy,hw,hh]=head;
 const box=[hx+(x-35)*hw/230,hy+(y-20)*hh/220,w*hw/230,h*hh/220],a=adjustment;
 return [box[0]+a.x+box[2]*(1-a.scale)/2,box[1]+a.y+box[3]*(1-a.scale)/2,box[2]*a.scale,box[3]*a.scale];
}
export function drawCelebrationLayers(ctx,assets,profile,head,adjustment,{face=true}={}){
 if(face){ctx.save();ctx.translate(head[0]-35*head[2]/230,head[1]-20*head[3]/220);ctx.scale(head[2]/230,head[3]/220);drawFrontMotionFace(ctx,assets,profile,{expression:'happy'});ctx.restore();}
 drawFrontMotionHair(ctx,assets,profile,celebrationHairBox(assets,profile,head,adjustment));
}
export function celebrationFrame(atlas,value,index,{kit,goalkeeper=false,baseOnly=false}={}){
 const profile=avatarProfile(value),surface=createSurface(atlas.avatar,883,883),ctx=surface.getContext('2d'),sheet=goalkeeper?atlas.keeperCelebrate:atlas.celebrate,padding=SHOOT_DRAW_PADDING;
 ctx.imageSmoothingEnabled=false;ctx.drawImage(sheet,index%2*sheet.width/2,Math.floor(index/2)*sheet.height/2,sheet.width/2,sheet.height/2,padding,padding+(627-627*sheet.height/sheet.width)/2,627,627*sheet.height/sheet.width);
 const pixels=ctx.getImageData(0,0,883,883);recolorPixels(pixels.data,{skinTone:profile.skinTone,kit,goalkeeper,recolorKit:!goalkeeper});ctx.putImageData(pixels,0,0);
 if(!baseOnly){ctx.save();ctx.translate(padding,padding);drawCelebrationLayers(ctx,atlas.avatar,profile,MOTION_HAIR_LAYOUTS.celebrate.boxes[index],effectiveHairAdjustment(readHairAdjustments('celebrate')[profile.hairStyle],index));ctx.restore();}
 return surface;
}
