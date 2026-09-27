import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const app = document.querySelector('#app');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c3046);
scene.fog = new THREE.Fog(0x1c3046, 36, 65);

const camera = new THREE.OrthographicCamera(-9, 9, 5.2, -5.2, 0.1, 100);
// Raise the framing without tilting the horizontal court axis.
camera.position.set(0, 15, 16);
camera.lookAt(0, 2, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.domElement.id = 'three-club-bg';
renderer.domElement.setAttribute('aria-hidden', 'true');
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
document.body.prepend(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xbfe5ff, 0x35463e, 1.25);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.25);
key.position.set(-5, 12, 7);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -13;
key.shadow.camera.right = 13;
key.shadow.camera.top = 10;
key.shadow.camera.bottom = -10;
scene.add(key);

const rim = new THREE.DirectionalLight(0xaddfff, .65);
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

// Goal mouths lie in the Y/Z plane; depth extends away from the court.
function makeGoal(side){
  const direction=side==='left'?-1:1;
  const group=new THREE.Group();
  const postMat=new THREE.MeshStandardMaterial({color:0xf2fbff,roughness:.5});
  function post(w,h,d,x,y,z){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),postMat);
    mesh.position.set(x,y,z); mesh.castShadow=true; group.add(mesh);
  }
  for(const z of [-1.25,1.25]){
    post(.09,1.4,.09,0,.7,z);
    post(1,.06,.06,direction*.5,.03,z);
    post(.06,1.1,.06,direction, .55,z);
  }
  post(.09,.09,2.59,0,1.4,0);
  post(.06,.06,2.55,direction,1.1,0);
  const vertices=[];
  function segment(a,b){vertices.push(...a,...b);}
  // Rectangular mesh on the back, sides and sloping roof only.
  for(let i=0;i<=10;i++){
    const z=-1.25+i*.25;
    segment([direction,0,z],[direction,1.1,z]);
    segment([0,1.4,z],[direction,1.1,z]);
  }
  for(let i=0;i<=7;i++){
    const f=i/7;
    segment([direction,1.1*f,-1.25],[direction,1.1*f,1.25]);
    for(const z of [-1.25,1.25])
      segment([0,1.4*f,z],[direction,1.1*f,z]);
  }
  for(let i=0;i<=4;i++){
    const f=i/4,x=direction*f,h=1.4-.3*f;
    for(const z of [-1.25,1.25]) segment([x,0,z],[x,h,z]);
    segment([x,h,-1.25],[x,h,1.25]);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({
    color:0xcdebf7,transparent:true,opacity:.32
  })));
  group.position.x=direction*7.87;
  world.add(group);
}
makeGoal('left'); makeGoal('right');

function block(w,h,d,x,y,z,color){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
    new THREE.MeshStandardMaterial({color,roughness:.9}));
  mesh.position.set(x,y,z); mesh.receiveShadow=true; world.add(mesh); return mesh;
}
block(28,.18,17,0,-.14,0,0x344859);
block(28,7,.25,0,3.4,-8,0x3d536e);
for(const x of [-13.9,13.9]) block(.25,7,17,x,3.4,-.5,0x324961);
for(let row=0;row<4;row++)
  block(25,.4+row*.30,.65,0,(.4+row*.30)/2,-5.1-row*.65,0x456079);
// Side terraces occupy the former empty strips, clear of both goal nets.
for(const side of [-1,1]) for(let row=0;row<4;row++)
  block(.65,.4+row*.24,6.1,side*(10.1+row*.65),(.4+row*.24)/2,-.3,0x456079);
for(const side of [-1,1]){
  const ribbon=block(.08,.12,12,side*13.7,3.1,-1,0x9dd9ef);
  ribbon.material.emissive=new THREE.Color(0x73b7d3);
  ribbon.material.emissiveIntensity=.6;
}

// Open cutaway roof: visible rear trusses do not cover the playing area.
for(const y of [5.25,5.7]) block(22,.09,.09,0,y,-7.4,0x466077);
for(let x=-10;x<=10;x+=1){
  const brace=block(.065,.62,.065,x,5.48,-7.4,0x466077);
  brace.rotation.z=(x%2?1:-1)*.75;
}
const lampPanels=[];
for(const x of [-9,-5,5,9]){
  block(.12,1.6,.12,x,6.2,-7.4,0x30485d);
  const fixture=block(1.65,.62,.24,x,4.8,-6.2,0x30485d);
  fixture.name='arena-lamp-housing';
  // Face the visible LED banks toward the camera rather than exposing only their tops.
  for(let row=0;row<2;row++) for(let col=0;col<5;col++){
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(.24,.18),
      new THREE.MeshBasicMaterial({color:0xe6f6ff,toneMapped:false}));
    panel.position.set(x+(col-2)*.3,4.8+(row-.5)*.26,-6.05);
    panel.quaternion.copy(camera.quaternion);
    panel.name='arena-lamp-panel';
    world.add(panel); lampPanels.push(panel);
  }
  const light=new THREE.SpotLight(0xe6f3ff,100,30,Math.PI/5,.8,1.3);
  light.position.set(x,7,-3);
  light.target.position.set(x*.45,0,0);
  scene.add(light,light.target);
}
const boardCanvas=document.createElement('canvas');
boardCanvas.width=512; boardCanvas.height=96;
const boardContext=boardCanvas.getContext('2d');
boardContext.fillStyle='#06111d'; boardContext.fillRect(0,0,512,96);
boardContext.fillStyle='#81e7ff'; boardContext.textAlign='center';
boardContext.font='bold 28px monospace'; boardContext.fillText('FOOTBALL LEAGUE',256,38);
boardContext.font='18px monospace'; boardContext.fillStyle='#d5ffe6';
boardContext.fillText('HOME  00 : 00  AWAY',256,73);
const boardTexture=new THREE.CanvasTexture(boardCanvas);
boardTexture.colorSpace=THREE.SRGBColorSpace;
const board=new THREE.Mesh(new THREE.PlaneGeometry(5.4,1.01),
  new THREE.MeshBasicMaterial({map:boardTexture}));
board.position.set(0,3.65,-7.2);
board.quaternion.copy(camera.quaternion);
board.name='arena-scoreboard';
world.add(board);
const boardFrame=new THREE.Mesh(new THREE.PlaneGeometry(5.65,1.26),
  new THREE.MeshBasicMaterial({color:0x4d9db7}));
boardFrame.quaternion.copy(camera.quaternion);
boardFrame.position.copy(board.position).addScaledVector(
  new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion),-.02);
world.add(boardFrame);

// Tiny canvas textures are drawn as pixel art, never smoothed.
function pixelTexture(kit,index,appearance='player'){
  // Chunky 24 x 32 sprite: large head, compact body, one-pixel silhouette.
  const canvas=document.createElement('canvas'); canvas.width=24; canvas.height=32;
  const ctx=canvas.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const pixels=Array.from({length:32},()=>Array(24).fill(null));
  function rect(color,x,y,w,h){
    for(let py=y;py<y+h;py++) for(let px=x;px<x+w;px++)
      if(pixels[py]&&px>=0&&px<24) pixels[py][px]=color;
  }
  const skin=['#efba87','#bf8159','#f4cea4'][index%3];
  const skinShade=['#c88a61','#925a40','#d6a17c'][index%3];
  const hair=['#35241c','#81502d','#d5a344','#191d29','#a7532d','#44302b'][index%6];
  const hairLight=['#65412a','#af7540','#f3cc69','#41485a','#d38547','#77513a'][index%6];
  const kitShade='#'+new THREE.Color(kit).multiplyScalar(.48).getHexString();
  const kitLight='#'+new THREE.Color(kit).lerp(new THREE.Color('#ffffff'),.22).getHexString();

  // Oversized front-facing head with ears, two eyes and a small mouth.
  rect(skinShade,6,4,12,10); rect(skin,7,4,10,9);
  rect(skinShade,5,8,1,3); rect(skinShade,18,8,1,3);
  rect('#3b2925',8,7,2,1); rect('#3b2925',14,7,2,1);
  // Small dark eyes without whites for a softer expression.
  rect('#171b23',9,9,1,2); rect('#171b23',14,9,1,2);
  rect(skinShade,11,10,2,2); rect('#854b3e',10,12,4,1);
  const isWoman=appearance==='woman';
  if(isWoman){
    // Long hair, ponytail and bob silhouettes among the female supporters.
    rect(hair,5,2,14,3); rect(hairLight,7,2,9,1);
    const style=index%3;
    if(style===0){
      rect(hair,4,5,3,11); rect(hair,17,5,3,11);
      rect(hairLight,4,7,1,7);
    }else if(style===1){
      rect(hair,5,5,2,3); rect(hair,17,5,2,3);
      rect(hair,19,5,3,9); rect(kitLight,19,5,3,2);
    }else{
      rect(hair,4,5,3,8); rect(hair,17,5,3,8);
      rect(hairLight,4,6,1,5);
    }
    rect(hair,7,5,3,1);
  }else switch(index%6){
    case 0: // Short, square crop.
      rect(hair,6,2,12,3); rect(hair,6,5,2,2); rect(hair,17,5,1,2);
      rect(hairLight,8,2,7,1); break;
    case 1: // Side part and long swept fringe.
      rect(hair,6,2,12,3); rect(hair,6,5,4,2); rect(hair,6,7,1,2);
      rect(hairLight,8,2,3,2); rect(hairLight,12,3,5,1); break;
    case 2: // Spiky silhouette.
      rect(hair,6,3,12,2);
      for(const x of [6,10,14]) rect(hair,x,1,2,3);
      rect(hairLight,10,1,1,3); rect(hairLight,14,2,1,2); break;
    case 3: // Mohawk with shaved sides.
      rect(hair,10,1,4,5); rect(hairLight,11,1,1,4);
      rect(hair,6,5,1,2); rect(hair,17,5,1,2); break;
    case 4: // Bob with side locks.
      rect(hair,5,2,14,3); rect(hair,5,5,2,8); rect(hair,17,5,2,8);
      rect(hair,7,5,3,1); rect(hairLight,7,2,9,1);
      rect(hairLight,5,6,1,5); break;
    case 5: // Rounded curls.
      rect(hair,5,3,14,3); rect(hair,7,1,10,3);
      rect(hair,4,5,3,3); rect(hair,17,5,3,3);
      for(const x of [7,11,15]) rect(hairLight,x,2,2,2);
      break;
  }
  rect(skinShade,10,14,4,1);
  // Broad shoulders, stepped sleeves and shaded vertical shirt panels.
  rect(kitShade,7,15,10,9); rect(kit,8,16,8,8);
  rect(kit,5,16,3,6); rect(kit,16,16,3,6);
  rect(kitShade,3,18,3,4); rect(kitShade,18,18,3,4);
  rect(kitLight,8,16,2,7); rect(kitShade,12,16,2,8);
  rect('#edf4f5',10,15,4,1);
  rect(skinShade,3,22,3,2); rect(skin,3,22,2,1);
  rect(skinShade,18,22,3,2); rect(skin,18,22,2,1);
  // White shorts, separate legs and colored socks echo classic football sprites.
  rect('#bbc7d2',7,24,10,4); rect('#f5f4eb',8,24,8,3);
  rect('#788596',11,26,2,2);
  rect(kitShade,7,28,4,2); rect(kitShade,13,28,4,2);
  rect(kitLight,7,28,1,2); rect(kitLight,13,28,1,2);
  rect('#27313e',6,30,5,1); rect('#27313e',13,30,5,1);

  if(appearance!=='player'){
    // Casual trousers and scarves distinguish supporters from the players.
    rect('#34415b',7,24,10,4); rect('#536685',8,24,3,6);
    rect('#536685',13,24,3,6); rect('#34415b',11,26,2,4);
    if(index%2===0){
      rect('#f9de8b',8,15,8,2); rect('#f9de8b',8,17,2,5);
    }
  }

  // Outline the final silhouette without a grid or smoothing artifacts.
  for(let y=0;y<32;y++) for(let x=0;x<24;x++){
    const fill=pixels[y][x];
    const edge=!fill&&[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]
      .some(([nx,ny])=>pixels[ny]?.[nx]);
    if(fill||edge){
      ctx.fillStyle=fill||'#111923'; ctx.fillRect(x,y,1,1);
    }
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.magFilter=THREE.NearestFilter; texture.minFilter=THREE.NearestFilter;
  texture.generateMipmaps=false; texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
function sprite(material,height){
  const result=new THREE.Sprite(material);
  result.center.set(.5,0); result.scale.set(height*3/4,height,1); return result;
}
const crowd=[];
const crowdMaterials=Array.from({length:24},(_,i)=>new THREE.SpriteMaterial({
  map:pixelTexture(['#68a9e0','#eb9e61','#81c6a0','#e18fa8','#ba9ce0','#e6c66a'][i%6],
    i,i%2===0?'woman':'man'),alphaTest:.5
}));
function addSupporter(x,y,z,index){
  const variant=index%crowdMaterials.length;
  const person=sprite(crowdMaterials[variant],.68);
  person.position.set(x,y,z);
  person.userData={baseY:y,phase:index*1.7,isWoman:variant%2===0};
  world.add(person); crowd.push(person);
}
// 248 tightly packed supporters, with a narrow central access aisle.
for(let row=0;row<4;row++) for(let col=0;col<64;col++){
  if(col===31||col===32) continue;
  addSupporter(-11.5+col*.365,.43+row*.30,-5.05-row*.65,col+row*7);
}
// 72 more supporters wrap around the ends of the arena (320 total).
for(const side of [-1,1]) for(let row=0;row<4;row++) for(let col=0;col<9;col++)
  addSupporter(side*(10.1+row*.65),.43+row*.24,-2.9+col*.65,
    col+row*9+(side===1?5:0));
const shadowMaterial=new THREE.MeshBasicMaterial({
  color:0x020b14,transparent:true,opacity:.35,depthWrite:false
});
const shadowGeometry=new THREE.CircleGeometry(.3,24);
function makePlayer(starter=true,index=0){
  const g=new THREE.Group();
  const kit=new THREE.SpriteMaterial({map:pixelTexture(starter?'#4ade80':'#64748b',index),alphaTest:.5});
  const body=sprite(kit,1.45); g.add(body);
  const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);
  shadow.rotation.x=-Math.PI/2; shadow.scale.set(1,.55,1);
  shadow.position.y=.055; g.add(shadow);
  g.userData={body,kit,starter,index,phase:index*.71,baseX:0,baseZ:0};
  return g;
}

const placements=[
  [-3.4,-1.5],[-1.4,-.5],[1.0,-1.3],[3.2,-.3],
  [-4.3,1.6],[-2.2,2.0],[0,1.7],[2.4,2.1],[4.2,1.45],[5.4,-1.8],
  [-5.7,3.2],[5.8,3.15]
];
const players = placements.map((p,i)=>{
  const g=makePlayer(i<5,i); g.position.set(p[0],0,p[1]); g.scale.setScalar(.9);
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
let lastClubColor='';
function readClubColor(){
  const raw=app?.querySelector('.hero[style*="--club"]')?.style.getPropertyValue('--club')?.trim();
  if(raw){ try{ clubColor.set(raw); }catch{} }
  const color='#'+clubColor.getHexString();
  if(color===lastClubColor) return;
  lastClubColor=color;
  for(const p of players) if(p.userData.starter){
    const material=p.userData.kit;
    material.map.dispose();
    material.map=pixelTexture(color,p.userData.index);
  }
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

function resize(){
  renderer.setSize(innerWidth,innerHeight,false);
  const aspect=innerWidth/innerHeight;
  // Include the scoreboard, lamp banks and truss, with room below the header.
  const h=Math.max(7.9,14.3/aspect);
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
  u.body.position.y=Math.max(0,sway*.025);
  u.body.material.rotation=Math.sin(t*.8+u.phase)*.025;
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


}

function render(ms){
  requestAnimationFrame(render);
  if(document.hidden||!document.body.classList.contains('living-bg-active')) return;
  const t=reducedMotion.matches?0:ms*.001;
  players.forEach((p,i)=>animatePlayer(p,t,i));
  crowd.forEach(p=>{
    p.position.y=p.userData.baseY+Math.sin(t*1.4+p.userData.phase)*.018;
  });
  updateBall(t);
  renderer.render(scene,camera);
}
requestAnimationFrame(render);
