import * as THREE from 'three';
export function createFootball(){
  const ball=new THREE.Group();const radius=.22;
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(radius,40,28),new THREE.MeshStandardMaterial({color:0xf7f4ec,roughness:.5}));sphere.castShadow=true;ball.add(sphere);
  // Twelve black pentagons, arranged around the vertices of an icosahedron.
  const phi=(1+Math.sqrt(5))/2,centers=[];
  for(const a of [-1,1])for(const b of [-phi,phi])centers.push(new THREE.Vector3(0,a,b),new THREE.Vector3(a,b,0),new THREE.Vector3(b,0,a));
  const black=new THREE.MeshStandardMaterial({color:0x15202d,roughness:.65,side:THREE.DoubleSide});
  for(const normal of centers){normal.normalize();const u=new THREE.Vector3(0,1,0).cross(normal).normalize(),v=normal.clone().cross(u);const vertices=[];
    const center=normal.clone().multiplyScalar(radius+.014);
    for(let i=0;i<5;i++){const points=[center];for(const j of [i,i+1]){const angle=j*Math.PI*2/5;points.push(normal.clone().addScaledVector(u,Math.cos(angle)*.31).addScaledVector(v,Math.sin(angle)*.31).normalize().multiplyScalar(radius+.014));}points.forEach(p=>vertices.push(p.x,p.y,p.z));}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();ball.add(new THREE.Mesh(geo,black));
  }
  return ball;
}
