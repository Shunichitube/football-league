import * as THREE from 'three';
import {createCourt} from './court.js';
import {createCrowd} from './crowd.js';
import {createFootball} from './football.js';
import {drawMotion,MOTIONS} from '../player-motion.js?v=motion-ui-v17';
import {playerAppearance} from '../avatar-profile.js?v=appearance-v29';
import {startingFive,seasonReelFrame} from '../season-reel.js';

export function createSeasonReel({host,atlas,club,clubs,fixtures}){
 const court=createCourt(host,innerWidth,innerHeight),{scene,camera}=court;
 const crowd=createCrowd(scene),ball=createFootball();ball.scale.setScalar(.7);scene.add(ball);
 const own=startingFive(club),cache=new Map(),allTextures=new Set(),actors=[];
 const focus=new THREE.Vector3(-2,1,-.5),right=new THREE.Vector3();let previousBall=null,currentIndex=-1;
 const material=()=>new THREE.MeshBasicMaterial({color:0x031421,transparent:true,opacity:.3,depthWrite:false});
 for(let i=0;i<10;i++){
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({depthWrite:false}));sprite.center.set(.5,0);sprite.scale.set(1.82,1.82,1);scene.add(sprite);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.35,20),material());shadow.rotation.x=-Math.PI/2;shadow.scale.y=.6;scene.add(shadow);
  actors.push({sprite,shadow,facing:'right',textures:null});
 }
 function textures(player,kit,keeper,active){
  const key=JSON.stringify([player?.id,playerAppearance(player||{id:'reel-fallback'}),kit,keeper,active]);if(cache.has(key))return cache.get(key);
  const bank={};
  for(const motion of (active?['idle','run','dribble','shoot']:keeper?['idle']:['idle','run']))for(const direction of ['left','right']){
   bank[`${motion}-${direction}`]=MOTIONS[motion].frames.map((_,frame)=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    drawMotion(canvas.getContext('2d'),atlas,motion,frame/MOTIONS[motion].fps+.001,{direction,ball:false,appearance:playerAppearance(player||{id:'reel-fallback',primaryPosition:keeper?'GK':'MF'}),kit,goalkeeper:keeper});
    if(motion==='shoot'&&direction==='left'){const ctx=canvas.getContext('2d'),copy=document.createElement('canvas');copy.width=copy.height=256;copy.getContext('2d').drawImage(canvas,0,0);ctx.clearRect(0,0,256,256);ctx.save();ctx.translate(256,0);ctx.scale(-1,1);ctx.drawImage(copy,0,0);ctx.restore();}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;allTextures.add(texture);return texture;
   });
  }
  cache.set(key,bank);return bank;
 }
 function setOpponent(match){
  const opponent=clubs.find(c=>c.id===match.opponent?.id)||match.opponent,enemy=startingFive(opponent);
  const players=[own[4],own[2],enemy[4],enemy[2],own[0],own[1],own[3],enemy[0],enemy[1],enemy[3]];
  players.forEach((p,i)=>{const kit=[2,3,7,8,9].includes(i)?opponent?.color||'#ee8a53':club.color;actors[i].textures=textures(p,kit,i===4||i===7,i<4);});
 }
 function background(time,ball){
  const lane=1.5+Math.sin(time*.85)*2,pace=Math.cos(time*.85);
  return [0,1,2,3,4,5].map(i=>{
   const side=i<3?-1:1;
   if(i===0||i===3)return {x:side*18.2,z:Math.sin(time*.7+i)*.28+THREE.MathUtils.clamp(ball.z*.09,-.65,.65),heading:-side,motion:'idle',rate:1};
   if(i===2||i===5){const enemy=i===5;return {x:lane+(enemy?1.1:0),z:5.8+(enemy?.65:0)+Math.sin(time*1.3)*(enemy?.25:.4),heading:Math.abs(pace)<.2?(enemy?-1:1):(pace>0?1:-1),motion:Math.abs(pace)<.22?'idle':'run',rate:.65};}
   return {x:side*10.5+THREE.MathUtils.clamp(ball.x*.12,-1.1,1.1)+Math.sin(time*.9+i)*.45,z:2.9+Math.sin(time*.75+i)*.7,heading:Math.cos(time*.9+i)>0?1:-1,motion:Math.abs(Math.cos(time*.9+i))<.35?'idle':'run',rate:.55};
  });
 }
 // Bake all fixture opponents before playback to avoid pauses at scene cuts.
 try{fixtures.forEach(setOpponent);if(fixtures.length)setOpponent(fixtures[0]);}
 catch(error){court.dispose();allTextures.forEach(t=>t.dispose());throw error;}
 return {render(time){
  const f=seasonReelFrame(fixtures,time);if(f.done)return f;
  if(currentIndex!==f.index){currentIndex=f.index;setOpponent(f.match);previousBall=null;camera.position.set(-1,5,11.5);}
  const states=[f.runner,f.support,f.rival,f.farRival,...background(time,f.ball)];
  const leader=f.match.outcome==='loss'&&f.t>=3?f.rival:f.match.outcome==='win'&&f.match.type==='pass'&&f.t>=3.2&&f.t<4.3?f.support:f.runner;
  focus.set(leader.x+1,1,-.5);camera.position.lerp(new THREE.Vector3(focus.x+1,5,focus.z+12),.06);camera.lookAt(focus);camera.updateMatrixWorld();right.setFromMatrixColumn(camera.matrixWorld,0);
  states.forEach((p,i)=>{const a=actors[i];a.sprite.position.set(p.x,.09,p.z);a.shadow.position.set(p.x,.098,p.z);if(Math.abs(right.x)>.08)a.facing=right.x*p.heading>0?'right':'left';const frames=a.textures[`${p.motion}-${a.facing}`];a.sprite.material.map=frames[Math.floor(time*MOTIONS[p.motion].fps*(p.rate??p.animationRate??1))%frames.length];});
  ball.position.set(f.ball.x,.244,f.ball.z);if(previousBall){const d=ball.position.clone().sub(previousBall);if(d.lengthSq()>0&&d.length()<1)ball.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(d.z,0,-d.x).normalize(),d.length()/.154));}previousBall=ball.position.clone();
  crowd(time*1000);court.animate(time*1000);court.render(focus);host.style.opacity=String(1-f.fade);return f;
 },renderShot(time,kind){
  const kick=.65,flight=.95,q=THREE.MathUtils.smoothstep(time,0,kick);
  const positions=[[8+q*.8,0],[10,-4],[15,2.8],[13,-4.8],[-18.2,0],[8,4],[10,5],[18.2,0],[16,-3],[14,5]];
  camera.position.set(5.5,5,13);camera.lookAt(13.5,1,0);camera.updateMatrixWorld();right.setFromMatrixColumn(camera.matrixWorld,0);
  actors.forEach((a,i)=>{a.sprite.visible=a.shadow.visible=i===0||i===7;const [x,z]=positions[i];a.sprite.position.set(x,.09,z);a.shadow.position.set(x,.098,z);const direction=right.x*(i===2||i===3||i>=7?-1:1)>0?'right':'left';const motion=i===0?(time<kick?'dribble':'shoot'):'idle',frames=a.textures[`${motion}-${direction}`];a.sprite.material.map=frames[motion==='shoot'?Math.min(frames.length-1,Math.floor((time-kick)*MOTIONS.shoot.fps)):Math.floor(time*MOTIONS[motion].fps)%frames.length];});
  const p=THREE.MathUtils.clamp((time-flight)/1.25,0,1),targetZ=1.1;
  ball.position.set(time<flight?8.55+q*.8:THREE.MathUtils.lerp(9.35,15.2,p),.244+Math.sin(p*Math.PI/2)*1.05,targetZ*p);
  ball.rotation.z=-time*12;crowd(time*1000);court.animate(time*1000);court.render();host.style.opacity=String(Math.min(1,time/.25)*(1-THREE.MathUtils.smoothstep(time,1.7,2.2)));
 },resize(w,h){court.resize(w,h);},dispose(){court.dispose();allTextures.forEach(t=>t.dispose());cache.clear();}};
}
