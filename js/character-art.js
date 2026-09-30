// FOOTBALL LEAGUE design master: assets/characters/design-master.png.
// New 64px artwork. Only appearance data is inherited from the former renderer.
// Integer rasterization keeps every pose crisp; the ball belongs to the scene.
export const CHARACTER_VERSION = '20260930-master-1';
export const CHARACTER_SIZE = 64;
const INK = '#141b25', WHITE = '#fff9ee';
const SKIN = ['#f5bb87', '#bd8058', '#ffd4a4'];
const HAIR = ['#493020','#82512c','#dfb13e','#202a35','#ad542e','#52372c','#e8e1cf','#737b87','#be382d','#2563eb','#16a34a','#9333ea'];
const mod = (n,m) => ((Number(n)||0)%m+m)%m;
const hash = value => String(value).split('').reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7);
function tint(hex,amount) {
  const values=hex.slice(1).match(/../g).map(v=>parseInt(v,16));
  return '#'+values.map(v=>Math.round(amount<0?v*(1+amount):v+(255-v)*amount).toString(16).padStart(2,'0')).join('');
}
const color = (value,fallback) => /^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
export function characterIdentity(value=0) {
  const a=typeof value==='object'&&value?value:{seed:value};
  const seed=Number.isFinite(Number(a.seed))?Number(a.seed):hash(a.seed??0);
  return {seed,hairStyle:mod(a.hairStyle??seed,20),face:mod(a.face??seed,7),
    hairColor:color(a.hairColor,HAIR[mod(a.hairColor??seed,HAIR.length)]),
    skinTone:color(a.skinTone,SKIN[mod(a.skinTone??seed,SKIN.length)])};
}

// Each hairstyle owns a complete new stepped silhouette, including its fringe.
// Local coordinates describe a rounded 32px head, never legacy sprite coordinates.
const HAIRSTYLES = [
  {name:'normal', points:[[2,15],[2,9],[5,9],[5,5],[10,5],[10,3],[22,3],[22,5],[27,5],[27,9],[30,9],[30,19],[27,19],[27,14],[24,14],[24,16],[21,16],[21,13],[18,13],[18,16],[15,16],[15,14],[11,14],[11,18],[8,18],[8,14],[5,14],[5,19],[2,19]]},
  {name:'side-part',points:[[2,19],[2,8],[5,8],[5,5],[12,5],[12,3],[24,3],[24,5],[28,5],[28,9],[30,9],[30,16],[26,16],[26,12],[23,12],[23,14],[20,14],[20,16],[16,16],[16,18],[11,18],[11,21],[7,21],[7,16],[5,16],[5,21],[2,21]],part:[[12,5],[15,5],[15,8],[12,8]]},
  {name:'spiky',points:[[1,17],[2,10],[0,7],[6,8],[5,3],[10,5],[13,1],[17,4],[22,1],[23,5],[29,3],[28,8],[32,9],[30,13],[30,19],[27,19],[26,14],[22,16],[20,13],[17,16],[14,13],[10,17],[8,14],[5,20],[2,20]]},
  {name:'mohawk',points:[[13,19],[12,8],[13,2],[17,0],[20,2],[20,10],[22,17],[19,19],[17,14],[16,19]],shaved:true},
  {name:'bob',points:[[1,25],[1,10],[3,10],[3,6],[7,6],[7,3],[25,3],[25,6],[29,6],[29,10],[31,10],[31,26],[26,26],[25,14],[22,14],[22,16],[18,16],[18,13],[13,13],[13,16],[8,16],[7,25]]},
  {name:'curls',points:[[0,19],[1,15],[0,12],[3,10],[2,7],[6,6],[7,3],[12,4],[15,2],[19,4],[24,3],[26,6],[30,7],[29,11],[32,14],[30,20],[26,21],[25,16],[22,17],[19,14],[16,17],[12,14],[9,17],[6,16],[5,21],[2,21]],curls:true},
  {name:'flat-top',points:[[2,19],[2,8],[5,8],[5,2],[27,2],[27,8],[30,8],[30,20],[26,20],[26,13],[6,13],[6,19]]},
  {name:'center-part',points:[[1,20],[1,10],[4,10],[4,6],[9,6],[9,3],[15,3],[16,7],[18,3],[24,3],[24,5],[28,5],[28,9],[31,9],[31,21],[26,21],[26,17],[23,17],[23,14],[20,14],[17,10],[14,10],[11,14],[8,15],[8,20]],part:[[15,4],[17,4],[17,11],[15,11]]},
  {name:'fringe',points:[[2,20],[2,10],[4,10],[4,6],[8,6],[8,3],[24,3],[24,5],[28,5],[28,9],[30,9],[30,20],[27,20],[27,17],[24,17],[24,19],[21,19],[21,16],[18,16],[18,19],[15,19],[15,16],[12,16],[12,18],[9,18],[9,16],[6,16],[6,20]]},
  {name:'wild-spikes',points:[[0,16],[3,11],[0,8],[6,8],[4,3],[10,5],[12,0],[17,4],[22,0],[24,5],[31,3],[29,9],[33,11],[30,15],[31,20],[26,18],[25,14],[22,17],[18,13],[15,17],[11,13],[8,19],[5,16],[3,21]]},
  {name:'swept-up',points:[[2,20],[2,10],[6,10],[6,5],[11,5],[11,1],[17,3],[22,2],[26,5],[28,5],[30,9],[30,17],[27,17],[26,12],[22,12],[22,10],[17,11],[14,14],[10,14],[8,17],[6,17],[6,21]]},
  {name:'bowl',points:[[1,21],[1,10],[3,10],[3,6],[8,6],[8,3],[24,3],[24,6],[29,6],[29,10],[31,10],[31,21],[27,21],[27,16],[6,16],[6,21]]},
  {name:'ponytail',points:[[2,20],[2,10],[5,10],[5,6],[9,6],[9,3],[24,3],[24,5],[28,5],[28,9],[30,9],[30,17],[26,17],[26,12],[21,12],[18,14],[14,15],[9,15],[7,20]],tail:[[-2,13],[-5,17],[-5,27],[-2,31],[2,29],[2,21],[5,16]]},
  {name:'long',points:[[0,29],[0,12],[2,12],[2,7],[6,7],[6,3],[26,3],[26,7],[30,7],[30,12],[32,12],[32,30],[27,29],[25,15],[21,15],[19,12],[14,12],[11,15],[7,15],[6,30]]},
  {name:'slick-back',points:[[2,20],[2,9],[5,9],[5,5],[11,5],[11,2],[23,2],[23,4],[28,4],[28,8],[30,8],[30,19],[27,19],[26,12],[23,12],[23,10],[10,10],[8,13],[6,13],[6,20]]},
  {name:'topknot',points:[[2,20],[2,11],[6,11],[6,7],[11,7],[11,2],[14,0],[21,0],[24,3],[23,7],[27,8],[30,12],[30,20],[26,20],[25,13],[8,13],[6,20]]},
  {name:'wavy-long',points:[[0,25],[2,20],[0,16],[2,10],[5,9],[4,5],[10,5],[12,2],[21,3],[26,4],[29,8],[28,12],[32,16],[30,21],[32,26],[27,28],[24,24],[25,19],[23,15],[20,17],[17,13],[13,17],[10,14],[7,19],[8,24],[4,28]]},
  {name:'asymmetric',points:[[1,26],[1,10],[4,10],[4,6],[9,6],[9,3],[24,3],[24,5],[28,5],[28,9],[30,9],[30,17],[27,17],[26,12],[23,12],[20,15],[17,15],[14,18],[10,21],[7,26]]},
  {name:'buzz',points:[[3,18],[3,11],[6,11],[6,7],[10,7],[10,5],[23,5],[23,7],[27,7],[27,11],[29,11],[29,18],[26,18],[26,12],[7,12],[7,18]]},
  {name:'afro',points:[[-2,22],[-3,16],[-1,12],[-2,8],[2,5],[6,5],[7,1],[12,2],[16,0],[20,2],[25,1],[27,5],[31,5],[34,9],[33,13],[35,17],[33,23],[28,25],[25,21],[25,16],[21,17],[18,14],[14,17],[10,15],[7,18],[6,24],[1,25]],curls:true}
];
export const CHARACTER_HAIRSTYLES = HAIRSTYLES.map(s=>s.name);

function raster(width=64,height=64) {
  const pixels=Array(width*height).fill(null);
  const put=(x,y,c)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&x<width&&y>=0&&y<height)pixels[y*width+x]=c;};
  const rect=(c,x,y,w,h)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)put(x+i,y+j,c);};
  const poly=(c,points,outline=true)=>{
    const mask=[];
    for(let y=Math.floor(Math.min(...points.map(p=>p[1])));y<=Math.ceil(Math.max(...points.map(p=>p[1])));y++){
      const xs=[];
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const a=points[i],b=points[j];
        if((a[1]>y+.5)!==(b[1]>y+.5))xs.push(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      xs.sort((a,b)=>a-b);
      for(let k=0;k<xs.length;k+=2)for(let x=Math.ceil(xs[k]);x<xs[k+1];x++)mask.push([x,y]);
    }
    if(outline)for(const [x,y] of mask)for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])put(x+dx,y+dy,INK);
    for(const [x,y] of mask)put(x,y,c);
    return mask;
  };
  const finish=()=>{
    const canvas=Object.assign(document.createElement('canvas'),{width,height});
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const c=pixels[y*width+x];if(c){ctx.fillStyle=c;ctx.fillRect(x,y,1,1);}}
    return canvas;
  };
  return {put,rect,poly,finish};
}

function head(out,d,x,y,quarter=false,lean=false,back=false) {
  const skin=d.skinTone,skinD=tint(skin,-.19),hair=d.hairColor,hairD=tint(hair,-.32),hairL=tint(hair,.23);
  const project=([u,v])=>[x+Math.round(u*(quarter?.91:1)+(lean?(29-v)*.16:0)),y+v];
  const poly=(c,p,edge=true)=>out.poly(c,p.map(project),edge);
  const rect=(c,u,v,w,h)=>poly(c,[[u,v],[u+w,v],[u+w,v+h],[u,v+h]],false);
  const style=HAIRSTYLES[d.hairStyle];
  if(style.tail)poly(hairD,style.tail);
  // Rounded cheeks, broad ears, stepped jaw. There is deliberately no nose layer.
  poly(skinD,[[3,10],[7,6],[24,6],[29,11],[29,17],[32,18],[32,24],[29,25],[27,29],[22,32],[11,32],[6,29],[4,25],[1,24],[1,18],[3,17]]);
  poly(skin,[[7,10],[25,10],[28,15],[28,25],[24,29],[11,29],[6,25],[6,16]],false);
  rect(tint(skin,.17),8,16,3,7);rect(skin,2,19,3,4);
  if(style.shaved){poly(tint(hair,.28),[[4,10],[9,7],[24,7],[29,12],[29,18],[26,18],[25,13],[8,13],[7,19],[4,19]],false);}
  if(back){poly(hairD,[[4,9],[9,5],[24,5],[29,10],[29,25],[24,30],[9,30],[4,25]]);}
  const mask=poly(hairD,style.points);
  // Three hair tones stay clipped to the authored silhouette, including curls/spikes.
  const bright=project([8,7])[0];
  for(const [px,py] of mask){
    if(py<y+12&&px>bright-3&&px<project([27,7])[0])out.put(px,py,hair);
    if(py>=y+6&&py<=y+9&&px>bright&&px<project([23,7])[0]&&((px+py+mod(d.seed,3))%11!==0))out.put(px,py,hairL);
    if(style.curls&&py<y+15&&(px+2*py)%9<2)out.put(px,py,tint(hair,.14));
  }
  if(style.part)poly(hairD,style.part,false);
  if(back)return;
  const eyes=quarter?[17,25]:[10,22];
  for(const u of eyes){
    if(d.face===4){rect(INK,u-1,22,4,1);rect(INK,u,21,2,1);}
    else {rect(INK,u,20,d.face===5?3:2,d.face===2?3:4);if(d.face===5)rect(WHITE,u,20,1,1);}
    if(d.face===2)rect(hairD,u-1,17,4,2);
    if(d.face===3){rect(hairD,u-1,18,3,1);rect(INK,u,24,2,1);}
    if(d.face===6){rect(hairD,u-1,17,2,1);rect(hairD,u+1,18,2,1);}
    if(d.face===1){poly(INK,[[u-2,19],[u+4,19],[u+4,25],[u-2,25]],false);rect(tint(skin,.2),u-1,20,4,4);rect(INK,u,21,2,3);}
  }
  if(d.face===1)rect(INK,eyes[0]+4,21,eyes[1]-eyes[0]-6,1);
  rect(tint(skin,-.1),quarter?16:8,26,3,1);
}

// Full-body keyframes: hip, knees, ankles, shoulders, elbows and hands all move.
const RUN = [
  {hip:[26,46],head:[25,4],bob:0,legs:[[[27,47],[17,49],[10,43]],[[31,47],[40,52],[45,59]]],arms:[[[28,36],[18,34],[15,39]],[[35,38],[40,45],[49,43]]]},
  {hip:[27,45],head:[26,3],bob:0,legs:[[[28,46],[20,52],[24,58]],[[32,46],[37,49],[40,56]]],arms:[[[29,35],[22,32],[18,35]],[[36,37],[39,43],[45,43]]]},
  {hip:[27,44],head:[27,2],bob:0,legs:[[[29,46],[39,48],[50,53]],[[32,46],[22,52],[12,56]]],arms:[[[29,35],[22,41],[17,40]],[[36,36],[42,33],[48,35]]]},
  {hip:[26,45],head:[26,3],bob:0,legs:[[[27,47],[30,54],[37,56]],[[31,47],[21,50],[19,57]]],arms:[[[28,36],[21,42],[19,45]],[[35,37],[41,35],[46,37]]]}
];
function limb(out,points,width,base,light) {
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
    const nx=-dy/len*width/2,ny=dx/len*width/2;
    out.poly(base,[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]]);
    out.poly(light,[[a[0]+nx*.65,a[1]+ny*.65],[b[0]+nx*.65,b[1]+ny*.65],[b[0],b[1]],[a[0],a[1]]],false);
  }
}
function boot(out,[x,y],forward=true) {
  const dx=forward?3:-3;
  out.poly('#d5dce6',[[x-3,y-2],[x+3,y-2],[x+3+dx,y+1],[x+3+dx,y+3],[x-3+dx,y+3],[x-3,y+1]]);
  out.rect(WHITE,x-2,y-1,5,2);out.rect('#66728b',x-2+dx,y+2,5,1);
}
export function drawCharacter(kit,value=0,{pose='front',direction='right',appearance='player'}={}) {
  const out=raster(),d=characterIdentity(value),k=color(kit,'#2259e8'),kd=tint(k,-.36),kl=tint(k,.25),skin=d.skinTone;
  const back=pose==='back'||pose==='coach',front=pose==='front'||back,idle=pose==='idle';
  if(front||idle){
    const shift=idle?1:0;
    // Broad socks and white boots underneath compact shorts.
    limb(out,[[26,49],[25,56]],6,kd,k);limb(out,[[37,49],[38,56]],6,kd,k);
    boot(out,[24,58],false);boot(out,[39,58]);
    out.poly('#b9c9e0',[[23,45],[40,45],[40,51],[34,53],[31,49],[29,53],[23,51]]);
    out.rect(WHITE,24,46,15,3);
    limb(out,[[23,38],[20,43],[20,47]],6,kd,k);limb(out,[[40,38],[43,42],[43,47]],6,kd,kl);
    out.poly(tint(skin,-.2),[[17,44],[22,44],[23,48],[20,50],[17,48]]);out.rect(skin,18,44,3,4);
    out.poly(skin,[[41,44],[46,44],[46,48],[43,50],[41,48]]);out.rect(tint(skin,.15),42,44,2,3);
    out.poly(kd,[[25,34],[37,34],[41,38],[39,47],[24,47],[22,38]]);
    out.poly(k,[[25,36],[37,36],[39,40],[37,46],[25,45]],false);
    out.poly(WHITE,[[25,36],[29,37],[31,39],[34,37],[38,36],[37,40],[34,42],[28,42],[25,40]],false);
    out.rect(kl,25,42,3,3);out.rect('#d3e2f7',29,39,5,2);
    if(appearance!=='player'){out.rect('#35455e',24,48,6,7);out.rect('#35455e',34,48,6,7);}
    if(pose==='back'){
      // Seated knees point outward; replace the standing lower body completely.
      for(let yy=48;yy<64;yy++)for(let xx=15;xx<49;xx++)out.put(xx,yy,null);
      limb(out,[[26,49],[20,51],[20,55]],6,kd,k);
      limb(out,[[37,49],[43,51],[43,55]],6,kd,k);
      out.poly('#b9c9e0',[[22,47],[41,47],[44,51],[35,53],[28,53],[19,51]]);
      out.rect(WHITE,24,48,16,2);boot(out,[19,56],false);boot(out,[44,56]);
    }
    head(out,d,16+shift,3,idle,false,back);
    if(pose==='coach'){out.rect('#dce4ef',27,40,9,2);out.poly('#ba9560',[[41,43],[48,43],[48,53],[41,53]]);out.rect(WHITE,42,44,5,7);}
  }else{
    let index=Number((pose.match(/[1-4]$/)||['1'])[0])-1;
    const p=JSON.parse(JSON.stringify(RUN[index]||RUN[0]));
    if(pose.startsWith('dribble')){p.head=[26,4];p.legs=index%2?[[[27,47],[21,52],[19,57]],[[32,47],[41,50],[47,55]]]:[[[27,47],[18,50],[14,45]],[[32,47],[36,53],[39,59]]];}
    if(pose.startsWith('kick')||pose==='pass'){
      const windup=pose==='kick1';p.head=windup?[23,3]:[27,5];
      p.legs=windup?[[[27,47],[26,53],[26,59]],[[32,47],[20,50],[14,44]]]:[[[27,47],[20,53],[15,58]],[[32,47],[44,49],[55,43]]];
      if(pose==='pass')p.legs=[[[27,47],[25,54],[25,59]],[[32,47],[40,51],[48,53]]];
      p.arms=[[[28,36],[18,34],[13,38]],[[35,38],[43,41],[49,38]]];
    }
    const arm=(a,far)=>{
      limb(out,a.slice(0,2),6,far?kd:k,far?k:kl);
      limb(out,a.slice(1),5,tint(skin,-.2),skin);
      const h=a[2];
      out.poly(tint(skin,-.15),[[h[0]-2,h[1]-1],[h[0]-1,h[1]-2],[h[0]+2,h[1]-2],[h[0]+3,h[1]-1],[h[0]+3,h[1]+2],[h[0]+2,h[1]+3],[h[0]-2,h[1]+2]]);
      out.rect(skin,h[0]-1,h[1]-1,3,3);
    };
    arm(p.arms[0],true);
    p.legs.forEach((leg,i)=>{limb(out,leg,6,i?kd:tint(k,-.5),i?k:kd);const knee=leg[1];out.rect(kl,knee[0]-1,knee[1]-1,2,2);boot(out,leg[2],i===1);});
    const [hx,hy]=p.hip;
    out.poly('#9eafca',[[hx-6,hy-5],[hx+9,hy-5],[hx+10,hy],[hx+4,hy+4],[hx-1,hy+1],[hx-5,hy+3],[hx-8,hy]]);
    out.poly(WHITE,[[hx-5,hy-5],[hx+8,hy-5],[hx+8,hy-1],[hx+3,hy+1],[hx-5,hy]],false);
    out.poly(kd,[[hx-5,hy-5],[hx,hy-15],[hx+8,hy-16],[hx+13,hy-10],[hx+8,hy-3],[hx+1,hy-1]]);
    out.poly(k,[[hx-2,hy-7],[hx+2,hy-14],[hx+8,hy-14],[hx+11,hy-10],[hx+6,hy-3]],false);
    out.poly(WHITE,[[hx,hy-14],[hx+3,hy-12],[hx+8,hy-13],[hx+10,hy-10],[hx+5,hy-7],[hx,hy-9]],false);
    out.rect(kl,hx-1,hy-7,3,3);
    arm(p.arms[1],false);
    head(out,d,p.head[0],p.head[1],true,true);
  }
  const canvas=out.finish();
  if(direction==='left'){
    const flipped=Object.assign(document.createElement('canvas'),{width:64,height:64}),ctx=flipped.getContext('2d');
    ctx.imageSmoothingEnabled=false;ctx.translate(64,0);ctx.scale(-1,1);ctx.drawImage(canvas,0,0);return flipped;
  }
  return canvas;
}

const avatarCache=new Map();
export function playerAvatar(player,kit='#60a5fa',pose='front') {
  // Old saves without profiles used hash % 80; retain those appearance identities.
  const value=player.avatar??mod(player.avatarIndex??hash(player.id),80);
  const identity=characterIdentity(value),key=JSON.stringify([CHARACTER_VERSION,identity,kit,pose]);
  if(!avatarCache.has(key)){
    if(avatarCache.size>=512)avatarCache.delete(avatarCache.keys().next().value);
    avatarCache.set(key,drawCharacter(kit,identity,{pose}).toDataURL());
  }
  return avatarCache.get(key);
}
