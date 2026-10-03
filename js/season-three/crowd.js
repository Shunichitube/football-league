import * as THREE from 'three';
import {drawSpectator} from '../spectator-art.js';

// Original spectator art, drawn independently of the player avatar assets.
export function createCrowd(scene){
 const colors=['#3f91bb','#dbb86a','#c26967','#5baf96','#7b79b8','#dce4e9','#c76c91','#496ac2','#c69557','#477b70','#9884c2','#e5bd87','#64a3ab','#bb6750','#697f96','#d0a25d','#779d62','#a56184','#dbd4b7','#417eab'];
 const textures=Array.from({length:20},(_,i)=>{
  const c=document.createElement('canvas');c.width=c.height=192;
  drawSpectator(c.getContext('2d'),i,colors[i]);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
 });
 const groups=Array.from({length:20},()=>[]);let count=0;
 const add=(x,y,z)=>{const i=count++;groups[(i*7+Math.floor(i/13))%20].push({x,y,z,phase:i*1.73,bounce:i%7===0?1:0});};
 // Match the actual seat layout; stair aisles stay accessible.
 for(const side of [-1,1])for(let row=0;row<8;row++)for(let col=0;col<62;col++){
  if(col%16<2)continue;
  add((col-30.5)*.8,.55+row*.65,side*(14+row*.95));
 }
 for(const side of [-1,1])for(let row=0;row<7;row++)for(let col=0;col<30;col++){
  if(col%15<2)continue;
  add(side*(24+row*.95),.55+row*.65,(col-14.5)*.8);
 }
 // Twenty batches instead of a separate draw call for every spectator.
 const clock={value:0},dummy=new THREE.Object3D();
 groups.forEach((people,i)=>{
  const geometry=new THREE.PlaneGeometry(1.05,1.05);geometry.translate(0,.525,0);
  geometry.setAttribute('crowdPhase',new THREE.InstancedBufferAttribute(new Float32Array(people.map(p=>p.phase)),1));
  geometry.setAttribute('crowdBounce',new THREE.InstancedBufferAttribute(new Float32Array(people.map(p=>p.bounce)),1));
  const material=new THREE.MeshBasicMaterial({map:textures[i],alphaTest:.15,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
   shader.uniforms.crowdTime=clock;
   shader.vertexShader='uniform float crowdTime; attribute float crowdPhase; attribute float crowdBounce;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
    vec4 center = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
    center.y += max(0.0,sin(crowdTime*3.0+crowdPhase))*0.11*crowdBounce;
    vec4 mvPosition = modelViewMatrix * center;
    mvPosition.xy += transformed.xy;
    gl_Position = projectionMatrix * mvPosition;
   `);
  };
  const mesh=new THREE.InstancedMesh(geometry,material,people.length);
  people.forEach((p,j)=>{dummy.position.set(p.x,p.y,p.z);dummy.updateMatrix();mesh.setMatrixAt(j,dummy.matrix);});
  mesh.frustumCulled=false;scene.add(mesh);
 });
 return time=>{clock.value=time/1000;};
}
