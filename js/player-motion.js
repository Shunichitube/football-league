export const MOTIONS = {
  idle: { label: '待機', frames: [0, 1], fps: 2 },
  run: { label: '走り', frames: [2, 3, 4, 5], fps: 8 },
  dribble: { label: 'ドリブル', frames: [6, 7], fps: 5 }
};
export function motionFrame(motion, seconds) {
  const sequence = MOTIONS[motion] || MOTIONS.idle;
  return sequence.frames[Math.floor(Math.max(0, seconds) * sequence.fps) % sequence.frames.length];
}
export async function loadMotionAtlas() {
  const atlas = new Image();
  atlas.src = new URL('../assets/avatars/player-motion-v1.png', import.meta.url).href;
  await atlas.decode();
  return atlas;
}
export function drawMotion(ctx, atlas, motion, seconds, { direction = 'right', ball = false } = {}) {
  const index = motionFrame(motion, seconds);
  const width = ctx.canvas.width, height = ctx.canvas.height;
  const cellWidth = atlas.width / 4, cellHeight = atlas.height / 2;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (direction === 'left') { ctx.translate(width, 0); ctx.scale(-1, 1); }
  const scale = Math.min(width / cellWidth, height / cellHeight);
  const w = cellWidth * scale, h = cellHeight * scale;
  ctx.drawImage(atlas, (index % 4) * cellWidth, Math.floor(index / 4) * cellHeight, cellWidth, cellHeight, (width-w)/2, (height-h)/2, w, h);
  if (ball && motion === 'dribble') {
    const x = width * (.73 + Math.sin(seconds * Math.PI * 5) * .025), y = (height-h)/2 + h*.88;
    const r = h*.052;
    ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#17212e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle = '#17212e';ctx.beginPath();
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const px=x+Math.cos(a)*r*.45,py=y+Math.sin(a)*r*.45;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
    ctx.closePath();ctx.fill();
  }
  ctx.restore();
}
