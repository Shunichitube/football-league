// Presentation only: no game, random-generator or storage imports.
export const ARENA = Object.freeze({ width: 1672, height: 941 });
export function arenaTransform(width, height) {
  const scale = Math.max(width / ARENA.width, height / ARENA.height);
  return { scale, x: (width - ARENA.width * scale) / 2, y: (height - ARENA.height * scale) / 2 };
}
export function exhibitionAt(seconds) {
  const t = seconds % 18;
  const points = [[570,620],[725,687],[850,650],[1518,548]];
  let from=points[0],to=points[0],progress=0,phase='idle';
  if(t>=2&&t<5){phase='move';to=[605,640];progress=(t-2)/3;}
  if(t>=5&&t<8){phase='pass';from=[605,640];to=points[1];progress=(t-5)/3;}
  if(t>=8&&t<11){phase='pass';from=points[1];to=points[2];progress=(t-8)/3;}
  if(t>=11&&t<12.5){phase='shoot';from=points[2];to=points[3];progress=(t-11)/1.5;}
  if(t>=12.5&&t<15){phase='save';from=points[3];to=[1453,576];progress=(t-12.5)/2.5;}
  if(t>=15){phase='reset';from=[1453,576];to=points[0];progress=(t-15)/3;}
  return { phase, ball:[from[0]+(to[0]-from[0])*progress,from[1]+(to[1]-from[1])*progress], keeper: t>=11&&t<15 ? Math.sin((t-11)/4*Math.PI)*15 : 0 };
}

const skinTones=['#f2c49b','#d79a72','#b87552','#7e4d37'];
const hairColors=['#161a22','#4b2d1f','#7c4b2a','#d2a13a','#8a3d2f'];
const crowdColors=['#22c55e','#4ade80','#60a5fa','#fbbf24','#fb7185','#a78bfa','#e2e8f0','#f97316'];
const makeCanvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});

// Original three-background.js playerTexture pixels, preserved without redesign.
function playerTexture(seed,kit){
  const canvas=makeCanvas(24,32),ctx=canvas.getContext('2d');
  const skin=skinTones[seed%skinTones.length],hair=hairColors[seed%hairColors.length];
  ctx.fillStyle='#111827';ctx.fillRect(5,2,14,12);
  ctx.fillStyle=skin;ctx.fillRect(6,4,12,10);
  ctx.fillStyle=hair;ctx.fillRect(5,1,14,5);
  ctx.fillStyle='#111827';ctx.fillRect(9,8,1,2);ctx.fillRect(14,8,1,2);
  ctx.fillStyle=kit;ctx.fillRect(6,15,12,9);ctx.fillRect(3,16,3,6);ctx.fillRect(18,16,3,6);
  ctx.fillStyle=skin;ctx.fillRect(3,22,3,2);ctx.fillRect(18,22,3,2);
  ctx.fillStyle='#f8fafc';ctx.fillRect(7,24,10,4);
  ctx.fillStyle=kit;ctx.fillRect(7,28,4,2);ctx.fillRect(13,28,4,2);
  ctx.fillStyle='#111827';ctx.fillRect(6,30,5,2);ctx.fillRect(13,30,5,2);
  return canvas;
}
function spectator(seed,cheer=false){
  const c=makeCanvas(20,28),ctx=c.getContext('2d');
  ctx.fillStyle='#0a0f18';ctx.fillRect(5,2,10,10);
  ctx.fillStyle=skinTones[seed%4];ctx.fillRect(6,4,8,8);
  ctx.fillStyle=hairColors[(seed*3)%5];ctx.fillRect(5,1,10,4);
  if(seed%3===0)ctx.fillRect(4,3,2,7);
  if(seed%4===0)ctx.fillRect(14,3,2,7);
  ctx.fillStyle='#111827';ctx.fillRect(8,7,1,1);ctx.fillRect(12,7,1,1);
  ctx.fillStyle=crowdColors[seed%8];ctx.fillRect(5,12,10,8);
  ctx.fillRect(3,cheer?8:13,3,6);ctx.fillRect(14,cheer?8:13,3,6);
  ctx.fillStyle=skinTones[seed%4];ctx.fillRect(3,cheer?6:18,3,2);ctx.fillRect(14,cheer?6:18,3,2);
  ctx.fillStyle='#334155';ctx.fillRect(6,20,3,6);ctx.fillRect(11,20,3,6);
  ctx.fillStyle='#111827';ctx.fillRect(5,25,4,2);ctx.fillRect(11,25,4,2);
  return c;
}

export async function mountArena(canvas){
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)return ()=>{};
  const images={};
  await Promise.all(['arena-base.webp','foreground-railing.png','bench-front.png','goal-front-net.png'].map(async name=>{
    const img=new Image();
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error(`Arena image timed out: ${name}`)),15000);
      img.onload=()=>{clearTimeout(timeout);resolve();};
      img.onerror=()=>{clearTimeout(timeout);reject(new Error(`Arena image failed: ${name}`));};
      img.src=new URL(`../assets/arena/${name}`,import.meta.url).href;
    });
    images[name]=img;
  }));
  const crowd=makeCanvas(ARENA.width,ARENA.height),cc=crowd.getContext('2d');
  cc.imageSmoothingEnabled=false;
  const fans=Array.from({length:80},(_,i)=>spectator(i)),cheers=Array.from({length:80},(_,i)=>spectator(i,true));
  const moving=[];let count=0;
  function zone(topLeft,topRight,bottomLeft,bottomRight,yTop,yBottom,rows,spacing){
    for(let row=0;row<rows;row++){
      const v=row/(rows-1),left=topLeft+(bottomLeft-topLeft)*v,right=topRight+(bottomRight-topRight)*v,y=yTop+(yBottom-yTop)*v;
      const size=.55+v*.16;
      for(let x=left+spacing/2;x<right-spacing/2;x+=spacing){
        const seed=count++,fan={x:x+(row%2)*2,y,size,seed};
        if(seed%29===0)moving.push(fan);
        else cc.drawImage(fans[seed%80],Math.round(fan.x-10*size),Math.round(y-28*size),20*size,28*size);
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
      cc.drawImage(fans[seed%80],x-10*size,y-28*size,20*size,28*size);
    }
    for(let row=0;row<5;row++)for(let col=0;col<9;col++){
      const x=side?1672-col*13:col*13,y=244+row*10+col*2.3,seed=count++;
      cc.drawImage(fans[seed%80],x-6,y-18,12,18);
    }
  }
  canvas.dataset.spectators=String(count);
  const kits=['#19dc89','#153b69'];
  const sprites=Array.from({length:20},(_,i)=>playerTexture(i,i===0?'#fbbf24':i===5?'#f05263':kits[Math.floor(i/5)%2]));
  const players=[[148,550],[460,598],[570,620],[725,687],[850,650],[1520,550],[1118,594],[967,624],[1235,698],[1058,752]];
  const nearFans=makeCanvas(40,28),nc=nearFans.getContext('2d');
  nc.drawImage(fans[0],0,0);nc.drawImage(cheers[4],20,0);
  nc.globalCompositeOperation='source-in';nc.fillStyle='#050e22';nc.fillRect(0,0,40,28);
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
    if(seated||i===0||i===5){ctx.drawImage(sprite,0,0,24,seated?28:32,left,top,24*s,(seated?28:32)*s);}
    else{
      ctx.drawImage(sprite,0,0,24,24,left,top,24*s,24*s);
      const kick=i===4&&t%18>=11&&t%18<11.6;
      const stride=Math.sin(t*5+i)*1.5*s;
      ctx.drawImage(sprite,0,24,12,8,left-stride,top+24*s,12*s,8*s);
      ctx.drawImage(sprite,12,24,12,8,left+12*s+(kick?6*s:stride),top+(kick?21:24)*s,12*s,8*s);
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
  function paint(t){
    if(!view||dead)return;
    const dpr=canvas.width/innerWidth;
    ctx.setTransform(dpr*view.scale,0,0,dpr*view.scale,dpr*view.x,dpr*view.y);
    ctx.imageSmoothingEnabled=true;ctx.drawImage(images['arena-base.webp'],0,0,W,H);
    displays(t);
    ctx.imageSmoothingEnabled=false;ctx.drawImage(crowd,0,0);
    for(const fan of moving){
      const hop=Math.max(0,Math.sin(t*3+fan.seed))*2;
      ctx.drawImage((Math.sin(t*2+fan.seed)>0?cheers:fans)[fan.seed%80],fan.x-10*fan.size,fan.y-28*fan.size-hop,20*fan.size,28*fan.size);
      if(fan.seed%3===0)flag(fan.x,fan.y-10,t,fan.seed);
    }
    for(const x of [75,360,534,1121,1292,1590])flag(x,423,t,x);
    ctx.drawImage(images['foreground-railing.png'],0,0,W,H);
    const play=exhibitionAt(t);
    const actors=players.map(([x,y],i)=>{
      if(i===2&&t%18>=2&&t%18<5){const f=(t%18-2)/3;x+=35*f;y+=20*f;}
      else if(i!==0&&i!==5){x+=Math.sin(t*.65+i)*8;y+=Math.sin(t*.4+i)*3;}
      if(i===5)y+=play.keeper;
      return {i,x,y};
    }).sort((a,b)=>a.y-b.y);
    for(const p of actors)actor(p.i,p.x,p.y,.96+(p.y-530)/520,t);
    shadow(...play.ball,.48);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(play.ball[0],play.ball[1]-5,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#152438';ctx.fillRect(play.ball[0]-2,play.ball[1]-8,4,4);ctx.fillRect(play.ball[0]+2,play.ball[1]-3,2,2);
    // Bench players are between the seat backs and their extracted front edges.
    for(let i=0;i<10;i++){
      actor(1+i%4,116+i*48.5,855,1.13,t,true);
      actor(6+i%4,1110+i*48.5,855,1.13,t,true);
    }
    ctx.drawImage(images['bench-front.png'],0,0,W,H);
    ctx.drawImage(images['goal-front-net.png'],0,0,W,H);
    // Near supporters are a separate local foreground zone, in front of benches.
    for(let i=0;i<32;i++){
      const cheer=i%3!==0,scale=4.3+(i*7%5)*.26,x=i*55-30,y=982-Math.max(0,Math.sin(t*2+i))*5;
      ctx.drawImage(nearFans,cheer?20:0,0,20,20,x,y-20*scale,20*scale,20*scale);
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
