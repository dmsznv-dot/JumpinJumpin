import { RADIUS, RING_WIDTH, SECTORS } from './rollout.mjs';
export function createRolloutVisuals(THREE, course) {
 const root=new THREE.Group();
 const colors=[0xf4529d,0x38cbe6,0xffd43b,0x9767e8,0x49d5af];
 const mats=colors.map(color=>new THREE.MeshStandardMaterial({color,roughness:.48,side:THREE.DoubleSide}));
 const wallMat=new THREE.MeshStandardMaterial({color:0xffe1f1,roughness:.48});
 const edgeMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.55});
 const groups=course.rings.map((ring,i)=>{
  const group=new THREE.Group();group.position.set(ring.x,-RADIUS,0);root.add(group);
  for(let s=0;s<SECTORS;s++) {
   if(s===ring.gap)continue;
   const count=8, verts=[],idx=[];
   for(let j=0;j<=count;j++){
    const a=(s+j/count)*Math.PI*2/SECTORS;
    for(const x of [-RING_WIDTH/2+.03,RING_WIDTH/2-.03])verts.push(x,RADIUS*Math.cos(a),RADIUS*Math.sin(a));
   }
   for(let j=0;j<count;j++){let k=j*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(idx);geo.computeVertexNormals();
   const m=new THREE.Mesh(geo,mats[i]);m.receiveShadow=true;group.add(m);
  }
  const a=(ring.wall+.5)*Math.PI*2/SECTORS;
  const wall=new THREE.Mesh(new THREE.BoxGeometry(RING_WIDTH*.9,1.8,.48),wallMat);
  wall.position.set(0,(RADIUS+.9)*Math.cos(a),(RADIUS+.9)*Math.sin(a)); wall.rotation.x=a;wall.castShadow=true;group.add(wall);
  for(const x of [-RING_WIDTH/2+.06,RING_WIDTH/2-.06]){
   const edge=new THREE.Mesh(new THREE.TorusGeometry(RADIUS,.075,8,64),edgeMat);
   edge.rotation.y=Math.PI/2;edge.position.x=x;group.add(edge);
  }
  return group;
 });
 return {root,update(){course.rings.forEach((r,i)=>{groups[i].rotation.x=r.angle;});},dispose(){root.traverse(o=>o.geometry?.dispose());[...mats,wallMat,edgeMat].forEach(m=>m.dispose());}};
}
