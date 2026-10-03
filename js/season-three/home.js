import * as THREE from 'three';
import {createCourt} from './court.js';
import {createCrowd} from './crowd.js';
import {createFootball} from './football.js';
import {homeExhibitionFrame} from './home-exhibition.js';
import {loadMotionAtlas,drawMotion,MOTIONS} from '../player-motion.js';

// A looping exhibition, entirely independent of league state and match RNG.
export async function mountHomeStadium(host){
 const atlas=await loadMotionAtlas();
 if(!host.isConnected)return ()=>{};
 const court=createCourt(host,innerWidth,innerHeight),{scene,camera,controls}=court;
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
 let view='free';
 const dock=document.createElement('nav');dock.className='home-camera-dock';dock.setAttribute('aria-label','スタジアムの視点');
 for(const [key,title] of [['stand','観客席'],['free','自由視点'],['overview','全体'],['sideline','コート脇'],['top','真上']]){const button=document.createElement('button');button.textContent=title;button.dataset.homeView=key;button.setAttribute('aria-pressed',String(key===view));dock.append(button);}document.body.append(dock);
 const views={free:[0,8.5,20.5],overview:[32,29,35],sideline:[0,4,12.5],top:[.01,46,.01]};
 function changeView(e){const key=e.target.closest('[data-home-view]')?.dataset.homeView;if(!key)return;view=key;controls.enabled=view!=='stand';controls.enableDamping=false;host.style.pointerEvents=controls.enabled?'auto':'none';if(view!=='stand'){camera.position.set(...views[view]);controls.target.set(0,.5,0);controls.update();}dock.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.homeView===view)));}dock.addEventListener('click',changeView);
 controls.enabled=true;controls.enableDamping=false;host.style.pointerEvents='auto';camera.position.set(...views.free);controls.target.set(0,.5,0);controls.update();
 function paint(t){
  const exhibition=homeExhibitionFrame(t),{actors:states,ball:football}=exhibition;
  smooth.lerp(reduced.matches?new THREE.Vector2():pointer,.04);
  if(view==='stand'){camera.position.set(smooth.x*.8,8.5+smooth.y*.4,20.5);camera.lookAt(smooth.x*1.7,.5+smooth.y*.5,0);}else controls.update();camera.updateMatrixWorld();right.setFromMatrixColumn(camera.matrixWorld,0);
  actors.forEach((a,i)=>{
   const p=states[i],px=p.x,pz=p.z,motion=p.motion;
   const moving=Math.hypot(p.vx,p.vz)>0;
   const horizontal=moving?right.x*p.vx+right.z*p.vz:right.x*(football.x-px)+right.z*(football.z-pz);
   if(Math.abs(horizontal)>.01)a.facing=horizontal>0?'right':'left';
   const direction=a.facing||'right',frames=a.bank[`${motion}-${direction}`];
   const seconds=['shoot','catch'].includes(motion)?p.actionTime:t*.7;
   const step=Math.floor(seconds*MOTIONS[motion].fps);a.sprite.material.map=frames[['shoot','catch'].includes(motion)?Math.min(frames.length-1,step):step%frames.length];
   a.sprite.position.set(px,.09,pz);a.shadow.position.set(px,.098,pz);
  });
  ball.visible=football.visible;ball.position.set(football.x,football.y,football.z);ball.rotation.z=-t*5;
  crowd(t*1000);court.animate(t*1000);court.render();host.dataset.ready='true';host.dataset.players='10';
 }
 function tick(now){if(dead)return;if(last&&!paused&&!document.hidden&&!reduced.matches)clock+=Math.min((now-last)/1000,.1)*.9;last=now;if(!document.hidden)paint(clock);raf=requestAnimationFrame(tick);}
 function move(e){pointer.set((e.clientX/innerWidth-.5)*2,-(e.clientY/innerHeight-.5)*2);}
 function leave(){pointer.set(0,0);}
 function resize(){court.resize(innerWidth,innerHeight);paint(clock);}
 function toggle(e){const button=e.target.closest('[data-arena-motion]');if(!button)return;paused=!paused;button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'演出を再生':'演出を一時停止';}
 addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',leave);addEventListener('resize',resize);document.addEventListener('click',toggle);
 paint(0);raf=requestAnimationFrame(tick);
 return ()=>{dead=true;cancelAnimationFrame(raf);removeEventListener('pointermove',move);document.removeEventListener('pointerleave',leave);removeEventListener('resize',resize);document.removeEventListener('click',toggle);dock.remove();court.dispose();textures.forEach(t=>t.dispose());};
}
