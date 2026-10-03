import {drawRarePortrait} from './rare-avatar.js?v=rare-fit-v5';
// Shared body, separately registered hairstyle/face/accessory layers.
import {avatarProfile,kitColor} from './avatar-profile.js?v=appearance-v29';
import {drawHair,drawGlasses,paintPart,loadAvatarAssets,AVATAR_BROWS} from './avatar-rendering.js?v=modular-motion-v4';
export {avatarProfile,HAIR_STYLES,HAIR_COLORS,FACE_STYLES,SKIN_TONES} from './avatar-profile.js?v=appearance-v29';
export const AVATAR_SIZE={width:300,height:470};
const HEAD=[104,121,256,220],BODY=[104,341,256,210];
const headX=x=>150+(x-150)*.88;
const EYE=[174,703,26,46];

export function drawAvatar(ctx,assets,value=0,{kit,goalkeeper=false,expression='normal',headOnly=false,base=true,baseOnly=false}={}) {
 if(!headOnly&&drawRarePortrait(ctx,assets.rare,value))return;
 const profile=avatarProfile(value),parts=assets.parts||assets;
 ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,300,470);
 const options={skinTone:profile.skinTone,kit:kitColor(kit,goalkeeper),goalkeeper};
 if(!headOnly&&base)paintPart(ctx,assets,parts,BODY,[22,250,256,210],{...options,frontKeeperBody:goalkeeper,partWidth:BODY[2]});
 if(base)paintPart(ctx,assets,parts,HEAD,[headX(22),30,256*.88,220],{...options,recolorKit:false});
 if(baseOnly)return;
 if(assets.hair)drawHair(ctx,assets,profile,'front',[35,20,230,220]);
 const eyes=[];
 for(let side=0;side<2;side++){
  const brow=AVATAR_BROWS[profile.face]?.[side];
  if(expression==='sad'){
   const x=headX(105+side*60);ctx.strokeStyle='#17130e';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,side?159:168);ctx.lineTo(x+26,side?168:159);ctx.stroke();
  }else if(brow)ctx.drawImage(parts,...brow,headX(105+side*60),155,30*.88,16);
  const dest=[Math.round(headX(112+side*60)),176,Math.round(16*.88),35];eyes.push(dest);
  if(expression==='normal')ctx.drawImage(parts,...EYE,...dest);
  else {ctx.strokeStyle='#17130e';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(dest[0]-2,194);ctx.quadraticCurveTo(dest[0]+dest[2]/2,expression==='happy'?174:202,dest[0]+dest[2]+2,194);ctx.stroke();}
 }
 if(profile.glasses)drawGlasses(ctx,eyes);
}
let assets;
if(typeof document!=='undefined'&&typeof Image!=='undefined')assets=await loadAvatarAssets();
export function playerAvatarTexture(value,options={}) {
 const canvas=document.createElement('canvas');canvas.width=300;canvas.height=470;drawAvatar(canvas.getContext('2d'),assets,value,options);return canvas;
}

