// Proportions measured from the model sheet (front / left side / back / three-quarter):
// body 1.62 × 1.57 × 1.34, every edge a superellipse (radius 0.61, power 3.3 — the sheet's
// silhouettes fit within 2 px), face window sunk 0.085 inside a yellow lip.
export const CUBE = {
 halfW:.81, halfH:.785, halfD:.67, radius:.61, power:3.3,
 face:{w:1.075, h:.605, radius:.135, z:.585},
 legBelow:.377 // visible leg + boot below the body, 0.24 of body height on the sheet
};
// Rounded rectangle; power 2 = circular corners, higher = fuller "squircle" corners.
export function roundedContour(w,h,r,steps=12,power=2){
 const p=[],e=2/power;
 for(let k=0;k<4;k++){
  const cx=(k===0||k===3?1:-1)*(w/2-r),cy=(k<2?1:-1)*(h/2-r);
  for(let j=0;j<=steps;j++){const a=(k+j/steps)*Math.PI/2,c=Math.cos(a),s=Math.sin(a);p.push([cx+Math.sign(c)*Math.abs(c)**e*r,cy+Math.sign(s)*Math.abs(s)**e*r]);}
 }return p;
}
// Cross-section of the rounded box at depth z: corners shrink as the superelliptic edge curls back.
function slice(theta,sign,grow=0){
 const {power:n}=CUBE,a=CUBE.halfW+grow,b=CUBE.halfH+grow,c=CUBE.halfD+grow,r=CUBE.radius+grow,e=2/n;
 const dz=r*Math.sin(theta)**e,rz=Math.max(.004,r*Math.cos(theta)**e);
 return [2*(a-r+rz),2*(b-r+rz),rz,sign*(c-r+dz),n];
}
// grow > 0 gives an offset copy of the body (full-body costumes) whose face opening still meets the face exactly.
export function cubeShellGeometry(T,{grow=0}={}){
 const {power:n,face}=CUBE,r=CUBE.radius+grow,rings=[];
 // Back: from the flat back panel round to the widest point.
 for(let k=8;k>=0;k--)rings.push(slice(k/8*Math.PI/2,-1,grow));
 // Front: round forward until the section can hold the face lip (corner radius 0.42 ⇒ half-width 0.62).
 const cut=Math.acos(((.42+grow)/r)**(n/2));
 for(let k=1;k<=6;k++)rings.push(slice(k/6*cut,1,grow));
 // Flat front panel → raised lip → bevel → walls of the sunken face window.
 const g2=2*grow;
 rings.push(
  [1.21+g2,.90+g2,.30+grow,.645+grow,2.6],
  [1.18+g2,.71+g2,.175+grow,.666+grow,2],[1.15+g2,.68+g2,.16+grow,.67+grow,2],[1.11+g2,.64+g2,.145+grow,.658+grow,2],
  [face.w,face.h,face.radius,.62,2],[face.w,face.h,face.radius,face.z,2]
 );
 const positions=[],indices=[];let count=0;
 for(const [w,h,rad,z,pw] of rings){const ring=roundedContour(w,h,rad,12,pw);count=ring.length;for(const [x,y] of ring)positions.push(x,y,z);}
 for(let k=0;k<rings.length-1;k++)for(let j=0;j<count;j++){const a=k*count+j,b=k*count+(j+1)%count,c=a+count,d=b+count;indices.push(a,b,c,b,d,c);}
 const center=positions.length/3;positions.push(0,0,-CUBE.halfD-grow);for(let j=0;j<count;j++)indices.push(center,(j+1)%count,j);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(new Array(positions.length/3*2).fill(0),2));g.setIndex(indices);g.computeVertexNormals();
 return g;
}
export function cubeFaceGeometry(T){
 const {w,h,radius}=CUBE.face,rim=roundedContour(w,h,radius),positions=[0,0,.006],indices=[];
 for(const [x,y] of rim)positions.push(x,y,0);
 for(let j=0;j<rim.length;j++)indices.push(0,1+j,1+(j+1)%rim.length);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(new Array(positions.length/3*2).fill(0),2));g.setIndex(indices);g.computeVertexNormals();return g;
}
// Boot: flat cuff on top, straight sides, rounded toe cap underneath — same width as the leg, as on the sheet.
export function cubeBootGeometry(T,radius=.086,straight=.075){
 const pts=[new T.Vector2(0,.004),new T.Vector2(radius,.004),new T.Vector2(radius,-straight)];
 for(let i=1;i<=8;i++){const a=i/8*Math.PI/2;pts.push(new T.Vector2(Math.cos(a)*radius,-straight-Math.sin(a)*radius));}
 return new T.LatheGeometry(pts.reverse(),18); // Lathe profile runs bottom → top for outward normals
}
