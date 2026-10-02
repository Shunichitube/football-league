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
 const body=new Uint8Array(width*height);
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
  const n=y*width+x,i=n*4,r=data[i],g=data[i+1],b=data[i+2];
  const warm=r>20&&r>g*1.12&&r>b*1.25&&g>=b;
  const blueKit=b>35&&b>r*1.45&&b>g*1.08;
  const gloveOrGrayKit=Math.min(r,g,b)>45&&Math.max(r,g,b)-Math.min(r,g,b)<15;
  // Brown/purple antialiasing at the old ear is not a piece of the uniform.
  if(data[i+3]>16&&!warm&&(blueKit||gloveOrGrayKit))body[n]=1;
 }
 // A raised forearm can enter the lower part of the head rectangle. Preserve
 // separate warm components that begin below the face, rather than erasing them.
 const visited=new Uint8Array(width*height);
 for(let sy=top;sy<bottom;sy++)for(let sx=left;sx<right;sx++){
  const start=sy*width+sx;if(visited[start]||body[start]||data[start*4+3]<16)continue;
  const warmAt=n=>{const i=n*4,r=data[i],g=data[i+1],b=data[i+2];return data[i+3]>16&&r>20&&r>g*1.12&&r>b*1.25&&g>=b;};
  if(!warmAt(start))continue;
  const queue=[start];visited[start]=1;let minY=sy;
  for(let k=0;k<queue.length;k++){
    const n=queue[k],x=n%width,y=Math.floor(n/width);minY=Math.min(minY,y);
    for(const [xx,yy] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
      if(xx<left||xx>=right||yy<top||yy>=bottom)continue;const m=yy*width+xx;
      if(!visited[m]&&warmAt(m)){visited[m]=1;queue.push(m);}
    }
  }
  if(minY>by+bh*.8&&queue.length>40){
    const touchesKit=queue.some(n=>{const x=n%width,y=Math.floor(n/width);for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const xx=x+dx,yy=y+dy;if(xx>=left&&xx<right&&yy>=top&&yy<bottom&&body[yy*width+xx])return true;}return false;});
    if(touchesKit)for(const n of queue)body[n]=1;
  }
 }
 // Keep the dark outline surrounding a preserved sleeve, shirt or glove as well.
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
  const n=y*width+x,i=n*4;if(body[n]||!data[i+3])continue;
  let keep=false;
  // The old ear/hair outline is warm even when almost black. Proximity to a
  // blue shoulder must not keep it; real arms have already been preserved above.
  const warmEdge=data[i]>data[i+1]*1.12&&data[i]>data[i+2]*1.25;
  if(Math.max(data[i],data[i+1],data[i+2])<65&&!warmEdge){
    for(let dy=-4;dy<=4&&!keep;dy++)for(let dx=-4;dx<=4;dx++){
      const xx=x+dx,yy=y+dy;
      if(xx>=left&&xx<right&&yy>=top&&yy<bottom&&body[yy*width+xx]){keep=true;break;}
    }
  }
  if(!keep)data[i+3]=0;
 }
 // Remove detached edge flecks left above the shoulders. Preserve components
 // joined to the body below, or to a raised arm outside the head rectangle.
 const joined=new Uint8Array(width*height),queue=[];
 const enqueue=(x,y)=>{if(x<left||x>=right||y<top||y>bottom||y>=height)return;const n=y*width+x;if(!joined[n]&&data[n*4+3]>16){joined[n]=1;queue.push(n);}};
 for(let x=left;x<right;x++)enqueue(x,bottom);
 for(let y=top;y<bottom;y++){enqueue(left,y);enqueue(right-1,y);}
 for(let k=0;k<queue.length;k++){const n=queue[k],x=n%width,y=Math.floor(n/width);enqueue(x-1,y);enqueue(x+1,y);enqueue(x,y-1);enqueue(x,y+1);}
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
  const n=y*width+x;if(joined[n]||!data[n*4+3])continue;
  let edge=false;
  if(data[n*4+3]<=16)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=left&&xx<right&&yy>=top&&yy<=bottom&&yy<height&&joined[yy*width+xx])edge=true;}
  if(!edge)data[n*4+3]=0;
 }
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
