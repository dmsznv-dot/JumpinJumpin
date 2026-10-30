// Original game-ready character based on the supplied cartoon model sheet.
// Bones and a bound SkinnedMesh are kept separate from gameplay collision state.
export const POSES = ['idle','run','jump','fall','dive','land','win','wave'];

export function createSketchCharacter(THREE, {shadowTexture=null}={}) {
  const root=new THREE.Group();root.name='SketchCharacter';
  const bodyPivot=new THREE.Group();bodyPivot.name='CharacterMotion';root.add(bodyPivot);
  const bones=[], named={};
  function bone(name,parent,x,y,z){const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);parent.add(b);bones.push(b);named[name]=b;return b;}
  const hips=bone('Hips',bodyPivot,0,.60,0);
  const spine=bone('Spine',hips,0,.24,0);
  const neck=bone('Neck',spine,0,.37,0);
  const head=bone('Head',neck,0,.35,0);
  for(const [side,sign] of [['Left',-1],['Right',1]]){
    const arm=bone(side+'Arm',spine,sign*.39,.20,0);
    const elbow=bone(side+'Forearm',arm,sign*.05,-.25,0);
    const hand=bone(side+'Hand',elbow,0,-.23,.015);
    bone(side+'Fingers',hand,0,-.10,.025);
    const thigh=bone(side+'Leg',hips,sign*.20,-.02,0);
    const knee=bone(side+'Shin',thigh,0,-.22,0);
    bone(side+'Foot',knee,0,-.22,.065);
  }
  const mats={
    skin:new THREE.MeshStandardMaterial({color:0xffd4b2,roughness:.58}),
    shirt:new THREE.MeshStandardMaterial({color:0xf27091,roughness:.63}),
    shorts:new THREE.MeshStandardMaterial({color:0x34476d,roughness:.65}),
    hair:new THREE.MeshStandardMaterial({color:0x49313c,roughness:.65}),
    shoe:new THREE.MeshStandardMaterial({color:0xf4c24f,roughness:.55}),
    sole:new THREE.MeshStandardMaterial({color:0xfff1d7,roughness:.65}),
    white:new THREE.MeshStandardMaterial({color:0xfffdf9,roughness:.35}),
    iris:new THREE.MeshStandardMaterial({color:0x3c8eae,roughness:.35}),
    dark:new THREE.MeshStandardMaterial({color:0x211c2b,roughness:.55})
  };
  const pieces=[];
  function part(b, material, geometry, position=[0,0,0], scale=[1,1,1], rotation=[0,0,0]) {
    const transform=new THREE.Object3D();transform.position.fromArray(position);transform.scale.fromArray(scale);transform.rotation.set(...rotation);transform.updateMatrix();
    pieces.push({b,material,geometry,transform:transform.matrix});
  }
  const sphere=(b,m,p,s)=>part(b,m,new THREE.SphereGeometry(1,28,20),p,s);
  sphere(head,'skin',[0,0,0],[.65,.69,.54]);
  for(const sign of [-1,1])sphere(head,'skin',[sign*.62,-.02,0],[.14,.19,.12]);
  sphere(spine,'shirt',[0,.08,0],[.39,.41,.30]);
  sphere(hips,'shorts',[0,.015,0],[.37,.20,.29]);
  // Separate rounded trouser legs, instead of a skirt-like continuous hem.
  for(const [side,sign] of [['Left',-1],['Right',1]]){
    part(named[side+'Leg'],'shorts',new THREE.CapsuleGeometry(.17,.12,6,16),[0,-.055,0]);
    part(named[side+'Shin'],'skin',new THREE.CapsuleGeometry(.105,.09,6,16),[0,-.04,0]);
    sphere(named[side+'Foot'],'shoe',[0,-.04,.09],[.20,.14,.31]);
    sphere(named[side+'Foot'],'sole',[0,-.12,.09],[.205,.045,.305]);
    sphere(named[side+'Arm'],'shirt',[sign*.015,-.07,0],[.17,.18,.17]);
    part(named[side+'Arm'],'skin',new THREE.CapsuleGeometry(.092,.12,6,14),[0,-.16,0]);
    part(named[side+'Forearm'],'skin',new THREE.CapsuleGeometry(.095,.12,6,14),[0,-.12,0]);
    sphere(named[side+'Hand'],'skin',[0,-.055,.02],[.15,.16,.075]);
    for(let finger=0;finger<3;finger++)part(named[side+'Fingers'],'skin',new THREE.CapsuleGeometry(.042,.11,5,12),[(finger-1)*.085,-.07,.015],[1,1,1],[0,0,(finger-1)*.15]);
    sphere(named[side+'Hand'],'skin',[-sign*.13,-.01,.045],[.075,.12,.065]);
  }
  // Bob haircut: back volume, side locks and a central parting in the fringe.
  sphere(head,'hair',[0,.04,-.28],[.68,.71,.32]);
  part(head,'hair',new THREE.SphereGeometry(1,32,20,0,Math.PI*2,0,1.05),[0,.015,-.015],[.69,.73,.58]);
  for(const sign of [-1,1]){
    sphere(head,'hair',[sign*.57,-.16,-.015],[.16,.52,.30]);
    sphere(head,'hair',[sign*.28,.51,.29],[.29,.11,.19]);
    sphere(head,'hair',[sign*.64,-.51,.01],[.20,.12,.26]);
  }
  // Large eye whites and pupils are volumetric. Brows have their own bones.
  const eyes=[];
  for(const [side,sign] of [['Left',-1],['Right',1]]){
    const eye=bone(side+'Eye',head,sign*.255,.08,.445);eyes.push(eye);
    sphere(eye,'white',[0,0,0],[.245,.31,.145]);
    sphere(eye,'iris',[-sign*.025,-.045,.132],[.102,.125,.035]);
    sphere(eye,'dark',[-sign*.025,-.045,.16],[.052,.075,.022]);
    sphere(eye,'white',[-sign*.025-.025,-.006,.181],[.026,.030,.012]);
    const brow=bone(side+'Brow',head,sign*.255,.405,.53);
    sphere(brow,'hair',[0,0,0],[.19,.035,.045]);
  }
  sphere(head,'skin',[0,-.13,.54],[.115,.08,.10]);
  const smile=[];for(let i=0;i<=12;i++){const x=-.17+i*.34/12;smile.push(new THREE.Vector3(x,-.32+.09*(x/.17)**2,.48));}
  part(head,'dark',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smile),16,.018,8,false));
  // White collar follows the torso, with a small shirt button.
  sphere(spine,'white',[0,.32,.18],[.23,.075,.12]);
  sphere(spine,'sole',[0,.02,.295],[.035,.035,.012]);
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
  const blobShadow=new THREE.Mesh(new THREE.PlaneGeometry(1.55,1.55),new THREE.MeshBasicMaterial({color:shadowTexture?0xffffff:0x24314d,map:shadowTexture,transparent:true,opacity:shadowTexture?.72:.16,depthWrite:false}));
  blobShadow.rotation.x=-Math.PI/2;blobShadow.position.y=.025;root.add(blobShadow);
  const shieldRing=new THREE.Mesh(new THREE.TorusGeometry(.95,.06,10,28),new THREE.MeshBasicMaterial({color:0xffd740}));shieldRing.rotation.x=Math.PI/2;shieldRing.position.y=1;shieldRing.visible=false;root.add(shieldRing);
  let clock=0,wasGrounded=true,landingTime=0;
  function animate(dt,{speed=0,grounded=true,diving=false,celebrating=false,vy=0,squash=0,pose=null}={}){
    clock+=dt;
    if(!wasGrounded && grounded)landingTime=.16;
    wasGrounded=grounded;landingTime=Math.max(0,landingTime-dt);
    const mode=pose||(celebrating?'win':diving?'dive':!grounded?(vy>=0?'jump':'fall'):landingTime>0?'land':speed>.6?'run':'idle');
    const phase=clock*(mode==='run'?Math.max(5,speed*1.7):5);
    for(const b of bones)b.rotation.set(0,0,0);
    bodyPivot.position.y=0;bodyPivot.rotation.x=0;bodyPivot.rotation.z=0;bodyPivot.scale.set(1+squash*.2,1-squash*.24,1+squash*.2);
    named.LeftArm.rotation.z=-.13;named.RightArm.rotation.z=.13;
    if(mode==='run'){
      const swing=Math.sin(phase);bodyPivot.position.y=Math.abs(Math.sin(phase*2))*.055;bodyPivot.rotation.x=.10;bodyPivot.rotation.z=swing*.045;
      named.LeftLeg.rotation.x=swing*.72;named.RightLeg.rotation.x=-swing*.72;
      named.LeftShin.rotation.x=Math.max(0,-swing)*.8;named.RightShin.rotation.x=Math.max(0,swing)*.8;
      named.LeftArm.rotation.x=-swing*.7;named.RightArm.rotation.x=swing*.7;
      named.LeftForearm.rotation.x=named.RightForearm.rotation.x=-.22;
      head.rotation.x=-.07;head.rotation.z=-swing*.03;
    }else if(mode==='jump'||mode==='fall'){
      named.LeftArm.rotation.z=-.85;named.RightArm.rotation.z=.85;
      named.LeftArm.rotation.x=named.RightArm.rotation.x=-.65;
      named.LeftForearm.rotation.x=Math.sin(clock*7)*.08;
      named.RightForearm.rotation.x=-Math.sin(clock*7)*.08;
      named.LeftLeg.rotation.x=-.35;named.RightLeg.rotation.x=.25;
      named.LeftShin.rotation.x=.55;named.RightShin.rotation.x=.25;head.rotation.x=mode==='fall'?.12:-.08;
    }else if(mode==='dive'){
      bodyPivot.rotation.x=1.15;bodyPivot.position.y=.25;
      named.LeftArm.rotation.x=named.RightArm.rotation.x=-2.15;named.LeftShin.rotation.x=named.RightShin.rotation.x=.25;
      named.LeftFoot.rotation.x=Math.sin(clock*9)*.12;named.RightFoot.rotation.x=-Math.sin(clock*9)*.12;
    }else if(mode==='win'||mode==='wave'){
      named.RightArm.rotation.z=2.6;named.RightForearm.rotation.z=Math.sin(phase*2)*.3;
      if(mode==='win'){named.LeftArm.rotation.z=-2.6;bodyPivot.position.y=Math.abs(Math.sin(phase))*.18;}
      head.rotation.z=Math.sin(phase*.5)*.06;
    }else if(mode==='land'){
      const progress=pose?Math.min(1,clock/.5):1-landingTime/.16;
      const s=Math.max(0,Math.sin(progress*Math.PI));bodyPivot.position.y=-s*.08;named.LeftShin.rotation.x=named.RightShin.rotation.x=s*.35;
    }else{
      bodyPivot.position.y=Math.sin(clock*2.4)*.018;head.rotation.y=Math.sin(clock*.8)*.08;
      named.LeftArm.rotation.x=Math.sin(clock*2)*.06;named.RightArm.rotation.x=-Math.sin(clock*2)*.06;
    }
    const blink=clock>1 && Math.cos(clock*1.7)>.997?.12:1;
    for(const eye of eyes)eye.scale.y=blink;
    return mode;
  }
  return {root,bodyPivot,skeleton,bones:named,meshes,mainMat:mats.shirt,blobShadow,shieldRing,
    leftArm:named.LeftArm,rightArm:named.RightArm,leftLeg:named.LeftLeg,rightLeg:named.RightLeg,animate,
    resetAnimation(){clock=0;wasGrounded=true;landingTime=0;animate(0,{pose:'idle'});},
    dispose(){root.traverse(o=>o.geometry?.dispose());Object.values(mats).forEach(m=>m.dispose());blobShadow.material.dispose();shieldRing.material.dispose();skeleton.dispose();}};
}

// Bake the same poses used at runtime into reusable skeletal animation clips.
export function createCharacterClips(THREE,rig,poses=POSES) {
  return poses.map(pose=>{
    rig.resetAnimation();const duration=pose==='land'?.5:pose==='run'?1:pose==='idle'?3:2;
    const count=Math.round(duration*30),times=[],values=new Map();
    const nodes=[rig.bodyPivot,...Object.values(rig.bones)];
    for(const node of nodes)values.set(node,{q:[],p:[],s:[]});
    for(let i=0;i<=count;i++){
      times.push(i/30);rig.animate(i===0?0:1/30,{pose,speed:pose==='run'?7:0});
      for(const node of nodes){const v=values.get(node);v.q.push(...node.quaternion.toArray());v.p.push(...node.position.toArray());v.s.push(...node.scale.toArray());}
    }
    const tracks=[];
    for(const [node,v] of values){tracks.push(new THREE.QuaternionKeyframeTrack(node.name+'.quaternion',times,v.q));
      if(node===rig.bodyPivot)tracks.push(new THREE.VectorKeyframeTrack(node.name+'.position',times,v.p));
      if(node.name.endsWith('Eye'))tracks.push(new THREE.VectorKeyframeTrack(node.name+'.scale',times,v.s));
    }
    return new THREE.AnimationClip(pose,duration,tracks).optimize();
  });
}
