import {HERO_PATTERNS} from './hero-patterns.mjs';
export const PRINTS={
 belly:['Random Shapes',2.6],stripes:['Diagonal Stripes',4],polka:['Polka Dots',4],flames:['Wiggle',3],stars:['Slanted Stars',4],lightning:['Zig Zag',3],rings:['Overlapping Circles',3],diamonds:['Flipped Diamonds',4],clouds:['Endless Clouds',2.5],leaves:['Leaf',3],circuit:['Circuit Board',2],hexagons:['Hexagons',3]
};
const cache=new Map();
export function wrapUV([x,y,z],repeat=4){
 const r=.34,fx=.47,fz=.24,q=fx+fz+Math.PI*r/2,ax=Math.abs(x),az=Math.abs(z);
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
   const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,1024,1024);const rgba=ctx.getImageData(0,0,1024,1024).data,mask=new Uint8Array(1024*1024);for(let i=0;i<mask.length;i++)mask[i]=rgba[i*4+3];texture.dispose();texture.image={data:mask,width:1024,height:1024};texture.needsUpdate=true;resolve();};img.onerror=()=>reject(new Error('Pattern rasterization failed: '+id));img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(HERO_PATTERNS[PRINTS[id][0]]);
  });
 }
 return entry;
}
export async function printsReady(){await Promise.all([...cache.values()].map(e=>e.ready));}
export function applyCubePrint(T,material,{pattern='plain',primary=0xffdb20,secondary=0xf53867,center=[0,1.3,0]}={}){
 const enabled=!!PRINTS[pattern];
 material.map=null;material.color.set(enabled?0xffffff:primary);
 material.onBeforeCompile=shader=>{
  if(!enabled)return;
  shader.uniforms.cubeMask={value:maskTexture(T,pattern).texture};
  shader.uniforms.cubePrimary={value:new T.Color(primary)};shader.uniforms.cubeSecondary={value:new T.Color(secondary)};shader.uniforms.cubeCenter={value:new T.Vector3(...center)};shader.uniforms.cubeRepeat={value:PRINTS[pattern][1]};
  shader.vertexShader='varying vec3 cubeBindPosition; varying vec3 cubeBindNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n cubeBindPosition=position;cubeBindNormal=normal;');
  shader.fragmentShader='varying vec3 cubeBindPosition; varying vec3 cubeBindNormal;uniform sampler2D cubeMask;uniform vec3 cubePrimary;uniform vec3 cubeSecondary;uniform vec3 cubeCenter;uniform float cubeRepeat;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 cubeLocal=cubeBindPosition-cubeCenter;
   vec2 cubeAbs=abs(cubeLocal.xz);
   float cubeRadius=0.34,cubeFlatX=0.47,cubeFlatZ=0.24;
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
 material.customProgramCacheKey=()=>enabled?'cube-wrap-v3':'cube-solid';
 material.needsUpdate=true;
 // Start decoding before the first frame; masks are shared across all contestants.
 if(enabled)maskTexture(T,pattern);
}
