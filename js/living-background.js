const app = document.querySelector('#app');

const canvas = document.createElement('canvas');
canvas.id = 'living-club-bg';
canvas.setAttribute('aria-hidden', 'true');
document.body.prepend(canvas);

const ctx = canvas.getContext('2d', { alpha: true });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let width = 0, height = 0, dpr = 1, raf = 0, last = 0, active = false;
let pointer = { x: .68, y: .56, tx: .68, ty: .56, seen: false };

const players = Array.from({ length: 12 }, (_, i) => ({
  phase: (i * .73) % (Math.PI * 2),
  lane: i % 4,
  row: Math.floor(i / 4),
  shirt: i < 5 ? 'starter' : 'bench',
  pace: .65 + (i % 5) * .08
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
  const topY = height * .24, bottomY = height * .94;
  const topLeft = width * .21, topRight = width * .79;
  const bottomLeft = width * -.06, bottomRight = width * 1.06;
  const left = mix(topLeft,bottomLeft,v);
  const right = mix(topRight,bottomRight,v);
  return [mix(left,right,u), mix(topY,bottomY,v)];
}

function drawStadiumBase(t) {
  const accent = clubColor();
  const sky = ctx.createLinearGradient(0,0,0,height);
  sky.addColorStop(0,'#07111f');
  sky.addColorStop(.48,'#0d1a2b');
  sky.addColorStop(1,'#08111b');
  ctx.fillStyle = sky;
  ctx.fillRect(0,0,width,height);

  const glowX = width * mix(.35,.72,pointer.x);
  const glow = ctx.createRadialGradient(glowX,height*.18,0,glowX,height*.18,width*.46);
  glow.addColorStop(0, accent + '25');
  glow.addColorStop(.45,'#16304b18');
  glow.addColorStop(1,'#0000');
  ctx.fillStyle = glow;
  ctx.fillRect(0,0,width,height*.72);

  // distant club house / stand
  poly([[width*.06,height*.16],[width*.94,height*.16],[width*.86,height*.38],[width*.14,height*.38]],'#111d2b','#26394d',2);
  for(let i=0;i<18;i++){
    const x=width*(.12+i*.045);
    const pulse=.42+.2*Math.sin(t*.0012+i*.9);
    ctx.fillStyle=`rgba(214,231,255,${pulse})`;
    ctx.fillRect(x,height*.205,Math.max(3,width*.008),Math.max(2,height*.006));
  }
  ctx.fillStyle='#0c1723';
  ctx.fillRect(width*.39,height*.185,width*.22,height*.075);
  ctx.fillStyle=accent+'bb';
  ctx.font=`800 ${Math.max(12,Math.min(28,width*.018))}px system-ui`;
  ctx.textAlign='center';
  ctx.fillText('FOOTBALL LEAGUE',width*.5,height*.233);

  const a=courtPoint(0,0), b=courtPoint(1,0), c=courtPoint(1,1), d=courtPoint(0,1);
  poly([a,b,c,d],'#155f3a','#8ed0a5',2);

  // grass stripes
  for(let i=0;i<10;i++){
    const v1=i/10, v2=(i+1)/10;
    const p1=courtPoint(0,v1),p2=courtPoint(1,v1),p3=courtPoint(1,v2),p4=courtPoint(0,v2);
    poly([p1,p2,p3,p4],i%2?'rgba(255,255,255,.018)':'rgba(0,0,0,.045)');
  }

  // pitch markings
  const white='rgba(235,255,241,.76)';
  const l1=courtPoint(.08,.09),l2=courtPoint(.92,.09),l3=courtPoint(.92,.9),l4=courtPoint(.08,.9);
  poly([l1,l2,l3,l4],null,white,2);
  const m1=courtPoint(.08,.5),m2=courtPoint(.92,.5); line(m1[0],m1[1],m2[0],m2[1],white,2);
  const center=courtPoint(.5,.5);
  ctx.beginPath();ctx.ellipse(center[0],center[1],Math.max(18,width*.045),Math.max(8,height*.022),0,0,Math.PI*2);ctx.strokeStyle=white;ctx.lineWidth=2;ctx.stroke();

  // benches
  const benchY=height*.57;
  ctx.fillStyle='#172538';ctx.fillRect(width*.04,benchY,width*.12,height*.07);
  ctx.fillStyle='#263c55';ctx.fillRect(width*.045,benchY-height*.015,width*.11,height*.018);
  ctx.fillStyle='#172538';ctx.fillRect(width*.84,benchY,width*.12,height*.07);
  ctx.fillStyle='#263c55';ctx.fillRect(width*.845,benchY-height*.015,width*.11,height*.018);

  // subtle cursor ripple over the field
  if(pointer.seen){
    const px=pointer.x*width, py=pointer.y*height;
    for(let r=0;r<3;r++){
      const rr=34+r*24+Math.sin(t*.004+r)*4;
      ctx.beginPath();ctx.ellipse(px,py,rr,rr*.34,0,0,Math.PI*2);
      ctx.strokeStyle=`rgba(190,255,210,${.09-r*.02})`;ctx.lineWidth=1.2;ctx.stroke();
    }
  }
}

function drawMiniPlayer(x,y,scale,color,phase,starter=true) {
  const bob = Math.sin(phase)*scale*.8;
  ctx.save();
  ctx.translate(x,y+bob);
  ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=5;
  ctx.fillStyle='rgba(0,0,0,.28)';
  ctx.beginPath();ctx.ellipse(0,scale*8,scale*6,scale*2.2,0,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;

  // legs
  ctx.strokeStyle='#d7b08b';ctx.lineWidth=Math.max(1.5,scale*1.9);
  line(-scale*2,scale*4,-scale*3.5,scale*8,'#d7b08b',scale*1.7);
  line(scale*2,scale*4,scale*3.5,scale*8,'#d7b08b',scale*1.7);

  // body
  ctx.fillStyle=starter?color:'#475569';
  ctx.fillRect(-scale*5,-scale*5,scale*10,scale*10);
  ctx.fillStyle='rgba(255,255,255,.72)';
  ctx.fillRect(-scale*.8,-scale*3,scale*1.6,scale*5);

  // head
  ctx.fillStyle='#dfb58f';
  ctx.beginPath();ctx.arc(0,-scale*9,scale*3.6,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#18202a';
  ctx.beginPath();ctx.arc(0,-scale*10,scale*3.7,Math.PI,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawBall(x,y,scale){
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='#f8fafc';ctx.beginPath();ctx.arc(0,0,scale*3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111827';ctx.beginPath();ctx.arc(scale*.7,-scale*.4,scale*.9,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawPlayers(t) {
  const accent=clubColor();
  const positions=[];
  for(let i=0;i<players.length;i++){
    const p=players[i], tt=t*.001*p.pace+p.phase;
    const baseU=.18+(p.lane*.21);
    const baseV=.22+(p.row*.24);
    const roam=.028;
    const u=clamp(baseU+Math.sin(tt*.73+i)*roam,.09,.91);
    const v=clamp(baseV+Math.cos(tt*.61+i*.4)*roam,.11,.88);
    const [x,y]=courtPoint(u,v);
    const scale=.52+v*.8;
    positions.push({x,y,scale});
    drawMiniPlayer(x,y,scale,accent,tt*3,p.shirt==='starter');
  }

  // looped passing ball among the first four players
  const cycle=(t*.00018)%4, from=Math.floor(cycle), to=(from+1)%4, f=cycle-from;
  const ease=f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2;
  const a=positions[from], b=positions[to];
  if(a&&b){
    const bx=mix(a.x,b.x,ease), by=mix(a.y,b.y,ease)-Math.sin(Math.PI*f)*28;
    drawBall(bx,by,mix(a.scale,b.scale,ease));
  }
}

function render(t=0) {
  raf=requestAnimationFrame(render);
  if(!active) return;
  if(document.hidden) return;
  pointer.x=mix(pointer.x,pointer.tx,.055);
  pointer.y=mix(pointer.y,pointer.ty,.055);
  if (reducedMotion.matches) t=0;
  ctx.clearRect(0,0,width,height);
  drawStadiumBase(t);
  drawPlayers(t);
}
raf=requestAnimationFrame(render);

addEventListener('visibilitychange',()=>{ last=performance.now(); });
