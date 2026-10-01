import { pixelTexture } from './arena-characters.js?v=appearance-v21';
// Presentation only: no game, random-generator or storage imports.
export const ARENA = Object.freeze({ width: 1672, height: 941 });
export function arenaTransform(width, height) {
  const scale = Math.max(width / ARENA.width, height / ARENA.height);
  return { scale, x: (width - ARENA.width * scale) / 2, y: (height - ARENA.height * scale) / 2 };
}
export function exhibitionAt(seconds) {
  const t = seconds % 18;
  const points = [[570,620],[725,687],[850,650],[1447,578]];
  let from=points[0],to=points[0],progress=0,phase='idle';
  if(t>=2&&t<5){phase='move';to=[605,640];progress=(t-2)/3;}
  if(t>=5&&t<8){phase='pass';from=[605,640];to=points[1];progress=(t-5)/3;}
  if(t>=8&&t<11){phase='pass';from=points[1];to=points[2];progress=(t-8)/3;}
  if(t>=11&&t<12.5){phase='shoot';from=points[2];to=points[3];progress=(t-11)/1.5;}
  if(t>=12.5&&t<15){phase='save';from=points[3];to=[1390,615];progress=(t-12.5)/2.5;}
  if(t>=15){phase='reset';from=[1390,615];to=points[0];progress=(t-15)/3;}
  return { phase, ball:[from[0]+(to[0]-from[0])*progress,from[1]+(to[1]-from[1])*progress], keeper: t>=11&&t<15 ? Math.sin((t-11)/4*Math.PI)*15 : 0 };
}

const makeCanvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const supporterColors=['#68a9e0','#eb9e61','#81c6a0','#e18fa8','#ba9ce0','#e6c66a'];
function spectator(index){return pixelTexture(supporterColors[index%6],index,index%2===0?'woman':'man');}

// A native 16px football sprite, matching the outlined character artwork.
function footballTexture(){
  const ball=makeCanvas(16,16),c=ball.getContext('2d');
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const radius=Math.hypot(x-7.5,y-7.5);
    if(radius>7.5)continue;
    c.fillStyle=radius>6.4?'#172838':y>10?'#aabcc5':x<7&&y<7?'#ffffff':'#e8f2ef';
    c.fillRect(x,y,1,1);
  }
  const panel=(points)=>{c.fillStyle='#172838';c.beginPath();c.moveTo(...points[0]);for(const point of points.slice(1))c.lineTo(...point);c.closePath();c.fill();};
  panel([[7,5],[10,6],[10,9],[7,11],[5,8]]);
  panel([[3,2],[6,1],[6,3],[3,5]]);
  panel([[12,3],[14,5],[13,8],[11,6]]);
  panel([[2,9],[4,10],[5,13],[3,13]]);
  panel([[10,12],[13,11],[12,14],[9,14]]);
  c.fillStyle='#ffffff';c.fillRect(5,4,2,1);c.fillRect(3,6,1,2);
  return ball;
}

export async function mountArena(canvas){
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)return ()=>{};
  const images={};
  const backdrop=new Image();
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Home arena image timed out')),15000);
    backdrop.onload=()=>{clearTimeout(timeout);resolve();};
    backdrop.onerror=()=>{clearTimeout(timeout);reject(new Error('Home arena image failed'));};
    backdrop.src=new URL('../assets/arena/home-arena-v2.webp',import.meta.url).href;
  });
  const kits=['#4ade80','#64748b'];
  const sprites=Array.from({length:20},(_,i)=>pixelTexture(kits[Math.floor(i/5)%2],i));
  const ballSprite=footballTexture();
  // Both keepers stand inside the court, clear of the projected goal mouths.
  const players=[[225,555],[460,568],[570,590],[725,645],[850,610],[1447,555],[1118,564],[967,594],[1235,668],[1058,710]];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,last=0,clock=0,previous=0,paused=false,dead=false;
  const W=ARENA.width,H=ARENA.height;
  let view;
  function resize(){
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);
    view=arenaTransform(innerWidth,innerHeight);
    document.documentElement.style.setProperty('--arena-scale',view.scale);
    document.documentElement.style.setProperty('--arena-y',`${view.y}px`);
    paint(clock);
  }
  function shadow(x,y,s){ctx.fillStyle='#03152250';ctx.beginPath();ctx.ellipse(x,y,12*s,3*s,0,0,Math.PI*2);ctx.fill();}
  function actor(i,x,y,s,t,seated=false){
    shadow(x,y,s);
    const bob=seated?0:Math.sin(t*5+i)*.8;
    const sprite=sprites[i%20],left=Math.round(x-12*s),top=Math.round(y-(seated?28:32)*s+bob);
    if(seated||i===0||i===5){ctx.drawImage(sprite,left,top,24*s,(seated?28:32)*s);}
    else{
      // Source dimensions follow the renderer; destination coordinates retain the scene layout.
      const split=sprite.height*.75,half=sprite.width/2,legs=sprite.height-split;
      ctx.drawImage(sprite,0,0,sprite.width,split,left,top,24*s,24*s);
      const kick=i===4&&t%18>=11&&t%18<11.6;
      const stride=Math.sin(t*5+i)*1.5*s;
      ctx.drawImage(sprite,0,split,half,legs,left-stride,top+24*s,12*s,8*s);
      ctx.drawImage(sprite,half,split,half,legs,left+12*s+(kick?6*s:stride),top+(kick?21:24)*s,12*s,8*s);
    }
  }
  function paint(t){
    if(!view||dead)return;
    const dpr=canvas.width/innerWidth;
    ctx.setTransform(dpr*view.scale,0,0,dpr*view.scale,dpr*view.x,dpr*view.y);
    // Spectators, dugouts, staff, goals and lighting are baked into the selected art.
    ctx.imageSmoothingEnabled=true;ctx.drawImage(backdrop,0,0,W,H);
    ctx.imageSmoothingEnabled=false;
    const play=exhibitionAt(t);
    const actors=players.map(([x,y],i)=>{
      if(i===2&&t%18>=2&&t%18<5){const f=(t%18-2)/3;x+=35*f;y+=20*f;}
      else if(i!==0&&i!==5){x+=Math.sin(t*.65+i)*8;y+=Math.sin(t*.4+i)*3;}
      if(i===5)y+=play.keeper;
      return {i,x,y};
    }).sort((a,b)=>a.y-b.y);
    for(const p of actors)actor(p.i,p.x,p.y,.96+(p.y-530)/520,t);
    const [bx,ballY]=play.ball;
    const by=ballY-30;
    const lift=play.phase==='shoot'?Math.sin((t%18-11)/1.5*Math.PI)*8:Math.abs(Math.sin(t*8))*1.2;
    ctx.save();ctx.translate(bx+2,by+1);ctx.scale(1,.3);
    const ballShadow=ctx.createRadialGradient(0,0,1,0,0,11+lift*.25);
    ballShadow.addColorStop(0,'#001c18a8');ballShadow.addColorStop(.55,'#001c185c');ballShadow.addColorStop(1,'#001c1800');
    ctx.fillStyle=ballShadow;ctx.beginPath();ctx.arc(0,0,11+lift*.25,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.drawImage(ballSprite,Math.round(bx-8),Math.round(by-16-lift),16,16);
    canvas.dataset.phase=play.phase;
  }
  function tick(now){
    frame=0;
    if(dead||document.hidden||paused||reduce.matches)return;
    if(previous)clock+=Math.min((now-previous)/1000,.1);
    previous=now;
    if(now-last>=1000/30){paint(clock);last=now;}
    frame=requestAnimationFrame(tick);
  }
  function schedule(){cancelAnimationFrame(frame);previous=0;paint(clock);if(!document.hidden&&!paused&&!reduce.matches)frame=requestAnimationFrame(tick);}
  function visibility(){schedule();}
  function toggle(event){
    const button=event.target.closest('[data-arena-motion]');if(!button)return;
    paused=!paused;button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'演出を再生':'演出を一時停止';schedule();
  }
  addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',visibility);
  document.addEventListener('click',toggle);reduce.addEventListener('change',schedule);
  resize();schedule();canvas.dataset.ready='true';
  return ()=>{dead=true;cancelAnimationFrame(frame);removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('click',toggle);reduce.removeEventListener('change',schedule);};
}
