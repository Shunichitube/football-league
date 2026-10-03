import {MOTION_HAIR_LAYOUTS,SHOOT_DRAW_PADDING} from './motion-hair-layout.js?v=motion-ui-v10';
import {readHairAdjustments,effectiveHairAdjustment,hairAdjustmentRevision} from './motion-hair-adjustments.js?v=motion-ui-v10';
import {avatarProfile,kitColor} from './avatar-profile.js?v=appearance-v29';
import {createSurface,recolorPixels,drawQuarterMotionLayers} from './avatar-rendering.js?v=hair-editor-v1';
// Head rectangles are registered to the approved body drawings, in source-cell pixels.
const HEAD_BOXES={
 base:MOTION_HAIR_LAYOUTS.idle.boxes,
 run:MOTION_HAIR_LAYOUTS.run.boxes,
 shoot:MOTION_HAIR_LAYOUTS.shoot.boxes,
 catch:[[180,0,360,304],[130,0,360,304],[180,0,360,304],[130,0,360,304]],
 dive:[[190,150,310,252],[180,148,300,244],[280,156,285,217],[285,268,310,207]]
};
const frames=new Map(),sheetIds=new WeakMap();let sheetSerial=0;
export function renderMotionLayers(atlas,sheet,sourceIndex,columns,value,{kit,goalkeeper=false,baseOnly=false}={}){
 let assets=atlas.avatar;if(!assets)throw new Error('Motion assets are missing');
 const profile=avatarProfile(value),keyName=Object.keys(HEAD_BOXES).find(key=>atlas[key]===sheet);
 const hairMode=keyName==='base'?'idle':keyName==='run'?'run':keyName==='shoot'?'shoot':null;
 if(hairMode){const adjustment=effectiveHairAdjustment(readHairAdjustments(hairMode)[profile.hairStyle],sourceIndex),factor=(sheet.width/columns)/627;assets={...assets,motionHairAdjustment:{...adjustment,x:adjustment.x*factor,y:adjustment.y*factor}};}
 const box=HEAD_BOXES[keyName]?.[sourceIndex];if(!box)throw new Error('Motion frame registration is missing');
 if(!sheetIds.has(sheet))sheetIds.set(sheet,++sheetSerial);
 const effectiveKeeper=goalkeeper||keyName==='catch'||keyName==='dive';
 const key=JSON.stringify([sheetIds.get(sheet),sourceIndex,profile,kitColor(kit,effectiveKeeper),effectiveKeeper,baseOnly,hairMode?hairAdjustmentRevision(hairMode):'']);
 if(frames.has(key)){const cached=frames.get(key);frames.delete(key);frames.set(key,cached);return cached;}
 const width=sheet.width/columns,height=sheet.height/(keyName==='base'?1:2),padding=keyName==='shoot'?SHOOT_DRAW_PADDING*width/627:0,surface=createSurface(assets,width+padding*2,height+padding*2);if(!surface)throw new Error('Motion canvas is unavailable');
 const ctx=surface.getContext('2d');ctx.imageSmoothingEnabled=false;
 ctx.drawImage(sheet,(sourceIndex%columns)*width,Math.floor(sourceIndex/columns)*height,width,height,padding,padding,width,height);
 const data=ctx.getImageData(0,0,surface.width,surface.height);recolorPixels(data.data,{skinTone:profile.skinTone,kit,goalkeeper:effectiveKeeper,recolorKit:keyName!=='catch'&&keyName!=='dive'});ctx.putImageData(data,0,0);
 if(!baseOnly){ctx.save();ctx.translate(padding,padding);drawQuarterMotionLayers(ctx,assets,profile,box);ctx.restore();}
 if(padding){
  const pixels=ctx.getImageData(0,0,surface.width,surface.height).data;let left=surface.width,top=surface.height,right=0,bottom=0;
  for(let y=0;y<surface.height;y++)for(let x=0;x<surface.width;x++)if(pixels[(y*surface.width+x)*4+3]>16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  surface.motionPadding=padding;surface.motionContentBounds={left,top,right,bottom};
 }
 if(frames.size>=48)frames.delete(frames.keys().next().value);frames.set(key,surface);return surface;
}
