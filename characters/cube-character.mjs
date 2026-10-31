import {applyCubePrint} from './cube-print.mjs';
import {CUBE,cubeShellGeometry,cubeFaceGeometry,cubeBootGeometry} from './cube-shape.mjs';
import {createCubeAccessories} from './cube-wardrobe.mjs';
import {createCharacterClips as bakeClips} from './sketch-character.mjs';
// Original game-ready character based on the supplied cartoon model sheet.
// Bones and a bound SkinnedMesh are kept separate from gameplay collision state.
export const POSES = ['idle','run','jump','fall','dive','land','win','wave','dance','sit','look'];

export function createCubeCharacter(THREE, {shadowTexture=null,skin=null}={}) {
  const root=new THREE.Group();root.name='CubeRunner';
  const bodyPivot=new THREE.Group();bodyPivot.name='CharacterMotion';bodyPivot.rotation.order='YXZ';root.add(bodyPivot);
  const bones=[], named={};
  function bone(name,parent,x,y,z){const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);parent.add(b);bones.push(b);named[name]=b;return b;}
  const hipsY=CUBE.halfH+CUBE.legBelow,face=CUBE.face;
  const hips=bone('Hips',bodyPivot,0,hipsY,0);
  const head=bone('Body',hips,0,0,0);
  for(const [side,sign] of [['Left',-1],['Right',1]]){
    const leg=bone(side+'Leg',hips,sign*.21,-.70,0);
    const shin=bone(side+'Shin',leg,0,-.15,0);
    bone(side+'Foot',shin,0,-.14,0);
  }
  const finishes = {
    gold:{metalness:.82,roughness:.24}, silver:{metalness:.9,roughness:.19},
    chrome:{metalness:.97,roughness:.09}, pearl:{metalness:.36,roughness:.21,
      iridescence:1,iridescenceIOR:1.55,iridescenceThicknessRange:[180,560],clearcoat:.75}
  };
  const finish=finishes[skin?.finish];
  const mats={
    shell:finish ? new THREE.MeshPhysicalMaterial({color:0xffdb20,...finish}) : new THREE.MeshStandardMaterial({color:0xffdb20,roughness:.5}),
    skin:new THREE.MeshStandardMaterial({color:0xf7cdac,roughness:.62}),
    shoe:new THREE.MeshStandardMaterial({color:0xf2596e,roughness:.5}),
    dark:new THREE.MeshStandardMaterial({color:0x292e31,roughness:.48})
  };
  const pieces=[];
  function part(b, material, geometry, position=[0,0,0], scale=[1,1,1], rotation=[0,0,0]) {
    const transform=new THREE.Object3D();transform.position.fromArray(position);transform.scale.fromArray(scale);transform.rotation.set(...rotation);transform.updateMatrix();
    pieces.push({b,material,geometry,transform:transform.matrix});
  }
  const sphere=(b,m,p,s)=>part(b,m,new THREE.SphereGeometry(1,20,14),p,s);
  part(head,'shell',cubeShellGeometry(THREE));
  part(head,'skin',cubeFaceGeometry(THREE),[0,0,face.z]);
  const eyes=[];
  for(const [side,sign] of [['Left',-1],['Right',1]]){
    const eye=bone(side+'Eye',head,skin?.eyeCount===1?0:sign*.35,.025,face.z+.012);eyes.push(eye);
    if(skin?.eyeCount!==1||side==='Left')sphere(eye,'dark',[0,0,0],skin?.eyeCount===1?[.078,.082,.009]:[.057,.058,.008]);
    // Thin straight legs; the coral boot is the lower 44% of the leg with a crisp cuff (model sheet).
    part(named[side+'Leg'],'skin',new THREE.CapsuleGeometry(.08,.22,4,12),[0,-.10,0]);
    part(named[side+'Shin'],'skin',new THREE.CapsuleGeometry(.08,.08,4,12),[0,-.06,0]);
    part(named[side+'Foot'],'shoe',cubeBootGeometry(THREE,.086,.085));
  }
  // Tiny puckered mouth, matching the supplied model card.
  sphere(head,'skin',[0,-.13,face.z+.009],[.024,.017,.014]);
  sphere(head,'dark',[.006,-.134,face.z+.021],[.009,.006,.003]);
  root.updateMatrixWorld(true);
  const skeleton=new THREE.Skeleton(bones);const meshes=[];
  for(const [key,material] of Object.entries(mats)){
    const positions=[],normals=[],uvs=[],indices=[],weights=[],triangles=[];
    for(const piece of pieces.filter(p=>p.material===key)){
      const g=piece.geometry.clone(),offset=positions.length/3;
      const matrix=new THREE.Matrix4().multiplyMatrices(piece.b.matrixWorld,piece.transform);g.applyMatrix4(matrix);
      positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);uvs.push(...g.attributes.uv.array);
      const idx=bones.indexOf(piece.b);
      for(let i=0;i<g.attributes.position.count;i++){indices.push(idx,0,0,0);weights.push(1,0,0,0);}
      if(g.index)for(const index of g.index.array)triangles.push(offset+index);
      else for(let i=0;i<g.attributes.position.count;i++)triangles.push(offset+i);
      g.dispose();piece.geometry.dispose();
    }
    if(!positions.length)continue;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    g.setIndex(triangles);
    const mesh=new THREE.SkinnedMesh(g,material);mesh.name='Character_'+key;mesh.frustumCulled=false;bodyPivot.add(mesh);mesh.bind(skeleton);meshes.push(mesh);
  }
  const accessory=createCubeAccessories(THREE,skin?.hat||'none');head.add(accessory.group);
  if(accessory.full)for(const m of meshes)if(m.material===mats.shell)m.visible=false;
  function applyColors({shell=skin?.c1??0xffdb20,face=0xf7cdac,boots=skin?.c2??0xf2596e,pattern=skin?.pattern||'plain',secondary=skin?.c2??0xf2596e}={}) {
    applyCubePrint(THREE,mats.shell,{pattern,primary:shell,secondary,center:[0,hipsY,0]});
    for(const {material,base} of accessory.printMaterials||[])applyCubePrint(THREE,material,{pattern,primary:base,secondary,center:[0,0,0]});
    mats.skin.color.set(face);mats.shoe.color.set(boots);
  }
  applyColors();
  const blobShadow=new THREE.Mesh(new THREE.PlaneGeometry(1.55,1.55),new THREE.MeshBasicMaterial({color:shadowTexture?0xffffff:0x24314d,map:shadowTexture,transparent:true,opacity:shadowTexture?.72:.16,depthWrite:false}));
  blobShadow.rotation.x=-Math.PI/2;blobShadow.position.y=.025;root.add(blobShadow);
  const shieldRing=new THREE.Mesh(new THREE.TorusGeometry(.95,.06,10,28),new THREE.MeshBasicMaterial({color:0xffd740}));shieldRing.rotation.x=Math.PI/2;shieldRing.position.y=1;shieldRing.visible=false;root.add(shieldRing);
  const oldRot=bones.map(b=>new THREE.Quaternion()),oldScale=new THREE.Vector3();
  let clock=0,wasGrounded=true,landingTime=0;
  function animate(dt,{speed=0,grounded=true,diving=false,celebrating=false,vy=0,squash=0,pose=null}={}){
    clock+=dt;
    if(!wasGrounded && grounded)landingTime=.16;
    wasGrounded=grounded;landingTime=Math.max(0,landingTime-dt);
    if(pose==='lobby'){const seq=['wave','idle','dance','idle','sit','idle','look','idle'];pose=seq[Math.floor(clock/6)%seq.length];}
    for(let i=0;i<bones.length;i++)oldRot[i].copy(bones[i].quaternion);
    oldScale.copy(bodyPivot.scale);
    const oldY=bodyPivot.position.y,oldRX=bodyPivot.rotation.x,oldRZ=bodyPivot.rotation.z;
    const mode=pose||(celebrating?'win':diving?'dive':!grounded?(vy>=0?'jump':'fall'):landingTime>0?'land':speed>.6?'run':'idle');
    const phase=clock*(mode==='run'?Math.max(5,speed*1.7):5);
    for(const b of bones)b.rotation.set(0,0,0);
    bodyPivot.position.y=0;bodyPivot.rotation.x=0;bodyPivot.rotation.z=0;bodyPivot.scale.set(1+squash*.2,1-squash*.24,1+squash*.2);
    if(mode==='dance'){
      const beat=clock*5.6,swing=Math.sin(beat);
      bodyPivot.rotation.z=swing*.16;bodyPivot.rotation.x=Math.cos(beat*.5)*.07;
      bodyPivot.position.y=Math.abs(Math.sin(beat))*.10;
      head.rotation.y=Math.sin(beat*.5)*.18;
      named.LeftLeg.rotation.x=swing*.5;named.RightLeg.rotation.x=-swing*.5;
      named.LeftFoot.rotation.z=-.12;named.RightFoot.rotation.z=.12;
    }else if(mode==='sit'){
      bodyPivot.position.y=-.30;bodyPivot.rotation.x=-.08;
      named.LeftLeg.rotation.x=named.RightLeg.rotation.x=-1.25;
      named.LeftShin.rotation.x=named.RightShin.rotation.x=.35;
      head.rotation.z=Math.sin(clock*1.2)*.04;
    }else if(mode==='look'){
      head.rotation.y=Math.sin(clock*1.6)*.26;bodyPivot.rotation.z=Math.sin(clock*.8)*.07;
      named.LeftFoot.rotation.x=Math.sin(clock*3)*.12;
    }else if(mode==='run'){
      const swing=Math.sin(phase);bodyPivot.position.y=Math.abs(Math.sin(phase*2))*.045;bodyPivot.rotation.x=.08;bodyPivot.rotation.z=swing*.065;
      named.LeftLeg.rotation.x=swing*.75;named.RightLeg.rotation.x=-swing*.75;
      named.LeftShin.rotation.x=Math.max(0,-swing)*.5;named.RightShin.rotation.x=Math.max(0,swing)*.5;
    } else if(mode==='jump'||mode==='fall') {
      named.LeftLeg.rotation.x=-.35;named.RightLeg.rotation.x=.25;
      named.LeftShin.rotation.x=.5;named.RightShin.rotation.x=.2;
      bodyPivot.rotation.z=Math.sin(clock*6)*.035;
    } else if(mode==='dive') {
      bodyPivot.rotation.x=1.15;bodyPivot.position.y=.25;
      named.LeftLeg.rotation.x=-.3;named.RightLeg.rotation.x=-.3;
    } else if(mode==='win'||mode==='wave') {
      bodyPivot.rotation.z=Math.sin(phase)*.15;bodyPivot.position.y=Math.abs(Math.sin(phase))*(mode==='win'?.18:.04);
      named.LeftLeg.rotation.x=Math.sin(phase)*.25;named.RightLeg.rotation.x=-Math.sin(phase)*.25;
    } else if(mode==='land') {
      const progress=pose?Math.min(1,clock/.5):1-landingTime/.16;
      const k=Math.max(0,Math.sin(progress*Math.PI));bodyPivot.position.y=-k*.06;
      bodyPivot.scale.set(1+k*.10,1-k*.12,1+k*.10);
    } else {bodyPivot.position.y=Math.sin(clock*2.4)*.012;head.rotation.y=Math.sin(clock*.8)*.035;}
    const blink=clock>1 && Math.cos(clock*1.7)>.997?.12:1;
    for(const eye of eyes)eye.scale.y=blink;
    const blend=dt>0?1-Math.exp(-dt*16):1;
    for(let i=0;i<bones.length;i++){oldRot[i].slerp(bones[i].quaternion,blend);bones[i].quaternion.copy(oldRot[i]);}
    bodyPivot.position.y=THREE.MathUtils.lerp(oldY,bodyPivot.position.y,blend);
    bodyPivot.rotation.x=THREE.MathUtils.lerp(oldRX,bodyPivot.rotation.x,blend);
    bodyPivot.rotation.z=THREE.MathUtils.lerp(oldRZ,bodyPivot.rotation.z,blend);
    oldScale.lerp(bodyPivot.scale,blend);bodyPivot.scale.copy(oldScale);
    return mode;
  }
  return {root,bodyPivot,skeleton,bones:named,meshes,mainMat:mats.shell,materials:mats,setColors:applyColors,accessory:accessory.group,blobShadow,shieldRing,
    leftArm:new THREE.Object3D(),rightArm:new THREE.Object3D(),leftLeg:named.LeftLeg,rightLeg:named.RightLeg,animate,
    resetAnimation(){clock=0;wasGrounded=true;landingTime=0;animate(0,{pose:'idle'});},
    dispose(){head.remove(accessory.group);accessory.dispose();root.traverse(o=>o.geometry?.dispose());Object.values(mats).forEach(m=>m.dispose());blobShadow.material.dispose();shieldRing.material.dispose();skeleton.dispose();}};
}

export const createCharacterClips=(THREE,rig)=>bakeClips(THREE,rig,POSES);
