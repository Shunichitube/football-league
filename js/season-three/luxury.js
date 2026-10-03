import * as THREE from 'three';

export function dressArena(scene){
 const wood=document.createElement('canvas');wood.width=1024;wood.height=512;const wc=wood.getContext('2d');wc.fillStyle='#59432e';wc.fillRect(0,0,1024,512);
 for(let y=0;y<512;y+=32){wc.fillStyle=y%64?'#694d33':'#5f452f';wc.fillRect(0,y,1024,31);for(let x=0;x<1024;x+=128){wc.fillStyle='#35291e';wc.fillRect(x+(y%64?64:0),y,1,32);}}
 for(let i=0;i<700;i++){wc.strokeStyle=`rgba(231,188,121,${.03+(i%4)*.01})`;wc.beginPath();const y=(i*73)%512,x=(i*137)%1024;wc.moveTo(x,y);wc.bezierCurveTo(x+35,y-2,x+70,y+3,x+120,y);wc.stroke();}
 const wt=new THREE.CanvasTexture(wood);wt.colorSpace=THREE.SRGBColorSpace;wt.wrapS=wt.wrapT=THREE.RepeatWrapping;wt.repeat.set(3,2);
 scene.traverse(o=>{if(o.geometry?.parameters?.width===46){o.material.map=wt;o.material.color.set(0xffffff);o.material.needsUpdate=true;}});
 const metal=new THREE.MeshStandardMaterial({color:0x9b773e,metalness:.8,roughness:.28});
 const dark=new THREE.MeshStandardMaterial({color:0x0d1924,metalness:.35,roughness:.4});
 const gold=new THREE.MeshStandardMaterial({color:0xffd99a,emissive:0xffb953,emissiveIntensity:2});
 const mint=new THREE.MeshStandardMaterial({color:0x9fffe3,emissive:0x32e7ad,emissiveIntensity:2});
 const box=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);scene.add(o);return o;};
 // Continuous architectural light strips, stepped seating and a gold court frame.
 for(const s of [-1,1]){
   box(45,.045,.055,gold,0,.13,s*11.4);box(.055,.045,22.8,gold,s*22.5,.13,0);
   for(let r=0;r<8;r++)box(51,.035,.055,r%2?gold:mint,0,.5+r*.65,s*(13.55+r*.95));
   box(57,.3,.4,metal,0,7.1,s*22.3);box(57,.07,.07,gold,0,7.3,s*22.08);
   // Illuminated private boxes with jersey displays echo the clubhouse cabinets.
   for(let i=-3;i<=3;i++){
     const x=i*7.5,z=s*23.2;
     box(7.1,4,.55,dark,x,9.3,z);box(7.1,.1,.4,gold,x,11.25,z-s*.35);
     for(const edge of [-1,1])box(.1,4,.6,metal,x+edge*3.5,9.3,z);
     box(5.8,.55,1.2,dark,x,7.7,z-s*.8);
     const c=document.createElement('canvas');c.width=512;c.height=384;const p=c.getContext('2d');
     const g=p.createRadialGradient(256,100,20,256,200,300);g.addColorStop(0,'#675039');g.addColorStop(1,'#0c1720');p.fillStyle=g;p.fillRect(0,0,512,384);
     p.fillStyle='#204c79';p.beginPath();p.moveTo(165,80);p.lineTo(220,55);p.lineTo(292,55);p.lineTo(347,80);p.lineTo(380,155);p.lineTo(330,180);p.lineTo(315,135);p.lineTo(315,315);p.lineTo(197,315);p.lineTo(197,135);p.lineTo(182,180);p.lineTo(132,155);p.closePath();p.fill();
     p.strokeStyle='#e9d5ab';p.lineWidth=8;p.beginPath();p.moveTo(220,55);p.lineTo(256,90);p.lineTo(292,55);p.stroke();p.fillStyle='#f2dfb8';p.font='bold 80px Arial';p.textAlign='center';p.fillText(String(i+7),256,230);
     const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
     const art=new THREE.Mesh(new THREE.PlaneGeometry(4.6,3.1),new THREE.MeshBasicMaterial({map:t}));art.position.set(x,9.5,z-s*.31);if(s===1)art.rotation.y=Math.PI;scene.add(art);
   }
   for(let i=-4;i<=4;i++){box(.13,7,.13,metal,i*6.5,10,s*23.7);box(.07,7,.07,gold,i*6.5+.15,10,s*23.6);}
 }
 // Suspended rectangular light sculpture above the playing surface.
 for(const y of [12.2,13])for(const s of [-1,1]){
   box(43,.12,.12,metal,0,y,s*12);box(43,.055,.055,gold,0,y-.1,s*12);
   box(.12,.12,24,metal,s*21.5,y,0);box(.055,.055,24,gold,s*21.5,y-.1,0);
 }
 // Warm practical lights are local and do not need additional shadow maps.
 for(const x of [-22,0,22])for(const s of [-1,1]){const l=new THREE.PointLight(0xffbc6b,65,23,2);l.position.set(x,9,s*20);scene.add(l);}
 const c=document.createElement('canvas');c.width=c.height=128;const p=c.getContext('2d');const g=p.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,226,155,1)');g.addColorStop(.15,'rgba(255,190,80,.5)');g.addColorStop(1,'rgba(255,190,80,0)');p.fillStyle=g;p.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);
 const lamps=[];for(let i=0;i<36;i++){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:t,color:0xffd693,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));sprite.position.set((i%18-8.5)*3,8+(i%3)*.4,i<18?-21.8:21.8);sprite.scale.set(.65,.65,1);scene.add(sprite);lamps.push(sprite);}
 return time=>lamps.forEach((lamp,i)=>{lamp.material.opacity=.65+Math.sin(time*.0008+i*1.9)*.15;});
}
