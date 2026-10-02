import {drawAvatar} from './player-avatar.js?v=season-finale-v1';
import {avatarProfile,kitColor} from './avatar-profile.js?v=appearance-v29';
import {createSurface,recolorPixels} from './avatar-rendering.js?v=appearance-v29';
import {eraseOriginalHead} from './avatar-motion-parts.js?v=ear-cleanup-v1';
import {drawRareMotion} from './rare-avatar.js?v=cell-cleanup-v1';

const cache=new Map(),headMasks=new WeakMap();
const JOY_HEADS=[[298,35,280,250],[143,35,280,250],[298,8,280,250],[143,35,280,250]];
export const CELEBRATION_SIZE={width:420,height:550,paddingX:60,paddingY:40};
function upperHeadCenter(data,width,height,box){
 const [bx,by,bw,bh]=box;let left=width,right=-1,top=height;
 for(let y=Math.max(0,Math.floor(by));y<Math.min(height,Math.floor(by+bh*.44));y++)
  for(let x=Math.max(0,Math.floor(bx));x<Math.min(width,Math.ceil(bx+bw));x++){
   if(data[(y*width+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);}
  }
 return right>=left?{x:(left+right)/2,y:top}:{x:bx+bw/2,y:by};
}
function joyHeadMask(atlas){
 if(headMasks.has(atlas.celebrate))return headMasks.get(atlas.celebrate);
 const w=atlas.celebrate.width/2,h=atlas.celebrate.height/2;
 const ref=createSurface(atlas.avatar,w,h),ctx=ref.getContext('2d');
 ctx.drawImage(atlas.celebrate,0,0,w,h,0,0,w,h);
 const data=ctx.getImageData(0,0,w,h).data,box=JOY_HEADS[0],[bx,by,bw,bh]=box;
 const alpha=new Uint8Array(bw*bh);
 for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){
  // The lower face narrows toward its chin. Exclude the reference pose's fists.
  const half=y<225?bw/2:Math.max(72,105-(y-225)*1.32);
  if(Math.abs(x-bw/2)<=half&&data[((by+y)*w+bx+x)*4+3]>16)alpha[y*bw+x]=1;
 }
 const mask={alpha,width:bw,height:bh,center:upperHeadCenter(data,w,h,box)};
 headMasks.set(atlas.celebrate,mask);return mask;
}
// Erase only the opaque silhouette of the source head. Alpha gaps never punch
// rectangular holes through the independently raised hands and forearms.
export function eraseCelebrationHead(data,width,height,box,mask){
 const center=upperHeadCenter(data,width,height,box);
 const left=Math.round(box[0]+center.x-(box[0]+box[2]/2)-(mask.center.x-(JOY_HEADS[0][0]+JOY_HEADS[0][2]/2)));
 const top=Math.round(box[1]+center.y-box[1]-(mask.center.y-JOY_HEADS[0][1]));
 for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){
  const xx=left+x,yy=top+y;
  if(mask.alpha[y*mask.width+x]&&xx>=0&&xx<width&&yy>=0&&yy<height)data[(yy*width+xx)*4+3]=0;
 }
 return data;
}
export function drawCelebration(ctx,image,x,y,height){
 const scale=height/470;
 ctx.imageSmoothingEnabled=false;
 // Keep the original 300x470 character registration; padding expands outward.
 ctx.drawImage(image,x-210*scale,y-510*scale,420*scale,550*scale);
}
export function celebrationTexture(atlas,value,{kit,goalkeeper=false,pose=1,dejected=false}={}){
 const profile=avatarProfile(value),index=((pose%4)+4)%4;
 const key=JSON.stringify([profile,kitColor(kit,goalkeeper),goalkeeper,index,dejected]);
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
 const box=dejected?[350,145,590,545]:JOY_HEADS[index],pixels=bc.getImageData(0,0,w,h);
 const mask=dejected?null:joyHeadMask(atlas);
 const sourceCenter=dejected?null:upperHeadCenter(pixels.data,w,h,box);
 if(dejected)eraseOriginalHead(pixels.data,w,h,box);
 else {
  eraseCelebrationHead(pixels.data,w,h,box,mask);
  if(goalkeeper)for(let y=350;y<418&&y<h;y++)for(let x=Math.max(0,Math.floor(box[0]+box[2]/2-85));x<Math.min(w,box[0]+box[2]/2+85);x++){
   const i=(y*w+x)*4;
   if(pixels.data[i]>110&&pixels.data[i+1]>110&&pixels.data[i+2]>110){
    const shade=Math.max(...pixels.data.slice(i,i+3))/255;
    pixels.data[i]=43*shade;pixels.data[i+1]=47*shade;pixels.data[i+2]=54*shade;
   }
  }
 }
 recolorPixels(pixels.data,{skinTone:profile.skinTone,kit,goalkeeper,recolorKit:!dejected});bc.putImageData(pixels,0,0);
 ctx.imageSmoothingEnabled=false;
 const scale=dejected?.42:.95;
 // A fixed body registration preserves the source jump instead of cancelling it.
 const reference=dejected?box:JOY_HEADS[0],offsetY=250-(reference[1]+reference[3])*scale;
 // Sad poses keep the head in front; joy arms are composited after the head.
 if(dejected)ctx.drawImage(body,paddingX+150-(box[0]+box[2]/2)*scale,paddingY+offsetY,w*scale,h*scale);
 const head=createSurface(atlas.avatar,300,470);
 drawAvatar(head.getContext('2d'),atlas.avatar,profile,{kit,goalkeeper,headOnly:true,expression:dejected?'sad':'happy'});
 const headDX=dejected?0:(sourceCenter.x-box[0]-box[2]/2-(mask.center.x-JOY_HEADS[0][0]-JOY_HEADS[0][2]/2))*scale;
 const headDY=dejected?0:(sourceCenter.y-mask.center.y)*scale;
 ctx.drawImage(head,paddingX+headDX,paddingY+headDY);
 // The source head has already been removed. Remaining hands/arms cover the face.
 if(!dejected)ctx.drawImage(body,paddingX+150-(box[0]+box[2]/2)*scale,paddingY+offsetY,w*scale,h*scale);
 if(cache.size>=96)cache.delete(cache.keys().next().value);cache.set(key,out);return out;
}
