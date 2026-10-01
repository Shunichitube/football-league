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
 scene.innerHTML='<h2>トレーニング中</h2><div class="training-drills"></div>';
 const drills=scene.querySelector('.training-drills');
 const field=club.roster.filter(p=>p.primaryPosition!=='GK'),keeper=club.roster.find(p=>p.primaryPosition==='GK');
 const entries=[['run','走り込み',field[0]||club.roster[0]],['dribble','ドリブル',field[1]||field[0]||club.roster[0]],['shoot','シュート',field[2]||field[0]||club.roster[0]],['catch','キーパー練習',keeper||club.roster[0]]];
 const sprites=entries.map(([motion,label,p])=>{const box=document.createElement('section');box.className='training-drill';const heading=document.createElement('h3');heading.textContent=label;const canvas=document.createElement('canvas');canvas.width=300;canvas.height=300;box.append(heading,canvas);drills.append(box);return {motion,p,canvas};});
 const shade=document.createElement('div');shade.className='training-shade';layer.append(source,scene,shade);document.body.append(layer);
 let frame=0,atlas=null;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const loading=loadMotionAtlas().then(value=>{atlas=value;}).catch(()=>{});
 // Draw existing standing avatars immediately while the motion sheets load.
 for(const x of sprites)if(x.p)x.canvas.getContext('2d').drawImage(playerAvatarTexture(playerAppearance(x.p),{kit:club.color,goalkeeper:x.motion==='catch'}),55,0,190,300);
 const fade=async dark=>{shade.classList.toggle('is-dark',dark);await wait(reduce?40:500);};
 try{
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await fade(true);
  source.remove();scene.classList.add('is-visible');
  await Promise.race([loading,wait(2000)]);
  const start=performance.now();
  const paint=now=>{const t=(now-start)/1000;for(const x of sprites)if(atlas&&x.p){let motion=x.motion;if(motion==='catch')motion=Math.floor(t/1.25)%2?'dive':'catch';drawMotion(x.canvas.getContext('2d'),atlas,motion,t,{loop:true,ball:motion==='dribble',appearance:playerAppearance(x.p),kit:club.color,goalkeeper:x.motion==='catch'});x.canvas.style.transform=!reduce&&x.motion==='run'?`translateX(${Math.sin(t*2)*25}px)`:'none';}frame=requestAnimationFrame(paint);};frame=requestAnimationFrame(paint);
  await fade(false);await wait(5000);await fade(true);cancelAnimationFrame(frame);scene.remove();await fade(false);
 }finally{cancelAnimationFrame(frame);layer.remove();active=false;}
}
