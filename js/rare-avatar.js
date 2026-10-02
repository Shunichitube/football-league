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
export function drawRareMotion(ctx, rare, appearance, motion, seconds, {direction='right',ball=false,loop}={}) {
  const kind = rareKind(appearance), source = rare?.[kind]?.motions;
  if (!source) return false;
  const frame = rareMotionFrame(kind,motion,seconds,loop);
  const width=ctx.canvas.width,height=ctx.canvas.height;
  ctx.clearRect(0,0,width,height);ctx.save();ctx.imageSmoothingEnabled=false;
  if(direction==='left'){ctx.translate(width,0);ctx.scale(-1,1);}
  ctx.drawImage(source,(frame%4)*300,Math.floor(frame/4)*470,300,470,0,0,width,height);
  if(ball && motion==='dribble'){
    ctx.fillStyle='#f8fafc';ctx.strokeStyle='#17212e';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(width*.82,height*.90,width*.05,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#17212e';ctx.beginPath();ctx.arc(width*.82,height*.90,width*.019,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();return true;
}
