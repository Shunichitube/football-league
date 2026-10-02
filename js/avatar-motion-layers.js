import {MOTION_HAIR_LAYOUTS} from './motion-hair-layout.js?v=1';
import {readHairAdjustments,effectiveHairAdjustment,hairAdjustmentRevision} from './motion-hair-adjustments.js?v=idle-approved-v5';
import {avatarProfile,kitColor} from './avatar-profile.js?v=appearance-v29';
import {createSurface,recolorPixels,drawQuarterMotionLayers} from './avatar-rendering.js?v=hair-editor-v1';
// Head rectangles are registered to the approved body drawings, in source-cell pixels.
const HEAD_BOXES={
 base:MOTION_HAIR_LAYOUTS.idle.boxes,
 run:MOTION_HAIR_LAYOUTS.run.boxes,
 shoot:[[180,8,360,310],[135,8,360,310],[165,8,360,310],[130,8,360,310]],
 catch:[[180,0,360,304],[130,0,360,304],[180,0,360,304],[130,0,360,304]],
 dive:[[190,150,310,252],[180,148,300,244],[280,156,285,217],[285,268,310,207]]
};
const frames=new Map(),sheetIds=new WeakMap();let sheetSerial=0;
export function renderMotionLayers(atlas,sheet,sourceIndex,columns,value,{kit,goalkeeper=false,baseOnly=false}={}){
 let assets=atlas.avatar;if(!assets)throw new Error('Motion assets are missing');
 const profile=avatarProfile(value),keyName=Object.keys(HEAD_BOXES).find(key=>atlas[key]===sheet);
 const hairMode=keyName==='base'?'idle':keyName==='run'?'run':null;
 if(hairMode){const adjustment=effectiveHairAdjustment(readHairAdjustments(hairMode)[profile.hairStyle],sourceIndex),factor=(sheet.width/columns)/627;assets={...assets,motionHairAdjustment:{...adjustment,x:adjustment.x*factor,y:adjustment.y*factor}};}
 const box=HEAD_BOXES[keyName]?.[sourceIndex];if(!box)throw new Error('Motion frame registration is missing');
 if(!sheetIds.has(sheet))sheetIds.set(sheet,++sheetSerial);
 const effectiveKeeper=goalkeeper||keyName==='catch'||keyName==='dive';
 const key=JSON.stringify([sheetIds.get(sheet),sourceIndex,profile,kitColor(kit,effectiveKeeper),effectiveKeeper,baseOnly,hairMode?hairAdjustmentRevision(hairMode):'']);
 if(frames.has(key)){const cached=frames.get(key);frames.delete(key);frames.set(key,cached);return cached;}
 const width=sheet.width/columns,height=sheet.height/(keyName==='base'?1:2),surface=createSurface(assets,width,height);if(!surface)throw new Error('Motion canvas is unavailable');
 const ctx=surface.getContext('2d');ctx.imageSmoothingEnabled=false;
 ctx.drawImage(sheet,(sourceIndex%columns)*width,Math.floor(sourceIndex/columns)*height,width,height,0,0,width,height);
 const data=ctx.getImageData(0,0,surface.width,surface.height);recolorPixels(data.data,{skinTone:profile.skinTone,kit,goalkeeper:effectiveKeeper,recolorKit:keyName!=='catch'&&keyName!=='dive'});ctx.putImageData(data,0,0);
 if(!baseOnly)drawQuarterMotionLayers(ctx,assets,profile,box);
 if(frames.size>=48)frames.delete(frames.keys().next().value);frames.set(key,surface);return surface;
}
