// Continuous rounded contours create one smooth shell, including its shallow face recess.
export function roundedContour(w,h,r,steps=12){
 const p=[];
 for(let k=0;k<4;k++){
  const cx=(k===0||k===3?1:-1)*(w/2-r),cy=(k<2?1:-1)*(h/2-r);
  for(let j=0;j<=steps;j++){const a=(k+j/steps)*Math.PI/2;p.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}
 }return p;
}
export function cubeShellGeometry(T){
 const rings=[
  [1.40,1.35,.39,-.58],[1.53,1.48,.43,-.54],[1.60,1.55,.46,-.42],
  [1.62,1.57,.48,-.24],[1.62,1.57,.48,.24],[1.60,1.55,.46,.42],
  [1.53,1.48,.43,.54],[1.42,1.37,.39,.58],
  [1.20,.74,.19,.58],[1.12,.65,.15,.577],[1.09,.62,.14,.565],[1.075,.605,.135,.540]
 ];
 const positions=[],indices=[];let n=0;
 for(const [w,h,r,z] of rings){const ring=roundedContour(w,h,r);n=ring.length;for(const [x,y]of ring)positions.push(x,y,z);}
 for(let k=0;k<rings.length-1;k++)for(let j=0;j<n;j++){const a=k*n+j,b=k*n+(j+1)%n,c=a+n,d=b+n;indices.push(a,b,c,b,d,c);}
 const center=positions.length/3;positions.push(0,0,-.58);for(let j=0;j<n;j++)indices.push(center,(j+1)%n,j);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(new Array(positions.length/3*2).fill(0),2));g.setIndex(indices);g.computeVertexNormals();
 return g;
}
export function cubeFaceGeometry(T){
 const rim=roundedContour(1.075,.605,.135),positions=[0,0,.006],indices=[];
 for(const [x,y] of rim)positions.push(x,y,0);
 for(let j=0;j<rim.length;j++)indices.push(0,1+j,1+(j+1)%rim.length);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(new Array(positions.length/3*2).fill(0),2));g.setIndex(indices);g.computeVertexNormals();return g;
}
