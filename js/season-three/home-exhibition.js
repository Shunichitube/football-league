const bases=[[-18.5,0],[-11,2],[-4,-4],[-3,5],[0,0],[18.5,0],[11,2],[4,-4],[3,5],[2,0]];
const mix=(a,b,p)=>a+(b-a)*p;
export function sampleHomePath(points,t){
 for(let i=1;i<points.length;i++)if(t<points[i][0]){const a=points[i-1],b=points[i],dt=b[0]-a[0],p=Math.max(0,(t-a[0])/dt);return {x:mix(a[1],b[1],p),z:mix(a[2],b[2],p),vx:(b[1]-a[1])/dt||0,vz:(b[2]-a[2])/dt||0};}
 const last=points.at(-1);return {x:last[1],z:last[2],vx:0,vz:0};
}
export function homeExhibitionFrame(seconds){
 const cycle=seconds%52,sign=cycle<26?1:-1,t=cycle%26,own=sign>0?0:5,enemy=sign>0?5:0;
 const paths=bases.map(([x,z])=>[[0,x,z],[26,x,z]]);
 function path(i,keys){const [x,z]=bases[i];paths[i]=[[0,x,z],...keys.map(([time,dx,dz])=>[time,x+dx*sign,z+dz]),[26,x,z]];}
 // The carrier challenges his marker, cuts into space and waits for a return pass.
 path(own+4,[[1,0,0],[4,2,0],[5,2,0],[6,2,-1.4],[8,5,-1.4],[9,5,0],[13,5,0],[16,8,.4],[20,8,.4],[24,0,0]]);
 path(enemy+4,[[.7,0,0],[2.5,-.2,.6],[4,1,0],[5,1,0],[6.6,1,-1.1],[9,3,-1.1],[10,3,-.1],[14,3,-.1],[17,6,.4],[19,6,.4],[24,0,0]]);
 // Far midfielder offers a pass; his opponent closes after the ball is released.
 path(own+2,[[2,0,0],[5,3,-.7],[7,3,-.7],[9,6,-.7],[11,6,-.7],[14,8,1],[18,8,1],[23,0,0]]);
 path(enemy+2,[[3,0,0],[6,-1,-.4],[8,-1,-.4],[10,-.6,-.6],[11.5,-.6,-.6],[14,2,.6],[17,2,.6],[24,0,0]]);
 // Near midfielder makes a separate run and then checks back for the pass.
 path(own+3,[[.5,0,0],[4,5,.5],[6,5,.5],[8,3,-1],[11,3,-1],[13,6,-1],[16,6,-1],[22,0,0]]);
 path(enemy+3,[[1.5,0,0],[4.5,1,.2],[7,1,.2],[10,-1,-1],[13,-1,-1],[16,3,-1],[19,3,-1],[24,0,0]]);
 path(own+1,[[3,0,0],[6,1,-2],[11,1,-2],[14,2,0],[19,2,0],[23,0,0]]);
 path(enemy+1,[[2,0,0],[5,-1,-1],[10,-1,-1],[14,-2,-1],[18,-2,-1],[23,0,0]]);
 const actors=paths.map((points,i)=>{const p=sampleHomePath(points,t),catching=i===enemy&&t>=18.4&&t<20,shooting=i===own+4&&t>=16.5&&t<17.4;return {...p,motion:catching?'catch':shooting?'shoot':Math.hypot(p.vx,p.vz)===0?'idle':i===own+4&&t<9?'dribble':'run',actionTime:catching?t-18.4:shooting?t-16.5:seconds};});
 const fw=actors[own+4],mf=actors[own+2],near=actors[own+3],gk=actors[enemy];
 const pass=(a,b,p)=>({x:mix(a.x,b.x,p),z:mix(a.z,b.z,p),y:.244,visible:true});
 let ball={x:fw.x+sign*.55,z:fw.z,y:.244,visible:true};
 if(t>=8&&t<9.2)ball=pass(fw,mf,(t-8)/1.2);
 else if(t>=9.2&&t<11)ball={...pass(mf,mf,0),x:mf.x+sign*.5};
 else if(t>=11&&t<12.2)ball=pass(mf,near,(t-11)/1.2);
 else if(t>=12.2&&t<13.2)ball={...pass(near,near,0),x:near.x+sign*.5};
 else if(t>=13.2&&t<14.4)ball=pass(near,fw,(t-13.2)/1.2);
 else if(t>=17&&t<18.5){const q=(t-17)/1.5;ball=pass(fw,gk,q);ball.y+=Math.sin(q*Math.PI/2)*.8;}
 else if(t>=18.5&&t<20)ball={x:gk.x,z:gk.z,y:1,visible:false};
 else if(t>=20)ball=pass(gk,fw,Math.min(1,(t-20)/4));
 return {actors,ball};
}
