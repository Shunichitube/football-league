// Character artwork restored from commit 0860bd579b08b540ff9cc51f94c58a00c1723315.
// Original pixel coordinates, palettes, silhouettes and clothing are preserved.
// Match Three.js linear-light color shading without loading its 3D renderer.
function shadeKit(hex, factor, white = 0) {
  const channels=hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255);
  return '#'+channels.map(value=>{
    const linear=value<=.04045?value/12.92:((value+.055)/1.055)**2.4;
    const mixed=linear*factor+(1-linear)*white;
    const srgb=mixed<=.0031308?mixed*12.92:1.055*mixed**(1/2.4)-.055;
    return Math.round(srgb*255).toString(16).padStart(2,'0');
  }).join('');
}
export function pixelTexture(kit,index,appearance='player'){
  // Chunky 24 x 32 sprite: large head, compact body, one-pixel silhouette.
  const canvas=document.createElement('canvas'); canvas.width=24; canvas.height=32;
  const ctx=canvas.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const pixels=Array.from({length:32},()=>Array(24).fill(null));
  function rect(color,x,y,w,h){
    for(let py=y;py<y+h;py++) for(let px=x;px<x+w;px++)
      if(pixels[py]&&px>=0&&px<24) pixels[py][px]=color;
  }
  const avatar=typeof index==='object'&&index?index:null;
  const numericIndex=(avatar?.seed ?? Number(index)) || 0;
  const skinIndex=avatar?.skinTone ?? numericIndex;
  const hairColorIndex=avatar?.hairColor ?? numericIndex;
  const hairStyleIndex=avatar?.hairStyle ?? numericIndex;
  const faceStyle=avatar?.face ?? numericIndex;
  const skin=['#efba87','#bf8159','#f4cea4'][skinIndex%3];
  const skinShade=['#c88a61','#925a40','#d6a17c'][skinIndex%3];
  const hair=['#35241c','#81502d','#d5a344','#191d29','#a7532d','#44302b','#e8e1cf','#6b7280','#c2410c','#2563eb','#16a34a','#9333ea'][hairColorIndex%12];
  const hairLight=['#65412a','#af7540','#f3cc69','#41485a','#d38547','#77513a','#fff7df','#a1a8b3','#f97316','#60a5fa','#4ade80','#c084fc'][hairColorIndex%12];
  const kitShade=shadeKit(kit,.48);
  const kitLight=shadeKit(kit,1,.22);

  // Oversized front-facing head with ears and two simple dark eyes.
  rect(skinShade,6,4,12,10); rect(skin,7,4,10,9);
  rect(skinShade,5,8,1,3); rect(skinShade,18,8,1,3);
  if(faceStyle%7===1){
    // Glasses.
    rect('#171b23',8,8,4,3); rect('#171b23',13,8,4,3); rect('#171b23',12,9,1,1);
    rect(skin,9,9,2,1); rect(skin,14,9,2,1);
  }else if(faceStyle%7===2){
    // Sharp eyebrows and upturned eyes.
    rect('#3b2925',8,7,3,1); rect('#3b2925',13,7,3,1); rect('#171b23',10,9,1,1); rect('#171b23',14,9,1,1);
    rect('#171b23',9,10,1,1); rect('#171b23',15,10,1,1);
  }else if(faceStyle%7===3){
    // Soft drooping eyebrows and eyes.
    rect('#3b2925',8,8,3,1); rect('#3b2925',13,8,3,1); rect('#171b23',9,10,1,1); rect('#171b23',14,10,1,1);
    rect('#171b23',10,9,1,1); rect('#171b23',15,9,1,1);
  }else if(faceStyle%7===4){
    // Narrow eyes.
    rect('#3b2925',8,7,2,1); rect('#3b2925',14,7,2,1); rect('#171b23',8,10,4,1); rect('#171b23',13,10,4,1);
  }else if(faceStyle%7===5){
    // Sparkly eyes: tiny highlights inside oversized dark eyes.
    rect('#3b2925',8,7,2,1); rect('#3b2925',14,7,2,1); rect('#171b23',8,9,3,3); rect('#171b23',14,9,3,3);
    rect('#f7fbff',9,9,1,1); rect('#f7fbff',15,9,1,1);
  }else if(faceStyle%7===6){
    // Determined eyebrows: outer edges rise for a sharper, heroic look.
    rect('#3b2925',8,7,1,1); rect('#3b2925',9,8,3,1);
    rect('#3b2925',15,8,3,1); rect('#3b2925',18,7,1,1);
    rect('#171b23',9,10,2,1); rect('#171b23',14,10,2,1);
  }else{
    rect('#3b2925',8,7,2,1); rect('#3b2925',14,7,2,1);
    // Small dark eyes without whites for a softer expression.
    rect('#171b23',9,9,1,2); rect('#171b23',14,9,1,2);
  }
  const isWoman=appearance==='woman';
  if(isWoman){
    // Long hair, ponytail and bob silhouettes among the female supporters.
    rect(hair,5,2,14,3); rect(hairLight,7,2,9,1);
    const style=numericIndex%3;
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
  }else switch(hairStyleIndex%20){
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
    case 6: // Flat top.
      rect(hair,6,1,12,4); rect(hair,5,4,14,2); rect(hair,6,6,2,1); rect(hair,16,6,2,1);
      rect(hairLight,7,1,9,1); break;
    case 7: // Center part with curtains.
      rect(hair,5,2,14,3); rect(hair,5,5,5,4); rect(hair,14,5,5,4);
      rect(hairLight,8,2,3,2); rect(hairLight,13,2,3,2); rect(hair,11,2,2,5); break;
    case 8: // Forward fringe.
      rect(hair,5,2,14,3); rect(hair,6,5,12,2); rect(hair,8,7,7,2);
      rect(hairLight,7,2,8,1); rect(hairLight,9,5,5,1); break;
    case 9: // High messy spikes.
      rect(hair,6,4,12,2);
      for(const [x,h] of [[5,4],[8,5],[12,5],[16,4]]) rect(hair,x,1,2,h);
      rect(hairLight,8,1,1,4); rect(hairLight,12,2,1,3); break;
    case 10: // Undercut sweep.
      rect(hair,6,2,12,3); rect(hair,5,5,12,2); rect(hair,5,7,5,2);
      rect(hairLight,10,2,7,1); rect(hairLight,11,4,4,1); break;
    case 11: // Bowl cut.
      rect(hair,5,2,14,4); rect(hair,4,5,16,3); rect(hair,5,8,2,2); rect(hair,17,8,2,2);
      rect(hairLight,7,2,9,1); break;
    case 12: // Long side tail.
      rect(hair,6,2,12,3); rect(hair,5,5,3,8); rect(hair,16,5,3,4); rect(hair,4,12,3,3);
      rect(hairLight,7,2,7,1); rect(hairLight,5,6,1,6); break;
    case 13: // Double side locks.
      rect(hair,5,2,14,3); rect(hair,4,5,4,7); rect(hair,16,5,4,7); rect(hair,8,5,8,1);
      rect(hairLight,7,2,8,1); rect(hairLight,4,6,1,4); rect(hairLight,18,6,1,4); break;
    case 14: // Slick back.
      rect(hair,6,2,12,3); rect(hair,7,5,10,1); rect(hair,8,6,8,1);
      rect(hairLight,8,2,9,1); rect(hairLight,10,4,5,1); break;
    case 15: // Tiny top knot.
      rect(hair,6,4,12,2); rect(hair,9,2,6,3); rect(hair,10,0,4,2); rect(hair,6,6,1,2); rect(hair,17,6,1,2);
      rect(hairLight,10,1,3,1); break;
    case 16: // Shaggy mop.
      rect(hair,5,2,14,4); rect(hair,4,5,4,5); rect(hair,9,5,3,3); rect(hair,15,5,5,5);
      rect(hairLight,7,2,9,1); rect(hairLight,5,6,2,2); break;
    case 17: // Angular fringe.
      rect(hair,5,2,14,3); rect(hair,5,5,11,2); rect(hair,5,7,7,2); rect(hair,5,9,3,1);
      rect(hairLight,8,2,8,1); rect(hairLight,7,5,4,1); break;
    case 18: // Buzz cut.
      rect(hair,7,3,10,2); rect(hair,6,5,12,1); rect(hair,6,6,2,1); rect(hair,16,6,2,1);
      rect(hairLight,8,3,7,1); break;
    case 19: // Big rounded afro.
      rect(hair,6,1,12,3); rect(hair,4,3,16,5); rect(hair,3,6,4,4); rect(hair,17,6,4,4);
      rect(hairLight,7,2,3,2); rect(hairLight,12,2,3,2); rect(hairLight,16,4,2,2); break;
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
    if(numericIndex%2===0){
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
  return canvas;
}


// Side-facing player sprite for match / conveyor-court animation.
// Reuses the same avatar seed, skin, hair and kit rules as pixelTexture().
export function pixelSideTexture(kit,index,pose='run1',direction='right'){
  const canvas=document.createElement('canvas'); canvas.width=24; canvas.height=32;
  const ctx=canvas.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const pixels=Array.from({length:32},()=>Array(24).fill(null));
  function rect(color,x,y,w,h){
    for(let py=y;py<y+h;py++) for(let px=x;px<x+w;px++)
      if(pixels[py]&&px>=0&&px<24) pixels[py][px]=color;
  }
  const avatar=typeof index==='object'&&index?index:null;
  const numericIndex=(avatar?.seed ?? Number(index)) || 0;
  const skinIndex=avatar?.skinTone ?? numericIndex;
  const hairColorIndex=avatar?.hairColor ?? numericIndex;
  const hairStyleIndex=avatar?.hairStyle ?? numericIndex;
  const skin=['#efba87','#bf8159','#f4cea4'][skinIndex%3];
  const skinShade=['#c88a61','#925a40','#d6a17c'][skinIndex%3];
  const hair=['#35241c','#81502d','#d5a344','#191d29','#a7532d','#44302b','#e8e1cf','#6b7280','#c2410c','#2563eb','#16a34a','#9333ea'][hairColorIndex%12];
  const hairLight=['#65412a','#af7540','#f3cc69','#41485a','#d38547','#77513a','#fff7df','#a1a8b3','#f97316','#60a5fa','#4ade80','#c084fc'][hairColorIndex%12];
  const kitShade=shadeKit(kit,.48), kitLight=shadeKit(kit,1,.22);

  // Profile head. The nose projects toward the running direction.
  rect(skinShade,7,4,10,10); rect(skin,8,4,9,9);
  rect(skin,17,8,2,3); rect(skinShade,18,10,1,1);
  rect('#171b23',15,8,1,2);
  rect('#3b2925',14,7,3,1);
  rect(skinShade,12,12,5,2);

  // Keep the player's hair identity, translated into a readable side silhouette.
  const hs=hairStyleIndex%20;
  rect(hair,7,2,10,4); rect(hair,6,5,4,7);
  rect(hairLight,10,2,6,1);
  if([2,9].includes(hs)){
    rect(hair,8,0,2,3); rect(hair,12,1,2,2); rect(hair,16,2,2,2);
  }else if(hs===3){
    rect(hair,11,0,4,5); rect(hairLight,12,0,1,4);
  }else if([4,12,13,16,19].includes(hs)){
    rect(hair,5,5,3,10); rect(hair,7,12,4,3);
  }else if(hs===15){
    rect(hair,9,0,5,3); rect(hair,10,0,3,1);
  }else if([6,18].includes(hs)){
    rect(hair,7,2,10,3);
  }else{
    rect(hair,7,5,2,6);
  }

  // Neck and compact side-on football shirt.
  rect(skinShade,10,14,5,2);
  rect(kitShade,7,16,10,8); rect(kit,9,16,8,8);
  rect(kitLight,10,16,2,7); rect('#edf4f5',11,16,4,1);

  // Arms change with the pose to make running / passing / shooting readable.
  const kick=pose==='kick'||pose==='pass';
  const run2=pose==='run2';
  if(kick){
    rect(kitShade,6,17,4,3); rect(skinShade,4,19,4,2);
    rect(kit,16,17,3,3); rect(skin,18,19,3,2);
  }else if(run2){
    rect(kitShade,6,17,4,3); rect(skinShade,4,15,3,5);
    rect(kit,16,17,3,3); rect(skin,18,20,3,4);
  }else{
    rect(kitShade,6,17,4,3); rect(skinShade,4,20,4,2);
    rect(kit,16,17,3,3); rect(skin,18,15,3,5);
  }

  // Shorts and legs. Two run frames deliberately swap the stride.
  rect('#bbc7d2',8,24,9,4); rect('#f5f4eb',9,24,7,3);
  if(kick){
    // Plant leg + forward kicking leg.
    rect(kitShade,9,27,3,4); rect('#27313e',8,30,5,2);
    rect(kitShade,14,27,3,2); rect(kitShade,16,28,4,2); rect('#27313e',19,29,4,2);
  }else if(run2){
    rect(kitShade,9,27,3,3); rect(kitShade,7,29,4,2); rect('#27313e',5,30,6,2);
    rect(kitShade,14,27,3,4); rect('#27313e',14,30,6,2);
  }else{
    rect(kitShade,9,27,3,4); rect('#27313e',7,30,6,2);
    rect(kitShade,14,27,3,3); rect(kitShade,17,29,3,2); rect('#27313e',18,30,5,2);
  }

  for(let y=0;y<32;y++) for(let x=0;x<24;x++){
    const fill=pixels[y][x];
    const edge=!fill&&[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([nx,ny])=>pixels[ny]?.[nx]);
    if(fill||edge){ctx.fillStyle=fill||'#111923';ctx.fillRect(x,y,1,1);}
  }

  if(direction==='left'){
    const flipped=document.createElement('canvas'); flipped.width=24; flipped.height=32;
    const fctx=flipped.getContext('2d'); fctx.imageSmoothingEnabled=false;
    fctx.translate(24,0); fctx.scale(-1,1); fctx.drawImage(canvas,0,0);
    return flipped;
  }
  return canvas;
}

export function seatedBackTexture(kit,index){
  const canvas=document.createElement('canvas'); canvas.width=24; canvas.height=32;
  const ctx=canvas.getContext('2d');
  function rect(color,x,y,w,h){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
  const hair=['#35241c','#81502d','#191d29','#a7532d','#44302b'][index%5];
  const shade=shadeKit(kit,.48);
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
  return canvas;
}

export function coachTexture(index){
  const texture=seatedBackTexture('#253446',index);
  const ctx=texture.getContext('2d');
  ctx.clearRect(3,14,18,18);
  ctx.fillStyle='#111923'; ctx.fillRect(5,14,14,11);
  ctx.fillStyle='#26394d'; ctx.fillRect(6,15,12,9);
  ctx.fillStyle='#aebcc4'; ctx.fillRect(7,16,10,1);
  ctx.fillStyle='#172333'; ctx.fillRect(7,24,4,6); ctx.fillRect(13,24,4,6);
  ctx.fillStyle='#111923'; ctx.fillRect(6,30,5,2); ctx.fillRect(13,30,5,2);
  ctx.fillStyle='#b59363'; ctx.fillRect(18,19,4,7);
  ctx.fillStyle='#e0dcc5'; ctx.fillRect(19,20,2,4);
  if(index===0){ctx.fillStyle='#31485a';ctx.fillRect(5,2,14,4);}
  return texture;
}
