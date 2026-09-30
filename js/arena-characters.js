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
  const {hair:h,hairL:l,hs}=d;
  r(h,8,2,16,5); r(l,11,2,9,1);
  const m=hs;
  if(m===2||m===9){for(const [x,y] of [[8,1],[12,0],[17,1],[22,2]])r(h,x,y,3,4);}
  else if(m===3){r(h,14,0,5,7);r(l,15,0,1,5);}
  else if(m===4||m===12||m===13||m===16){r(h,6,6,4,13);r(h,22,6,4,13);}
  else if(m===5||m===19){r(h,6,2,20,7);r(h,5,6,4,7);r(h,23,6,4,7);}
  else if(m===6){r(h,8,0,16,6);}
  else if(m===7){r(h,7,3,18,5);r(h,7,7,7,5);r(h,19,7,6,5);}
  else if(m===8||m===17){r(h,7,3,18,5);r(h,8,7,12,4);}
  else if(m===11){r(h,6,3,20,7);r(h,7,9,4,4);r(h,21,9,4,4);}
  else if(m===15){r(h,9,4,14,3);r(h,14,0,5,5);}
  else if(m===18){r(h,9,4,14,3);}
  else {r(h,7,6,4,5);r(h,21,6,4,5);}
}
function hairThreeQuarter(r,d){
  const {hair:h,hairL:l,hs}=d;
  r(h,8,2,15,5);r(h,7,6,5,9);r(l,12,2,8,1);
  if(hs===2||hs===9){r(h,9,0,3,4);r(h,14,1,3,3);r(h,20,2,3,3);}
  else if(hs===3){r(h,15,0,5,7);}
  else if([4,12,13,16].includes(hs)){r(h,6,6,4,14);r(h,8,17,5,3);}
  else if(hs===5||hs===19){r(h,6,2,19,7);r(h,5,6,5,8);}
  else if(hs===15){r(h,12,0,6,5);}
  else if(hs===18){r(h,9,3,14,3);}
  else if(hs===7){r(h,8,5,8,5);r(h,19,5,5,4);}
}

export function pixelTexture(kit,index,appearance='player'){
  const s=surface(),r=s.rect,d=data(index),kd=shadeKit(kit,.46),kl=shadeKit(kit,1,.25);
  // Big rounded face; intentionally NO nose.
  r(d.skinD,8,5,16,13);r(d.skin,9,5,14,12);r(d.skinD,7,10,2,4);r(d.skinD,23,10,2,4);
  hairFront(r,d);
  // Simple friendly face; retain face variation without changing the silhouette.
  if(d.face===1){r('#171b23',10,10,5,4);r('#171b23',18,10,5,4);r(d.skin,11,11,3,2);r(d.skin,19,11,3,2);r('#171b23',15,11,3,1);}
  else if(d.face===4){r('#171b23',11,12,4,1);r('#171b23',18,12,4,1);}
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
