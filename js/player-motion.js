import {drawRareMotion} from './rare-avatar.js?v=cell-cleanup-v1';
import {loadMotionLayerAssets} from './avatar-rendering.js?v=modular-motion-v2';
import {renderMotionLayers} from './avatar-motion-layers.js?v=idle-approved-v5';
export const MOTIONS = {
  idle: { label: '待機', frames: [0, 1], fps: 2 },
  run: { label: '走り', frames: [0, 1, 2, 3], fps: 8 },
  dribble: { label: 'ドリブル', frames: [0, 1, 2, 3], fps: 8 },
  shoot: { label: '右足シュート', frames: [0, 1, 2, 3], fps: 8, loop: false },
  catch: { label: 'GKキャッチ', frames: [0, 1, 2, 3], fps: 6, loop: false },
  dive: { label: 'GK飛び込み', frames: [0, 1, 2, 3], fps: 8, loop: false }
};
export function motionFrame(motion, seconds, { loop } = {}) {
  const sequence = MOTIONS[motion] || MOTIONS.idle;
  const step = Math.floor(Math.max(0, seconds) * sequence.fps);
  return sequence.frames[(loop ?? sequence.loop ?? true) ? step % sequence.frames.length : Math.min(step, sequence.frames.length - 1)];
}
export async function loadMotionAtlas() {
  const load = async path => { const image = new Image(); image.src = new URL(path, import.meta.url).href; await image.decode(); return image; };
  const [base, run, shoot, catchSheet, dive, celebrate, celebrateArms, dejected, avatar] = await Promise.all([
    load('../assets/avatars/player-idle-redrawn-v1.png?v=idle-approved-v5'),
    load('../assets/avatars/player-run-redrawn-v1.png'),
    load('../assets/avatars/player-shoot-base-v1.png'),
    load('../assets/avatars/keeper-catch-base-v1.png'),
    load('../assets/avatars/keeper-dive-base-v1.png'),
    load('../assets/avatars/player-celebrate-base-v1.png'),
    load('../assets/avatars/player-celebrate-arms-v1.png'),
    load('../assets/avatars/keeper-dejected-base-v1.png'),
    loadMotionLayerAssets()
  ]);
  return { base, run, shoot, catch: catchSheet, dive, celebrate, celebrateArms, dejected, avatar };
}
export function drawMotion(ctx, atlas, motion, seconds, { direction = 'right', ball = false, loop, appearance, kit, goalkeeper = false, baseOnly = false } = {}) {
  if(drawRareMotion(ctx,atlas.avatar?.rare,appearance,motion,seconds,{direction,ball,loop}))return;
  const index = motionFrame(motion, seconds, { loop });
  const width = ctx.canvas.width, height = ctx.canvas.height;
  const usesRun = motion === 'run' || motion === 'dribble';
  const sourceIndex = index;
  const isAction = ['shoot', 'catch', 'dive'].includes(motion);
  const sheet = isAction ? atlas[motion] : usesRun ? atlas.run : atlas.base;
  const columns = 2;
  const cellWidth = sheet.width / columns, cellHeight = sheet.height / (usesRun || isAction ? 2 : 1);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // Mirroring a kick would change the anatomical kicking foot. Keep this right-foot view.
  if (direction === 'left' && motion !== 'shoot') { ctx.translate(width, 0); ctx.scale(-1, 1); }
  const scale = Math.min(width / cellWidth, height / cellHeight) * (usesRun || isAction ? .9 : 1);
  const w = cellWidth * scale, h = cellHeight * scale;
  // Align the independently drawn heads; retain the small airborne foot lift.
  const actionOffsets = {
    shoot: [[-35,0],[30,0],[-25,12],[10,12]],
    catch: [[-35,0],[30,0],[-25,0],[25,0]]
  };
  const offsets = usesRun ? [[-25,0],[8,0],[-25,0],[8,0]][sourceIndex] : motion === 'idle' ? [[-62,0],[63,0]][index] : actionOffsets[motion]?.[index] || [0,0];
  const dx = (width-w)/2 + offsets[0] / 627 * w;
  const dy = (height-h)/2 + offsets[1] / 627 * h + (usesRun ? height*.04 : 0);
  const personalized = renderMotionLayers(atlas, sheet, sourceIndex, columns, appearance ?? 0, {kit, goalkeeper, baseOnly});
  ctx.drawImage(personalized,0,0,personalized.width,personalized.height,dx,dy,w,h);
  if (ball && motion === 'dribble') {
    const x = width * (.82 + Math.sin(seconds * Math.PI * 5) * .025), y = dy + h*.9;
    const r = h*.052;
    ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#17212e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle = '#17212e';ctx.beginPath();
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const px=x+Math.cos(a)*r*.45,py=y+Math.sin(a)*r*.45;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
    ctx.closePath();ctx.fill();
  }
  ctx.restore();
}

