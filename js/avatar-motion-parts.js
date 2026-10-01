import {avatarProfile,kitColor} from './avatar-profile.js?v=appearance-v15';
import {createSurface,recolorPixels,drawQuarterHead} from './avatar-rendering.js?v=appearance-v15';
// Head rectangles are registered to the approved body drawings, in source-cell pixels.
const HEAD_BOXES={
 base:[[126,51,229,213],[126,51,229,213]],
 run:[[180,0,360,310],[145,0,360,310],[180,0,360,310],[145,0,360,310]],
 inbetweens:[[180,10,360,310],[145,10,360,310],[180,10,360,310],[145,10,360,310]],
 correctedSix:[[180,10,360,310],[145,10,360,310],[180,10,360,310],[145,10,360,310]],
 shoot:[[180,8,360,310],[135,8,360,310],[165,8,360,310],[130,8,360,310]],
 catch:[[180,0,360,304],[130,0,360,304],[180,0,360,304],[130,0,360,304]],
 dive:[[190,150,310,252],[180,148,300,244],[280,156,285,217],[285,268,310,207]]
};
const frames=new Map(),sheetIds=new WeakMap();let sheetSerial=0;
export function appearanceMotionFrame(atlas,sheet,sourceIndex,columns,value,{kit,goalkeeper=false}={}){
 const assets=atlas.avatar;if(!assets)return null;
 const profile=avatarProfile(value),keyName=Object.keys(HEAD_BOXES).find(key=>atlas[key]===sheet);
 const box=HEAD_BOXES[keyName]?.[sourceIndex];if(!box)return null;
 if(!sheetIds.has(sheet))sheetIds.set(sheet,++sheetSerial);
 const effectiveKeeper=goalkeeper||keyName==='catch'||keyName==='dive';
 const key=JSON.stringify([sheetIds.get(sheet),sourceIndex,profile,kitColor(kit,effectiveKeeper),effectiveKeeper]);
 if(frames.has(key)){const cached=frames.get(key);frames.delete(key);frames.set(key,cached);return cached;}
 const width=sheet.width/columns,height=sheet.height/2,surface=createSurface(assets,width,height);if(!surface)return null;
 const ctx=surface.getContext('2d');ctx.imageSmoothingEnabled=false;
 ctx.drawImage(sheet,(sourceIndex%columns)*width,Math.floor(sourceIndex/columns)*height,width,height,0,0,width,height);
 const data=ctx.getImageData(0,0,surface.width,surface.height);recolorPixels(data.data,{skinTone:profile.skinTone,kit,goalkeeper:effectiveKeeper,recolorKit:keyName!=='catch'&&keyName!=='dive'});ctx.putImageData(data,0,0);
 ctx.clearRect(box[0]-25,Math.max(0,box[1]-20),box[2]+50,box[3]+Math.min(20,box[1]));
 drawQuarterHead(ctx,assets,profile,box);
 if(frames.size>=48)frames.delete(frames.keys().next().value);frames.set(key,surface);return surface;
}
