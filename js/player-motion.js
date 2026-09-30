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
// Limbs sample the approved idle sprite independently, preserving its artwork.
export function limbPose(motion, seconds) {
  const active = motion === 'run' || motion === 'dribble';
  const phase = Math.max(0, seconds) * Math.PI * 2 * (motion === 'run' ? 2 : 1.5);
  const swing = active ? Math.sin(phase) : 0;
  const reach = motion === 'run' ? .7 : .4;
  return { nearLeg: -swing * reach, farLeg: swing * reach,
    nearArm: swing * (motion === 'run' ? .6 : .3), farArm: -swing * (motion === 'run' ? .6 : .3),
    bob: active ? -Math.abs(Math.cos(phase)) * (motion === 'run' ? 5 : 2) : Math.sin(seconds*Math.PI)*1.5 };
}
export function drawMotion(ctx, atlas, motion, seconds, { direction = 'right', ball = false, debug = false } = {}) {
  const width = ctx.canvas.width, height = ctx.canvas.height;
  const pose = limbPose(motion, seconds);
  ctx.clearRect(0, 0, width, height);
  ctx.save();ctx.imageSmoothingEnabled=false;
  const scale=Math.min(width/443.5,height/443.5);
  ctx.translate(width/2,height/2);ctx.scale(direction==='left'?-scale:scale,scale);ctx.translate(-221.75,-221.75);
  // Existing atlas is normalized to its original 1774 x 887 coordinate space.
  const fx=atlas.width/1774,fy=atlas.height/887;
  function piece(region,x,y,rotation=0,offsetX=0,offsetY=0,far=false){
    ctx.save();ctx.translate(x,y+pose.bob);ctx.rotate(rotation);
    if(far)ctx.filter='brightness(0.78)';
    const [sx,sy,w,h]=region;
    ctx.drawImage(atlas,sx*fx,sy*fy,w*fx,h*fy,offsetX,offsetY,w,h);
    if(debug){ctx.strokeStyle=far?'#60a5fa':'#fb923c';ctx.lineWidth=2;ctx.strokeRect(offsetX,offsetY,w,h);}
    ctx.restore();
  }
  // Far limbs stay behind the body; near limbs stay in front.
  piece([142,365,83,73],211,365,pose.farLeg,-69,0,true);
  piece([126,268,52,90],180,275,pose.farArm,-54,-7,true);
  piece([181,257,103,120],181,257);
  piece([247,365,81,73],251,365,pose.nearLeg,-4,0);
  piece([291,268,44,90],292,275,pose.nearArm,-1,-7);
  piece([131,45,232,222],131,45);
  if(ball&&motion==='dribble'){
    const x=345+Math.sin(seconds*Math.PI*3)*7,y=414,r=20;
    ctx.fillStyle='#f8fafc';ctx.strokeStyle='#17212e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#17212e';ctx.beginPath();for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const px=x+Math.cos(a)*r*.45,py=y+Math.sin(a)*r*.45;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fill();
  }
  ctx.restore();
}
