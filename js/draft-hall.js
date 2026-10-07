import {renderPixelRatio} from './render-budget.js?v=mobile-memory-v1';
import { STAGE } from './stage-layout.js';
// Decorative only; the current draft venue does not read game state or DOM data.
export async function mountDraftHall(canvas){
  const ctx=canvas.getContext('2d',{alpha:false}),base=new Image();
  await new Promise((resolve,reject)=>{base.onload=resolve;base.onerror=reject;base.src=new URL('../assets/arena/draft-stage-podium.png',import.meta.url).href;});
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,dead=false,last=0,time=0,previous=0;
  function draw(){
    ctx.globalCompositeOperation='source-over';
    const scale=Math.max(innerWidth/STAGE.width,innerHeight/STAGE.height),dx=(innerWidth-STAGE.width*scale)/2;
    const dpr=renderPixelRatio(innerWidth,innerHeight);ctx.setTransform(dpr*scale,0,0,dpr*scale,dpr*dx,0);
    ctx.drawImage(base,0,0,STAGE.width,STAGE.height);ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='rgba(2,8,18,.28)';ctx.fillRect(0,0,STAGE.width,STAGE.height);
    ctx.globalCompositeOperation='screen';
    for(const [i,x,y] of [[0,210,42],[1,520,34],[2,1152,34],[3,1464,42]]){
      const end=x+Math.sin(time*.22+i)*120;
      const g=ctx.createLinearGradient(x,y,end,430);g.addColorStop(0,'#6ee7ff33');g.addColorStop(1,'#22c55e00');
      ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(end-50,430);ctx.lineTo(end+50,430);ctx.closePath();ctx.fill();
    }
    const pulse=.55+Math.sin(time*1.8)*.18;
    const glow=ctx.createRadialGradient(836,238,18,836,238,210);
    glow.addColorStop(0,`rgba(134,239,172,${pulse})`);
    glow.addColorStop(.28,'rgba(56,189,248,.22)');
    glow.addColorStop(1,'rgba(56,189,248,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(836,238,220,90,0,0,Math.PI*2);ctx.fill();
    ctx.globalCompositeOperation='source-over';canvas.dataset.ready='true';
  }
  function resize(){const dpr=renderPixelRatio(innerWidth,innerHeight);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);draw();}
  function tick(now){if(dead||document.hidden||reduce.matches)return;if(previous)time+=Math.min((now-previous)/1000,.1);previous=now;if(now-last>50){draw();last=now;}frame=requestAnimationFrame(tick);}
  function schedule(){cancelAnimationFrame(frame);previous=0;draw();if(!document.hidden&&!reduce.matches)frame=requestAnimationFrame(tick);}
  addEventListener('resize',resize);document.addEventListener('visibilitychange',schedule);reduce.addEventListener('change',schedule);resize();schedule();
  return ()=>{dead=true;cancelAnimationFrame(frame);removeEventListener('resize',resize);document.removeEventListener('visibilitychange',schedule);reduce.removeEventListener('change',schedule);};
}
