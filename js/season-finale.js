import {loadMotionAtlas,drawMotion} from './player-motion.js?v=appearance-v29';
import {playerAppearance} from './avatar-profile.js?v=appearance-v29';
import {drawAvatar} from './player-avatar.js?v=season-finale-v1';
import {celebrationTexture} from './avatar-celebration.js?v=1';

export const finaleKind=rank=>rank===1?'goal':rank<=3?'parry':'catch';
export function podiumPositions(count){
 const n=Math.min(12,Math.max(0,count)),gap=105;
 return Array.from({length:n},(_,i)=>({x:836+(i-(n-1)/2)*gap,y:700}));
}
export function finaleFrame(rank,time){
 const kind=finaleKind(rank),t=Math.max(0,time);
 if(t<1.15)return {scene:'shoot',white:0,ready:false};
 let white=t<1.85?0:t<2.12?(t-1.85)/.27:t<2.7?1:t<3.08?1-(t-2.7)/.38:0;
 if(kind==='goal'){
  if(t>=4.05)white=t<4.35?(t-4.05)/.3:t<4.65?1:t<5.05?1-(t-4.65)/.4:0;
  return {scene:t<2.7?'flight':t<4.65?'impact':'celebrate',white,ready:t>=5.05};
 }
 if(t>=4)white=Math.min(1,(t-4)/.35);
 return {scene:t<2.7?'flight':t<4.35?kind:'white',white,ready:t>=4.35};
}

let resources;
async function loadResources(){
 const load=async name=>{
  const im=new Image();im.src=new URL('../assets/'+name,import.meta.url).href;
  let timer;try{await Promise.race([im.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Finale image timed out')),15000);})]);}finally{clearTimeout(timer);}return im;
 };
 resources??=Promise.all([loadMotionAtlas(),load('arena/arena-base.webp'),load('arena/home-arena-v2.webp'),load('arena/goal-cutin-background-v1.webp'),load('arena/goal-net-bulge-no-ball-v3.webp'),load('avatars/player-celebrate-front-happy-v3.webp'),load('avatars/keeper-dejected-v1.webp')]).then(([atlas,ground,home,goal,bulge,celebrate,dejected])=>({atlas:{...atlas,celebrate,dejected},ground,home,goal,bulge}));
 try{return await resources;}catch(error){resources=null;throw error;}
}
function football(ctx,x,y,r,spin=0){
 ctx.save();ctx.translate(x,y);ctx.rotate(spin);ctx.fillStyle='#f9fafb';ctx.strokeStyle='#18222e';ctx.lineWidth=1.5;
 ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#18222e';
 for(const [cx,cy,size] of [[0,0,.4],[-.7,-.45,.26],[.65,.5,.26]]){
  ctx.beginPath();for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const px=(cx+Math.cos(a)*size)*r,py=(cy+Math.sin(a)*size)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();
 }ctx.restore();
}
export function createFinalePainter(data,club,rank,keeper){
 const {atlas,ground,home,goal,bulge}=data;
 const roster=club.roster.slice(0,12),scorer=roster.find(p=>p.primaryPosition==='FW')||roster.find(p=>p.primaryPosition!=='GK')||roster[0];
 const sprite=document.createElement('canvas');sprite.width=400;sprite.height=400;
 const actor=(ctx,motion,t,x,y,height,p=scorer,gk=false)=>{
  drawMotion(sprite.getContext('2d'),atlas,motion,t,{appearance:playerAppearance(p||{id:'finale-keeper',primaryPosition:'GK'}),kit:club.color,goalkeeper:gk,loop:motion==='idle'});
  ctx.imageSmoothingEnabled=false;ctx.drawImage(sprite,x-height/2,y-height,height,height);
 };
 const joy=(ctx,p,x,y,height,t,gk=false,sad=false)=>{
  const pose=Math.floor(t*3)%4,im=celebrationTexture(atlas,playerAppearance(p||{id:'finale-keeper',primaryPosition:'GK'}),{kit:club.color,goalkeeper:gk,pose,dejected:sad});
  ctx.imageSmoothingEnabled=false;ctx.drawImage(im,x-height*300/470/2,y-height,height*300/470,height);
 };
 const portraits=roster.map(p=>{const im=document.createElement('canvas');im.width=300;im.height=470;drawAvatar(im.getContext('2d'),atlas.avatar,playerAppearance(p),{kit:club.color,goalkeeper:p.primaryPosition==='GK'});return im;});
 return {
  cinematic(ctx,time){
   const t=time,frame=finaleFrame(rank,t),kind=finaleKind(rank);
   ctx.imageSmoothingEnabled=true;
   if(frame.scene==='shoot'){
    ctx.drawImage(ground,500,480,672,315,0,0,960,540);
    actor(ctx,'shoot',t,340,455,240);
    const q=Math.max(0,Math.min(1,(t-.35)/.8));football(ctx,420+q*380,430-q*90,12-q*4,t*12);
   }else if(frame.scene!=='white'){
    ctx.drawImage(goal,0,0,960,540);
    if(frame.scene==='flight'){
     const q=t-1.15,d=Math.max(0,Math.min(1,(q-.55)/.8)),p=Math.max(0,Math.min(1,q/1.55));
     if(kind==='catch')actor(ctx,'catch',q<.55?0:.18,355,385,255,keeper,true);
     else actor(ctx,d?'dive':'catch',d*.375,355+d*130,385-d*100,255,keeper,true);
     football(ctx,950-p*(kind==='catch'?563:435),kind==='catch'?285-p*4:325-p*152,17-p*3,t*15);
    }else if(frame.scene==='impact'){
     ctx.save();ctx.translate(960*.55,540*.42);ctx.scale(1.85,1.85);ctx.translate(-490,-154);
     ctx.drawImage(bulge,0,0,960,540);football(ctx,490+Math.sin(t*30)*1.5,154,14,t*15);ctx.restore();
    }else if(frame.scene==='celebrate'){
     football(ctx,478,321,14,0);joy(ctx,keeper,355,395,240,t,true,true);joy(ctx,scorer,783,407,270,t);
    }else if(frame.scene==='parry'){
     actor(ctx,'dive',.25,460,325,255,keeper,true);
     const p=Math.min(1,(t-2.7)/1.15);football(ctx,595+p*445,220-p*125+p*p*35,14,t*18);
    }else if(frame.scene==='catch'){
     actor(ctx,'catch',.6,355,385,255,keeper,true);football(ctx,387,281,16,0);
    }
   }
   if(frame.white){ctx.fillStyle=`rgba(255,255,255,${frame.white})`;ctx.fillRect(0,0,960,540);}
   return frame;
  },
  ceremony(ctx,t){
   ctx.imageSmoothingEnabled=true;ctx.drawImage(home,0,0,1672,941);
   // The home court is empty already. Replace just the occupied dugouts below
   // the podium, retaining the home spectators, goals and court lighting.
   ctx.drawImage(ground,0,745,1672,196,0,745,1672,196);
   if(rank<=3){
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let i=0;i<4;i++){
     const x=260+i*380,wave=Math.sin(t*.5+i)*90;
     const light=ctx.createLinearGradient(x,240,x+wave,750);light.addColorStop(0,'#fff9d080');light.addColorStop(1,'#fff3b208');ctx.fillStyle=light;
     ctx.beginPath();ctx.moveTo(x,240);ctx.lineTo(x+wave-160,770);ctx.lineTo(x+wave+160,770);ctx.closePath();ctx.fill();
    }ctx.restore();
   }
   const medal=['','#dbb95f','#b9c9d7','#b98659'][rank]||'#647e95';
   ctx.fillStyle='#081d29aa';ctx.beginPath();ctx.ellipse(836,766,690,28,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle=medal;ctx.fillRect(150,700,1372,66);ctx.fillStyle='#f2f8ff';ctx.fillRect(150,700,1372,8);
   ctx.fillStyle='#182c3b';ctx.fillRect(166,723,1340,29);ctx.fillStyle=medal;ctx.textAlign='center';ctx.font='bold 20px sans-serif';ctx.fillText(rank===1?'CHAMPIONS':`${rank} PLACE`,836,745);
   podiumPositions(roster.length).forEach(({x,y},i)=>{
    const p=roster[i],height=175;
    if(rank<=3)joy(ctx,p,x,y,height,t+i*.19,p.primaryPosition==='GK');
    else {ctx.imageSmoothingEnabled=false;ctx.drawImage(portraits[i],x-height*300/470/2,y-height,height*300/470,height);}
   });
   if(rank<=3){
    const colors=['#fff2a4','#f4a5ce','#6be5dd','#a9b6ff','#ffffff'];
    for(let i=0;i<130;i++){const x=(i*173.7+Math.sin(t+i)*22)%1672,y=((i*97+t*(55+i%35))%750)+110;ctx.save();ctx.translate(x,y);ctx.rotate(t+i);ctx.fillStyle=colors[i%5];ctx.fillRect(-3,-5,6,10);ctx.restore();}
   }
  }
 };
}

export function playSeasonFinale({app,club,rank,keeper,onDone=()=>{}}){
 const root=document.createElement('section');root.className='season-finale';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','シーズン最終演出');
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
 const heading=document.createElement('div');heading.className='finale-heading';heading.hidden=true;
 const team=document.createElement('h1');team.textContent=club.name;
 const placing=document.createElement('p');placing.textContent=rank===1?'優勝':rank===2?'準優勝':`第${rank}位`;heading.append(team,placing);
 const status=document.createElement('p');status.className='finale-loading';status.textContent='シーズン最終演出を準備しています…';status.setAttribute('role','status');
 const button=document.createElement('button');button.className='finale-next';button.textContent='次へ';button.hidden=true;
 root.append(canvas,heading,status,button);document.body.append(root);app.inert=true;
 let dead=false,raf=0,painter,stage='cinematic',clock=0,previous=0,lastPaint=0,loadTimer;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function dispose(){if(dead)return;dead=true;clearTimeout(loadTimer);cancelAnimationFrame(raf);removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);root.remove();app.inert=false;}
 function finish(){dispose();onDone();}
 function paint(){
  if(!painter||dead)return;
  const ctx=canvas.getContext('2d'),w=stage==='ceremony'?1672:960,h=stage==='ceremony'?941:540;
  const scale=Math.min(canvas.width/w,canvas.height/h),x=(canvas.width-w*scale)/2,y=(canvas.height-h*scale)/2;
  const frame=finaleFrame(rank,clock),white=stage==='cinematic'&&frame.scene==='white';
  root.classList.toggle('finale-white',white);ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=white?'#fff':'#07121d';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(scale,0,0,scale,x,y);
  if(stage==='ceremony')painter.ceremony(ctx,clock);else painter.cinematic(ctx,clock);
  root.dataset.scene=stage==='ceremony'?'ceremony':frame.scene;
  if(stage==='cinematic'&&frame.ready&&button.hidden){button.hidden=false;button.focus({preventScroll:true});}
 }
 function resize(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);paint();}
 function tick(now){
  if(dead)return;
  if(!document.hidden){if(previous)clock+=Math.min(.1,(now-previous)/1000);previous=now;if(now-lastPaint>1000/30){paint();lastPaint=now;}}
  else previous=0;
  raf=requestAnimationFrame(tick);
 }
 function visibility(){previous=0;}
 button.addEventListener('click',()=>{
  if(stage==='ceremony'||stage==='error')return finish();
  stage='ceremony';clock=0;previous=0;root.classList.remove('finale-white');heading.hidden=false;button.textContent='シーズン結果へ';paint();button.focus({preventScroll:true});
 });
 addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',visibility);resize();
 Promise.race([loadResources(),new Promise((_,reject)=>{loadTimer=setTimeout(()=>reject(new Error('Finale assets timed out')),20000);})]).then(data=>{
  if(dead)return;painter=createFinalePainter(data,club,rank,keeper);status.remove();
  if(reduced)clock=finaleKind(rank)==='goal'?5.1:4.4;
  paint();if(!reduced)raf=requestAnimationFrame(tick);
 }).catch(error=>{
  if(dead)return;console.error('Season finale assets failed to load',error);stage='error';status.textContent='演出を読み込めませんでした。シーズン結果へ進めます。';button.textContent='シーズン結果へ';button.hidden=false;button.focus();
 }).finally(()=>clearTimeout(loadTimer));
 return dispose;
}
