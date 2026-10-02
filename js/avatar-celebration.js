import {drawAvatar} from './player-avatar.js?v=season-finale-v1';
import {avatarProfile,kitColor} from './avatar-profile.js?v=appearance-v29';
import {createSurface,recolorPixels} from './avatar-rendering.js?v=appearance-v29';
import {eraseOriginalHead} from './avatar-motion-parts.js?v=ear-cleanup-v1';
import {drawRareMotion} from './rare-avatar.js?v=cell-cleanup-v1';

const cache=new Map();
// Source registrations retain the raised arms; only the original head is removed.
const JOY_HEADS=[[298,35,280,250],[143,35,280,250],[298,8,280,250],[143,35,280,250]];
export function celebrationTexture(atlas,value,{kit,goalkeeper=false,pose=1,dejected=false}={}){
 const profile=avatarProfile(value),index=((pose%4)+4)%4;
 const key=JSON.stringify([profile,kitColor(kit,goalkeeper),goalkeeper,index,dejected]);
 if(cache.has(key))return cache.get(key);
 const out=createSurface(atlas.avatar,300,470),ctx=out.getContext('2d');
 if(profile.rareCharacter&&!dejected){drawRareMotion(ctx,atlas.avatar.rare,profile,'celebrate',index/3,{loop:true});if(cache.size>=96)cache.delete(cache.keys().next().value);cache.set(key,out);return out;}
 const sheet=dejected?atlas.dejected:atlas.celebrate;
 const w=sheet.width/(dejected?1:2),h=sheet.height/(dejected?1:2),body=createSurface(atlas.avatar,w,h),bc=body.getContext('2d');
 bc.drawImage(sheet,dejected?0:index%2*w,dejected?0:Math.floor(index/2)*h,w,h,0,0,w,h);
 const box=dejected?[350,145,590,545]:JOY_HEADS[index];
 const pixels=bc.getImageData(0,0,w,h);
 if(dejected)eraseOriginalHead(pixels.data,w,h,box);
 else {
  // The fists and forearms reach head height. A shaped head mask keeps them,
  // unlike the rectangular motion-head removal used for running poses.
  const [bx,by,bw,bh]=box,cx=bx+bw/2;
  for(let y=Math.max(0,by-5);y<by+bh;y++){
   const relative=y-by,half=relative<155?bw/2+4:relative<237?119:90;
   for(let x=Math.floor(cx-half);x<cx+half;x++)pixels.data[(y*w+x)*4+3]=0;
  }
  if(goalkeeper)for(let y=350;y<418;y++)for(let x=Math.floor(cx-85);x<cx+85;x++){
   const i=(y*w+x)*4;if(pixels.data[i]>110&&pixels.data[i+1]>110&&pixels.data[i+2]>110){const shade=Math.max(...pixels.data.slice(i,i+3))/255;pixels.data[i]=43*shade;pixels.data[i+1]=47*shade;pixels.data[i+2]=54*shade;}
  }
 }
 recolorPixels(pixels.data,{skinTone:profile.skinTone,kit,goalkeeper,recolorKit:!dejected});bc.putImageData(pixels,0,0);
 ctx.imageSmoothingEnabled=false;
 const scale=dejected?.42:.95,offsetY=250-(box[1]+box[3])*scale;
 ctx.drawImage(body,150-(box[0]+box[2]/2)*scale,offsetY,w*scale,h*scale);
 const head=createSurface(atlas.avatar,300,470);
 drawAvatar(head.getContext('2d'),atlas.avatar,profile,{kit,goalkeeper,headOnly:true,expression:dejected?'sad':'happy'});
 ctx.drawImage(head,0,0);
 if(cache.size>=96)cache.delete(cache.keys().next().value);cache.set(key,out);return out;
}
