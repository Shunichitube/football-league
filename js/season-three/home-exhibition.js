const bases=[[-18.5,0],[-10,2.8],[-4,-4.3],[-2,5],[0,0],[18.5,0],[11,2],[4,-3.5],[6,4.2],[3,.8]];
const mix=(a,b,p)=>a+(b-a)*p;
function progress(t){
 if(t<2)return [0,0];
 if(t<8)return [(t-2)/12,1/12];
 if(t<13)return [.5,0];
 if(t<16)return [.5+(t-13)/6,1/6];
 if(t<20)return [1,0];
 if(t<24)return [1-(t-20)/4,-1/4];
 return [0,0];
}
export function homeExhibitionFrame(seconds){
 const cycle=seconds%52,sign=cycle<26?1:-1,t=cycle%26,offset=sign>0?0:5;
 const [p,rate]=progress(t);
 const actors=bases.map(([x,z],i)=>{
  const keeper=i%5===0,amount=keeper?0:i%5===1?2:8;
  const sideShift=keeper?0:i%5===2?-.6:i%5===3?.6:0;
  const vx=sign*amount*rate||0,vz=sideShift*rate||0;
  const catching=i===(sign>0?5:0)&&t>=18.4&&t<20;
  const shooting=i===offset+4&&t>=16.5&&t<17.4;
  return {x:x+sign*amount*p,z:z+sideShift*p,vx,vz,motion:catching?'catch':shooting?'shoot':Math.hypot(vx,vz)===0?'idle':i===offset+4&&t<8?'dribble':'run',actionTime:catching?t-18.4:shooting?t-16.5:seconds};
 });
 const fw=actors[offset+4],mf=actors[offset+2],near=actors[offset+3],gk=actors[sign>0?5:0];
 let ball={x:fw.x+sign*.55,z:fw.z,y:.244,visible:true};
 const pass=(a,b,p)=>({x:mix(a.x,b.x,p),z:mix(a.z,b.z,p),y:.244,visible:true});
 if(t>=8&&t<10)ball=pass(fw,mf,(t-8)/2);
 else if(t>=10&&t<11)ball=pass(mf,mf,0);
 else if(t>=11&&t<13)ball=pass(mf,near,(t-11)/2);
 else if(t>=13&&t<15)ball=pass(near,fw,(t-13)/2);
 else if(t>=17&&t<18.5){const q=(t-17)/1.5;ball=pass(fw,gk,q);ball.y+=Math.sin(q*Math.PI/2)*.8;}
 else if(t>=18.5&&t<20)ball={x:gk.x,z:gk.z,y:1,visible:false};
 else if(t>=20)ball=pass(gk,fw,Math.min(1,(t-20)/4));
 return {actors,ball};
}
