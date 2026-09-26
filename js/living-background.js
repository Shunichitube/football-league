const app = document.querySelector('#app');

const canvas = document.createElement('canvas');
canvas.id = 'living-club-bg';
canvas.setAttribute('aria-hidden', 'true');
document.body.prepend(canvas);

const ctx = canvas.getContext('2d', { alpha: true });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let width = 0, height = 0, dpr = 1, active = false;
let pointer = { x: .68, y: .56, tx: .68, ty: .56, seen: false };

const STATE = {
  IDLE: 'idle',
  WALK: 'walk',
  KICK: 'kick',
  REST: 'rest'
};

const actors = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  u: .16 + (i % 4) * .22,
  v: .24 + Math.floor(i / 4) * .24,
  homeU: .16 + (i % 4) * .22,
  homeV: .24 + Math.floor(i / 4) * .24,
  targetU: .16 + (i % 4) * .22,
  targetV: .24 + Math.floor(i / 4) * .24,
  state: i === 10 || i === 11 ? STATE.REST : (i < 4 ? STATE.IDLE : STATE.WALK),
  stateUntil: 0,
  facing: i % 2 ? 1 : -1,
  phase: i * .67,
  starter: i < 5,
  nextDecision: 600 + i * 170
}));

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  width = Math.max(1, innerWidth);
  height = Math.max(1, innerHeight);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize, { passive: true });
resize();

function screenIsActive() {
  const main = app?.querySelector(':scope > main');
  if (!main) return false;
  if (main.classList.contains('title') || main.classList.contains('screen-title')) return true;
  if (main.classList.contains('screen-home')) return true;
  const h2 = main.querySelector('h2')?.textContent || '';
  return h2.includes('編成と戦術');
}

function refreshActive() {
  active = screenIsActive();
  document.body.classList.toggle('living-bg-active', active);
}
new MutationObserver(refreshActive).observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
refreshActive();

addEventListener('pointermove', e => {
  pointer.seen = true;
  pointer.tx = e.clientX / Math.max(1, width);
  pointer.ty = e.clientY / Math.max(1, height);
}, { passive: true });

function mix(a,b,t){ return a + (b-a)*t; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

function clubColor() {
  const hero = app?.querySelector('.hero[style*="--club"]');
  const value = hero?.style.getPropertyValue('--club')?.trim();
  return value || '#4ade80';
}

function poly(points, fill, stroke, lineWidth=1) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i=1;i<points.length;i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function line(x1,y1,x2,y2,stroke,w=1){
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=stroke;ctx.lineWidth=w;ctx.stroke();
}

function courtPoint(u,v) {
  const topY = height * .24, bottomY = height * .95;
  const topLeft = width * .20, topRight = width * .80;
  const bottomLeft = width * -.07, bottomRight = width * 1.07;
  const left = mix(topLeft,bottomLeft,v);
  const right = mix(topRight,bottomRight,v);
  return [mix(left,right,u), mix(topY,bottomY,v)];
}

function drawEnvironment(t) {
  const accent = clubColor();
  const sky = ctx.createLinearGradient(0,0,0,height);
  sky.addColorStop(0,'#07111f');
  sky.addColorStop(.48,'#0d1a2b');
  sky.addColorStop(1,'#08111b');
  ctx.fillStyle = sky;
  ctx.fillRect(0,0,width,height);

  const glowX = width * mix(.35,.72,pointer.x);
  const glow = ctx.createRadialGradient(glowX,height*.18,0,glowX,height*.18,width*.46);
  glow.addColorStop(0, accent + '28');
  glow.addColorStop(.48,'#16304b18');
  glow.addColorStop(1,'#0000');
  ctx.fillStyle = glow;
  ctx.fillRect(0,0,width,height*.72);

  // compact club-house / stand
  poly([[width*.06,height*.15],[width*.94,height*.15],[width*.86,height*.37],[width*.14,height*.37]],'#111d2b','#2b4055',2);
  for(let i=0;i<18;i++){
    const x=width*(.12+i*.045);
    const pulse=.40+.18*Math.sin(t*.0011+i*.9);
    ctx.fillStyle=`rgba(220,235,255,${pulse})`;
    ctx.fillRect(x,height*.202,Math.max(4,width*.008),Math.max(3,height*.007));
  }
  ctx.fillStyle='#0c1723';
  ctx.fillRect(width*.38,height*.18,width*.24,height*.08);
  ctx.fillStyle=accent+'d8';
  ctx.font=`900 ${Math.max(13,Math.min(30,width*.018))}px system-ui`;
  ctx.textAlign='center';
  ctx.fillText('FOOTBALL LEAGUE',width*.5,height*.23);

  const a=courtPoint(0,0), b=courtPoint(1,0), c=courtPoint(1,1), d=courtPoint(0,1);
  poly([a,b,c,d],'#17683f','#9de1b8',2);

  for(let i=0;i<10;i++){
    const v1=i/10, v2=(i+1)/10;
    const p1=courtPoint(0,v1),p2=courtPoint(1,v1),p3=courtPoint(1,v2),p4=courtPoint(0,v2);
    poly([p1,p2,p3,p4],i%2?'rgba(255,255,255,.022)':'rgba(0,0,0,.05)');
  }

  const white='rgba(240,255,245,.78)';
  const l1=courtPoint(.08,.09),l2=courtPoint(.92,.09),l3=courtPoint(.92,.9),l4=courtPoint(.08,.9);
  poly([l1,l2,l3,l4],null,white,2);
  const m1=courtPoint(.08,.5),m2=courtPoint(.92,.5); line(m1[0],m1[1],m2[0],m2[1],white,2);
  const center=courtPoint(.5,.5);
  ctx.beginPath();ctx.ellipse(center[0],center[1],Math.max(22,width*.047),Math.max(10,height*.023),0,0,Math.PI*2);ctx.strokeStyle=white;ctx.lineWidth=2;ctx.stroke();

  // goals
  const goalTop=courtPoint(.42,.09), goalTopR=courtPoint(.58,.09);
  line(goalTop[0],goalTop[1],goalTop[0],goalTop[1]-22,'#d7eef5',3);
  line(goalTopR[0],goalTopR[1],goalTopR[0],goalTopR[1]-22,'#d7eef5',3);
  line(goalTop[0],goalTop[1]-22,goalTopR[0],goalTopR[1]-22,'#d7eef5',3);

  // benches
  const benchY=height*.58;
  for (const x of [width*.045,width*.835]) {
    ctx.fillStyle='#16263a';ctx.fillRect(x,benchY,width*.12,height*.072);
    ctx.fillStyle='#2c4765';ctx.fillRect(x+.006*width,benchY-height*.018,width*.108,height*.02);
  }

  if(pointer.seen){
    const px=pointer.x*width, py=pointer.y*height;
    for(let r=0;r<3;r++){
      const rr=30+r*22+Math.sin(t*.004+r)*3;
      ctx.beginPath();ctx.ellipse(px,py,rr,rr*.34,0,0,Math.PI*2);
      ctx.strokeStyle=`rgba(190,255,210,${.08-r*.018})`;ctx.lineWidth=1.1;ctx.stroke();
    }
  }
}

// Draws a small sprite frame to an offscreen canvas.
// The gameplay canvas then renders this like a sprite sheet frame.
const spriteCanvas = document.createElement('canvas');
spriteCanvas.width = 128 * 4;
spriteCanvas.height = 160 * 2;
const sctx = spriteCanvas.getContext('2d');

function drawSpriteFrame(frameX,row,state,starter=true){
  const ox=frameX*128, oy=row*160;
  const accent=clubColor();
  const px=4;
  const bob = state===STATE.WALK && frameX%2 ? 4 : 0;
  const kick = state===STATE.KICK;
  const rest = state===STATE.REST;

  sctx.clearRect(ox,oy,128,160);
  sctx.save();
  sctx.translate(ox+64,oy+92+bob);

  // shadow
  sctx.fillStyle='rgba(0,0,0,.35)';
  sctx.beginPath();sctx.ellipse(0,42,25,8,0,0,Math.PI*2);sctx.fill();

  // legs
  sctx.fillStyle='#d7aa82';
  if(rest){
    sctx.fillRect(-16,18,12,10);sctx.fillRect(4,18,12,10);
    sctx.fillRect(-22,27,20,8);sctx.fillRect(2,27,20,8);
  }else{
    const step=state===STATE.WALK ? (frameX%2?10:-10) : 0;
    sctx.fillRect(-15+step*.25,18,10,23);
    sctx.fillRect(5-step*.25,18,10,23);
    if(kick){sctx.fillRect(11,18,10,9);sctx.fillRect(18,23,27,9);}
  }

  // shoes
  sctx.fillStyle='#121826';
  if(rest){
    sctx.fillRect(-25,33,22,7);sctx.fillRect(3,33,22,7);
  }else{
    sctx.fillRect(-18,38,15,7);
    sctx.fillRect(kick?34:3,kick?28:38,15,7);
  }

  // shirt / shorts
  sctx.fillStyle=starter?accent:'#64748b';
  sctx.fillRect(-23,-18,46,40);
  sctx.fillStyle='rgba(255,255,255,.78)';
  sctx.fillRect(-3,-12,6,20);
  sctx.fillStyle='#182234';
  sctx.fillRect(-20,20,40,13);

  // arms
  sctx.fillStyle='#d7aa82';
  const armSwing=state===STATE.WALK ? (frameX%2?7:-7) : 0;
  sctx.fillRect(-31,-12+armSwing*.15,8,28);
  sctx.fillRect(23,-12-armSwing*.15,8,28);

  // head
  sctx.fillStyle='#dfb58f';
  sctx.fillRect(-15,-48,30,27);
  sctx.fillStyle='#1b2430';
  sctx.fillRect(-16,-52,32,10);
  sctx.fillRect(-18,-48,6,12);

  // simple face
  sctx.fillStyle='#111827';
  sctx.fillRect(-8,-37,3,3);sctx.fillRect(6,-37,3,3);

  // highlight / outline
  sctx.strokeStyle='rgba(255,255,255,.28)';
  sctx.lineWidth=2;
  sctx.strokeRect(-23,-18,46,40);

  sctx.restore();
}

function rebuildSpriteSheet(){
  for(let row=0;row<2;row++){
    for(let frame=0;frame<4;frame++){
      const states=[STATE.IDLE,STATE.WALK,STATE.KICK,STATE.REST];
      drawSpriteFrame(frame,row,states[frame],row===0);
    }
  }
}

function spriteFrameFor(state,t,actor){
  if(state===STATE.WALK) return Math.floor((t*.008+actor.phase)%2) ? 1 : 0;
  if(state===STATE.KICK) return 2;
  if(state===STATE.REST) return 3;
  return 0;
}

function drawActor(actor,t){
  const [x,y]=courtPoint(actor.u,actor.v);
  const depthScale=.92 + actor.v*.95;
  const drawW=78*depthScale;
  const drawH=98*depthScale;
  const frame=spriteFrameFor(actor.state,t,actor);

  ctx.save();
  ctx.translate(x,y);
  ctx.scale(actor.facing,1);
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(spriteCanvas,frame*128,actor.starter?0:160,128,160,-drawW/2,-drawH+12,drawW,drawH);
  ctx.restore();
  return {x,y,scale:depthScale};
}

function chooseNewState(actor,t){
  if(actor.id===10 || actor.id===11){
    actor.state=STATE.REST;
    actor.stateUntil=t+2500;
    actor.targetU=actor.id===10?.15:.85;
    actor.targetV=.68;
    return;
  }
  const roll=(Math.sin(t*.001+actor.id*2.13)+1)/2;
  if(roll<.2){
    actor.state=STATE.IDLE;
    actor.stateUntil=t+1000+actor.id*90;
    actor.targetU=actor.u;actor.targetV=actor.v;
  }else{
    actor.state=STATE.WALK;
    actor.stateUntil=t+1700+actor.id*60;
    const du=Math.sin(t*.0009+actor.id)*.08;
    const dv=Math.cos(t*.0011+actor.id*.7)*.06;
    actor.targetU=clamp(actor.homeU+du,.11,.89);
    actor.targetV=clamp(actor.homeV+dv,.15,.84);
  }
}

function updateActors(t){
  for(const actor of actors){
    if(t>actor.nextDecision || t>actor.stateUntil){
      chooseNewState(actor,t);
      actor.nextDecision=t+1400+(actor.id%4)*330;
    }
    if(actor.state===STATE.WALK){
      const dx=actor.targetU-actor.u, dy=actor.targetV-actor.v;
      actor.facing=dx>=0?1:-1;
      actor.u+=dx*.018;
      actor.v+=dy*.018;
      if(Math.hypot(dx,dy)<.008){ actor.state=STATE.IDLE; actor.stateUntil=t+900; }
    }
  }
}

function drawBall(x,y,scale){
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='#f8fafc';ctx.beginPath();ctx.arc(0,0,5.5*scale,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111827';ctx.beginPath();ctx.arc(1.5*scale,-1*scale,1.8*scale,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawActorsAndBall(t){
  updateActors(t);

  // Force first four into a passing drill.
  const cycle=(t*.00022)%4;
  const from=Math.floor(cycle), to=(from+1)%4, f=cycle-from;
  const kicker=actors[from];
  if(f<.16){ kicker.state=STATE.KICK; kicker.stateUntil=t+150; }
  actors.slice(0,4).forEach((a,i)=>{ if(i!==from && a.state===STATE.REST) a.state=STATE.IDLE; });

  const rendered=actors
    .map(actor=>({actor,point:courtPoint(actor.u,actor.v)}))
    .sort((a,b)=>a.point[1]-b.point[1]);

  const positions=new Map();
  for(const row of rendered){
    positions.set(row.actor.id,drawActor(row.actor,t));
  }

  const a=positions.get(from), b=positions.get(to);
  if(a&&b){
    const ease=f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2;
    const bx=mix(a.x,b.x,ease);
    const by=mix(a.y,b.y,ease)-Math.sin(Math.PI*f)*20;
    drawBall(bx,by,mix(a.scale,b.scale,ease));
  }
}

function render(t=0) {
  requestAnimationFrame(render);
  if(!active || document.hidden) return;
  pointer.x=mix(pointer.x,pointer.tx,.055);
  pointer.y=mix(pointer.y,pointer.ty,.055);
  if(reducedMotion.matches) t=0;
  rebuildSpriteSheet();
  ctx.clearRect(0,0,width,height);
  drawEnvironment(t);
  drawActorsAndBall(t);
}
requestAnimationFrame(render);
