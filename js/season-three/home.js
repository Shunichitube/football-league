import * as THREE from 'three';
import {createCourt} from './court.js';
import {createCrowd} from './crowd.js';
import {createFootball} from './football.js';
import {loadMotionAtlas,drawMotion,MOTIONS} from '../player-motion.js';

// A looping exhibition, entirely independent of league state and match RNG.
export async function mountHomeStadium(host){
 const atlas=await loadMotionAtlas();
 if(!host.isConnected)return ()=>{};
 const court=createCourt(host,innerWidth,innerHeight),{scene,camera}=court;
 camera.fov=68;camera.updateProjectionMatrix();
 const crowd=createCrowd(scene),ball=createFootball();ball.scale.setScalar(.7);scene.add(ball);
 const actors=[],textures=[],right=new THREE.Vector3(),pointer=new THREE.Vector2(),smooth=new THREE.Vector2();
 for(let i=0;i<10;i++){
  const goalkeeper=i%5===0,bank={};
  for(const motion of goalkeeper?['idle','catch']:['idle','run','dribble','shoot'])for(const direction of ['left','right']){
   bank[`${motion}-${direction}`]=MOTIONS[motion].frames.map((_,frame)=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    drawMotion(canvas.getContext('2d'),atlas,motion,frame/MOTIONS[motion].fps+.001,{direction,goalkeeper,loop:false,ball:false,kit:i<5?'#42b8e6':'#ee8a53',appearance:{seed:i*197,hairStyle:i*3%20,hairColor:i%10,skinTone:i%3,face:i%3}});
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);return texture;
   });
  }
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:bank['idle-right'][0],depthWrite:false}));sprite.center.set(.5,0);sprite.scale.set(1.82,1.82,1);scene.add(sprite);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.35,20),new THREE.MeshBasicMaterial({color:0x031421,transparent:true,opacity:.3,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.scale.y=.6;scene.add(shadow);
  actors.push({sprite,shadow,bank});
 }
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let clock=0,last=0,raf=0,dead=false,paused=false;
 const lerp=THREE.MathUtils.lerp;
 function paint(t){
  // Each half-cycle swaps attacking teams without teleporting the players.
  const cycle=t%36,sign=cycle<18?1:-1,u=cycle%18;
  const advance=u<10?THREE.MathUtils.smoothstep(u,1,10):1-THREE.MathUtils.smoothstep(u,13,18);
  const x=-5+advance*14;
  const positions=[[-18.5,0],[-10+advance*3,2.8],[x-3,-4.3],[x-1,5],[x,0],[18.5,0],[11+advance*2,2],[x+1.7,-3.5],[x+1.8,4.2],[x+1.5,.8]];
  // Opposite direction on the next possession; goalkeepers stay at their goals.
  if(sign<0){for(let i=1;i<5;i++){const own=positions[i],opponent=positions[i+5];positions[i]=[-opponent[0],opponent[1]];positions[i+5]=[-own[0],own[1]];}}
  const offset=sign>0?0:5,fw=positions[offset+4],mf=positions[offset+2],receiver=positions[offset+3];
  let bx=fw[0]+sign*.55,bz=fw[1],by=.244;
  if(u>=4&&u<6){const f=(u-4)/2;bx=lerp(fw[0],mf[0],f);bz=lerp(fw[1],mf[1],f);}
  else if(u>=6&&u<7){bx=mf[0]+sign*.5;bz=mf[1];}
  else if(u>=7&&u<9){const f=(u-7)/2;bx=lerp(mf[0],receiver[0],f);bz=lerp(mf[1],receiver[1],f);}
  else if(u>=9&&u<10.5){const f=(u-9)/1.5;bx=lerp(receiver[0],fw[0],f);bz=lerp(receiver[1],fw[1],f);}
  else if(u>=11&&u<12.5){const f=(u-11)/1.5;bx=lerp(fw[0]+sign*.55,sign*18.5,f);bz=lerp(0,.3,f);by+=Math.sin(f*Math.PI/2)*.8;}
  else if(u>=12.5&&u<14){bx=sign*18.5;bz=.3;}
  else if(u>=14){const f=(u-14)/4;bx=lerp(sign*18.5,fw[0],f);bz=lerp(.3,fw[1],f);}
  smooth.lerp(reduced.matches?new THREE.Vector2():pointer,.04);
  camera.position.set(smooth.x*.8,8.5+smooth.y*.4,20.5);camera.lookAt(smooth.x*1.7,.5+smooth.y*.5,0);camera.updateMatrixWorld();right.setFromMatrixColumn(camera.matrixWorld,0);
  actors.forEach((a,i)=>{
   const keeper=i%5===0,p=positions[i],jitter=keeper?.22:.5;
   const px=p[0]+Math.sin(t*.9+i)*jitter,pz=p[1]+Math.sin(t*1.2+i)*jitter;
   const defendingKeeper=i===(sign>0?5:0),catching=defendingKeeper&&u>=12.3&&u<14;
   const shooter=i===offset+4&&u>=10.5&&u<11.4;
   const motion=keeper?(catching?'catch':'idle'):shooter?'shoot':i===offset+4&&u<4?'dribble':Math.abs(Math.cos(t*.9+i))<.15?'idle':'run';
   const direction=right.x*(keeper?(bx>px?1:-1):sign*(i<5?1:-1))>0?'right':'left',frames=a.bank[`${motion}-${direction}`];
   const seconds=catching?u-12.3:shooter?u-10.5:t*.75;
   const step=Math.floor(seconds*MOTIONS[motion].fps);a.sprite.material.map=frames[['shoot','catch'].includes(motion)?Math.min(frames.length-1,step):step%frames.length];
   a.sprite.position.set(px,.09,pz);a.shadow.position.set(px,.098,pz);
  });
  ball.visible=!(u>=12.8&&u<14);ball.position.set(bx,by,bz);ball.rotation.z=-t*5;
  crowd(t*1000);court.animate(t*1000);court.render();host.dataset.ready='true';host.dataset.players='10';
 }
 function tick(now){if(dead)return;if(last&&!paused&&!document.hidden&&!reduced.matches)clock+=Math.min((now-last)/1000,.1);last=now;if(!document.hidden)paint(clock);raf=requestAnimationFrame(tick);}
 function move(e){pointer.set((e.clientX/innerWidth-.5)*2,-(e.clientY/innerHeight-.5)*2);}
 function leave(){pointer.set(0,0);}
 function resize(){court.resize(innerWidth,innerHeight);paint(clock);}
 function toggle(e){const button=e.target.closest('[data-arena-motion]');if(!button)return;paused=!paused;button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'演出を再生':'演出を一時停止';}
 addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',leave);addEventListener('resize',resize);document.addEventListener('click',toggle);
 paint(0);raf=requestAnimationFrame(tick);
 return ()=>{dead=true;cancelAnimationFrame(raf);removeEventListener('pointermove',move);document.removeEventListener('pointerleave',leave);removeEventListener('resize',resize);document.removeEventListener('click',toggle);court.dispose();textures.forEach(t=>t.dispose());};
}
