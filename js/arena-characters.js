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
  const skin=['#efba87','#bf8159','#f4cea4'][index%3];
  const skinShade=['#c88a61','#925a40','#d6a17c'][index%3];
  const hair=['#35241c','#81502d','#d5a344','#191d29','#a7532d','#44302b'][index%6];
  const hairLight=['#65412a','#af7540','#f3cc69','#41485a','#d38547','#77513a'][index%6];
  const kitShade=shadeKit(kit,.48);
  const kitLight=shadeKit(kit,1,.22);

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
