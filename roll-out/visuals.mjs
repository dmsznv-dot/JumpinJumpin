import { RADIUS, RING_WIDTH, SECTORS } from './rollout.mjs';
export function createRolloutVisuals(THREE, course) {
 const root=new THREE.Group();
 const colors=[0xf4529d,0x38cbe6,0xffd43b,0x9767e8,0x49d5af];
 const mats=colors.map(color=>new THREE.MeshStandardMaterial({color,roughness:.48,side:THREE.DoubleSide}));
 const wallMat=new THREE.MeshStandardMaterial({color:0xffe1f1,roughness:.48});
 const edgeMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.55});
 const stripeMat=new THREE.MeshStandardMaterial({color:0xf3548b,roughness:.45});
 const gapMat=new THREE.MeshStandardMaterial({color:0xffdb56,roughness:.45});
 const seamGeo=new THREE.CylinderGeometry(.038,.038,RING_WIDTH-.25,8);
 seamGeo.rotateZ(Math.PI/2);
 const groups=course.rings.map((ring,i)=>{
  const group=new THREE.Group();group.position.set(ring.x,-RADIUS,0);root.add(group);
  for(let s=0;s<SECTORS;s++) {
   if(s===ring.gap || s===(ring.gap+1)%SECTORS)continue;
   // Thick shell with inner surface and closed sides exposes the cut-out depth.
   const count=8, verts=[],idx=[], inner=RADIUS-.8;
   for(let j=0;j<=count;j++){
    const a=(s+j/count)*Math.PI*2/SECTORS, c=Math.cos(a), q=Math.sin(a);
    verts.push(-RING_WIDTH/2+.03,RADIUS*c,RADIUS*q, RING_WIDTH/2-.03,RADIUS*c,RADIUS*q,
      -RING_WIDTH/2+.03,inner*c,inner*q, RING_WIDTH/2-.03,inner*c,inner*q);
   }
   for(let j=0;j<count;j++){let k=j*4,n=k+4;
    idx.push(k,k+1,n,k+1,n+1,n, k+2,n+2,k+3,k+3,n+2,n+3,
      k,n,k+2,k+2,n,n+2, k+1,k+3,n+1,k+3,n+3,n+1);}
   idx.push(0,2,1,1,2,3);let e=count*4;idx.push(e,e+1,e+2,e+1,e+3,e+2);
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(idx);geo.computeVertexNormals();
   const m=new THREE.Mesh(geo,mats[i]);m.receiveShadow=true;group.add(m);
   const mid=(s+.5)*Math.PI*2/SECTORS;
   const seam=new THREE.Mesh(seamGeo,edgeMat);
   seam.position.set(0,(RADIUS+.025)*Math.cos(mid),(RADIUS+.025)*Math.sin(mid));
   group.add(seam);
   // Pale trim only on solid sections, so it never bridges a hole.
   for(const x of [-RING_WIDTH/2+.08,RING_WIDTH/2-.08]){
    const trim=new THREE.Mesh(new THREE.TorusGeometry(RADIUS,.065,6,8,Math.PI*2/SECTORS),edgeMat);
    trim.rotation.y=Math.PI/2;trim.rotation.x=Math.PI/2;trim.position.x=x;
    // Torus arc is easier to orient around the drum using a parent.
    const holder=new THREE.Group();holder.rotation.x=s*Math.PI*2/SECTORS;holder.add(trim);group.add(holder);
   }
  }
  // Padded lips outline the actual edges of each opening without covering it.
  for(const boundary of [ring.gap,ring.gap+2]){
   const a=boundary*Math.PI*2/SECTORS;
   const lip=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,RING_WIDTH-.18,12),gapMat);
   lip.rotation.z=Math.PI/2;
   lip.position.set(0,(RADIUS-.06)*Math.cos(a),(RADIUS-.06)*Math.sin(a));group.add(lip);
  }
  const a=(ring.wall+.5)*Math.PI*2/SECTORS;
  const w=RING_WIDTH*.9,h=1.8,r=.28, shape=new THREE.Shape();
  shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
  shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);
  shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);
  shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
  const wallGeo=new THREE.ExtrudeGeometry(shape,{depth:.48,bevelEnabled:false,curveSegments:6});wallGeo.translate(0,0,-.24);
  const wall=new THREE.Mesh(wallGeo,wallMat);
  wall.position.set(0,(RADIUS+.9)*Math.cos(a),(RADIUS+.9)*Math.sin(a)); wall.rotation.x=a;wall.castShadow=true;group.add(wall);
  for (const side of [-1,1]) for(let stripe=-1;stripe<=1;stripe++){
   const detail=new THREE.Mesh(new THREE.BoxGeometry(.36,1.48,.015),stripeMat);
   detail.position.set(stripe*1.25,0,side*.25);wall.add(detail);
  }

  return group;
 });
 return {root,update(){course.rings.forEach((r,i)=>{groups[i].rotation.x=r.angle;});},dispose(){root.traverse(o=>o.geometry?.dispose());[...mats,wallMat,edgeMat,stripeMat,gapMat].forEach(m=>m.dispose());}};
}

