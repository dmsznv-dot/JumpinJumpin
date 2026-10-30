import {HERO_PATTERNS} from './hero-patterns.mjs';
export const PRINTS={
 belly:['Random Shapes',2.6],stripes:['Diagonal Stripes',4],polka:['Polka Dots',4],flames:['Candy Waves',3],stars:['Five Point Stars',4],lightning:['Zig Zag',3],rings:['Hypnotic Rings',3],diamonds:['Harlequin Diamonds',4],clouds:['Fluffy Clouds',2.5],leaves:['Leaf',3],circuit:['Circuit Board',1],hexagons:['Hexagons',3]
};
const cache=new Map();
// Horizontal body section for print wrapping: half-width 0.81, half-depth 0.67 (see cube-shape CUBE), corner radius 0.5.
export const WRAP={radius:.5,flatX:.31,flatZ:.17};
export function wrapUV([x,y,z],repeat=4){
 const r=WRAP.radius,fx=WRAP.flatX,fz=WRAP.flatZ,q=fx+fz+Math.PI*r/2,ax=Math.abs(x),az=Math.abs(z);
 let u=ax<=fx?ax:az<=fz?fx+Math.PI*r/2+fz-az:fx+r*Math.atan2(ax-fx,az-fz);
 if(z<0)u=2*q-u;if(x<0)u=-u;
 return [u/(4*q)*Math.round(4*q/1.6*repeat),(y/1.6+.5)*repeat];
}
function maskTexture(T,id){
 if(cache.has(id))return cache.get(id);
 const texture=new T.DataTexture(new Uint8Array([0]),1,1,T.RedFormat);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
 const entry={texture,ready:Promise.resolve()};cache.set(id,entry);
 if(typeof document!=='undefined'&&PRINTS[id]){
  entry.ready=new Promise((resolve,reject)=>{
   const img=new Image();img.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d');const a=(img.naturalWidth||img.width||1)/(img.naturalHeight||img.height||1),nx=a>=1?1:Math.max(1,Math.round(1/a)),ny=a>=1?Math.max(1,Math.round(a)):1;for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++)ctx.drawImage(img,ix*1024/nx,iy*1024/ny,1024/nx,1024/ny);const rgba=ctx.getImageData(0,0,1024,1024).data,mask=new Uint8Array(1024*1024);for(let i=0;i<mask.length;i++)mask[i]=rgba[((1023-Math.floor(i/1024))*1024+i%1024)*4+3];texture.dispose();texture.image={data:mask,width:1024,height:1024};texture.needsUpdate=true;resolve();}catch(e){reject(e);}};img.onerror=()=>reject(new Error('Pattern rasterization failed: '+id));img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(HERO_PATTERNS[PRINTS[id][0]]);
  });
  // Без принта куб остаётся однотонным — предупреждаем, а не роняем «Uncaught (in promise)»
  entry.ready.catch(e=>console.warn('[cube-print]',e));
 }
 return entry;
}
export async function printsReady(){await Promise.all([...cache.values()].map(e=>e.ready));}
export function applyCubePrint(T,material,{pattern='plain',primary=0xffdb20,secondary=0xf53867,center=[0,1.3,0]}={}){
 const enabled=!!PRINTS[pattern];
 material.map=null;material.color.set(enabled?0xffffff:primary);
 // Three компилирует шейдер один раз на ключ программы, поэтому uniforms храним на материале и обновляем значения здесь
 const U=material.userData.cubeUniforms??={cubeMask:{value:null},cubePrimary:{value:new T.Color()},cubeSecondary:{value:new T.Color()},cubeCenter:{value:new T.Vector3()},cubeRepeat:{value:1}};
 if(enabled){U.cubeMask.value=maskTexture(T,pattern).texture;U.cubePrimary.value.set(primary);U.cubeSecondary.value.set(secondary);U.cubeCenter.value.set(...center);U.cubeRepeat.value=PRINTS[pattern][1];}
 const wasEnabled=material.userData.cubePrintEnabled;material.userData.cubePrintEnabled=enabled;
 material.onBeforeCompile=shader=>{
  if(!enabled)return;
  Object.assign(shader.uniforms,U);
  shader.vertexShader='varying vec3 cubeBindPosition; varying vec3 cubeBindNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n cubeBindPosition=position;cubeBindNormal=normal;');
  shader.fragmentShader='varying vec3 cubeBindPosition; varying vec3 cubeBindNormal;uniform sampler2D cubeMask;uniform vec3 cubePrimary;uniform vec3 cubeSecondary;uniform vec3 cubeCenter;uniform float cubeRepeat;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 cubeLocal=cubeBindPosition-cubeCenter;
   vec2 cubeAbs=abs(cubeLocal.xz);
   float cubeRadius=${WRAP.radius.toFixed(3)},cubeFlatX=${WRAP.flatX.toFixed(3)},cubeFlatZ=${WRAP.flatZ.toFixed(3)};
   float cubeQuarter=cubeFlatX+cubeFlatZ+1.57079632679*cubeRadius;
   float cubeU;
   if(cubeAbs.x<=cubeFlatX)cubeU=cubeAbs.x;
   else if(cubeAbs.y<=cubeFlatZ)cubeU=cubeFlatX+1.57079632679*cubeRadius+cubeFlatZ-cubeAbs.y;
   else cubeU=cubeFlatX+cubeRadius*atan(cubeAbs.x-cubeFlatX,cubeAbs.y-cubeFlatZ);
   if(cubeLocal.z<0.0)cubeU=2.0*cubeQuarter-cubeU;
   if(cubeLocal.x<0.0)cubeU=-cubeU;
   float cubeAround=floor(4.0*cubeQuarter/1.6*cubeRepeat+0.5);
   vec2 cubeUV=vec2(cubeU/(4.0*cubeQuarter)*cubeAround,(cubeLocal.y/1.6+0.5)*cubeRepeat);
   float cubeInk=texture2D(cubeMask,cubeUV).r;
   // Top/bottom caps and the inner rim stay clean; no folded print at singularities.
   float cubeCap=1.0-smoothstep(0.55,0.86,abs(normalize(cubeBindNormal).y));
   cubeInk*=cubeCap;
   diffuseColor.rgb=mix(cubePrimary,cubeSecondary,clamp(cubeInk,0.0,1.0));`);
 };
 material.customProgramCacheKey=()=>enabled?'cube-wrap-v4':'cube-solid';
 if(wasEnabled!==enabled)material.needsUpdate=true;
 // Start decoding before the first frame; masks are shared across all contestants.
 if(enabled)maskTexture(T,pattern);
}
