import { pixelTexture } from './arena-characters.js';
// Decorative only. Club data flows one way from the current draft renderer.
export async function mountDraftHall(canvas){
  const ctx=canvas.getContext('2d',{alpha:false}),base=new Image();
  await new Promise((resolve,reject)=>{base.onload=resolve;base.onerror=reject;base.src=new URL('../assets/arena/auction-hall-v3.webp',import.meta.url).href;});
  const colors=['#4ade80','#60a5fa','#fbbf24','#f472b6','#a78bfa','#e2e8f0'];
  const fans=Array.from({length:36},(_,i)=>pixelTexture(colors[i%6],i,i%2?'woman':'man'));
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,dead=false,last=0,time=0,previous=0;
  function draw(){
    const scale=Math.max(innerWidth/1672,innerHeight/940),dx=(innerWidth-1672*scale)/2;
    const dpr=Math.min(devicePixelRatio||1,2);ctx.setTransform(dpr*scale,0,0,dpr*scale,dpr*dx,0);
    ctx.drawImage(base,0,0,1672,940);ctx.imageSmoothingEnabled=false;
    // Each tier is clipped to its seating envelope; aisle gaps stay clear.
    for(let side=0;side<2;side++)for(let tier=0;tier<2;tier++){
      ctx.save();if(side){ctx.translate(1672,0);ctx.scale(-1,1);}
      ctx.beginPath();ctx.moveTo(0,tier?359:217);ctx.lineTo(239,tier?388:259);ctx.lineTo(239,tier?450:310);ctx.lineTo(0,tier?428:279);ctx.closePath();ctx.clip();
      for(let row=0;row<5;row++)for(let col=0;col<22;col++){
        const i=row*22+col+side*17+tier*7,x=col*11,y=(tier?368:228)+row*12+col*1.7;
        const hop=i%13===0?Math.max(0,Math.sin(time*2+i))*2:0;
        ctx.drawImage(fans[i%36],x,y-hop,12,16);
      }
      ctx.restore();
    }
    const clubs=JSON.parse(document.querySelector('#app').dataset.draftClubs||'[]');
    const desks=[320,450,580,986,1117,1247];
    clubs.slice(0,6).forEach((club,i)=>{
      const x=desks[i];ctx.fillStyle=club.color||'#4ade80';ctx.globalAlpha=.6;ctx.fillRect(x+3,519,100,45);ctx.globalAlpha=1;
      ctx.fillRect(x+3,519,100,3);ctx.fillStyle='#fff';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText(club.name,x+53,548,90);
    });
    ctx.globalCompositeOperation='screen';
    for(const [i,x,y] of [[0,193,104],[1,536,24],[2,1136,24],[3,1479,104]]){
      const end=x+Math.sin(time*.25+i)*150;
      const g=ctx.createLinearGradient(x,y,end,720);g.addColorStop(0,'#65ebff35');g.addColorStop(1,'#24efa000');
      ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(end-65,720);ctx.lineTo(end+65,720);ctx.closePath();ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';canvas.dataset.ready='true';
  }
  function resize(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);draw();}
  function tick(now){if(dead||document.hidden||reduce.matches)return;if(previous)time+=Math.min((now-previous)/1000,.1);previous=now;if(now-last>50){draw();last=now;}frame=requestAnimationFrame(tick);}
  function schedule(){cancelAnimationFrame(frame);previous=0;draw();if(!document.hidden&&!reduce.matches)frame=requestAnimationFrame(tick);}
  addEventListener('resize',resize);document.addEventListener('visibilitychange',schedule);reduce.addEventListener('change',schedule);resize();schedule();
  return ()=>{dead=true;cancelAnimationFrame(frame);removeEventListener('resize',resize);document.removeEventListener('visibilitychange',schedule);reduce.removeEventListener('change',schedule);};
}
