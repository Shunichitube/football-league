import {avatarProfile,kitColor} from './avatar-profile.js?v=appearance-v29';
import {createSurface,recolorPixels,drawQuarterHead} from './avatar-rendering.js?v=appearance-v29';
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
// Remove warm head/hair pixels and their dark edge, preserving kit, gloves and arms
// outside the head box. No transparent rectangle is punched through the body.
export function eraseOriginalHead(data,width,height,box){
 const [bx,by,bw,bh]=box,left=Math.max(0,Math.floor(bx-25)),right=Math.min(width,Math.ceil(bx+bw+25));
 const top=Math.max(0,Math.floor(by-20)),bottom=Math.min(height,Math.ceil(by+bh));
 const protectedPixels=new Uint8Array(width*height),removed=new Uint8Array(width*height);
 const warm=n=>{const i=n*4,r=data[i],g=data[i+1],b=data[i+2];return data[i+3]>16&&r>20&&r>g*1.12&&r>b*1.25&&g>=b;};
 // Preserve every uniform colour, including its shaded white trim.
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
  const n=y*width+x,i=n*4,r=data[i],g=data[i+1],b=data[i+2];
  if(data[i+3]>16&&!warm(n)&&Math.max(r,g,b)>65)protectedPixels[n]=1;
 }
 // Hands are separate warm components below the face. Keep their full silhouette.
 const seen=new Uint8Array(width*height);
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
  const first=y*width+x;if(seen[first]||!warm(first))continue;
  const queue=[first];seen[first]=1;let minY=y;
  for(let k=0;k<queue.length;k++){
   const n=queue[k],xx=n%width,yy=Math.floor(n/width);minY=Math.min(minY,yy);
   for(const [nx,ny] of [[xx-1,yy],[xx+1,yy],[xx,yy-1],[xx,yy+1]]){
    if(nx<left||nx>=right||ny<top||ny>=height)continue;
    const next=ny*width+nx;if(!seen[next]&&warm(next)){seen[next]=1;queue.push(next);}
   }
  }
  if(minY>by+bh*.65)for(const n of queue)protectedPixels[n]=1;
 }
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
  const n=y*width+x,i=n*4;if(!data[i+3]||protectedPixels[n])continue;
  let bodyEdge=false;
  for(let dy=-4;dy<=4&&!bodyEdge;dy++)for(let dx=-4;dx<=4;dx++){
   const xx=x+dx,yy=y+dy;
   if(xx>=0&&xx<width&&yy>=0&&yy<height&&protectedPixels[yy*width+xx]){bodyEdge=true;break;}
  }
  if(warm(n)||!bodyEdge)removed[n]=1;
 }
 for(let n=0;n<removed.length;n++)if(removed[n])data[n*4+3]=0;
 return data;
}
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
 const data=ctx.getImageData(0,0,surface.width,surface.height);eraseOriginalHead(data.data,surface.width,surface.height,box);recolorPixels(data.data,{skinTone:profile.skinTone,kit,goalkeeper:effectiveKeeper,recolorKit:keyName!=='catch'&&keyName!=='dive'});ctx.putImageData(data,0,0);
 drawQuarterHead(ctx,assets,profile,box);
 if(frames.size>=48)frames.delete(frames.keys().next().value);frames.set(key,surface);return surface;
}
