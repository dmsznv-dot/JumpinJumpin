import { LENGTH,RISE,TRACK_HALF,zones,obstaclesAt,courseY,slimeY } from './course.mjs';
export function createVisuals(THREE,c){
 const root=new THREE.Group(), mats=[];
 const mat=(color,opts={})=>{let m=new THREE.MeshStandardMaterial({color,roughness:.5,...opts});mats.push(m);return m;};
 const pink=mat(0xff5194), cyan=mat(0x3bd7e8), yellow=mat(0xffdf43), purple=mat(0x8e61dc), dark=mat(0x171c3f), white=mat(0xffffff), slimeMat=mat(0x45eab6,{emissive:0x0b986d,emissiveIntensity:.3,transparent:true,opacity:.9});
 function box(w,h,d,m,x,y,z,rot=0){let o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.rotation.x=rot;o.castShadow=true;o.receiveShadow=true;root.add(o);return o;}
 // Each zone has a real pitched surface, with holes and balance beams cut into it.
 for(let z=0;z<LENGTH;z+=2){
  const mid=z+1,y=courseY(mid)-.35;
  if((mid>65&&mid<67)||(mid>73&&mid<75))continue;
  const zone=zones.find(a=>mid>=a.from&&mid<a.to);const m=zone?.type==='conveyor'?cyan:zone?.type==='hammers'?purple:((Math.floor(z/20)%2)?cyan:pink);
  if(mid>=99&&mid<114){const xs=mid<106?[-2.1,2.1]:[0];for(const x of xs)box(mid<106?1.7:2,.7,2.03,yellow,x,y,mid,-Math.atan(RISE));}
  else box(TRACK_HALF*2,.7,2.03,m,0,y,mid,-Math.atan(RISE));
 }
 box(18,.7,6,cyan,0,-.35,-3);box(18,.7,8,yellow,0,courseY(LENGTH)-.35,LENGTH+4);
 // Raised markers are outside the playable corridor.
 for(let z=0;z<=LENGTH;z+=10)for(const side of [-1,1])box(.22,.32,2,white,side*(TRACK_HALF+.16),courseY(z)+.16,z);
 const floor=box(170,1,260,dark,0,-17,75);
 const slime=new THREE.Mesh(new THREE.BoxGeometry(150,.65,240),slimeMat);slime.position.set(0,slimeY(0)-.3,80);root.add(slime);
 const props=obstaclesAt(0).map(o=>{
  let mesh;if(o.type==='ball'||o.type==='bumper'||o.type==='pendulum')mesh=new THREE.Mesh(new THREE.SphereGeometry(o.radius,18,12),o.type==='ball'?purple:yellow);
  else mesh=new THREE.Mesh(new THREE.BoxGeometry(o.type==='pusher'?2.7:2,.9,1.2),o.type==='pusher'?purple:pink);
  mesh.castShadow=true;root.add(mesh);return mesh;
 });
 // Finish arch faces contestants climbing towards +Z.
 box(.7,6,.7,pink,-7.5,courseY(LENGTH)+3,LENGTH);box(.7,6,.7,pink,7.5,courseY(LENGTH)+3,LENGTH);box(15.7,.8,.7,pink,0,courseY(LENGTH)+6,LENGTH);
 const cnv=document.createElement('canvas');cnv.width=512;cnv.height=128;let ctx=cnv.getContext('2d');ctx.fillStyle='#713aca';ctx.fillRect(0,0,512,128);ctx.fillStyle='white';ctx.font='bold 80px sans-serif';ctx.textAlign='center';ctx.fillText('FINISH!',256,94);
 const tex=new THREE.CanvasTexture(cnv);tex.colorSpace=THREE.SRGBColorSpace;const signMat=new THREE.MeshBasicMaterial({map:tex});mats.push(signMat);const sign=new THREE.Mesh(new THREE.PlaneGeometry(7,1.8),signMat);sign.rotation.y=Math.PI;sign.position.set(0,courseY(LENGTH)+7,LENGTH-.4);root.add(sign);
 return {root,update(){slime.position.y=slimeY(c.time)-.32;const now=obstaclesAt(c.time);now.forEach((o,i)=>{props[i].position.set(o.x,courseY(o.z)+o.radius*.6,o.z);});},dispose(){root.traverse(o=>o.geometry?.dispose());mats.forEach(m=>m.dispose());tex.dispose();}};
}
