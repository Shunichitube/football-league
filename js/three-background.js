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

// Deterministic, chunky grass grain; nearest filtering matches the pixel characters.
function makeGrassTexture(){
  const canvas=document.createElement('canvas'); canvas.width=32; canvas.height=32;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#d0dbce'; ctx.fillRect(0,0,32,32);
  let seed=173;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296;}
  const tones=['#b5c5af','#c0ceba','#dce5d6','#edf1df'];
  for(let i=0;i<190;i++){
    ctx.fillStyle=tones[Math.floor(random()*tones.length)];
    ctx.fillRect(Math.floor(random()*16)*2,Math.floor(random()*16)*2,2,random()<.3?4:2);
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=texture.minFilter=THREE.NearestFilter;
  texture.generateMipmaps=false;
  texture.repeat.set(8,4);
  return texture;
}
const grassTexture=makeGrassTexture();
const stripeGrass=grassTexture.clone();
stripeGrass.repeat.set(.79,4);
stripeGrass.needsUpdate=true;

const pitch = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 8.7),
  new THREE.MeshStandardMaterial({ color: 0x258354, map: grassTexture, roughness: 1, metalness: 0 })
);
pitch.rotation.x = -Math.PI / 2;
pitch.receiveShadow = true;
world.add(pitch);

const stripeMatA = new THREE.MeshStandardMaterial({ color: 0x298c59, map: stripeGrass, roughness: 1 });
const stripeMatB = new THREE.MeshStandardMaterial({ color: 0x237f50, map: stripeGrass, roughness: 1 });
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

// A restrained pixel-art interior: teal panels, warm brass and square light bands.
function interiorTexture(){
  const canvas=document.createElement('canvas'); canvas.width=64; canvas.height=16;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#203b4b'; ctx.fillRect(0,0,64,16);
  for(let x=0;x<64;x+=4) for(let y=0;y<16;y+=4){
    ctx.fillStyle=['#315467','#3f6974','#527e83'][(x/4+y/4)%3];
    ctx.fillRect(x,y,3,3);
  }
  ctx.fillStyle='#e5bd79'; ctx.fillRect(0,14,64,2);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=texture.minFilter=THREE.NearestFilter;
  texture.generateMipmaps=false;
  return texture;
}
const mosaicMaterial=new THREE.MeshBasicMaterial({map:interiorTexture()});
for(const x of [-10.3,-6.9,6.9,10.3]){
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(3.1,1.05),mosaicMaterial);
  panel.position.set(x,3.3,-7.72); world.add(panel);
}
const trimMaterial=new THREE.MeshBasicMaterial({color:0xe5bd79});
for(const z of [-4.65,4.65]){
  const trim=new THREE.Mesh(new THREE.BoxGeometry(18,.06,.09),trimMaterial);
  trim.position.set(0,.045,z); world.add(trim);
}
// Chunky perimeter tiles frame the court without changing its markings.
const tileGeometry=new THREE.BoxGeometry(.32,.04,.32);
const tileMaterial=new THREE.MeshStandardMaterial({color:0x62868b,roughness:1});
const tiles=new THREE.InstancedMesh(tileGeometry,tileMaterial,104);
const tileTransform=new THREE.Object3D();
for(let i=0;i<104;i++){
  tileTransform.position.set(-8.67+(i%52)*.34,.015,i<52?-4.98:4.98);
  tileTransform.updateMatrix(); tiles.setMatrixAt(i,tileTransform.matrix);
}
world.add(tiles);
for(const side of [-1,1]){
  for(let i=0;i<12;i++){
    const step=block(.34,.09,.34,side*9.6,.08,-3.7+i*.68,0x92bac2);
    step.material.emissive=new THREE.Color(0x365963);
  }
}
// Nearest-neighbor filtering keeps signage as crisp as the characters.
boardTexture.magFilter=boardTexture.minFilter=THREE.NearestFilter;
boardTexture.generateMipmaps=false;

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

  // Oversized front-facing head with ears and two simple dark eyes.
  rect(skinShade,6,4,12,10); rect(skin,7,4,10,9);
  rect(skinShade,5,8,1,3); rect(skinShade,18,8,1,3);
  rect('#3b2925',8,7,2,1); rect('#3b2925',14,7,2,1);
  // Small dark eyes without whites for a softer expression.
  rect('#171b23',9,9,1,2); rect('#171b23',14,9,1,2);
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
const CHARACTER_HEIGHT=.68;
const crowd=[];
const crowdMaterials=Array.from({length:24},(_,i)=>new THREE.SpriteMaterial({
  map:pixelTexture(['#68a9e0','#eb9e61','#81c6a0','#e18fa8','#ba9ce0','#e6c66a'][i%6],
    i,i%2===0?'woman':'man'),alphaTest:.5
}));
function addSupporter(x,y,z,index){
  const variant=index%crowdMaterials.length;
  const person=sprite(crowdMaterials[variant],CHARACTER_HEIGHT);
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
  const body=sprite(kit,CHARACTER_HEIGHT); g.add(body);
  const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);
  shadow.rotation.x=-Math.PI/2; shadow.scale.set(.6,.33,1);
  shadow.position.y=.055; g.add(shadow);
  g.userData={body,kit,starter,index,phase:index*.71,baseX:0,baseZ:0};
  return g;
}

// Two five-player passing circles, one in each half of the court.
const placements=[
  [-5.8,-1.6],[-3.8,-2.5],[-1.8,-.9],[-2.6,2.0],[-5.3,1.8],
  [1.8,-1.6],[4.0,-2.5],[6.0,-.9],[5.2,2.0],[2.5,1.8]
];
const players=placements.map((p,i)=>{
  const g=makePlayer(i<5,i); g.position.set(p[0],0,p[1]);
  g.userData.baseX=p[0]; g.userData.baseZ=p[1]; world.add(g); return g;
});
function makePracticeBall(){
  const canvas=document.createElement('canvas'); canvas.width=8; canvas.height=8;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#152130'; ctx.fillRect(2,0,4,8); ctx.fillRect(0,2,8,4);
  ctx.fillStyle='#f4f4de'; ctx.fillRect(2,1,4,6); ctx.fillRect(1,2,6,4);
  ctx.fillStyle='#28384a'; ctx.fillRect(3,3,2,2); ctx.fillRect(1,2,1,2); ctx.fillRect(5,5,1,2);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=texture.minFilter=THREE.NearestFilter; texture.generateMipmaps=false;
  const ball=sprite(new THREE.SpriteMaterial({map:texture,alphaTest:.5}),.30);
  ball.scale.x=.30;
  // Rotate about the middle: a foot-anchored rotating sprite cuts through the turf.
  ball.center.set(.5,.5);
  world.add(ball);
  const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);
  shadow.rotation.x=-Math.PI/2; shadow.scale.set(.5,.35,1); world.add(shadow);
  return {ball,shadow};
}
const passingGroups=[0,5].map((offset,index)=>({
  members:players.slice(offset,offset+5),
  route:[0,2,4,1,3], phase:index*1.15,
  ...makePracticeBall()
}));

// Foreground technical areas face the pitch (-Z), with seated backs toward the camera.
function seatedBackTexture(kit,index){
  const canvas=document.createElement('canvas'); canvas.width=24; canvas.height=32;
  const ctx=canvas.getContext('2d');
  function rect(color,x,y,w,h){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
  const hair=['#35241c','#81502d','#191d29','#a7532d','#44302b'][index%5];
  const shade='#'+new THREE.Color(kit).multiplyScalar(.48).getHexString();
  // Back of head: hair and nape only, no facial features.
  rect('#111923',5,2,14,12); rect(hair,6,3,12,10);
  rect('#d3a27d',10,12,4,2);
  rect('#111923',5,14,14,11);
  rect(shade,6,15,12,9); rect(kit,8,15,8,8);
  rect('#dce8ed',10,15,4,1);
  // Small pixel jersey number on the back.
  rect('#f5f4eb',11,17,2,5);
  if(index%2) rect('#f5f4eb',10,17,4,1);
  rect('#111923',3,17,3,8); rect('#111923',18,17,3,8);
  rect(kit,4,18,2,4); rect(kit,18,18,2,4);
  rect('#d3a27d',4,22,2,2); rect('#d3a27d',18,22,2,2);
  // Bent legs extend sideways from the seated hips, not a standing pose.
  rect('#111923',4,24,16,4);
  rect('#bbc7d2',5,24,14,2); rect('#f5f4eb',7,24,10,1);
  rect('#27313e',4,27,4,2); rect('#27313e',16,27,4,2);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=texture.minFilter=THREE.NearestFilter;
  texture.generateMipmaps=false;
  return texture;
}
const benchPlayers=[];
for(const side of [-1,1]){
  const centerX=side*4.5;
  const platform=block(6.4,.12,1.65,centerX,.015,6.15,0x2d4b59);
  platform.name='bench-area';
  block(6.4,.035,.08,centerX,.09,5.36,0xe5bd79);
  block(5.5,.12,.5,centerX,.29,6.25,0xb98a53);
  for(const x of [-2.35,2.35]) block(.14,.26,.44,centerX+x,.13,6.25,0x233646);
  // Low back rail leaves hair and jersey numbers visible.
  block(5.5,.13,.09,centerX,.32,6.55,0x698a93);
  for(let i=0;i<5;i++){
    const material=new THREE.SpriteMaterial({
      map:seatedBackTexture(side===-1?'#4ade80':'#64748b',i),alphaTest:.5
    });
    const person=sprite(material,CHARACTER_HEIGHT);
    person.position.set(centerX+(i-2)*1.05,.12,6.25);
    person.userData={starter:side===-1,index:i};
    person.name='seated-bench-player';
    world.add(person); benchPlayers.push(person);
  }
}

// Club identity and small signs of daily use, all confined to the concourse.
const clubDecor=[];
function venueSign(text,x,y,z,width,height,club=false){
  const canvas=document.createElement('canvas'); canvas.width=128; canvas.height=32;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#142937'; ctx.fillRect(0,0,128,32);
  ctx.fillStyle='#edf3dc'; ctx.font='bold 16px "Yu Gothic", "Meiryo", sans-serif'; ctx.textAlign='center';
  ctx.fillText(text,64,21);
  for(let i=0;i<128;i+=8){ctx.fillRect(i,0,4,2);ctx.fillRect(i,30,4,2);}
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=texture.minFilter=THREE.NearestFilter; texture.generateMipmaps=false;
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(width,height),
    new THREE.MeshBasicMaterial({map:texture}));
  panel.position.set(x,y,z); world.add(panel);
  if(club){
    const border=block(width+.14,height+.14,.07,x,y,z-.06,0x4ade80);
    clubDecor.push(border.material);
  }
  return panel;
}
venueSign('OUR HOME',-4.2,2.55,-7.5,3.4,.7,true);
venueSign('ONE CLUB',4.2,2.75,-7.5,3.1,.65,true);
venueSign('共に戦おう',-7.3,.58,-4.70,3,.5,true);
venueSign('一蹴入魂',6.4,.58,-4.70,3.5,.5,true);
for(const side of [-1,1]){
  const x=side*13;
  // Dark recess, chunky jambs and an illuminated exit sign.
  block(1.25,2.15,.08,x,1.07,-7.72,0x0c1824);
  for(const dx of [-.68,.68]) block(.12,2.25,.2,x+dx,1.12,-7.60,0x839ca8);
  block(1.48,.12,.2,x,2.25,-7.60,0x839ca8);
  venueSign('GATE '+(side<0?'A':'B'),x,2.55,-7.55,1.4,.35);
  block(1.05,.04,3.05,x,.02,-6.1,0x789398);
}
block(.68,1.5,.08,0,.75,-7.73,0x0c1824);
venueSign('PLAYERS',0,1.72,-7.55,1.25,.30);

const supporterFlags=[];
for(const side of [-1,1]){
  const group=new THREE.Group();
  group.position.set(side*6.25,1.0,-5.8);
  const pole=new THREE.Mesh(new THREE.BoxGeometry(.045,1.8,.045),
    new THREE.MeshBasicMaterial({color:0xe4e8d8}));
  pole.position.y=.9; group.add(pole);
  const canvas=document.createElement('canvas'); canvas.width=24; canvas.height=16;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,24,16);
  ctx.fillStyle='#78958a';
  for(let y=0;y<16;y+=4) for(let x=0;x<24;x+=4)
    if((x+y)%8===0) ctx.fillRect(x,y,4,4);
  const texture=new THREE.CanvasTexture(canvas);
  texture.magFilter=texture.minFilter=THREE.NearestFilter; texture.generateMipmaps=false;
  texture.colorSpace=THREE.SRGBColorSpace;
  const cloth=new THREE.Mesh(new THREE.PlaneGeometry(1.25,.8,8,4),
    new THREE.MeshBasicMaterial({map:texture,color:0x4ade80,side:THREE.DoubleSide}));
  cloth.position.set(.62,1.35,0);
  group.add(cloth); world.add(group);
  clubDecor.push(cloth.material);
  supporterFlags.push({group,cloth,phase:side<0?0:2.1});
}
function animateFlags(t){
  for(const {group,cloth,phase} of supporterFlags){
    group.rotation.z=Math.sin(t*.65+phase)*.24;
    const points=cloth.geometry.attributes.position;
    for(let i=0;i<points.count;i++)
      points.setZ(i,Math.sin(points.getX(i)*4-t*1.7+phase)*.08*(points.getX(i)+.625));
    points.needsUpdate=true;
  }
}

// Back-facing coaches in dark tracksuits, with a cap and a clipboard.
function coachTexture(index){
  const texture=seatedBackTexture('#253446',index);
  const ctx=texture.image.getContext('2d');
  ctx.clearRect(3,14,18,18);
  ctx.fillStyle='#111923'; ctx.fillRect(5,14,14,11);
  ctx.fillStyle='#26394d'; ctx.fillRect(6,15,12,9);
  ctx.fillStyle='#aebcc4'; ctx.fillRect(7,16,10,1);
  ctx.fillStyle='#172333'; ctx.fillRect(7,24,4,6); ctx.fillRect(13,24,4,6);
  ctx.fillStyle='#111923'; ctx.fillRect(6,30,5,2); ctx.fillRect(13,30,5,2);
  ctx.fillStyle='#b59363'; ctx.fillRect(18,19,4,7);
  ctx.fillStyle='#e0dcc5'; ctx.fillRect(19,20,2,4);
  if(index===0){ctx.fillStyle='#31485a';ctx.fillRect(5,2,14,4);}
  texture.needsUpdate=true; return texture;
}
const coaches=[-1,1].map((side,i)=>{
  const p=sprite(new THREE.SpriteMaterial({map:coachTexture(i),alphaTest:.5}),CHARACTER_HEIGHT);
  p.position.set(side*1.55,.10,5.8); p.name='coach';
  world.add(p); return p;
});

// Independent repeatable random streams make each new visit / training bout different.
function variety(seed,cycle,salt){
  let value=Math.imul(seed+17,374761393)^Math.imul(cycle+31,668265263)^Math.imul(salt+7,1274126177);
  value=Math.imul(value^(value>>>13),1274126177);
  return ((value^(value>>>16))>>>0)/4294967296;
}
function routeState(u,t){
  if(t<u.start){u.start=0;u.cycle=0;u.schedule=null;}
  if(!u.schedule) u.schedule=u.build(u.cycle);
  while(t>=u.start+u.schedule.at(-1)[0]){
    u.start+=u.schedule.at(-1)[0]; u.schedule=u.build(++u.cycle);
  }
  const local=t-u.start;
  let segment=0;
  while(segment<u.schedule.length-2&&local>=u.schedule[segment+1][0]) segment++;
  const [aTime,a]=u.schedule[segment], [bTime,b]=u.schedule[segment+1];
  return {a,b,f:(local-aTime)/(bTime-aTime),segment};
}
benchPlayers.forEach((p,i)=>{
  const seat=p.position.clone(), side=Math.sign(seat.x);
  const launch=new THREE.Vector3(side*2.25,.08,4.95+(i%2)*.22);
  const turn=new THREE.Vector3(side*7.1,.08,launch.z);
  const u=p.userData;
  u.seatedMap=p.material.map;
  u.runningMap=pixelTexture(u.starter?'#4ade80':'#64748b',u.index);
  u.sprint={seat,start:0,cycle:0,schedule:null,build(cycle){
    const rest=10+variety(i,cycle,1)*34;
    const run=2.4+variety(i,cycle,2)*1.8;
    const pause=.5+variety(i,cycle,3)*2;
    return [[0,seat],[rest,seat],[rest+2.5,launch],[rest+2.5+run,turn],
      [rest+2.5+run+pause,turn],[rest+2.5+run*2+pause,launch],
      [rest+5+run*2+pause,seat],[rest+8+run*2+pause,seat]];
  }};
});
function animateSprints(t){
  benchPlayers.forEach(p=>{
    const u=p.userData, state=u.sprint;
    if(reducedMotion.matches){
      p.position.copy(state.seat); p.material.map=u.seatedMap;p.material.rotation=0;return;
    }
    const {a,b,f,segment}=routeState(state,t);
    p.position.lerpVectors(a,b,f);
    const seated=segment===0||segment===6;
    p.material.map=seated?u.seatedMap:u.runningMap;
    const moving=a!==b;
    p.material.rotation=moving?Math.sin(t*15+u.index)*.065:0;
    if(moving) p.position.y+=Math.abs(Math.sin(t*15+u.index))*.045;
  });
}

// Asymmetric equipment clusters beside the benches.
for(const side of [-1,1]){
  const x=side*7.85;
  block(.55,.38,.4,x,.24,6.0,0x609ea8); // Drinks cooler.
  block(.60,.07,.44,x,.46,6.0,0xe2e7dc);
  block(.60,.23,.32,x-side*.3,.19,6.65,0x263749); // Kit bag.
  block(.22,.06,.08,x-side*.3,.34,6.65,0xbb9368);
  for(let i=0;i<3;i++){
    block(.09,.20,.09,x-side*(.1+i*.16),.18,5.53,0x8acddb);
    block(.07,.04,.07,x-side*(.1+i*.16),.30,5.53,0xe6e9d7);
  }
  const spare=makePracticeBall();
  spare.ball.position.set(x-side*.7,.24,6.85);
  spare.shadow.position.set(x-side*.7,.055,6.85);
}

// Reuse twelve existing spectators, so entering/exiting never duplicates occupied seats.
const visitingSupporters=crowd.filter(p=>p.position.z===-5.05&&Math.abs(p.position.x)>9.45)
  .slice(0,12);
visitingSupporters.forEach((p,i)=>{
  const seat=p.position.clone(), side=Math.sign(seat.x);
  const front=new THREE.Vector3(seat.x,.08,-4.48);
  const corner=new THREE.Vector3(side*13,.08,-4.48);
  const door=new THREE.Vector3(side*13,.08,-7.45);
  p.userData.visit={seat,start:0,cycle:0,schedule:null,build(cycle){
    const wait=6+variety(i+40,cycle,1)*48;
    const speed=.65+variety(i+40,cycle,2)*.55;
    const outside=8+variety(i+40,cycle,3)*35;
    const leg1=3/speed,leg2=7/speed,leg3=4/speed;
    const exit=wait+leg1+leg2+leg3,enter=exit+outside;
    return [[0,seat],[wait,seat],[wait+leg1,front],[wait+leg1+leg2,corner],
      [exit,door],[enter,door],[enter+leg3,corner],[enter+leg3+leg2,front],
      [enter+leg3+leg2+leg1,seat],[enter+leg3+leg2+leg1+5,seat]];
  }};
});
function animateVisitors(t){
  for(const p of visitingSupporters){
    const u=p.userData.visit;
    if(reducedMotion.matches){p.visible=true;p.position.copy(u.seat);continue;}
    const {a,b,f,segment}=routeState(u,t);
    p.position.lerpVectors(a,b,f);
    p.visible=segment!==4;
    if(a!==b) p.position.y+=Math.abs(Math.sin(t*7+p.userData.phase))*.025;
    if(segment===0||segment===8) p.position.y-=.035;
  }
}

const clubColor = new THREE.Color(0x4ade80);
let lastClubColor='';
function readClubColor(){
  const raw=app?.querySelector('.hero[style*="--club"]')?.style.getPropertyValue('--club')?.trim();
  if(raw){ try{ clubColor.set(raw); }catch{} }
  const color='#'+clubColor.getHexString();
  if(color===lastClubColor) return;
  lastClubColor=color;
  clubDecor.forEach(material=>material.color.copy(clubColor));
  for(const p of players) if(p.userData.starter){
    const material=p.userData.kit;
    material.map.dispose();
    material.map=pixelTexture(color,p.userData.index);
  }
  for(const p of benchPlayers) if(p.userData.starter){
    const u=p.userData;
    const wasSeated=p.material.map===u.seatedMap;
    u.seatedMap.dispose(); u.runningMap.dispose();
    u.seatedMap=seatedBackTexture(color,u.index);
    u.runningMap=pixelTexture(color,u.index);
    p.material.map=wasSeated?u.seatedMap:u.runningMap;
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
  const roam=.10;
  p.position.x=u.baseX + Math.sin(t*.43+u.phase)*roam;
  p.position.z=u.baseZ + Math.cos(t*.37+u.phase)*roam*.65;
  u.body.position.x=0;
  u.body.position.y=Math.max(0,sway*.025);
  u.body.material.rotation=Math.sin(t*.8+u.phase)*.025;
}

function updateBall(t){
  for(const group of passingGroups){
    const cycle=(t/2.4+group.phase)%5;
    const leg=Math.floor(cycle), f=cycle-leg;
    const sender=group.members[group.route[leg]];
    const receiver=group.members[group.route[(leg+1)%5]];
    // Hold at the feet, kick, roll across, then allow the receiver to control it.
    const travel=THREE.MathUtils.clamp((f-.20)/.65,0,1);
    const a=sender.position,b=receiver.position;
    group.ball.position.set(
      THREE.MathUtils.lerp(a.x,b.x,travel),.24+Math.sin(travel*Math.PI)*.03,
      THREE.MathUtils.lerp(a.z,b.z,travel)+.28
    );
    group.ball.material.rotation=-travel*Math.PI*4;
    group.shadow.position.set(group.ball.position.x,.055,group.ball.position.z);
    const kick=Math.sin(THREE.MathUtils.clamp((f-.14)/.18,0,1)*Math.PI);
    sender.userData.body.position.x=Math.sign(b.x-a.x)*kick*.09;
    sender.userData.body.material.rotation+=Math.sign(b.x-a.x)*kick*.08;
    const receive=Math.sin(THREE.MathUtils.clamp((f-.82)/.18,0,1)*Math.PI);
    receiver.userData.body.position.y+=receive*.035;
  }
}

function render(ms){
  requestAnimationFrame(render);
  if(document.hidden||!document.body.classList.contains('living-bg-active')) return;
  const t=reducedMotion.matches?0:ms*.001;
  players.forEach((p,i)=>animatePlayer(p,t,i));
  crowd.forEach(p=>{
    if(p.userData.visit) return;
    const cheering=Math.abs(p.position.x)<3&&p.position.z<-5.6;
    p.position.y=p.userData.baseY+Math.sin(t*1.4+p.userData.phase)*.018
      +(cheering?Math.max(0,Math.sin(t*2.8))*.055:0);
  });
  animateFlags(t);
  animateSprints(t);
  animateVisitors(t);
  updateBall(t);
  renderer.render(scene,camera);
}
requestAnimationFrame(render);
