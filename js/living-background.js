const app = document.querySelector('#app');

const canvas = document.createElement('canvas');
canvas.id = 'living-club-bg';
canvas.setAttribute('aria-hidden', 'true');
document.body.prepend(canvas);

const ctx = canvas.getContext('2d', { alpha: true });
ctx.imageSmoothingEnabled = false;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let width = 0;
let height = 0;
let dpr = 1;
let active = false;

const pointer = { x: .65, y: .45, tx: .65, ty: .45, seen: false };
const STATE = { IDLE:'idle', WALK:'walk', KICK:'kick', REST:'rest' };

const actors = [
  {u:.34,v:.42,starter:true},{u:.46,v:.46,starter:true},{u:.58,v:.42,starter:true},{u:.70,v:.46,starter:true},
  {u:.26,v:.30,starter:true},{u:.23,v:.67,starter:false},{u:.36,v:.70,starter:false},{u:.50,v:.66,starter:false},
  {u:.66,v:.69,starter:false},{u:.79,v:.31,starter:false},{u:.09,v:.88,starter:false,bench:true},{u:.91,v:.88,starter:false,bench:true}
].map((p,i)=>({
  id:i,u:p.u,v:p.v,homeU:p.u,homeV:p.v,targetU:p.u,targetV:p.v,
  starter:p.starter,bench:!!p.bench,state:p.bench?STATE.REST:STATE.IDLE,
  stateUntil:0,nextDecision:600+i*120,facing:i%2?1:-1,phase:i*.73
}));

function resize(){
  dpr=Math.min(devicePixelRatio||1,2);
  width=Math.max(1,innerWidth);height=Math.max(1,innerHeight);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  canvas.style.width=width+'px';canvas.style.height=height+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;
}
addEventListener('resize',resize,{passive:true});resize();

function mix(a,b,t){return a+(b-a)*t}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function clubColor(){
  return app?.querySelector('.hero[style*="--club"]')?.style.getPropertyValue('--club')?.trim()||'#4ade80';
}
function screenIsActive(){
  const main=app?.querySelector(':scope > main');
  if(!main)return false;
  if(main.classList.contains('title')||main.classList.contains('screen-title')||main.classList.contains('screen-home'))return true;
  return (main.querySelector('h2')?.textContent||'').includes('編成と戦術');
}
function refreshActive(){active=screenIsActive();document.body.classList.toggle('living-bg-active',active)}
new MutationObserver(refreshActive).observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});refreshActive();
addEventListener('pointermove',e=>{pointer.seen=true;pointer.tx=e.clientX/Math.max(1,width);pointer.ty=e.clientY/Math.max(1,height)},{passive:true});

function fieldPoint(u,v){
  const tl=[width*.14,height*.31],tr=[width*.86,height*.27],bl=[width*.10,height*.83],br=[width*.90,height*.79];
  const tx=mix(tl[0],tr[0],u),ty=mix(tl[1],tr[1],u),bx=mix(bl[0],br[0],u),by=mix(bl[1],br[1],u);
  return [mix(tx,bx,v),mix(ty,by,v)];
}
function poly(points,fill,stroke,w=1){
  ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill()} if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=w;ctx.stroke()}
}
function line(a,b,color,w=1){ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke()}
function shadow(x,y,rx,ry,a=.22){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=`rgba(0,0,0,${a})`;ctx.fill()}

function drawBackground(t){
  const accent=clubColor();
  const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#07111f');sky.addColorStop(.46,'#0d1a2b');sky.addColorStop(1,'#08111b');
  ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);

  const gx=width*mix(.35,.72,pointer.x), glow=ctx.createRadialGradient(gx,height*.18,0,gx,height*.18,width*.42);
  glow.addColorStop(0,accent+'2c');glow.addColorStop(.5,'#19324a18');glow.addColorStop(1,'#0000');
  ctx.fillStyle=glow;ctx.fillRect(0,0,width,height*.7);

  poly([[width*.05,height*.15],[width*.95,height*.15],[width*.89,height*.28],[width*.11,height*.29]],'#0f1c2b','#24384b',2);
  for(let i=0;i<22;i++){
    const x=width*(.10+i*.036),pulse=.33+.12*Math.sin(t*.0012+i*.7);
    ctx.fillStyle=`rgba(222,236,255,${pulse})`;ctx.fillRect(x,height*.195,Math.max(3,width*.006),Math.max(2,height*.006));
  }
  ctx.fillStyle='#0c1723';ctx.fillRect(width*.39,height*.17,width*.22,height*.06);
  ctx.fillStyle=accent+'d8';ctx.font=`900 ${Math.max(12,Math.min(26,width*.015))}px system-ui`;ctx.textAlign='center';
  ctx.fillText('FOOTBALL LEAGUE',width*.5,height*.212);
}
function drawPitch(){
  const p1=fieldPoint(0,0),p2=fieldPoint(1,0),p3=fieldPoint(1,1),p4=fieldPoint(0,1);
  poly([p1,p2,p3,p4],'#17683f','#8fd7a6',2);
  for(let i=0;i<9;i++){
    const v1=i/9,v2=(i+1)/9;poly([fieldPoint(0,v1),fieldPoint(1,v1),fieldPoint(1,v2),fieldPoint(0,v2)],i%2?'rgba(255,255,255,.02)':'rgba(0,0,0,.045)');
  }
  const white='rgba(240,255,245,.8)';
  poly([fieldPoint(.08,.10),fieldPoint(.92,.10),fieldPoint(.92,.90),fieldPoint(.08,.90)],null,white,2);
  line(fieldPoint(.5,.10),fieldPoint(.5,.90),white,2);
  const c=fieldPoint(.5,.5);ctx.beginPath();ctx.ellipse(c[0],c[1],width*.035,height*.025,-.03,0,Math.PI*2);ctx.strokeStyle=white;ctx.lineWidth=2;ctx.stroke();
  poly([fieldPoint(.08,.28),fieldPoint(.20,.28),fieldPoint(.20,.72),fieldPoint(.08,.72)],null,white,2);
  poly([fieldPoint(.80,.28),fieldPoint(.92,.28),fieldPoint(.92,.72),fieldPoint(.80,.72)],null,white,2);
}
function drawGoal(side){
  const left=side==='left', ft=fieldPoint(left?.08:.92,.40), fb=fieldPoint(left?.08:.92,.60), dx=left?-22:22,dy=-14;
  const bt=[ft[0]+dx,ft[1]+dy],bb=[fb[0]+dx,fb[1]+dy];
  shadow((ft[0]+fb[0])/2+(left?-8:8),(ft[1]+fb[1])/2+12,18,6,.18);
  poly([ft,bt,bb,fb],'rgba(220,240,248,.20)','rgba(210,235,245,.38)',1.5);
  line(ft,fb,'#d8edf7',3);line(bt,bb,'#d8edf7',2);line(ft,bt,'#d8edf7',2);line(fb,bb,'#d8edf7',2);
  for(let i=1;i<4;i++){
    const t=i/4;line([mix(ft[0],fb[0],t),mix(ft[1],fb[1],t)],[mix(bt[0],bb[0],t),mix(bt[1],bb[1],t)],'rgba(220,240,248,.18)',1);
  }
}
function drawBench(x,y){
  shadow(x+48,y+34,42,10,.18);
  ctx.fillStyle='#16263a';ctx.fillRect(x,y,96,32);
  ctx.fillStyle='#294461';ctx.fillRect(x+6,y-10,84,10);
  ctx.fillStyle='#203247';ctx.fillRect(x+8,y+10,80,8);
}
function ripple(t){
  if(!pointer.seen)return;const px=pointer.x*width,py=pointer.y*height;
  for(let i=0;i<3;i++){const r=24+i*16+Math.sin(t*.004+i)*2;ctx.beginPath();ctx.ellipse(px,py,r,r*.34,0,0,Math.PI*2);ctx.strokeStyle=`rgba(190,255,210,${.07-i*.016})`;ctx.lineWidth=1;ctx.stroke()}
}

function dot(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h))}
function drawPixelActor(actor,x,y,scale,t){
  const px=Math.max(1.2,Math.round(scale*1.7)),left=Math.round(x-(14*px)/2),top=Math.round(y-20*px);
  const shirt=actor.starter?clubColor():'#6b7280', skin='#e3b28a', outline='#111827';
  const hair=[ '#2b1f17','#4b2d16','#18181b'][actor.id%3], frame=Math.floor((t*.009+actor.phase)%2);
  shadow(x,y+4,8*px*.5,3.5*px*.5,.25);
  const b=(gx,gy,gw,gh,c)=>dot(left+gx*px,top+gy*px,px*gw,px*gh,c);
  const o=(gx,gy,gw,gh)=>{b(gx,gy,gw,1,outline);b(gx,gy+gh-1,gw,1,outline);b(gx,gy,1,gh,outline);b(gx+gw-1,gy,1,gh,outline)};

  if(actor.state===STATE.REST){
    o(4,3,6,6);b(5,4,4,4,skin);b(4,2,6,2,hair);o(3,9,8,5);b(4,10,6,3,shirt);b(6,13,4,1,'#fff');
    b(2,13,2,2,skin);b(10,13,2,2,skin);b(3,14,2,2,'#e5e7eb');b(9,14,2,2,'#ef4444');b(2,16,3,1,outline);b(9,16,3,1,outline);
  }else{
    o(4,1,6,6);b(5,2,4,4,skin);b(4,0,6,2,hair);b(5,3,1,1,outline);b(8,3,1,1,outline);
    o(3,7,8,6);b(4,8,6,4,shirt);b(6,8,1,4,'#0f172a');
    b(2,8+(actor.state===STATE.WALK&&frame?1:0),1,3,skin);b(11,8+(actor.state===STATE.WALK&&!frame?1:0),1,3,skin);
    o(4,13,6,3);b(5,14,4,1,'#fff');
    if(actor.state===STATE.KICK){
      b(4,16,2,3,'#e5e7eb');b(8,14,3,2,'#ef4444');b(10,16,2,1,'#ef4444');b(4,19,2,1,outline);b(10,16,2,1,outline);
    }else if(actor.state===STATE.WALK&&frame){
      b(4,15,2,4,'#e5e7eb');b(8,16,2,3,'#ef4444');b(4,19,2,1,outline);b(8,19,2,1,outline);
    }else{
      b(4,16,2,3,'#e5e7eb');b(8,15,2,4,'#ef4444');b(4,19,2,1,outline);b(8,19,2,1,outline);
    }
  }
  return {x,y,px};
}
function drawBall(x,y,s){
  shadow(x,y+4,5*s,2.4*s,.22);ctx.fillStyle='#f8fafc';ctx.beginPath();ctx.arc(x,y,4.8*s,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111827';ctx.beginPath();ctx.arc(x+1.2*s,y-.8*s,1.5*s,0,Math.PI*2);ctx.fill();
}
function chooseState(a,t){
  if(a.bench){a.state=STATE.REST;a.stateUntil=t+1800;return}
  const roll=(Math.sin(t*.001+a.id*1.97)+1)/2;
  if(roll<.28){a.state=STATE.IDLE;a.stateUntil=t+900+a.id*40;a.targetU=a.u;a.targetV=a.v}
  else{a.state=STATE.WALK;a.stateUntil=t+1700+a.id*60;a.targetU=clamp(a.homeU+Math.sin(t*.001+a.id)*.07,.10,.90);a.targetV=clamp(a.homeV+Math.cos(t*.0013+a.id*.8)*.06,.18,.82)}
}
function updateActors(t){
  for(const a of actors){
    if(a.id<=3)continue;
    if(t>a.nextDecision||t>a.stateUntil){chooseState(a,t);a.nextDecision=t+1400+(a.id%4)*180}
    if(a.state===STATE.WALK){
      const dx=a.targetU-a.u,dy=a.targetV-a.v;a.facing=dx>=0?1:-1;a.u+=dx*.02;a.v+=dy*.02;
      if(Math.hypot(dx,dy)<.006){a.state=STATE.IDLE;a.stateUntil=t+700}
    }
  }
  const drill=[[.34,.45],[.46,.50],[.58,.45],[.70,.50]];
  for(let i=0;i<4;i++){const a=actors[i];a.homeU=drill[i][0];a.homeV=drill[i][1];a.u=mix(a.u,a.homeU,.05);a.v=mix(a.v,a.homeV,.05);a.state=STATE.IDLE}
}
function drawActors(t){
  updateActors(t);
  const cycle=(t*.00022)%4,from=Math.floor(cycle),to=(from+1)%4,f=cycle-from;
  if(f<.16){actors[from].state=STATE.KICK;actors[from].facing=actors[to].u>=actors[from].u?1:-1}
  const rows=actors.map(a=>({a,p:fieldPoint(a.u,a.v)})).sort((x,y)=>x.p[1]-y.p[1]),pos=new Map();
  for(const row of rows){const s=.78+row.a.v*.78;pos.set(row.a.id,drawPixelActor(row.a,row.p[0],row.p[1],s,t))}
  const pa=pos.get(from),pb=pos.get(to);
  if(pa&&pb){const ease=f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2,bx=mix(pa.x,pb.x,ease),by=mix(pa.y-10,pb.y-10,ease)-Math.sin(Math.PI*f)*16,bs=mix(pa.px,pb.px,ease)*.12;drawBall(bx,by,bs)}
}
function drawScene(t){
  drawBackground(t);drawPitch();drawGoal('left');drawGoal('right');
  drawBench(width*.05,height*.66);drawBench(width*.83,height*.66);
  drawActors(t);ripple(t);
}
function render(t=0){
  requestAnimationFrame(render);
  if(!active||document.hidden)return;
  pointer.x=mix(pointer.x,pointer.tx,.055);pointer.y=mix(pointer.y,pointer.ty,.055);
  if(reducedMotion.matches)t=0;
  ctx.clearRect(0,0,width,height);drawScene(t);
}
requestAnimationFrame(render);
