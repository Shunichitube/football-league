import { RARE_CHARACTERS, rareKind } from './rare-characters.js';

let pending;
export function loadRareAssets() {
  if (!pending) pending = (async () => {
    const entries = await Promise.all(Object.keys(RARE_CHARACTERS).map(async kind => {
      const images = await Promise.all(['portrait','motions'].map(async type => {
        const image = new Image();
        const filename=type==='motions'&&['king_kong','robot'].includes(kind)?`${kind}-motions-approved-v1.png`:type==='motions'&&['phoenix','dragon','sage'].includes(kind)?`${kind}-motions-spaced-v1.png`:`${kind}-${type}.webp`;
        image.src = new URL(`../assets/avatars/rare/${filename}`, import.meta.url).href;
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
  const scale=Math.min(ctx.canvas.width/source.width,ctx.canvas.height/source.height);
  const width=source.width*scale,height=source.height*scale;
  ctx.drawImage(source,(ctx.canvas.width-width)/2,ctx.canvas.height-height,width,height);
  return true;
}
export function rareMotionFrame(kind, motion, seconds, loop) {
  if (kind === 'black_hole') return Math.floor(Math.max(0,seconds)*8)%8;
  if(['king_kong','robot'].includes(kind)&&['run','dribble'].includes(motion)){
    const step=Math.floor(Math.max(0,seconds)*8);
    return 2+(loop===false?Math.min(step,3):step%4);
  }
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
// Measure the whole animation once: a wider kick must not change character size
// or move the feet between frames. Source artwork remains untouched.
const registeredSheets=new WeakMap();
function registerRareSheet(source,kind){
 if(registeredSheets.has(source))return registeredSheets.get(source);
 const rows=kind==='black_hole'?2:3,width=source.width/4,height=source.height/rows;
 const frames=[],bounds={left:width,top:height,right:0,bottom:0};
 for(let frame=0;frame<rows*4;frame++){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  ctx.drawImage(source,(frame%4)*width,Math.floor(frame/4)*height,width,height,0,0,width,height);
  const data=ctx.getImageData(0,0,width,height);
  if(['dragon','king_kong'].includes(kind)){retainPrimarySprite(data.data,width,height);ctx.putImageData(data,0,0);}
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data.data[(y*width+x)*4+3]>16){
   bounds.left=Math.min(bounds.left,x);bounds.top=Math.min(bounds.top,y);bounds.right=Math.max(bounds.right,x+1);bounds.bottom=Math.max(bounds.bottom,y+1);
  }
  frames.push(canvas);
 }
 if(bounds.right<=bounds.left||bounds.bottom<=bounds.top)Object.assign(bounds,{left:0,top:0,right:width,bottom:height});
 const registered={frames,bounds,width,height};registeredSheets.set(source,registered);return registered;
}
export function rareFramePlacement(bounds,sourceWidth,sourceHeight,width,height){
 const center=sourceWidth/2,baseline=bounds.bottom;
 const extent=Math.max(center-bounds.left,bounds.right-center),spriteHeight=baseline-bounds.top;
 const scale=Math.min(width*.9/Math.max(1,extent*2),height*.9/Math.max(1,spriteHeight));
 return {x:width/2-center*scale,y:height*.95-baseline*scale,width:sourceWidth*scale,height:sourceHeight*scale};
}
export function drawRareMotion(ctx, rare, appearance, motion, seconds, {direction='right',ball=false,loop}={}) {
  const kind = rareKind(appearance),source=rare?.[kind]?.motions;
  if (!source) return false;
  const frame = rareMotionFrame(kind,motion,seconds,loop);
  const width=ctx.canvas.width,height=ctx.canvas.height;
  ctx.clearRect(0,0,width,height);ctx.save();ctx.imageSmoothingEnabled=false;
  if(direction==='left'){ctx.translate(width,0);ctx.scale(-1,1);}
  const registered=registerRareSheet(source,kind);
  const placement=rareFramePlacement(registered.bounds,registered.width,registered.height,width,height);
  ctx.drawImage(registered.frames[frame],placement.x,placement.y,placement.width,placement.height);
  if(ball && motion==='dribble'){
    const radius=Math.min(width,height)*.05;
    ctx.fillStyle='#f8fafc';ctx.strokeStyle='#17212e';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(width*.82,height*.90,radius,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#17212e';ctx.beginPath();ctx.arc(width*.82,height*.90,radius*.38,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();return true;
}
