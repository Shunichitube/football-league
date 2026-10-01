import { pixelTexture, seatedBackTexture, coachTexture } from './arena-characters.js?v=appearance-v17';
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
  await Promise.all(['arena-base.webp','foreground-railing.png','bench-seats.png','bench-front.png','goal-front-net.png'].map(async name=>{
    const img=new Image();
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error(`Arena image timed out: ${name}`)),15000);
      img.onload=()=>{clearTimeout(timeout);resolve();};
      img.onerror=()=>{clearTimeout(timeout);reject(new Error(`Arena image failed: ${name}`));};
      img.src=new URL(`../assets/arena/${name}?v=1.2.0`,import.meta.url).href;
    });
    images[name]=img;
  }));
  const crowd=makeCanvas(ARENA.width,ARENA.height),cc=crowd.getContext('2d');
  cc.imageSmoothingEnabled=false;
  const fans=Array.from({length:80},(_,i)=>spectator(i)),cheers=Array.from({length:80},(_,i)=>spectator(i));
  const moving=[];let count=0;
  function zone(topLeft,topRight,bottomLeft,bottomRight,yTop,yBottom,rows,spacing){
    for(let row=0;row<rows;row++){
      const v=row/(rows-1),left=topLeft+(bottomLeft-topLeft)*v,right=topRight+(bottomRight-topRight)*v,y=yTop+(yBottom-yTop)*v;
      const size=.5+v*.12;
      for(let x=left+spacing/2;x<right-spacing/2;x+=spacing){
        const seed=count++,fan={x:x+(row%2)*2,y,size,seed};
        if(seed%29===0)moving.push(fan);
        else cc.drawImage(fans[seed%80],Math.round(fan.x-12*size),Math.round(y-32*size),24*size,32*size);
      }
    }
  }
  // Seating blocks exclude stairways, doors and tier fascia.
  for(const z of [[226,408,263,388],[478,682,460,659],[718,824,710,820],[846,937,853,948],[979,1190,997,1208],[1229,1449,1247,1407]])zone(...z,250,310,8,11);
  for(const z of [[306,441,345,415],[481,710,465,696],[740,794,737,790],[868,928,882,940],[960,1199,977,1218],[1230,1372,1250,1330]])zone(...z,380,454,7,13);
  // Side seating follows its own perspective, still in the common world space.
  for(let side=0;side<2;side++){
    for(let row=0;row<8;row++)for(let col=0;col<15;col++){
      let x=col*12.8,y=374+row*13-col*1.05;
      if(side)x=ARENA.width-x;
      if(col>10&&row<3)continue;
      const seed=count++,size=.76;
      cc.drawImage(fans[seed%80],x-12*size,y-32*size,24*size,32*size);
    }
    for(let row=0;row<5;row++)for(let col=0;col<9;col++){
      const x=side?1672-col*13:col*13,y=244+row*10+col*2.3,seed=count++;
      cc.drawImage(fans[seed%80],x-6.75,y-18,13.5,18);
    }
  }
  canvas.dataset.spectators=String(count);
  const kits=['#4ade80','#64748b'];
  const sprites=Array.from({length:20},(_,i)=>pixelTexture(kits[Math.floor(i/5)%2],i));
  const reserves=kits.map(kit=>Array.from({length:10},(_,i)=>seatedBackTexture(kit,i)));
  const coaches=[coachTexture(0),coachTexture(1)];
  const ballSprite=footballTexture();
  // Both keepers stand inside the court, clear of the projected goal mouths.
  const players=[[225,585],[460,598],[570,620],[725,687],[850,650],[1447,585],[1118,594],[967,624],[1235,698],[1058,752]];
  const nearFans=makeCanvas(48,32),nc=nearFans.getContext('2d');
  nc.drawImage(fans[0],0,0,24,32);nc.drawImage(cheers[4],24,0,24,32);
  nc.globalCompositeOperation='source-in';nc.fillStyle='#050e22';nc.fillRect(0,0,48,32);
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
  function text(value,x,y,size,color='#eaf9ff'){
    ctx.fillStyle=color;ctx.font=`900 ${size}px system-ui,sans-serif`;ctx.textAlign='center';ctx.fillText(value,x,y);
  }
  function displays(t){
    ctx.fillStyle='#061625';ctx.fillRect(659,32,354,121);
    text('FOOTBALL',836,77,29);text('LEAGUE',836,109,30,'#20ef98');
    text(`—    ${String(Math.floor(t/60)%100).padStart(2,'0')} : ${String(Math.floor(t)%60).padStart(2,'0')}    —`,836,136,15,'#b5e9eb');
    ctx.fillStyle='#21ed9840';for(let y=35;y<151;y+=4)ctx.fillRect(660,y,352,1);
    ctx.fillStyle='#05283b';ctx.fillRect(315,472,1040,18);
    for(let i=0;i<4;i++)text('◉  FOOTBALL LEAGUE',449+i*260,486,13,i%2?'#eaf9ff':'#39efa6');
    for(const x of [513,1159]){
      ctx.fillStyle='#061d32';ctx.fillRect(x-43,168,86,64);
      ctx.fillStyle='#19e593';ctx.fillRect(x-43,168,2,64);ctx.fillRect(x+41,168,2,64);
      text(x<800?'OUR HOME':'ONE CLUB',x,196,13);text('◆',x,219,17,'#19e593');
    }
  }
  function flag(x,y,t,seed){
    const wave=Math.sin(t*2+seed)*4;
    ctx.strokeStyle='#dbeefa';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y+9);ctx.lineTo(x-5,y-30);ctx.stroke();
    for(let row=0;row<3;row++)for(let col=0;col<4;col++){
      ctx.fillStyle=(row+col)%2?'#c5ffe5':'#00b77d';
      ctx.fillRect(x-4+col*6,y-30+row*6+Math.sin(col+t*2+seed)*2+wave,6,6);
    }
  }
  // Two open-sided dugouts share the arena coordinates and local depth order.
  function shelter(x,front=false,mirrored=false){
    const width=510;
    ctx.save();ctx.lineJoin='round';
    if(mirrored){ctx.translate(2*x+width,0);ctx.scale(-1,1);}
    if(!front){
      shadow(x+width/2,866,21);
      const glass=ctx.createLinearGradient(0,768,0,852);
      glass.addColorStop(0,'#a9dded55');glass.addColorStop(.35,'#73adc62b');glass.addColorStop(1,'#12294019');
      ctx.fillStyle=glass;ctx.strokeStyle='#39556c';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(x,850);ctx.lineTo(x,797);ctx.quadraticCurveTo(x,766,x+22,766);
      ctx.lineTo(x+width-16,766);ctx.quadraticCurveTo(x+width,776,x+width,799);
      ctx.lineTo(x+width,850);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#102739';ctx.fillRect(x,847,width,4);
      ctx.strokeStyle='#bcdfec70';ctx.lineWidth=1;
      for(const y of [776,789]){ctx.beginPath();ctx.moveTo(x+12,y);ctx.lineTo(x+width-8,y);ctx.stroke();}
    }else{
      // Thin roof ribs and end posts, never a fence across the team exit.
      for(let i=0;i<=5;i++){
        const rib=x+i*width/5;
        ctx.strokeStyle='#102333';ctx.lineWidth=4;
        ctx.beginPath();ctx.moveTo(rib,868);ctx.lineTo(rib,803);ctx.quadraticCurveTo(rib-2,778,rib+15,767);ctx.stroke();
        ctx.strokeStyle='#85a8ba';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(rib-1,865);ctx.lineTo(rib-1,803);ctx.quadraticCurveTo(rib-3,778,rib+14,767);ctx.stroke();
        ctx.fillStyle='#132534';ctx.fillRect(rib-5,867,12,3);
      }
      ctx.strokeStyle='#203b50';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(x+15,767);ctx.lineTo(x+width+15,767);ctx.stroke();
    }
    ctx.restore();
  }
  function equipment(side){
    const boxX=side?1060:600;
    shadow(boxX+9,870,1.5);
    ctx.fillStyle='#102434';ctx.fillRect(boxX-2,847,26,22);
    ctx.fillStyle=side?'#235799':'#16867e';ctx.fillRect(boxX,850,22,17);
    ctx.fillStyle='#dbeaf0';ctx.fillRect(boxX-2,845,26,6);
    ctx.fillStyle='#92b7cf';ctx.fillRect(boxX+2,846,18,2);
    ctx.fillStyle='#dbeaf0';ctx.fillRect(boxX+8,855,6,3);
    ctx.fillStyle='#081828';ctx.fillRect(boxX+2,867,4,3);ctx.fillRect(boxX+17,867,4,3);
    const bottle=(x,y)=>{
      shadow(x+3,y+1,.35);
      ctx.fillStyle='#10283e';ctx.fillRect(x,y-12,6,12);
      ctx.fillStyle='#54c8ea';ctx.fillRect(x+1,y-10,4,9);
      ctx.fillStyle='#d3f7fb';ctx.fillRect(x+1,y-8,1,5);
      ctx.fillStyle='#f6d065';ctx.fillRect(x+1,y-14,4,3);
    };
    for(let i=0;i<3;i++)bottle(boxX-21+i*7,865);
    for(let i=0;i<4;i++)bottle((side?1136:142)+i*97,859);
    for(let i=0;i<2;i++){
      const x=(side?1008:665)+i*17,y=866+i*3;
      shadow(x,y,.7);ctx.drawImage(ballSprite,x-7,y-14,14,14);
    }
    // Folded training bibs at the end of each row.
    ctx.fillStyle='#142338';ctx.fillRect(side?1570:88,853,19,9);
    ctx.fillStyle=side?'#ffc851':'#f7a057';ctx.fillRect(side?1571:89,852,17,4);
    ctx.fillStyle='#fff0ad';ctx.fillRect(side?1573:91,852,2,4);
  }
  function paint(t){
    if(!view||dead)return;
    const dpr=canvas.width/innerWidth;
    ctx.setTransform(dpr*view.scale,0,0,dpr*view.scale,dpr*view.x,dpr*view.y);
    ctx.imageSmoothingEnabled=true;ctx.drawImage(images['arena-base.webp'],0,0,W,H);
    displays(t);
    ctx.imageSmoothingEnabled=false;ctx.drawImage(crowd,0,0);
    for(const fan of moving){
      const hop=Math.max(0,Math.sin(t*3+fan.seed))*2;
      ctx.drawImage((Math.sin(t*2+fan.seed)>0?cheers:fans)[fan.seed%80],fan.x-12*fan.size,fan.y-32*fan.size-hop,24*fan.size,32*fan.size);
      if(fan.seed%3===0)flag(fan.x,fan.y-10,t,fan.seed);
    }
    for(const x of [75,360,534,1121,1292,1590])flag(x,423,t,x);
    ctx.drawImage(images['foreground-railing.png'],0,0,W,H);
    // The goal zone is behind the court zone; its net cannot cover a keeper.
    ctx.drawImage(images['goal-front-net.png'],0,0,W,H);
    const play=exhibitionAt(t);
    const actors=players.map(([x,y],i)=>{
      if(i===2&&t%18>=2&&t%18<5){const f=(t%18-2)/3;x+=35*f;y+=20*f;}
      else if(i!==0&&i!==5){x+=Math.sin(t*.65+i)*8;y+=Math.sin(t*.4+i)*3;}
      if(i===5)y+=play.keeper;
      return {i,x,y};
    }).sort((a,b)=>a.y-b.y);
    for(const p of actors)actor(p.i,p.x,p.y,.96+(p.y-530)/520,t);
    const [bx,by]=play.ball;
    const lift=play.phase==='shoot'?Math.sin((t%18-11)/1.5*Math.PI)*8:Math.abs(Math.sin(t*8))*1.2;
    ctx.save();ctx.translate(bx+2,by+1);ctx.scale(1,.3);
    const ballShadow=ctx.createRadialGradient(0,0,1,0,0,11+lift*.25);
    ballShadow.addColorStop(0,'#001c18a8');ballShadow.addColorStop(.55,'#001c185c');ballShadow.addColorStop(1,'#001c1800');
    ctx.fillStyle=ballShadow;ctx.beginPath();ctx.arc(0,0,11+lift*.25,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.drawImage(ballSprite,Math.round(bx-8),Math.round(by-16-lift),16,16);
    shelter(77);shelter(1084,false,true);
    for(let i=0;i<10;i++){
      for(let side=0;side<2;side++){
        const x=(side?1110:116)+i*48.5;
        ctx.drawImage(reserves[side][i],x-16.8,796,33.6,44.8);
      }
    }
    // Chair backs occlude the seated bodies; roof supports occupy the local foreground.
    ctx.drawImage(images['bench-seats.png'],0,0,W,H);
    ctx.drawImage(images['bench-front.png'],0,0,W,H);
    shelter(77,true);shelter(1084,true,true);
    equipment(0);equipment(1);
    // Back-facing coaches, original tracksuits, cap and clipboard, beside both benches.
    for(let i=0;i<2;i++){
      const x=i?1040:634,y=852;
      shadow(x,y,1.35);
      ctx.drawImage(coaches[i],x-16.2,y-43.2,32.4,43.2);
    }
    // Near supporters are a separate local foreground zone, in front of benches.
    for(let i=0;i<32;i++){
      const cheer=i%3!==0,scale=4.3+(i*7%5)*.26,x=i*55-30,y=982-Math.max(0,Math.sin(t*2+i))*5;
      ctx.drawImage(nearFans,cheer?24:0,0,24,20,x,y-20*scale,24*scale,20*scale);
    }
    for(const x of [30,155,1510,1640]){ctx.save();ctx.translate(x,903);ctx.scale(2,2);flag(0,0,t,x);ctx.restore();}
    // Beams originate at the actual ceiling fixtures in the generated art.
    ctx.globalCompositeOperation='screen';
    for(const [i,x,y] of [[0,238,40],[1,529,92],[2,1141,92],[3,1425,40]]){
      const target=x+Math.sin(t*.24+i)*95;
      const gradient=ctx.createLinearGradient(x,y,target,750);
      gradient.addColorStop(0,'#b5deff30');gradient.addColorStop(1,'#b5deff00');
      ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(target+90,760);ctx.lineTo(target-90,760);ctx.closePath();ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';
    for(let i=0;i<34;i++){
      const x=(i*173+Math.sin(t*.5+i)*35)%W,y=(i*83+t*(13+i%7))%850;
      ctx.save();ctx.translate(x,y);ctx.rotate(t+i);ctx.fillStyle=i%3?'#27e9a67a':'#fff4bd80';ctx.fillRect(-2,-1,5,2);ctx.restore();
    }
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
