import {mobileRendering,renderPixelRatio} from '../render-budget.js?v=mobile-memory-v1';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


import { dressArena } from './luxury.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createCourt(host,width,height){
let innerWidth=width,innerHeight=height;
const scene=new THREE.Scene();scene.background=new THREE.Color('#080e18');scene.fog=new THREE.Fog('#080e18',75,150);
const mobile=mobileRendering();
const renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:mobile?'low-power':'default'});renderer.setPixelRatio(renderPixelRatio(innerWidth,innerHeight));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=!mobile;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;host.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,220);camera.position.set(49,38,52);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(-2,0,0);controls.enableDamping=true;controls.minDistance=5;controls.maxDistance=100;controls.maxPolarAngle=Math.PI/2-.03;controls.autoRotateSpeed=.4;
scene.add(new THREE.HemisphereLight(0xb8dfff,0x182330,2));
const mat=(color,roughness=.7,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const navy=mat('#152332'),concrete=mat('#253745'),white=mat('#e2f7ff'),teal=mat('#2bd4c6');
function box(w,h,d,m,x,y,z){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;}
function rod(a,b,r,m,parent=scene){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av);const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),8),m);o.position.copy(av.add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());o.castShadow=true;parent.add(o);return o;}
box(66,.8,46,navy,0,-.5,0);box(46,.12,26,mat('#543c2b',.38),0,0,0);
// A procedural surface keeps the prototype independent of image assets.
const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;const ctx=canvas.getContext('2d');ctx.fillStyle='#25652b';ctx.fillRect(0,0,2048,1024);
for(let x=0;x<2048;x+=102){ctx.fillStyle=x%204<102?'#347c35':'#2d7130';ctx.fillRect(x,0,102,1024);}
for(let x=0;x<2048;x+=9){ctx.fillStyle='rgba(220,245,255,.025)';ctx.fillRect(x,0,1,1024);}
const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,20),new THREE.MeshStandardMaterial({map:texture,roughness:.24,metalness:.3}));floor.rotation.x=-Math.PI/2;floor.position.y=.075;floor.receiveShadow=true;scene.add(floor);
function line(points,color=0xffeed3){const g=new THREE.BufferGeometry().setFromPoints(points.map(([x,z])=>new THREE.Vector3(x,.091,z)));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color}));scene.add(l);}
line([[-20,-10],[20,-10],[20,10],[-20,10],[-20,-10]]);line([[0,-10],[0,10]]);
function arc(cx,cz,r,start=0,end=Math.PI*2){line(Array.from({length:97},(_,i)=>[cx+Math.cos(start+(end-start)*i/96)*r,cz+Math.sin(start+(end-start)*i/96)*r]));}
arc(0,0,3);
for(const sign of [-1,1]){
 const x=20*sign;
 const points=[[x,-7.5]];
 for(let i=0;i<=24;i++){const a=i/24*Math.PI/2;points.push([x-sign*6*Math.sin(a),-1.5-6*Math.cos(a)]);}
 points.push([x-sign*6,1.5]);
 for(let i=0;i<=24;i++){const a=i/24*Math.PI/2;points.push([x-sign*6*Math.cos(a),1.5+6*Math.sin(a)]);}
 line(points);arc(x-sign*6,0,.09);arc(x-sign*10,0,.09);
 for(const z of [-10,10]){const a=sign===1?(z===10?Math.PI:Math.PI/2):(z===10?-Math.PI/2:0);arc(x,z,.25,a,a+Math.PI/2);}
 const goalStart=scene.children.length;
 const back=x+sign*1.5;
 rod([x,.1,-1.5],[x,2.1,-1.5],.055,white);rod([x,.1,1.5],[x,2.1,1.5],.055,white);rod([x,2.1,-1.5],[x,2.1,1.5],.055,white);
 for(const z of [-1.5,1.5]){rod([x,2.1,z],[back,1.8,z],.035,white);rod([back,.1,z],[back,1.8,z],.035,white);rod([x,.1,z],[back,.1,z],.035,white);}
 const nets=[];function segment(a,b){nets.push(...a,...b);}
 for(let z=-1.5;z<=1.501;z+=.15){segment([back,.1,z],[back,1.8,z]);segment([x,2.1,z],[back,1.8,z]);}
 for(let y=.1;y<=1.801;y+=.15){segment([back,y,-1.5],[back,y,1.5]);for(const z of [-1.5,1.5])segment([x,y,z],[back,y,z]);}
 for(let d=0;d<=1.501;d+=.15){const xx=x+sign*d;for(const z of [-1.5,1.5])segment([xx,.1,z],[xx,2.1-d*.2,z]);segment([xx,2.1-d*.2,-1.5],[xx,2.1-d*.2,1.5]);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(nets,3));scene.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xb1d2dc,transparent:true,opacity:.48})));
 const goalParts=scene.children.slice(goalStart),goal=new THREE.Group();goal.position.set(x,.1,0);scene.add(goal);goalParts.forEach(part=>goal.attach(part));goal.scale.setScalar(1.5);
}
// Shared geometry and instancing allow thousands of seats with few draw calls.
const seatGeo=new THREE.BoxGeometry(.66,.16,.65),backGeo=new THREE.BoxGeometry(.66,.62,.12);const seats=[],backs=[];
for(const side of [-1,1])for(let row=0;row<8;row++){
 const z=side*(14+row*.95),y=.55+row*.65;box(52,.65,.96,concrete,0,y-.4,z);
 for(let col=0;col<62;col++){if(col%16<2)continue;const x=(col-30.5)*.8;seats.push([x,y,z]);backs.push([x,y+.35,z+side*.28]);}
}
for(const side of [-1,1])for(let row=0;row<7;row++){
 const x=side*(24+row*.95),y=.55+row*.65;box(.96,.65,26,concrete,x,y-.4,0);
 for(let col=0;col<30;col++){if(col%15<2)continue;const z=(col-14.5)*.8;seats.push([x,y,z]);backs.push([x+side*.28,y+.35,z]);}
}
function instances(geo,positions){const mesh=new THREE.InstancedMesh(geo,mat('#24677c'),positions.length);const dummy=new THREE.Object3D();positions.forEach((p,i)=>{dummy.position.set(...p);dummy.rotation.y=Math.abs(p[0])>25?Math.PI/2:0;dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(i%13===0?'#49c9bc':i%7===0?'#152e44':'#24677c'));});mesh.receiveShadow=true;mesh.castShadow=true;scene.add(mesh);}
instances(seatGeo,seats);instances(backGeo,backs);
function panel(text,w,h,bg='#0d1f2e',fg='#62e8dc') {const c=document.createElement('canvas');c.width=1024;c.height=256;const p=c.getContext('2d');p.fillStyle=bg;p.fillRect(0,0,c.width,c.height);p.fillStyle=fg;p.font='600 74px Arial';p.textAlign='center';p.textBaseline='middle';p.fillText(text,512,128);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));}
for(const side of [-1,1]){box(45,.8,.15,navy,0,.45,side*12.4);for(let i=-2;i<=2;i++){const p=panel(i%2===0?'NIGHT COURT':'PLAY THE CITY',8,.62);p.position.set(i*8.8,.49,side*12.3);if(side===1)p.rotation.y=Math.PI;scene.add(p);}box(.15,.8,22,navy,side*22.6,.45,0);}
for(const side of [-1,1]){box(3,1,12,navy,side*31,5,0);const score=panel('HOME  0 : 0  AWAY',10,2.4);score.position.set(side*29.4,7,0);score.rotation.y=-side*Math.PI/2;scene.add(score);const clock=panel('20:00  ·  FIRST HALF',10,.8);clock.position.set(side*29.3,5.4,0);clock.rotation.y=-side*Math.PI/2;scene.add(clock);}
const glow=new THREE.MeshBasicMaterial({color:'#75f5ed'});
for(const side of [-1,1]){box(52,.055,.07,glow,0,5.35,side*21.2);box(.07,.055,27,glow,side*30.1,4.7,0);}
// Open roof trusses frame the arena without hiding the court from above.
const steel=mat('#334656',.45,.7);
for(const x of [-25,-12,0,12,25]){
 for(const side of [-1,1]){rod([x,0,side*23],[x,14,side*23],.17,steel);rod([x,14,side*23],[x,16,side*8],.1,steel);rod([x,13.4,side*23],[x,15.4,side*8],.08,steel);}
 for(const z of [-8,8]){box(2.4,.12,.65,new THREE.MeshBasicMaterial({color:'#e4f8ff'}),x,14.2,z);}
}
const spots=[];
for(const x of [-14,14])for(const z of [-7,7]){const light=new THREE.SpotLight(0xd5eaff,360,65,.78,.6,1.5);light.position.set(x,15,z);light.target.position.set(x*.6,0,z*.3);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.bias=-.0003;scene.add(light,light.target);spots.push(light);}
const accent=new THREE.PointLight(0x29ddda,130,45,2);accent.position.set(0,5,-15);scene.add(accent);
// Small player figures provide a sense of scale.
for(const side of [-1,1])for(let i=0;i<1;i++){
 continue;
 const x=side*(i===0?18:5+(i%2)*5),z=i===0?0:(i-2.5)*3;
 const kit=mat(side===1?'#ffb56c':'#dceeff');const body=new THREE.Mesh(new THREE.CapsuleGeometry(.22,.48,4,8),kit);body.position.set(x,1,z);body.castShadow=true;scene.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.17,12,8),mat('#c68e70'));head.position.set(x,1.65,z);head.castShadow=true;scene.add(head);
 for(const dz of [-.13,.13])rod([x,.18,z+dz],[x,.75,z+dz],.09,navy);
}
const animateLuxury = dressArena(scene);
// Mobile avoids multiple floating-point postprocessing buffers.
const composer=mobile?null:new EffectComposer(renderer);if(composer){composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.25,.5,1.15));composer.addPass(new OutputPass());}

controls.enabled=false;
let contextLost=false;renderer.domElement.addEventListener('webglcontextlost',()=>{contextLost=true;});
return {scene,camera,controls,render(){if(contextLost)throw new Error('WebGL context lost');if(composer)composer.render();else renderer.render(scene,camera);},resize(w,h){const ratio=renderPixelRatio(w,h);renderer.setPixelRatio(ratio);renderer.setSize(w,h);composer?.setPixelRatio(ratio);composer?.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();},dispose(){controls.dispose();composer?.passes.forEach(p=>p.dispose?.());composer?.dispose();const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();},animate:animateLuxury};
}
