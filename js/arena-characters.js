import { playerAvatarTexture } from './player-avatar.js?v=appearance-v15';

// FOOTBALL LEAGUE character renderer v2
// Unified cute pixel-art language: large head, no nose, simple eyes, strong silhouette.
// Existing public function names are preserved so current UI callers keep working.

function shadeKit(hex,factor,white=0){
  const channels=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255);
  return '#'+channels.map(v=>{
    const linear=v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
    const mixed=linear*factor+(1-linear)*white;
    const srgb=mixed<=.0031308?mixed*12.92:1.055*mixed**(1/2.4)-.055;
    return Math.round(srgb*255).toString(16).padStart(2,'0');
  }).join('');
}
const SKIN=['#efba87','#bf8159','#f4cea4'];
const SKIN_D=['#c88a61','#925a40','#d6a17c'];
const HAIR=['#35241c','#81502d','#d5a344','#191d29','#a7532d','#44302b','#e8e1cf','#6b7280','#c2410c','#2563eb','#16a34a','#9333ea'];
const HAIR_L=['#65412a','#af7540','#f3cc69','#41485a','#d38547','#77513a','#fff7df','#a1a8b3','#f97316','#60a5fa','#4ade80','#c084fc'];

function data(index){
  const a=typeof index==='object'&&index?index:null, n=(a?.seed??Number(index))||0;
  return {n,skin:SKIN[(a?.skinTone??n)%3],skinD:SKIN_D[(a?.skinTone??n)%3],
    hair:HAIR[(a?.hairColor??n)%12],hairL:HAIR_L[(a?.hairColor??n)%12],
    hs:(a?.hairStyle??n)%20,face:(a?.face??n)%7};
}
function surface(w=32,h=40){
  const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
  const ctx=canvas.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const px=Array.from({length:h},()=>Array(w).fill(null));
  const rect=(c,x,y,rw,rh)=>{for(let yy=y;yy<y+rh;yy++)for(let xx=x;xx<x+rw;xx++)if(px[yy]&&xx>=0&&xx<w)px[yy][xx]=c;};
  const finish=()=>{
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const f=px[y][x],edge=!f&&[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([xx,yy])=>px[yy]?.[xx]);
      if(f||edge){ctx.fillStyle=f||'#111923';ctx.fillRect(x,y,1,1);}
    }
    return canvas;
  };
  return {canvas,ctx,rect,finish};
}
function hairFront(r,d){
  const h=d.hair,l=d.hairL,m=d.hs;
  // Each hairstyle has its own silhouette. These are intentionally redrawn rather than
  // scaled versions of the legacy sprites.
  switch(m){
    case 0: r(h,8,2,16,5);r(h,7,6,4,6);r(h,21,6,4,5);r(l,11,2,9,1);r(l,9,4,5,1);break;
    case 1: r(h,8,2,16,5);r(h,7,6,5,7);r(h,11,6,10,3);r(l,10,2,6,1);r(l,16,4,7,1);break;
    case 2: r(h,8,3,16,4);for(const [x,y] of [[7,2],[11,0],[16,1],[21,2]])r(h,x,y,4,5);r(l,12,1,2,3);r(l,18,2,2,3);break;
    case 3: r(h,14,0,5,8);r(h,9,5,14,3);r(h,8,7,4,4);r(h,22,7,3,3);r(l,15,0,1,6);break;
    case 4: r(h,7,2,18,5);r(h,6,6,5,13);r(h,22,6,5,13);r(h,10,6,5,3);r(l,10,2,10,1);r(l,7,7,2,8);break;
    case 5: r(h,7,3,18,5);r(h,9,1,14,4);r(h,5,6,6,7);r(h,22,6,5,7);for(const x of [9,14,19])r(l,x,2,3,2);break;
    case 6: r(h,9,1,14,5);r(h,7,5,18,3);r(h,8,8,4,3);r(h,21,8,4,3);r(l,11,1,10,1);break;
    case 7: r(h,7,2,18,5);r(h,6,6,8,7);r(h,19,6,7,7);r(h,15,2,3,8);r(l,10,2,4,2);r(l,19,2,3,2);break;
    case 8: r(h,7,2,18,5);r(h,8,6,16,4);r(h,11,9,10,3);r(l,10,2,10,1);r(l,13,6,7,1);break;
    case 9: r(h,8,4,16,4);for(const [x,y,hh] of [[6,2,6],[10,0,7],[15,1,6],[21,2,5]])r(h,x,y,4,hh);r(l,11,1,2,4);r(l,17,2,2,3);break;
    case 10:r(h,9,2,15,5);r(h,7,6,15,4);r(h,7,9,7,4);r(l,15,2,8,1);r(l,16,5,5,1);break;
    case 11:r(h,7,2,18,7);r(h,6,7,20,4);r(h,7,10,4,4);r(h,22,10,4,4);r(l,10,2,10,1);break;
    case 12:r(h,8,2,16,5);r(h,6,6,5,15);r(h,21,6,5,8);r(h,5,18,5,4);r(l,10,2,9,1);r(l,7,8,2,9);break;
    case 13:r(h,7,2,18,5);r(h,5,6,6,13);r(h,22,6,6,13);r(h,10,6,13,3);r(l,10,2,9,1);r(l,6,8,2,8);r(l,25,8,2,8);break;
    case 14:r(h,9,2,15,5);r(h,10,6,13,3);r(h,12,9,9,2);r(l,12,2,10,1);r(l,15,5,6,1);break;
    case 15:r(h,9,5,15,3);r(h,12,2,9,4);r(h,14,0,5,3);r(h,8,7,4,5);r(h,22,7,3,4);r(l,15,0,3,1);break;
    case 16:r(h,7,2,18,6);r(h,5,6,7,9);r(h,12,7,5,5);r(h,20,6,7,10);r(l,10,2,10,1);r(l,7,8,3,3);break;
    case 17:r(h,7,2,18,5);r(h,6,6,16,4);r(h,6,9,11,4);r(h,6,12,6,3);r(l,11,2,10,1);r(l,9,6,6,1);break;
    case 18:r(h,10,4,13,3);r(h,9,6,15,2);r(h,9,8,4,3);r(h,21,8,3,3);r(l,12,4,8,1);break;
    case 19:r(h,8,1,16,4);r(h,5,4,22,7);r(h,4,8,7,7);r(h,23,8,6,7);r(l,10,2,4,3);r(l,17,2,4,3);r(l,23,5,2,3);break;
  }
}
function hairThreeQuarter(r,d){
  const h=d.hair,l=d.hairL,m=d.hs;
  // Same 20 identities translated into the forward-leaning 3/4 match pose.
  switch(m){
    case 0:r(h,10,2,15,5);r(h,8,6,6,9);r(h,22,6,4,5);r(l,14,2,8,1);break;
    case 1:r(h,10,2,15,5);r(h,8,6,7,10);r(h,14,6,9,3);r(l,13,2,5,1);r(l,19,4,5,1);break;
    case 2:r(h,10,3,15,4);for(const [x,y] of [[9,1],[13,0],[18,1],[23,2]])r(h,x,y,4,5);r(l,14,1,2,3);break;
    case 3:r(h,16,0,5,8);r(h,11,5,14,3);r(h,9,7,5,5);r(l,17,0,1,6);break;
    case 4:r(h,9,2,17,5);r(h,7,6,6,15);r(h,22,6,5,11);r(l,13,2,9,1);break;
    case 5:r(h,9,2,17,6);r(h,7,5,7,10);r(h,22,5,5,8);r(l,13,2,3,2);r(l,19,3,3,2);break;
    case 6:r(h,11,1,14,5);r(h,9,5,17,3);r(h,9,8,5,4);r(l,14,1,9,1);break;
    case 7:r(h,9,2,17,5);r(h,7,6,9,9);r(h,20,6,6,7);r(h,17,2,3,8);r(l,13,2,4,2);break;
    case 8:r(h,9,2,17,5);r(h,10,6,15,4);r(h,13,9,9,3);r(l,13,2,9,1);break;
    case 9:r(h,10,4,15,4);for(const [x,y,hh] of [[8,2,6],[12,0,7],[18,1,6],[23,2,5]])r(h,x,y,4,hh);r(l,13,1,2,4);break;
    case 10:r(h,11,2,14,5);r(h,8,6,15,4);r(h,8,9,7,5);r(l,17,2,7,1);break;
    case 11:r(h,9,2,17,7);r(h,7,7,20,4);r(h,8,10,6,5);r(l,13,2,9,1);break;
    case 12:r(h,10,2,15,5);r(h,7,6,6,16);r(h,22,6,5,9);r(h,6,18,5,4);r(l,13,2,8,1);break;
    case 13:r(h,9,2,17,5);r(h,6,6,7,14);r(h,22,6,6,12);r(h,12,6,11,3);r(l,13,2,8,1);break;
    case 14:r(h,11,2,14,5);r(h,11,6,13,3);r(h,13,9,9,2);r(l,15,2,8,1);break;
    case 15:r(h,11,5,14,3);r(h,14,2,9,4);r(h,16,0,5,3);r(h,9,7,5,6);r(l,17,0,3,1);break;
    case 16:r(h,9,2,17,6);r(h,6,6,8,11);r(h,14,7,5,5);r(h,22,6,6,10);r(l,13,2,9,1);break;
    case 17:r(h,9,2,17,5);r(h,7,6,16,4);r(h,7,9,11,5);r(h,7,13,6,3);r(l,13,2,9,1);break;
    case 18:r(h,12,4,12,3);r(h,10,6,15,2);r(h,9,8,5,4);r(l,14,4,7,1);break;
    case 19:r(h,10,1,16,4);r(h,7,4,21,7);r(h,6,8,8,8);r(h,24,8,5,6);r(l,13,2,4,3);r(l,20,2,4,3);break;
  }
}

export function pixelTexture(kit,index,appearance='player',options={}){
  if (appearance === 'player') return playerAvatarTexture(index,{...options,kit});
  return supporterTexture(kit,index,appearance);
}

function supporterTexture(kit,index,appearance){
  const s=surface(),r=s.rect,d=data(index),kd=shadeKit(kit,.46),kl=shadeKit(kit,1,.25);
  // Big rounded face; intentionally NO nose.
  r(d.skinD,8,5,16,13);r(d.skin,9,5,14,12);r(d.skinD,7,10,2,4);r(d.skinD,23,10,2,4);
  hairFront(r,d);
  // Simple friendly face; retain face variation without changing the silhouette.
  if(d.face===1){r('#171b23',10,10,5,4);r('#171b23',18,10,5,4);r(d.skin,11,11,3,2);r(d.skin,19,11,3,2);r('#171b23',15,11,3,1);}
  else if(d.face===4){r('#171b23',11,12,4,1);r('#171b23',18,12,4,1);}
  else if(d.face===2){r('#3b2925',11,9,4,1);r('#3b2925',19,9,4,1);r('#171b23',12,11,2,2);r('#171b23',20,11,2,2);}
  else if(d.face===3){r('#171b23',12,12,2,2);r('#171b23',19,12,2,2);r('#3b2925',11,10,3,1);r('#3b2925',19,10,3,1);}
  else if(d.face===5){r('#171b23',11,10,4,4);r('#171b23',19,10,4,4);r('#f7fbff',12,10,1,1);r('#f7fbff',20,10,1,1);}
  else if(d.face===6){r('#3b2925',11,9,1,1);r('#3b2925',12,10,3,1);r('#3b2925',20,10,3,1);r('#3b2925',23,9,1,1);r('#171b23',12,12,2,1);r('#171b23',20,12,2,1);}
  else {r('#171b23',12,11,2,3);r('#171b23',19,11,2,3);}
  r(d.skinD,14,18,5,2);
  // Compact, toy-like football body.
  r(kd,9,20,14,10);r(kit,11,20,11,9);r(kl,12,20,3,8);r('#f4f7f7',15,20,4,2);
  r(kd,6,21,5,7);r(kit,22,21,4,7);r(d.skinD,5,27,5,3);r(d.skin,24,27,4,3);
  if(appearance!=='player'){r('#34415b',10,29,13,5);r('#536685',10,33,5,5);r('#536685',19,33,5,5);}
  else {r('#f5f4eb',10,29,13,5);r('#bbc7d2',10,33,13,2);r(kd,10,34,5,4);r(kd,19,34,5,4);}
  r('#27313e',8,37,7,2);r('#27313e',19,37,7,2);
  return s.finish();
}

export function pixelSideTexture(kit,index,pose='run1',direction='right'){
  const s=surface(36,40),r=s.rect,d=data(index),kd=shadeKit(kit,.46),kl=shadeKit(kit,1,.25);
  const run2=pose==='run2'||pose==='dribble2',kick=pose==='kick',pass=pose==='pass';
  // 3/4 face: both eyes remain visible, no nose. Head leads the body for forward momentum.
  r(d.skinD,11,5,15,13);r(d.skin,12,5,13,12);
  hairThreeQuarter(r,d);
  r('#171b23',19,11,2,3);r('#171b23',23,11,2,3);
  r(d.skinD,16,18,5,2);
  // Torso slopes forward to the right.
  r(kd,10,20,14,8);r(kit,13,19,13,8);r(kl,14,20,3,6);r('#f4f7f7',18,20,4,2);
  // Strong opposing arm swing.
  if(kick||pass){r(kd,9,21,5,4);r(d.skinD,5,24,6,3);r(kit,24,20,4,4);r(d.skin,27,22,5,3);}
  else if(run2){r(kd,9,21,5,4);r(d.skinD,6,17,4,7);r(kit,24,20,4,4);r(d.skin,27,24,5,3);}
  else {r(kd,9,21,5,4);r(d.skinD,5,24,6,3);r(kit,24,20,4,4);r(d.skin,27,17,4,7);}
  r('#f5f4eb',12,27,13,5);r('#bbc7d2',13,31,11,2);
  // Bent-knee running silhouettes, based on the reference's low, fast stride.
  if(kick){
    r(kd,13,31,4,6);r('#27313e',11,36,7,3);
    r(kd,21,31,4,3);r(kd,24,32,7,3);r('#27313e',29,34,7,3);
  }else if(run2){
    r(kd,13,31,4,4);r(kd,9,34,6,3);r('#27313e',5,36,8,3);
    r(kd,21,31,4,6);r('#27313e',20,36,8,3);
  }else{
    r(kd,13,31,4,6);r('#27313e',10,36,8,3);
    r(kd,21,31,4,4);r(kd,24,34,6,3);r('#27313e',28,36,8,3);
  }
  const out=s.finish();
  if(direction==='left'){
    const c=document.createElement('canvas');c.width=out.width;c.height=out.height;
    const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.translate(c.width,0);x.scale(-1,1);x.drawImage(out,0,0);return c;
  }
  return out;
}

export function seatedBackTexture(kit,index){
  const s=surface(),r=s.rect,d=data(index),kd=shadeKit(kit,.46),kl=shadeKit(kit,1,.22);
  r(d.hair,8,3,16,12);r(d.hairL,11,3,8,1);r(d.skinD,14,15,5,3);
  r(kd,8,18,16,11);r(kit,10,19,12,9);r(kl,11,19,3,8);r('#f4f7f7',15,19,4,2);
  r('#f5f4eb',10,29,13,4);r('#bbc7d2',10,32,13,2);
  r('#27313e',6,34,8,3);r('#27313e',20,34,8,3);
  return s.finish();
}

export function coachTexture(index){
  const s=surface(),r=s.rect,d=data(index);
  r(d.hair,8,3,16,12);r(d.hairL,11,3,8,1);r(d.skinD,14,15,5,3);
  r('#172333',8,18,16,12);r('#26394d',10,19,12,10);r('#aebcc4',11,20,10,2);
  r('#172333',10,29,6,8);r('#172333',19,29,6,8);r('#111923',8,36,8,3);r('#111923',19,36,8,3);
  return s.finish();
}
