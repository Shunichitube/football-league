export const MOTIONS = {
  idle: { label: '待機', frames: [0, 1], fps: 2 },
  run: { label: '走り', frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 16 },
  dribble: { label: 'ドリブル', frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 16 },
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
  const [base, run, inbetweens, correctedSix, shoot, catchSheet, dive] = await Promise.all([
    load('../assets/avatars/player-motion-v1.png'),
    load('../assets/avatars/player-run-v3.png'),
    load('../assets/avatars/player-run-inbetweens-v1.png'),
    load('../assets/avatars/player-run-frame-six-v2.png'),
    load('../assets/avatars/player-shoot-v1.png'),
    load('../assets/avatars/keeper-catch-v1.png'),
    load('../assets/avatars/keeper-dive-v1.png')
  ]);
  return { base, run, inbetweens, correctedSix, shoot, catch: catchSheet, dive };
}
export function drawMotion(ctx, atlas, motion, seconds, { direction = 'right', ball = false, loop } = {}) {
  const index = motionFrame(motion, seconds, { loop });
  const width = ctx.canvas.width, height = ctx.canvas.height;
  const usesRun = motion === 'run' || motion === 'dribble';
  const isBetween = usesRun && index % 2 === 1;
  const sourceIndex = usesRun ? Math.floor(index / 2) : index;
  const isAction = ['shoot', 'catch', 'dive'].includes(motion);
  const sheet = isAction ? atlas[motion] : usesRun ? (index === 5 ? atlas.correctedSix : isBetween ? atlas.inbetweens : atlas.run) : atlas.base;
  const columns = usesRun || isAction ? 2 : 4;
  const cellWidth = sheet.width / columns, cellHeight = sheet.height / 2;
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
  const offsets = usesRun ? (isBetween ? [[-50,-12],[7,-8],[-48,3],[5,3]] : [[-50,0],[20,0],[-48,10],[21,11]])[sourceIndex] : actionOffsets[motion]?.[index] || [0,0];
  const dx = (width-w)/2 + offsets[0] / 627 * w;
  const dy = (height-h)/2 + offsets[1] / 627 * h + (usesRun ? height*.04 : 0);
  ctx.drawImage(sheet, (sourceIndex % columns) * cellWidth, Math.floor(sourceIndex / columns) * cellHeight, cellWidth, cellHeight, dx, dy, w, h);
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
