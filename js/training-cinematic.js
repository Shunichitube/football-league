import {loadMotionAtlas,drawMotion} from './player-motion.js?v=appearance-v21';
import {playerAppearance} from './avatar-profile.js?v=appearance-v21';
import {playerAvatarTexture} from './player-avatar.js?v=appearance-v21';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let active=false;
export async function playTrainingCinematic(club,previousScreen){
 if(active)return;active=true;
 const layer=document.createElement('div');layer.className='training-cinematic';
 const source=document.createElement('div');source.className='training-source';source.append(previousScreen);
 const scene=document.createElement('div');scene.className='training-practice';
 scene.innerHTML='<h2>トレーニング中</h2><canvas class="training-field" width="1672" height="941"></canvas>';
 const court=scene.querySelector('canvas'),ctx=court.getContext('2d');
 const backdrop=new Image();
 const backgroundReady=new Promise(resolve=>{backdrop.onload=resolve;backdrop.onerror=resolve;});
 backdrop.src=new URL('../assets/arena/practice-hall-v1.webp',import.meta.url).href;
 const field=club.roster.filter(p=>p.primaryPosition!=='GK'),keeper=club.roster.find(p=>p.primaryPosition==='GK');
 const entries=[['run','走り込み',field[0]||club.roster[0]],['dribble','ドリブル',field[1]||field[0]||club.roster[0]],['shoot','シュート',field[2]||field[0]||club.roster[0]],['catch','キーパー練習',keeper||club.roster[0]]];
 const sprites=entries.map(([motion,label,p])=>{const canvas=document.createElement('canvas');canvas.width=300;canvas.height=300;return {motion,label,p,canvas};});
 const extra=field.slice(3,7).map((p,i)=>({motion:i<2?'dribble':'run',label:'',p,canvas:Object.assign(document.createElement('canvas'),{width:300,height:300}),lane:i}));
 sprites.push(...extra);
 const used=new Set(sprites.map(x=>x.p?.id));
 const partners=field.filter(p=>!used.has(p.id)).slice(0,2);
 if(partners.length===2)partners.forEach((p,side)=>sprites.push({motion:'idle',label:'',p,passSide:side,canvas:Object.assign(document.createElement('canvas'),{width:300,height:300})}));
 const shade=document.createElement('div');shade.className='training-shade';layer.append(source,scene,shade);document.body.append(layer);
 document.body.classList.add('training-results-pending');
 let frame=0,atlas=null,finished=false;
 const cleanup=()=>{cancelAnimationFrame(frame);layer.remove();active=false;document.body.classList.remove('training-results-pending');document.removeEventListener('football-league:view-rendered',onRender);};
 const onRender=()=>{if(!document.querySelector('#app > .growth-modal'))cleanup();};
 document.addEventListener('football-league:view-rendered',onRender);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const loading=loadMotionAtlas().then(value=>{atlas=value;}).catch(()=>{});
 // Draw existing standing avatars immediately while the motion sheets load.
 for(const x of sprites)if(x.p)x.canvas.getContext('2d').drawImage(playerAvatarTexture(playerAppearance(x.p),{kit:club.color,goalkeeper:x.motion==='catch'}),55,0,190,300);
 const fade=async dark=>{shade.classList.toggle('is-dark',dark);await wait(reduce?40:500);};
 try{
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await fade(true);
  source.remove();scene.classList.add('is-visible');
  await Promise.race([Promise.all([loading,backgroundReady]),wait(2000)]);
  const start=performance.now();
  const paint=now=>{
   const t=reduce?0:(now-start)/1000;
   ctx.clearRect(0,0,1672,941);
   if(backdrop.complete&&backdrop.naturalWidth)ctx.drawImage(backdrop,0,0,1672,941);
   const cycle=t%5,shot=cycle>=2&&cycle<3.2,saving=cycle>=2.8&&cycle<3.5;
   const actors=sprites.map((x,i)=>{
    let px,py,motion=x.motion,direction='right',clock=t;
    if(x.passSide!==undefined){const beat=t%4,turn=x.passSide===0?0:2;px=x.passSide===0?1040:1350;py=745;direction=x.passSide===0?'right':'left';clock=beat-turn;motion=clock>=0&&clock<.45?'shoot':'idle';}
    else if(i===0){const u=(t%8)/4;px=350+Math.min(u,2-u)*420;py=720;direction=u<1?'right':'left';}
    else if(i===1){const u=(t%10)/5;px=440+Math.min(u,2-u)*450;py=620;direction=u<1?'right':'left';}
    else if(i===2){px=1110;py=560;motion=shot?'shoot':'idle';clock=cycle-2;}
    else if(i===3){px=1570;py=555;motion=saving?'catch':'idle';clock=cycle-2.8;direction='left';}
    else {const u=((t+x.lane*1.2)%8)/4;px=350+Math.min(u,2-u)*420;py=655+x.lane*35;direction=u<1?'right':'left';}
    return {...x,px,py,motion,direction,clock};
   }).sort((a,b)=>a.py-b.py);
   for(const x of actors)if(x.p){
    if(atlas)drawMotion(x.canvas.getContext('2d'),atlas,x.motion,x.clock,{direction:x.direction,loop:!['shoot','catch'].includes(x.motion),ball:false,appearance:playerAppearance(x.p),kit:club.color,goalkeeper:x.p.primaryPosition==='GK'});
    ctx.fillStyle='#03152255';ctx.beginPath();ctx.ellipse(x.px,x.py,18,5,0,0,Math.PI*2);ctx.fill();
    if(x.passSide===1&&x.motion==='shoot'){ctx.save();ctx.translate(x.px,x.py-72);ctx.scale(-1,1);ctx.drawImage(x.canvas,-36,0,72,72);ctx.restore();}
    else ctx.drawImage(x.canvas,x.px-36,x.py-72,72,72);
   }
   const balls=actors.filter(x=>x.motion==='dribble').map(x=>[x.px+(x.direction==='right'?25:-25),x.py-3]);
   if(partners.length===2){const beat=t%2,progress=Math.max(0,Math.min(1,(beat-.25)/1.1)),rightward=t%4<2;balls.push([rightward?1065+260*progress:1325-260*progress,742]);}
   if(!saving){const progress=Math.max(0,Math.min(1,(cycle-2.5)/.45));balls.push([1135+435*progress,557]);}
   for(const [x,y] of balls){ctx.fillStyle='white';ctx.strokeStyle='#182b3d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#182b3d';ctx.fillRect(x-2,y-2,4,4);}
   frame=requestAnimationFrame(paint);
  };frame=requestAnimationFrame(paint);
  await fade(false);await wait(5000);
  document.body.classList.remove('training-results-pending');
  layer.classList.add('training-results-visible');finished=true;
 }finally{if(!finished)cleanup();}
}
