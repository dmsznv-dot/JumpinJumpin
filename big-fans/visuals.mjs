import { COURSE } from './course.mjs';

// Three.js is supplied by the existing game so the level does not load a second engine.
export function createCourseVisuals(THREE, course) {
  const root = new THREE.Group();
  const pink = new THREE.MeshStandardMaterial({ color: 0xff398e, roughness: 0.55 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x25d6e3, roughness: 0.48 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffda34, roughness: 0.48 });
  const purple = new THREE.MeshStandardMaterial({ color: 0x7845d0, roughness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  const lightPink = new THREE.MeshStandardMaterial({ color: 0xffc8df, roughness: 0.42 });
  const darkBlue = new THREE.MeshStandardMaterial({ color: 0x294c86, roughness: 0.55 });
  const metal = new THREE.MeshStandardMaterial({color:0x6383ae,roughness:.4,metalness:.35});
  const box = (w,h,d,mat,x,y,z,parent=root) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };
  [COURSE.start, ...COURSE.checkpoints, COURSE.finish].forEach((pad, i) => {
    box(pad.halfWidth*2, 0.65, pad.halfLength*2, i === 4 ? yellow : cyan, pad.x, -0.325, pad.z);
    box(pad.halfWidth*2, 0.12, 0.25, pink, pad.x, 0.06, pad.z-pad.halfLength+0.25);
    // Seams and a padded rim remain inside the walkable platform footprint.
    for (let stripe = -2; stripe <= 2; stripe++) {
      box(.07, .015, Math.max(.1, pad.halfLength*2-.55), white,
        pad.x+stripe*pad.halfWidth*.32, .008, pad.z);
    }
    for (const side of [-1,1]) box(.28,.2,pad.halfLength*2-.3,lightPink,
      pad.x+side*(pad.halfWidth-.18),.04,pad.z);
    // Structural supports sit below the walking surface and remain out of the route.
    for (const side of [-1,1]) {
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.36,.48,3.1,16),metal);
      leg.position.set(pad.x+side*(pad.halfWidth-1.4),-2.2,pad.z);root.add(leg);
      const foot=new THREE.Mesh(new THREE.SphereGeometry(.48,16,10),yellow);
      foot.position.set(pad.x+side*(pad.halfWidth-1.4),-3.72,pad.z);root.add(foot);
    }
    if (i > 0 && i < 4) {
      box(0.3, 3.8, 0.3, white, pad.x-pad.halfWidth+1, 1.9, pad.z);
      box(2, 1.2, 0.12, pink, pad.x-pad.halfWidth+2, 3.0, pad.z);
    }
  });
  // Finish arch and striped finish line.
  box(.7, 6, .7, pink, -8, 3, COURSE.finish.z);
  box(.7, 6, .7, pink, 8, 3, COURSE.finish.z);
  box(16.7, .8, .7, pink, 0, 6, COURSE.finish.z);
  // Support posts and backboard for the FINISH marquee
  box(.6, 2.2, .6, pink, -4, 7.1, COURSE.finish.z);
  box(.6, 2.2, .6, pink, 4, 7.1, COURSE.finish.z);
  box(8.6, 2.3, .4, pink, 0, 7.45, COURSE.finish.z);
  for (let i=0; i<12; i++) box(1.3,.06,.8,i%2 ? purple : white, -7.15+i*1.3,.04,COURSE.finish.z);

  // A bright marquee and floating confetti make the finish readable from afar.
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024; signCanvas.height = 256;
  const ctx = signCanvas.getContext('2d');
  ctx.fillStyle = '#713aca'; ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#ffdc38'; ctx.lineWidth = 14; ctx.strokeRect(8, 8, 1008, 240);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 150px sans-serif'; ctx.fillText('FINISH!', 512, 132);
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshBasicMaterial({
    map: signTexture,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), signMat);
  sign.position.set(0, 7.45, COURSE.finish.z - 0.22); sign.rotation.y = Math.PI; root.add(sign);
  const backSign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), signMat);
  backSign.position.set(0, 7.45, COURSE.finish.z + 0.22); root.add(backSign);
  const decorations = [];
  const colors = [pink, cyan, yellow, white];
  for (let i = 0; i < 24; i++) {
    const a = i * 2.399, radius = 3 + (i % 4) * 1.3;
    const piece = box(.20, .34, .12, colors[i % colors.length], Math.cos(a)*radius, 5+(i%5)*.7, COURSE.finish.z+Math.sin(a)*1.5);
    decorations.push({mesh:piece, baseY:piece.position.y, phase:i*.8});
  }
  const bulbMat = new THREE.MeshStandardMaterial({color:0x756948, emissive:0x000000, roughness:.5});
  for (const side of [-1, 1]) {
    for (let i=0; i<5; i++) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(.2,12,8), bulbMat);
      bulb.position.set(side*8, .8+i*1.1, COURSE.finish.z-.42); root.add(bulb);
    }
  }

  const fanVisuals = course.fans.map((fan, i) => {
    const group = new THREE.Group(); group.position.set(fan.x, 0, fan.z); root.add(group);
    const rotor = new THREE.Group(); group.add(rotor);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(fan.hubRadius,fan.hubRadius,.5,32), yellow);
    hub.position.y = -.25; hub.castShadow = true; rotor.add(hub);
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(fan.hubRadius*.72,fan.hubRadius*.52,1.3,24),metal);
    engine.position.y=-1.13;rotor.add(engine);
    const engineRim = new THREE.Mesh(new THREE.TorusGeometry(fan.hubRadius*.62,.08,8,24),white);
    engineRim.rotation.x=Math.PI/2;engineRim.position.y=-1.75;rotor.add(engineRim);
    const hubTrim = new THREE.Mesh(new THREE.TorusGeometry(fan.hubRadius*.75,.08,8,32), white);
    hubTrim.rotation.x = Math.PI/2; hubTrim.position.y=.012; rotor.add(hubTrim);
    const hubCenter = new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.08,16), darkBlue);
    hubCenter.position.y=.04;rotor.add(hubCenter);
    // Blades are tapered to match the widening collision surface.
    for (let n=0; n<fan.blades; n++) {
      const shape = new THREE.Shape();
      shape.moveTo(fan.hubRadius,-fan.innerHalfWidth); shape.lineTo(fan.radius,-fan.outerHalfWidth);
      shape.lineTo(fan.radius,fan.outerHalfWidth); shape.lineTo(fan.hubRadius,fan.innerHalfWidth); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {depth:.5, bevelEnabled:false});
      // Extruded XY -> horizontal XZ with its top at y=0.
      geo.rotateX(Math.PI/2);
      const blade = new THREE.Mesh(geo, i%2 ? cyan : pink);
      blade.rotation.y = -n * Math.PI*2/fan.blades;
      blade.castShadow = true; blade.receiveShadow = true; rotor.add(blade);
      // A narrow inset highlight reads as a seam, with no extra collision surface.
      const seam = new THREE.Mesh(new THREE.BoxGeometry((fan.radius-fan.hubRadius)*.72,.018,.055), white);
      const mid=(fan.hubRadius+fan.radius)*.5, a=n*Math.PI*2/fan.blades;
      seam.position.set(Math.cos(a)*mid,.012,Math.sin(a)*mid); seam.rotation.y=-a; rotor.add(seam);
    }
    let sweeper = null;
    if (fan.beam) {
      sweeper = new THREE.Group(); group.add(sweeper);
      const bar=new THREE.Mesh(new THREE.CylinderGeometry(.275,.275,fan.radius*2,24),purple);
      bar.rotation.z=Math.PI/2;bar.position.y=.52;bar.castShadow=true;sweeper.add(bar);
      const boss=new THREE.Mesh(new THREE.CylinderGeometry(.52,.56,1.0,24),yellow);
      boss.position.y=.5;sweeper.add(boss);
      for(const side of [-1,1]){
        const end=new THREE.Mesh(new THREE.SphereGeometry(.275,16,12),lightPink);
        end.position.set(side*fan.radius,.52,0);sweeper.add(end);
        for(let j=1;j<=3;j++){
          const band=new THREE.Mesh(new THREE.TorusGeometry(.28,.035,8,20),white);
          band.rotation.y=Math.PI/2;band.position.set(side*fan.radius*j/4,.52,0);sweeper.add(band);
        }
      }
    }
    return {rotor,sweeper};
  });
  return {
    root,
    celebrateFinish() { bulbMat.color.setHex(0xffed91); bulbMat.emissive.setHex(0xffbd12); bulbMat.emissiveIntensity = 2; },
    update() {
      decorations.forEach(({mesh, baseY, phase}) => {
        mesh.position.y = baseY + Math.sin(course.time*1.6+phase)*.28;
        mesh.rotation.z = course.time*.6+phase;
      });
      course.fans.forEach((fan,i) => {
        fanVisuals[i].rotor.rotation.y = -fan.angle;
        if (fanVisuals[i].sweeper) fanVisuals[i].sweeper.rotation.y = -fan.beamAngle;
      });
    },
    dispose() {
      root.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); });
      [pink,cyan,yellow,purple,white,lightPink,darkBlue,metal,signMat,bulbMat].forEach(m => m.dispose());
      signTexture.dispose();
    }
  };
}

