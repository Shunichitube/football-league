import { RARE_CHARACTERS, rareKind } from './rare-characters.js';

let pending;
export function loadRareAssets() {
  if (!pending) pending = (async () => {
    const entries = await Promise.all(Object.keys(RARE_CHARACTERS).map(async kind => {
      const images = await Promise.all(['portrait','motions'].map(async type => {
        const image = new Image();
        image.src = new URL(`../assets/avatars/rare/${kind}-${type}.webp`, import.meta.url).href;
        await image.decode(); return image;
      }));
      return [kind, {portrait:images[0], motions:images[1]}];
    }));
    return Object.fromEntries(entries);
  })();
  return pending;
}
export function drawRarePortrait(ctx, rare, appearance) {
  const source = rare?.[rareKind(appearance)]?.portrait;
  if (!source) return false;
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source,0,0,ctx.canvas.width,ctx.canvas.height);
  return true;
}
export function rareMotionFrame(kind, motion, seconds, loop) {
  if (kind === 'black_hole') return Math.floor(Math.max(0,seconds)*8)%8;
  const action = ({idle:[0,2,2],run:[2,2,6],dribble:[4,2,6],shoot:[6,4,8],celebrate:[10,2,3],joy:[10,2,3]})[motion] || [0,2,2];
  const step = Math.floor(Math.max(0,seconds)*action[2]);
  return action[0] + ((loop ?? motion !== 'shoot') ? step%action[1] : Math.min(step,action[1]-1));
}
// Approved dragon/Kong sheets contain pieces of neighbouring cells. Keep the
// connected character and its antialias edge, without changing its registration.
export function retainPrimarySprite(pixels,width,height){
 const labels=new Int32Array(width*height);let serial=0,largest=0,largestSize=0;
 for(let n=0;n<labels.length;n++){
  if(labels[n]||pixels[n*4+3]<=16)continue;
  const label=++serial,queue=[n];labels[n]=label;
  for(let k=0;k<queue.length;k++){
   const point=queue[k],x=point%width,y=Math.floor(point/width);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,yy=y+dy;if(xx<0||xx>=width||yy<0||yy>=height)continue;
    const next=yy*width+xx;if(!labels[next]&&pixels[next*4+3]>16){labels[next]=label;queue.push(next);}
   }
  }
  if(queue.length>largestSize){largest=label;largestSize=queue.length;}
 }
 if(!largest)return pixels;
 for(let n=0;n<labels.length;n++){
  if(labels[n]===largest||!pixels[n*4+3])continue;
  const x=n%width,y=Math.floor(n/width);let edge=false;
  if(pixels[n*4+3]<=16)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const xx=x+dx,yy=y+dy;if(xx>=0&&xx<width&&yy>=0&&yy<height&&labels[yy*width+xx]===largest)edge=true;
  }
  if(!edge)pixels[n*4+3]=0;
 }
 return pixels;
}
const cleanedFrames=new WeakMap();
function cleanRareFrame(source,frame){
 if(typeof document==='undefined')return null;
 let frames=cleanedFrames.get(source);if(!frames){frames=new Map();cleanedFrames.set(source,frames);}
 if(frames.has(frame))return frames.get(frame);
 const canvas=document.createElement('canvas');canvas.width=300;canvas.height=470;
 const ctx=canvas.getContext('2d');ctx.drawImage(source,(frame%4)*300,Math.floor(frame/4)*470,300,470,0,0,300,470);
 const data=ctx.getImageData(0,0,300,470);retainPrimarySprite(data.data,300,470);ctx.putImageData(data,0,0);frames.set(frame,canvas);return canvas;
}
export function drawRareMotion(ctx, rare, appearance, motion, seconds, {direction='right',ball=false,loop}={}) {
  const kind = rareKind(appearance), source = rare?.[kind]?.motions;
  if (!source) return false;
  const frame = rareMotionFrame(kind,motion,seconds,loop);
  const width=ctx.canvas.width,height=ctx.canvas.height;
  ctx.clearRect(0,0,width,height);ctx.save();ctx.imageSmoothingEnabled=false;
  if(direction==='left'){ctx.translate(width,0);ctx.scale(-1,1);}
  const cleaned=['dragon','king_kong'].includes(kind)?cleanRareFrame(source,frame):null;
  if(cleaned)ctx.drawImage(cleaned,0,0,width,height);
  else ctx.drawImage(source,(frame%4)*300,Math.floor(frame/4)*470,300,470,0,0,width,height);
  if(ball && motion==='dribble'){
    ctx.fillStyle='#f8fafc';ctx.strokeStyle='#17212e';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(width*.82,height*.90,width*.05,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#17212e';ctx.beginPath();ctx.arc(width*.82,height*.90,width*.019,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();return true;
}
