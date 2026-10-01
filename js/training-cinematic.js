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
 // Quiet practice hall: the drawing and players share a single court coordinate system.
 const backdrop=document.createElement('canvas');backdrop.width=1672;backdrop.height=941;
 const bg=backdrop.getContext('2d');
 const wall=bg.createLinearGradient(0,0,0,450);wall.addColorStop(0,'#344846');wall.addColorStop(1,'#8daba0');bg.fillStyle=wall;bg.fillRect(0,0,1672,941);
 bg.fillStyle='#263d3a';bg.fillRect(0,390,1672,50);
 for(let x=100;x<1600;x+=240){bg.fillStyle='#b7d0c7';bg.fillRect(x,100,160,180);bg.fillStyle='#819e93';bg.fillRect(x+6,106,148,168);bg.strokeStyle='#d9e5da';bg.lineWidth=5;bg.strokeRect(x+6,106,148,168);bg.beginPath();bg.moveTo(x+80,106);bg.lineTo(x+80,274);bg.stroke();}
 bg.fillStyle='#b8c2af';bg.fillRect(0,440,1672,501);
 bg.fillStyle='#477967';bg.fillRect(180,460,1310,380);
 bg.strokeStyle='#e0e7ce';bg.lineWidth=4;bg.strokeRect(180,460,1310,380);bg.beginPath();bg.moveTo(835,460);bg.lineTo(835,840);bg.stroke();bg.beginPath();bg.ellipse(835,650,82,58,0,0,Math.PI*2);bg.stroke();bg.strokeRect(180,535,150,220);bg.strokeRect(1340,535,150,220);
 // Training goal and net, with a front upright and rear frame.
 bg.strokeStyle='#ecf1e9';bg.lineWidth=6;bg.strokeRect(1450,480,95,145);bg.lineWidth=1;bg.strokeStyle='#d5e3d780';for(let x=1450;x<=1545;x+=12){bg.beginPath();bg.moveTo(x,480);bg.lineTo(x,625);bg.stroke();}for(let y=480;y<=625;y+=12){bg.beginPath();bg.moveTo(1450,y);bg.lineTo(1545,y);bg.stroke();}
 bg.fillStyle='#36524a';bg.fillRect(80,350,220,24);bg.fillRect(100,374,14,45);bg.fillRect(270,374,14,45);
 for(const [x,y] of [[450,615],[600,615],[750,615],[900,615]]){bg.fillStyle='#d99b4f';bg.beginPath();bg.moveTo(x,y-13);bg.lineTo(x-7,y);bg.lineTo(x+7,y);bg.fill();}

 const field=club.roster.filter(p=>p.primaryPosition!=='GK'),keeper=club.roster.find(p=>p.primaryPosition==='GK');
 const entries=[['run','走り込み',field[0]||club.roster[0]],['dribble','ドリブル',field[1]||field[0]||club.roster[0]],['shoot','シュート',field[2]||field[0]||club.roster[0]],['catch','キーパー練習',keeper||club.roster[0]]];
 const sprites=entries.map(([motion,label,p])=>{const canvas=document.createElement('canvas');canvas.width=300;canvas.height=300;return {motion,label,p,canvas};});
 const extra=field.slice(3,7).map((p,i)=>({motion:i<2?'dribble':'run',label:'',p,canvas:Object.assign(document.createElement('canvas'),{width:300,height:300}),lane:i}));
 sprites.push(...extra);
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
  await Promise.race([loading,wait(2000)]);
  const start=performance.now();
  const paint=now=>{
   const t=reduce?0:(now-start)/1000;
   ctx.clearRect(0,0,1672,941);
   ctx.drawImage(backdrop,0,0,1672,941);
   const cycle=t%5,shot=cycle>=2&&cycle<3.2,saving=cycle>=2.8&&cycle<3.5;
   const actors=sprites.map((x,i)=>{
    let px,py,motion=x.motion,direction='right',clock=t;
    if(i===0){const u=(t%8)/4;px=350+Math.min(u,2-u)*420;py=720;direction=u<1?'right':'left';}
    else if(i===1){const u=(t%10)/5;px=440+Math.min(u,2-u)*450;py=620;direction=u<1?'right':'left';}
    else if(i===2){px=1110;py=560;motion=shot?'shoot':'idle';clock=cycle-2;}
    else if(i===3){px=1447;py=555;motion=saving?'catch':'idle';clock=cycle-2.8;direction='left';}
    else {const u=((t+x.lane*1.2)%8)/4;px=350+Math.min(u,2-u)*420;py=655+x.lane*35;direction=u<1?'right':'left';}
    return {...x,px,py,motion,direction,clock};
   }).sort((a,b)=>a.py-b.py);
   for(const x of actors)if(x.p){
    if(atlas)drawMotion(x.canvas.getContext('2d'),atlas,x.motion,x.clock,{direction:x.direction,loop:!['shoot','catch'].includes(x.motion),ball:false,appearance:playerAppearance(x.p),kit:club.color,goalkeeper:x.p.primaryPosition==='GK'});
    ctx.fillStyle='#03152255';ctx.beginPath();ctx.ellipse(x.px,x.py,18,5,0,0,Math.PI*2);ctx.fill();
    ctx.drawImage(x.canvas,x.px-36,x.py-72,72,72);
   }
   const balls=actors.filter(x=>x.motion==='dribble').map(x=>[x.px+(x.direction==='right'?25:-25),x.py-3]);
   if(!saving){const progress=Math.max(0,Math.min(1,(cycle-2.5)/.45));balls.push([1135+312*progress,557]);}
   for(const [x,y] of balls){ctx.fillStyle='white';ctx.strokeStyle='#182b3d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#182b3d';ctx.fillRect(x-2,y-2,4,4);}
   frame=requestAnimationFrame(paint);
  };frame=requestAnimationFrame(paint);
  await fade(false);await wait(5000);
  document.body.classList.remove('training-results-pending');
  layer.classList.add('training-results-visible');finished=true;
 }finally{if(!finished)cleanup();}
}
