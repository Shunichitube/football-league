import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const app = document.querySelector('#app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111f);
scene.fog = new THREE.Fog(0x07111f, 25, 58);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.domElement.id = 'three-club-bg';
renderer.domElement.setAttribute('aria-hidden', 'true');
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
document.body.prepend(renderer.domElement);

const camera = new THREE.OrthographicCamera(-10, 10, 5.625, -5.625, 0.1, 100);
camera.position.set(0, 12.7, 17.4);
camera.lookAt(0, 2.15, 0);

const world = new THREE.Group();
scene.add(world);

function mat(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function block(w, h, d, x, y, z, color, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, options.roughness ?? 0.9, options.metalness ?? 0));
  mesh.position.set(x, y, z);
  mesh.castShadow = !!options.castShadow;
  mesh.receiveShadow = options.receiveShadow !== false;
  if (options.emissive) {
    mesh.material.emissive = new THREE.Color(options.emissive);
    mesh.material.emissiveIntensity = options.emissiveIntensity ?? 1;
  }
  world.add(mesh);
  return mesh;
}

function plane(w, h, color, x, y, z, opacity = 1) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide })
  );
  mesh.position.set(x, y, z);
  world.add(mesh);
  return mesh;
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

/* ---------- lighting ---------- */
scene.add(new THREE.HemisphereLight(0x99c7ff, 0x07111f, 0.72));
scene.add(new THREE.AmbientLight(0x3a506b, 0.35));

const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(-2, 15, 10);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -16;
key.shadow.camera.right = 16;
key.shadow.camera.top = 12;
key.shadow.camera.bottom = -12;
scene.add(key);

for (const [x, z] of [[-8, 5.5], [8, 5.5], [-8, -3.5], [8, -3.5]]) {
  const spot = new THREE.SpotLight(0xe9f5ff, 28, 36, Math.PI / 5.3, 0.55, 1.4);
  spot.position.set(x, 10.5, z);
  spot.target.position.set(x * 0.28, 0, 0);
  scene.add(spot, spot.target);
}

/* ---------- arena shell ---------- */
block(31, 0.6, 18, 0, -0.36, -0.2, 0x152331);
block(31, 8.0, 0.55, 0, 3.6, -9.0, 0x0b1724);
block(0.65, 7.0, 18, -15.1, 3.1, -0.1, 0x0d1b2b);
block(0.65, 7.0, 18, 15.1, 3.1, -0.1, 0x0d1b2b);

/* ---------- roof/truss ---------- */
block(29, 0.18, 0.18, 0, 6.9, -7.9, 0x25384a, { metalness: 0.35 });
block(29, 0.18, 0.18, 0, 6.9, -4.9, 0x25384a, { metalness: 0.35 });
for (let x = -14; x <= 14; x += 2) {
  const a = block(0.12, 1.2, 0.12, x, 6.35, -6.4, 0x2b4054, { metalness: 0.35 });
  a.rotation.z = (Math.floor((x + 14) / 2) % 2 ? 1 : -1) * 0.45;
}

for (const x of [-11.4, -7.6, -3.8, 0, 3.8, 7.6, 11.4]) {
  block(1.25, 0.28, 0.36, x, 6.5, -5.2, 0x172a3c);
  for (let i = -1; i <= 1; i++) {
    const lamp = block(0.28, 0.15, 0.08, x + i * 0.34, 6.38, -4.98, 0xffffff, {
      emissive: 0xffffff,
      emissiveIntensity: 2.4,
      roughness: 0.25
    });
    lamp.material.toneMapped = false;
  }
}

/* ---------- scoreboard ---------- */
const boardTex = canvasTexture(1024, 230, (ctx, w, h) => {
  ctx.fillStyle = '#07131f';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 12;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FOOTBALL', w / 2, 82);
  ctx.fillStyle = '#4ade80';
  ctx.fillText('LEAGUE', w / 2, 150);
  ctx.fillStyle = '#b9d7e7';
  ctx.font = 'bold 30px monospace';
  ctx.fillText('HOME   00 : 00   AWAY', w / 2, 203);
});
const board = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 1.55), new THREE.MeshBasicMaterial({ map: boardTex }));
board.position.set(0, 5.38, -7.65);
board.quaternion.copy(camera.quaternion);
world.add(board);
block(7.15, 1.85, 0.22, 0, 5.36, -7.82, 0x0b1724);

/* ---------- hanging banners ---------- */
function bannerTexture(title, subtitle) {
  return canvasTexture(320, 520, (ctx, w, h) => {
    ctx.fillStyle = '#0a1a2c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f3147';
    ctx.fillRect(0, 0, w, 30);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, h - 60, w, 60);
    ctx.beginPath();
    ctx.moveTo(0, h - 1);
    ctx.lineTo(w / 2, h - 110);
    ctx.lineTo(w, h - 1);
    ctx.closePath();
    ctx.fillStyle = '#10253a';
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText(title, w / 2, 185);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(subtitle, w / 2, 235);
  });
}
for (const [x, title, sub] of [[-6.6, 'OUR', 'HOME'], [6.6, 'ONE', 'CLUB']]) {
  const b = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 3.5), new THREE.MeshBasicMaterial({ map: bannerTexture(title, sub), transparent: true }));
  b.position.set(x, 4.6, -7.5);
  b.quaternion.copy(camera.quaternion);
  world.add(b);
}

/* ---------- main stands ---------- */
const standColors = [0x17283a, 0x1b3044, 0x20394e, 0x264258];
for (let row = 0; row < 6; row++) {
  const z = -5.25 - row * 0.52;
  const y = 0.32 + row * 0.42;
  block(27.2, 0.42 + row * 0.03, 0.62, 0, y, z, standColors[row % standColors.length]);
}

/* central aisles */
for (const x of [-7.8, 0, 7.8]) {
  block(0.72, 2.85, 0.95, x, 1.65, -6.55, 0x8395a0);
  for (let i = 0; i < 7; i++) {
    block(0.78, 0.05, 0.18, x, 0.46 + i * 0.4, -5.3 - i * 0.42, 0xcbd5e1);
  }
}

/* side lower stands */
for (const side of [-1, 1]) {
  block(2.4, 1.2, 7.7, side * 13.45, 0.5, -0.4, 0x1e3346);
  block(1.5, 0.6, 7.9, side * 14.35, 0.22, -0.4, 0x2b475b);
}

/* ---------- crowd ---------- */
const crowdColors = ['#22c55e', '#4ade80', '#60a5fa', '#fbbf24', '#fb7185', '#a78bfa', '#e2e8f0', '#f97316'];
const skinTones = ['#f2c49b', '#d79a72', '#b87552', '#7e4d37'];
const hairColors = ['#161a22', '#4b2d1f', '#7c4b2a', '#d2a13a', '#8a3d2f'];

function spectatorTexture(seed, flag = false) {
  return canvasTexture(20, 28, (ctx) => {
    const shirt = crowdColors[seed % crowdColors.length];
    const skin = skinTones[seed % skinTones.length];
    const hair = hairColors[(seed * 3) % hairColors.length];
    ctx.clearRect(0, 0, 20, 28);
    ctx.fillStyle = '#0a0f18'; ctx.fillRect(5, 2, 10, 10);
    ctx.fillStyle = skin; ctx.fillRect(6, 4, 8, 8);
    ctx.fillStyle = hair; ctx.fillRect(5, 1, 10, 4);
    if (seed % 3 === 0) ctx.fillRect(4, 3, 2, 7);
    if (seed % 4 === 0) ctx.fillRect(14, 3, 2, 7);
    ctx.fillStyle = '#111827'; ctx.fillRect(8, 7, 1, 1); ctx.fillRect(12, 7, 1, 1);
    ctx.fillStyle = shirt; ctx.fillRect(5, 12, 10, 8);
    if (seed % 4 === 0) {
      ctx.fillRect(2, 10, 4, 3); ctx.fillRect(14, 10, 4, 3);
      ctx.fillStyle = skin; ctx.fillRect(1, 9, 2, 2); ctx.fillRect(17, 9, 2, 2);
    } else {
      ctx.fillRect(3, 13, 3, 6); ctx.fillRect(14, 13, 3, 6);
    }
    ctx.fillStyle = '#334155'; ctx.fillRect(6, 20, 3, 6); ctx.fillRect(11, 20, 3, 6);
    ctx.fillStyle = '#111827'; ctx.fillRect(5, 25, 4, 2); ctx.fillRect(11, 25, 4, 2);
    if (flag) {
      ctx.fillStyle = '#e5e7eb'; ctx.fillRect(16, 3, 1, 15);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(17, 3, 3, 4);
      ctx.fillStyle = '#dcfce7'; ctx.fillRect(17, 7, 3, 4);
    }
  });
}

function spectatorSprite(seed, scale = 0.54, flag = false) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: spectatorTexture(seed, flag), transparent: true, depthWrite: false }));
  s.scale.set(scale * 0.72, scale, 1);
  return s;
}

let crowdSeed = 0;
for (let row = 0; row < 6; row++) {
  const y = 0.72 + row * 0.43;
  const z = -4.95 - row * 0.52;
  const count = 42 - row;
  for (let i = 0; i < count; i++) {
    const x = -12.6 + i * (25.2 / (count - 1));
    if (Math.abs(x) < 0.55 || Math.abs(x - 7.8) < 0.55 || Math.abs(x + 7.8) < 0.55) continue;
    const s = spectatorSprite(crowdSeed, 0.56, crowdSeed % 19 === 0);
    s.position.set(x, y, z + 0.02);
    world.add(s);
    crowdSeed++;
  }
}

/* supporter color blocks */
for (const side of [-1, 1]) {
  for (let i = 0; i < 16; i++) {
    const s = spectatorSprite(200 + i + (side > 0 ? 50 : 0), 0.6, i % 5 === 0);
    s.material.color.set(side < 0 ? 0xb8ffd1 : 0xffffff);
    s.position.set(side * (10.0 + (i % 8) * 0.34), 1.0 + Math.floor(i / 8) * 0.46, -4.75 - Math.floor(i / 8) * 0.5);
    world.add(s);
  }
}

/* ---------- supporter banners ---------- */
function textPanel(text, width = 4.2, height = 0.72) {
  const texture = canvasTexture(700, 120, (ctx, w, h) => {
    ctx.fillStyle = '#0a1725'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, w / 2, 78);
  });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
  p.quaternion.copy(camera.quaternion);
  world.add(p);
  return p;
}
const leftPanel = textPanel('OUR HOME'); leftPanel.position.set(-5.4, 3.3, -5.05);
const rightPanel = textPanel('ONE CLUB'); rightPanel.position.set(5.4, 3.3, -5.05);

/* ---------- LED ribbon ---------- */
for (let i = 0; i < 8; i++) {
  const led = block(3.2, 0.16, 0.14, -11.7 + i * 3.35, 0.72, -4.1, 0x22c55e, {
    emissive: 0x22c55e, emissiveIntensity: 1.55, roughness: 0.35
  });
  led.material.toneMapped = false;
}

/* ---------- pitch floor ---------- */
block(21.0, 0.18, 10.6, 0, 0.02, 1.45, 0xb98f5c, { roughness: 0.55 });
const pitch = new THREE.Mesh(
  new THREE.PlaneGeometry(17.6, 8.6),
  new THREE.MeshStandardMaterial({ color: 0x168a55, roughness: 0.44, metalness: 0.04 })
);
pitch.rotation.x = -Math.PI / 2;
pitch.position.set(0, 0.13, 1.15);
pitch.receiveShadow = true;
world.add(pitch);

for (let i = 0; i < 11; i++) {
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 8.48), new THREE.MeshStandardMaterial({
    color: i % 2 ? 0x1d985f : 0x168554, roughness: 0.46
  }));
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(-8.0 + i * 1.6, 0.145, 1.15);
  world.add(stripe);
}

const lineMat = new THREE.MeshBasicMaterial({ color: 0xf3fff7 });
function courtLine(w, d, x, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), lineMat);
  m.position.set(x, 0.17, z + 1.15);
  world.add(m);
}
courtLine(17.0, 0.06, 0, -4.0); courtLine(17.0, 0.06, 0, 4.0);
courtLine(0.06, 8.0, -8.5, 0); courtLine(0.06, 8.0, 8.5, 0); courtLine(0.06, 8.0, 0, 0);

const circle = new THREE.Mesh(
  new THREE.RingGeometry(0.9, 0.96, 64),
  new THREE.MeshBasicMaterial({ color: 0xf3fff7, side: THREE.DoubleSide })
);
circle.rotation.x = -Math.PI / 2;
circle.position.set(0, 0.175, 1.15);
world.add(circle);

for (const side of [-1, 1]) {
  const x0 = side * 7.05;
  courtLine(2.9, 0.06, side * 7.05, -2.45);
  courtLine(2.9, 0.06, side * 7.05, 2.45);
  courtLine(0.06, 4.9, side * 5.6, 0);
}

/* ---------- goals ---------- */
function goal(side) {
  const dir = side < 0 ? -1 : 1;
  const group = new THREE.Group();
  const post = mat(0xf7fbff, 0.42);
  const add = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), post);
    m.position.set(x, y, z); m.castShadow = true; group.add(m);
  };
  for (const z of [-1.25, 1.25]) {
    add(0.09, 1.55, 0.09, 0, 0.78, z);
    add(0.9, 0.07, 0.07, dir * 0.45, 0.07, z);
  }
  add(0.09, 0.09, 2.6, 0, 1.55, 0);
  add(0.07, 0.07, 2.55, dir * 0.9, 1.17, 0);
  const net = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.15, 2.45, 4, 5, 10),
    new THREE.MeshBasicMaterial({ color: 0xb8dded, transparent: true, opacity: 0.15, wireframe: true })
  );
  net.position.set(dir * 0.45, 0.62, 0);
  group.add(net);
  group.position.set(dir * 8.55, 0.18, 1.15);
  world.add(group);
}
goal(-1); goal(1);

/* ---------- benches ---------- */
for (const side of [-1, 1]) {
  const x = side * 5.7;
  block(5.0, 0.12, 0.9, x, 0.2, 5.85, 0x102033);
  block(4.8, 0.08, 0.15, x, 0.9, 5.55, 0x87a8b8);
  for (let i = 0; i < 6; i++) {
    const seat = block(0.42, 0.15, 0.42, x - 1.55 + i * 0.62, 0.34, 5.72, side < 0 ? 0x16a34a : 0x334155);
    seat.material.roughness = 0.55;
    const s = spectatorSprite(300 + i + (side > 0 ? 20 : 0), 0.52, false);
    s.position.set(x - 1.55 + i * 0.62, 0.83, 5.56);
    world.add(s);
  }
  const staff = spectatorSprite(380 + (side > 0 ? 2 : 0), 0.7, false);
  staff.position.set(x + 2.2 * side, 0.95, 5.4);
  world.add(staff);
}

/* ---------- player sprites ---------- */
function playerTexture(seed, kit) {
  return canvasTexture(24, 32, (ctx) => {
    const skin = skinTones[seed % skinTones.length];
    const hair = hairColors[seed % hairColors.length];
    ctx.clearRect(0, 0, 24, 32);
    ctx.fillStyle = '#111827'; ctx.fillRect(5, 2, 14, 12);
    ctx.fillStyle = skin; ctx.fillRect(6, 4, 12, 10);
    ctx.fillStyle = hair; ctx.fillRect(5, 1, 14, 5);
    ctx.fillStyle = '#111827'; ctx.fillRect(9, 8, 1, 2); ctx.fillRect(14, 8, 1, 2);
    ctx.fillStyle = kit; ctx.fillRect(6, 15, 12, 9);
    ctx.fillRect(3, 16, 3, 6); ctx.fillRect(18, 16, 3, 6);
    ctx.fillStyle = skin; ctx.fillRect(3, 22, 3, 2); ctx.fillRect(18, 22, 3, 2);
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(7, 24, 10, 4);
    ctx.fillStyle = kit; ctx.fillRect(7, 28, 4, 2); ctx.fillRect(13, 28, 4, 2);
    ctx.fillStyle = '#111827'; ctx.fillRect(6, 30, 5, 2); ctx.fillRect(13, 30, 5, 2);
  });
}

function playerSprite(seed, kit, x, z, scale = 0.78) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: playerTexture(seed, kit), transparent: true }));
  sprite.scale.set(scale * 0.72, scale, 1);
  sprite.position.set(x, 0.72, z);
  world.add(sprite);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1.5, 0.55, 1);
  shadow.position.set(x, 0.18, z);
  world.add(shadow);
}

const playerPositions = [
  [-5.6, 1.2], [-3.6, 0.1], [-2.0, 2.2], [-0.7, 0.7], [-0.8, 3.2],
  [5.7, 1.3], [3.9, -0.1], [2.3, 2.5], [0.8, 0.5], [0.9, 3.4]
];
playerPositions.forEach(([x, z], i) => playerSprite(i, i < 5 ? '#22c55e' : '#1d4ed8', x, z + 1.15));

/* ---------- foreground supporter silhouettes ---------- */
const fgTex = canvasTexture(90, 64, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#020811';
  for (let i = 0; i < 5; i++) {
    const x = 5 + i * 18;
    ctx.fillRect(x + 3, 23, 10, 24);
    ctx.fillRect(x + 1, 16, 14, 12);
    ctx.fillRect(x, 45, 6, 19);
    ctx.fillRect(x + 10, 45, 6, 19);
    if (i % 2 === 0) {
      ctx.fillRect(x - 3, 12, 5, 26);
      ctx.fillRect(x + 14, 8, 5, 28);
    }
  }
});
for (const x of [-8.0, -4.0, 4.0, 8.0]) {
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ map: fgTex, transparent: true, opacity: 0.88, depthWrite: false }));
  fg.scale.set(4.8, 3.0, 1);
  fg.position.set(x, 0.7, 7.2);
  world.add(fg);
}

/* ---------- visibility + sizing ---------- */
function activeScreen() {
  const main = app?.querySelector(':scope > main');
  if (!main) return false;
  return main.classList.contains('title') || main.classList.contains('screen-title') || main.classList.contains('screen-home');
}

function refreshActive() {
  const active = activeScreen();
  document.body.classList.toggle('living-bg-active', active);
  renderer.domElement.style.opacity = active ? '1' : '0';
}
new MutationObserver(refreshActive).observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
refreshActive();

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  const viewHeight = 5.625;
  camera.top = viewHeight;
  camera.bottom = -viewHeight;
  camera.left = -viewHeight * aspect;
  camera.right = viewHeight * aspect;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize, { passive: true });
resize();

function render() {
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
