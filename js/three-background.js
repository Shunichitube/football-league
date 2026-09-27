import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const app = document.querySelector('#app');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111f);
scene.fog = new THREE.Fog(0x07111f, 18, 34);

const camera = new THREE.OrthographicCamera(-9, 9, 5.2, -5.2, 0.1, 100);
camera.position.set(10.5, 11.5, 13.5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.domElement.id = 'three-club-bg';
renderer.domElement.setAttribute('aria-hidden', 'true');
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
document.body.prepend(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xbfe5ff, 0x0c1a12, 1.65);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(-5, 12, 7);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -13;
key.shadow.camera.right = 13;
key.shadow.camera.top = 10;
key.shadow.camera.bottom = -10;
scene.add(key);

const rim = new THREE.DirectionalLight(0x7dd3fc, 0.85);
rim.position.set(8, 7, -8);
scene.add(rim);

const world = new THREE.Group();
scene.add(world);

const pitch = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 8.7),
  new THREE.MeshStandardMaterial({ color: 0x187447, roughness: 0.96, metalness: 0 })
);
pitch.rotation.x = -Math.PI / 2;
pitch.receiveShadow = true;
world.add(pitch);

const stripeMatA = new THREE.MeshStandardMaterial({ color: 0x1c7c4c, roughness: 1 });
const stripeMatB = new THREE.MeshStandardMaterial({ color: 0x176b42, roughness: 1 });
for (let i = 0; i < 10; i++) {
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 8.55), i % 2 ? stripeMatA : stripeMatB);
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(-7.11 + i * 1.58, 0.012, 0);
  stripe.receiveShadow = true;
  world.add(stripe);
}

const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8fff0 });
function lineBox(w,d,x,z){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, .026, d), lineMat);
  m.position.set(x, .035, z);
  world.add(m);
}
lineBox(15.65,.055,0,-4.12); lineBox(15.65,.055,0,4.12);
lineBox(.055,8.28,-7.82,0); lineBox(.055,8.28,7.82,0);
lineBox(.055,8.28,0,0);
lineBox(2.1,.055,-6.78,-2.25); lineBox(2.1,.055,-6.78,2.25);
lineBox(.055,4.55,-5.73,0);
lineBox(2.1,.055,6.78,-2.25); lineBox(2.1,.055,6.78,2.25);
lineBox(.055,4.55,5.73,0);

const circle = new THREE.Mesh(
  new THREE.RingGeometry(.82,.87,64),
  new THREE.MeshBasicMaterial({ color: 0xe8fff0, side: THREE.DoubleSide })
);
circle.rotation.x = -Math.PI / 2;
circle.position.y = .04;
world.add(circle);

function makeGoal(side){
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xf2fbff, roughness: .5 });
  const netMat = new THREE.MeshBasicMaterial({ color: 0xcdebf7, transparent:true, opacity:.17, wireframe:true });
  const postGeoV = new THREE.BoxGeometry(.1,1.4,.1);
  const postGeoH = new THREE.BoxGeometry(.1,.1,2.55);
  for (const z of [-1.25,1.25]) {
    const p = new THREE.Mesh(postGeoV,postMat); p.position.set(0,.7,z); p.castShadow=true; group.add(p);
  }
  const bar = new THREE.Mesh(postGeoH,postMat); bar.rotation.y=Math.PI/2; bar.position.set(0,1.4,0); bar.castShadow=true; group.add(bar);
  const net = new THREE.Mesh(new THREE.BoxGeometry(1.0,1.35,2.45,4,3,6),netMat);
  net.position.set(side==='left' ? -.48 : .48,.67,0);
  group.add(net);
  group.position.x = side==='left' ? -7.87 : 7.87;
  world.add(group);
}
makeGoal('left'); makeGoal('right');

const standMat = new THREE.MeshStandardMaterial({ color: 0x122235, roughness:.85 });
const stand = new THREE.Mesh(new THREE.BoxGeometry(13.8,2.4,2.2),standMat);
stand.position.set(0,1.2,-6.1);
stand.receiveShadow=true; stand.castShadow=true;
scene.add(stand);

for(let i=0;i<18;i++){
  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(.22,.12,.12),
    new THREE.MeshBasicMaterial({ color: i%3===0 ? 0x86efac : 0xe0ecff })
  );
  lamp.position.set(-6.1+i*.72,2.15,-4.96);
  scene.add(lamp);
}

const sign = new THREE.Mesh(
  new THREE.BoxGeometry(4.6,.95,.12),
  new THREE.MeshStandardMaterial({ color:0x0a1522, emissive:0x0a1522, roughness:.6 })
);
sign.position.set(0,2.55,-4.98);
scene.add(sign);

function makePlayer(starter=true,index=0){
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color:[0xe0ad86,0xc98e68,0xf0c6a2][index%3], roughness:.9 });
  const hair = new THREE.MeshStandardMaterial({ color:[0x241a14,0x4a2d1b,0x16181d][index%3], roughness:1 });
  const kit = new THREE.MeshStandardMaterial({ color: starter ? 0x4ade80 : 0x64748b, roughness:.78 });
  const shorts = new THREE.MeshStandardMaterial({ color:0xe5e7eb, roughness:.8 });
  const shoe = new THREE.MeshStandardMaterial({ color:0x111827, roughness:.7 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(.48,.62,.30),kit); torso.position.y=1.18; torso.castShadow=true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.24,16,12),skin); head.position.y=1.72; head.castShadow=true; g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.245,16,8,0,Math.PI*2,0,Math.PI*.55),hair); cap.position.y=1.78; cap.castShadow=true; g.add(cap);

  const hip = new THREE.Mesh(new THREE.BoxGeometry(.42,.22,.30),shorts); hip.position.y=.78; hip.castShadow=true; g.add(hip);
  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(.13,.55,.13),skin); lLeg.position.set(-.12,.42,0); lLeg.castShadow=true; g.add(lLeg);
  const rLeg = lLeg.clone(); rLeg.position.x=.12; g.add(rLeg);
  const lShoe = new THREE.Mesh(new THREE.BoxGeometry(.16,.10,.28),shoe); lShoe.position.set(-.12,.11,.05); lShoe.castShadow=true; g.add(lShoe);
  const rShoe = lShoe.clone(); rShoe.position.x=.12; g.add(rShoe);

  const lArm = new THREE.Mesh(new THREE.BoxGeometry(.12,.52,.12),skin); lArm.position.set(-.33,1.12,0); lArm.rotation.z=.12; lArm.castShadow=true; g.add(lArm);
  const rArm = lArm.clone(); rArm.position.x=.33; rArm.rotation.z=-.12; g.add(rArm);

  g.userData={torso,lLeg,rLeg,lArm,rArm,kit,starter,index,phase:index*.71,baseX:0,baseZ:0};
  return g;
}

const placements=[
  [-3.4,-1.5],[-1.4,-.5],[1.0,-1.3],[3.2,-.3],
  [-4.3,1.6],[-2.2,2.0],[0,1.7],[2.4,2.1],[4.2,1.45],[5.4,-1.8],
  [-5.7,3.2],[5.8,3.15]
];
const players = placements.map((p,i)=>{
  const g=makePlayer(i<5,i); g.position.set(p[0],0,p[1]); g.scale.setScalar(.72);
  g.userData.baseX=p[0]; g.userData.baseZ=p[1]; world.add(g); return g;
});

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(.13,16,12),
  new THREE.MeshStandardMaterial({ color:0xf8fafc, roughness:.55 })
);
ball.castShadow=true;
ball.position.set(-3.4,.16,-1.5);
world.add(ball);

const clubColor = new THREE.Color(0x4ade80);
function readClubColor(){
  const raw=app?.querySelector('.hero[style*="--club"]')?.style.getPropertyValue('--club')?.trim();
  if(raw){ try{ clubColor.set(raw); }catch{} }
  for(const p of players) if(p.userData.starter) p.userData.kit.color.copy(clubColor);
}

function activeScreen(){
  const main=app?.querySelector(':scope > main');
  if(!main) return false;
  if(main.classList.contains('title')||main.classList.contains('screen-title')||main.classList.contains('screen-home')) return true;
  return (main.querySelector('h2')?.textContent||'').includes('編成と戦術');
}
function refreshActive(){
  const on=activeScreen();
  document.body.classList.toggle('living-bg-active',on);
  renderer.domElement.style.opacity=on?'1':'0';
  renderer.domElement.style.pointerEvents='none';
  readClubColor();
}
new MutationObserver(refreshActive).observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
refreshActive();

const pointer={x:0,y:0};
addEventListener('pointermove',e=>{
  pointer.x=(e.clientX/innerWidth-.5)*2;
  pointer.y=(e.clientY/innerHeight-.5)*2;
},{passive:true});

function resize(){
  renderer.setSize(innerWidth,innerHeight,false);
  const aspect=innerWidth/innerHeight;
  const h=5.2;
  camera.top=h; camera.bottom=-h; camera.left=-h*aspect; camera.right=h*aspect;
  camera.updateProjectionMatrix();
}
addEventListener('resize',resize,{passive:true}); resize();

function animatePlayer(p,t,i){
  const u=p.userData;
  const sway=Math.sin(t*1.35+u.phase);
  const roam=i>=4&&i<10 ? .16 : 0;
  p.position.x=u.baseX + Math.sin(t*.43+u.phase)*roam;
  p.position.z=u.baseZ + Math.cos(t*.37+u.phase)*roam*.65;
  p.position.y=Math.max(0,sway*.018);
  u.lArm.rotation.x=sway*.35;
  u.rArm.rotation.x=-sway*.35;
  u.lLeg.rotation.x=-sway*.22;
  u.rLeg.rotation.x=sway*.22;
  p.rotation.y=Math.sin(t*.28+u.phase)*.18;
}

function updateBall(t){
  const drill=[players[0],players[1],players[2],players[3]];
  const cycle=(t*.34)%4;
  const from=Math.floor(cycle),to=(from+1)%4,f=cycle-from;
  const a=drill[from].position,b=drill[to].position;
  const ease=f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2;
  ball.position.x=THREE.MathUtils.lerp(a.x,b.x,ease);
  ball.position.z=THREE.MathUtils.lerp(a.z,b.z,ease);
  ball.position.y=.14+Math.sin(Math.PI*f)*.35;

  const kicker=drill[from];
  kicker.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
  if(f<.18) kicker.userData.rLeg.rotation.x=-.85*Math.sin((f/.18)*Math.PI);
}

let last=0;
function render(ms){
  requestAnimationFrame(render);
  if(document.hidden) return;
  const t=reducedMotion.matches?0:ms*.001;
  const dt=Math.min(.032,(ms-last)*.001||.016); last=ms;

  readClubColor();
  players.forEach((p,i)=>animatePlayer(p,t,i));
  updateBall(t);

  const targetX=pointer.x*.35,targetZ=pointer.y*.12;
  camera.position.x=THREE.MathUtils.lerp(camera.position.x,10.5+targetX,dt*2.5);
  camera.position.z=THREE.MathUtils.lerp(camera.position.z,13.5+targetZ,dt*2.5);
  camera.lookAt(0,0,0);

  renderer.render(scene,camera);
}
requestAnimationFrame(render);
