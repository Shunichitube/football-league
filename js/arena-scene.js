import {loadMotionAtlas,drawMotion} from './player-motion.js?v=appearance-v25';
import { pixelTexture } from './arena-characters.js?v=appearance-v25';
// Presentation only: no game, random-generator or storage imports.
export const ARENA = Object.freeze({ width: 1672, height: 941 });
export function arenaTransform(width, height) {
  const scale = Math.max(width / ARENA.width, height / ARENA.height);
  return { scale, x: (width - ARENA.width * scale) / 2, y: (height - ARENA.height * scale) / 2 };
}
export function exhibitionAt(seconds) {
  const t=seconds%22;
  const interpolate=(a,b,f)=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
  let phase='idle',owner=2,ball=[580,590],keeper=0;
  if(t>=2&&t<5){phase='dribble';ball=[580+35*(t-2)/3,590+20*(t-2)/3];}
  else if(t>=5&&t<7){phase='pass';owner=null;ball=interpolate([615,610],[735,645],(t-5)/2);}
  else if(t>=7&&t<8){owner=3;ball=[735,645];}
  else if(t>=8&&t<10){phase='pass';owner=null;ball=interpolate([735,645],[860,610],(t-8)/2);}
  else if(t>=10&&t<11){owner=4;ball=[860,610];}
  else if(t>=11&&t<11.5){phase='shoot';owner=4;ball=[860,610];}
  else if(t>=11.5&&t<13){phase='flight';owner=null;ball=interpolate([860,610],[1447,555],(t-11.5)/1.5);}
  else if(t>=13&&t<14){phase='save';owner=5;ball=[1447,555];keeper=Math.sin((t-13)*Math.PI)*8;}
  else if(t>=14&&t<15){phase='held';owner=5;ball=[1447,555];}
  else if(t>=15&&t<18){phase='return';owner=null;ball=interpolate([1447,555],[580,590],(t-15)/3);}
  return {phase,owner,ball,keeper};
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
  const atlas=await loadMotionAtlas();
  const backdrop=new Image();
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Home arena image timed out')),15000);
    backdrop.onload=()=>{clearTimeout(timeout);resolve();};
    backdrop.onerror=()=>{clearTimeout(timeout);reject(new Error('Home arena image failed'));};
    backdrop.src=new URL('../assets/arena/home-arena-v2.webp',import.meta.url).href;
  });
  const kits=['#4ade80','#64748b'];
  const motionCanvases=Array.from({length:10},()=>makeCanvas(300,300));
  const directions=Array.from({length:10},(_,i)=>i<5?'right':'left');
  const positions=Array(10).fill(null);
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
  function actor(i,x,y,scale,t,motion,direction){
    const sprite=motionCanvases[i];
    const goalkeeper=i===0||i===5;
    drawMotion(sprite.getContext('2d'),atlas,motion,t,{direction,appearance:{seed:i,hairStyle:i%20,hairColor:i%2?1:0},kit:kits[i<5?0:1],goalkeeper,loop:motion!=='shoot'&&motion!=='catch',ball:false});
    shadow(x,y,scale);
    const size=46*scale;
    ctx.drawImage(sprite,x-size/2,y-size,size,size);
  }
  function paint(t){
    if(!view||dead)return;
    const dpr=canvas.width/innerWidth;
    ctx.setTransform(dpr*view.scale,0,0,dpr*view.scale,dpr*view.x,dpr*view.y);
    // Spectators, dugouts, staff, goals and lighting are baked into the selected art.
    ctx.imageSmoothingEnabled=true;ctx.drawImage(backdrop,0,0,W,H);
    ctx.imageSmoothingEnabled=false;
    const play=exhibitionAt(t);
    const cycle=t%22;
    const actors=players.map(([x,y],i)=>{
      let motion='idle',motionTime=t;
      if(i===2){
        if(cycle>=2&&cycle<5){const f=(cycle-2)/3;x+=35*f;y+=20*f;motion='dribble';}
        else if(cycle>=5&&cycle<18){x+=35;y+=20;}
        else if(cycle>=18&&cycle<20){const f=1-(cycle-18)/2;x+=35*f;y+=20*f;motion='run';}
      }
      if([1,6,7,8,9].includes(i)){
        const start=3+(i%3),end=start+3;
        if(cycle>=start&&cycle<end){x+=28*(cycle-start)/3;motion='run';}
        else if(cycle>=end&&cycle<16)x+=28;
        else if(cycle>=16&&cycle<19){x+=28*(1-(cycle-16)/3);motion='run';}
      }
      if(i===4&&cycle>=11&&cycle<11.5){motion='shoot';motionTime=cycle-11;directions[i]='right';}
      if(i===5&&cycle>=13&&cycle<14){motion='catch';motionTime=cycle-13;y+=play.keeper;directions[i]='left';}
      const old=positions[i];
      if(old&&Math.abs(x-old.x)>.001)directions[i]=x>old.x?'right':'left';
      else if(motion==='idle'&&play.owner!==i&&Math.abs(play.ball[0]-x)>20)directions[i]=play.ball[0]>x?'right':'left';
      positions[i]={x,y};return {i,x,y,motion,motionTime,direction:directions[i]};
    }).sort((a,b)=>a.y-b.y);
    for(const p of actors)actor(p.i,p.x,p.y,.96+(p.y-530)/520,p.motionTime,p.motion,p.direction);
    let [bx,ballY]=play.ball;
    if(play.owner===2){const owner=positions[2];bx=owner.x+10;ballY=owner.y;}
    const by=ballY;
    const lift=play.phase==='flight'?Math.sin((cycle-11.5)/1.5*Math.PI)*8:Math.abs(Math.sin(t*8))*1.2;
    ctx.save();ctx.translate(bx+2,by+1);ctx.scale(1,.3);
    const ballShadow=ctx.createRadialGradient(0,0,1,0,0,11+lift*.25);
    ballShadow.addColorStop(0,'#001c18a8');ballShadow.addColorStop(.55,'#001c185c');ballShadow.addColorStop(1,'#001c1800');
    ctx.fillStyle=ballShadow;ctx.beginPath();ctx.arc(0,0,11+lift*.25,0,Math.PI*2);ctx.fill();ctx.restore();
    if(!['save','held'].includes(play.phase))ctx.drawImage(ballSprite,Math.round(bx-6),Math.round(by-10-lift),12,12);
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
