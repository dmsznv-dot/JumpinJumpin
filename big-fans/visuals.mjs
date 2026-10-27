import { COURSE } from './course.mjs';

// Three.js is supplied by the existing game so the level does not load a second engine.
export function createCourseVisuals(THREE, course) {
  const root = new THREE.Group();
  const pink = new THREE.MeshStandardMaterial({ color: 0xff398e, roughness: 0.55 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x25d6e3, roughness: 0.48 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffda34, roughness: 0.48 });
  const purple = new THREE.MeshStandardMaterial({ color: 0x7845d0, roughness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  const box = (w,h,d,mat,x,y,z,parent=root) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };
  [COURSE.start, ...COURSE.checkpoints, COURSE.finish].forEach((pad, i) => {
    box(pad.halfWidth*2, 0.65, pad.halfLength*2, i === 4 ? yellow : cyan, pad.x, -0.325, pad.z);
    box(pad.halfWidth*2, 0.12, 0.25, pink, pad.x, 0.06, pad.z-pad.halfLength+0.25);
    if (i > 0 && i < 4) {
      box(0.3, 3.8, 0.3, white, pad.x-pad.halfWidth+1, 1.9, pad.z);
      box(2, 1.2, 0.12, pink, pad.x-pad.halfWidth+2, 3.0, pad.z);
    }
  });
  // Finish arch and striped finish line.
  box(.7, 6, .7, pink, -8, 3, COURSE.finish.z);
  box(.7, 6, .7, pink, 8, 3, COURSE.finish.z);
  box(16.7, .8, .7, pink, 0, 6, COURSE.finish.z);
  for (let i=0; i<12; i++) box(1.3,.06,.8,i%2 ? purple : white, -7.15+i*1.3,.04,COURSE.finish.z);

  const fanVisuals = course.fans.map((fan, i) => {
    const group = new THREE.Group(); group.position.set(fan.x, 0, fan.z); root.add(group);
    const rotor = new THREE.Group(); group.add(rotor);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(fan.hubRadius,fan.hubRadius,.5,32), yellow);
    hub.position.y = -.25; hub.castShadow = true; rotor.add(hub);
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
    }
    let sweeper = null;
    if (fan.beam) {
      sweeper = new THREE.Group(); group.add(sweeper);
      box(fan.radius*2, .55, .55, purple, 0, .52, 0, sweeper);
      box(.8, 1.2, .8, yellow, 0, .6, 0, sweeper);
    }
    return {rotor,sweeper};
  });
  return {
    root,
    update() {
      course.fans.forEach((fan,i) => {
        fanVisuals[i].rotor.rotation.y = -fan.angle;
        if (fanVisuals[i].sweeper) fanVisuals[i].sweeper.rotation.y = -fan.beamAngle;
      });
    },
    dispose() {
      root.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); });
      [pink,cyan,yellow,purple,white].forEach(m => m.dispose());
    }
  };
}
