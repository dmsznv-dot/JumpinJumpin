// Original accessories designed around a 1.6 m rounded cube, attached to Body.
import {CUBE,cubeShellGeometry} from './cube-shape.mjs';
import {COSTUME_ASSETS} from './costume-manifest.mjs';
// Accessories were laid out for a 1.16-deep body with the face at z 0.54; the sheet body is deeper.
const FACE_DZ=CUBE.face.z-.54,DEPTH=CUBE.halfD/.58,SUIT=.06;
export const CUBE_COSMETICS = [
 ['none','Без украшения','🟨'],['cherry','Вишенка','🍒'],['strawberry','Клубничка','🍓'],['orange','Мандарин','🍊'],['lemon','Лимончик','🍋'],['sprout','Росток','🌱'],['mushroom','Мухомор','🍄'],['cap','Бейсболка','🧢'],['beanie','Шапка с помпоном','🧶'],['party','Праздничный колпак','🎉'],['king','Корона','👑'],['wizard','Шляпа волшебника','🧙'],['pirate','Пиратская треуголка','🏴‍☠️'],['flower','Ромашка','🌼'],['headphones','Наушники','🎧'],['propeller','Пропеллер','🚁'],['pineapple','Ананасовая корона','🍍'],
 ['fox','Лисьи ушки','🦊'],['rabbit','Заячьи ушки','🐰'],['cat','Кошачьи ушки','🐱'],['bear','Медвежьи ушки','🐻'],['frog','Лягушачьи глазки','🐸'],['chicken','Петушиный гребень','🐓'],['bee','Усики пчёлки','🐝'],['cow','Рожки','🐮'],['panda','Ушки панды','🐼'],['owl','Совёнок','🦉'],
 ['astronaut','Кубонавт','👩‍🚀',true],['diver','Глубоководный скафандр','🤿',true],['robot','Робокуб','🤖',true],['dino','Кубозавр','🦖',true],['shark','Акулокуб','🦈',true],['dragon','Дракончик','🐉',true],['samurai','Кубо-самурай','👹',true],
 // Costumes built from NVIDIA SimReady assets (CC BY 4.0) by tools/costumes/build.py
 ...Object.entries(COSTUME_ASSETS).map(([id,c])=>[id,c.title,c.icon,true])
].map(([hat,title,icon,full=false])=>({id:'hat_'+hat,hat,title,icon,full,sub:full?'Полная оболочка корпуса':'Украшение сверху',rarity:'ОБЫЧНЫЙ',unlockType:'free',cost:0}));

export function createCubeAccessories(T, type='none') {
 const group=new T.Group();group.name='CubeAccessory_'+type;const printMaterials=[];
 const materials=new Map();
 const mat=(c,metal=0)=>{const k=c+':'+metal;if(!materials.has(k))materials.set(k,new T.MeshStandardMaterial({color:c,roughness:.45,metalness:metal}));return materials.get(k);};
 function mesh(g,c,p=[0,0,0],s=[1,1,1],r=[0,0,0],metal=0){const m=new T.Mesh(g,mat(c,metal));m.position.fromArray(p);m.scale.fromArray(s);m.rotation.set(...r);group.add(m);return m;}
 const ball=(c,p,s)=>mesh(new T.SphereGeometry(1,20,14),c,p,s);
 const cone=(c,p,r=.18,h=.35)=>mesh(new T.ConeGeometry(r,h,24),c,p);
 const cyl=(c,p,r=.25,h=.12)=>mesh(new T.CylinderGeometry(r,r,h,28),c,p);
 const tube=(points,c,r=.025)=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),20,r,8,false),c);
 const leaf=(p,r=0)=>mesh(new T.SphereGeometry(1,16,12),0x50a957,p,[.14,.035,.065],[0,0,r]);
 const top=.79;
 if(type==='none')return {group,full:false,dispose(){}};
 if(COSTUME_ASSETS[type])return assetCostume(T,type,group,mesh,mat,materials);
 if(type==='cherry'){
  ball(0xe73855,[-.13,top+.13,.04],[.15,.15,.15]);ball(0xcd2348,[.16,top+.14,0],[.16,.16,.16]);
  tube([[-.13,top+.24,.04],[-.08,top+.48,0],[.08,top+.53,0]],0x52833e);
  tube([[.16,top+.27,0],[.17,top+.44,0],[.08,top+.53,0]],0x52833e);leaf([.22,top+.48,0],.3);
 }else if(['strawberry','orange','lemon'].includes(type)){
  const col=type==='strawberry'?0xf14769:type==='orange'?0xff962e:0xffdc3d;
  ball(col,[0,top+.19,0],type==='lemon'?[.28,.16,.17]:[.23,.24,.22]);
  leaf([.08,top+.41,0],.35);leaf([-.08,top+.41,0],-.35);
  if(type==='strawberry')for(let i=0;i<12;i++){const a=i*2.4,y=(i%3)*.1;ball(0xffe5a2,[Math.cos(a)*.195,top+.08+y,Math.sin(a)*.195],[.012,.021,.012]);}
 }else if(type==='sprout'||type==='flower'){
  tube([[0,top,0],[.02,top+.22,0],[0,top+.43,0]],0x459a52,.035);
  leaf([-.10,top+.23,0],.5);leaf([.11,top+.30,0],-.5);
  if(type==='flower'){for(let i=0;i<8;i++){const a=i*Math.PI/4;ball(0xfffaf0,[Math.cos(a)*.14,top+.45+Math.sin(a)*.14,.02],[.09,.09,.04]);}ball(0xffc72d,[0,top+.45,.07],[.09,.09,.05]);}
 }else if(type==='mushroom'){
  cyl(0xffe4bd,[0,top+.12,0],.095,.25);mesh(new T.SphereGeometry(.36,28,16,0,Math.PI*2,0,Math.PI/2),0xef4861,[0,top+.20,0],[1,.65,1]);
  for(let i=0;i<8;i++){const a=i*2.4;ball(0xfff4e3,[Math.cos(a)*.24,top+.34,Math.sin(a)*.24],[.055,.018,.055]);}
 }else if(type==='cap'){
  mesh(new T.SphereGeometry(.36,28,16,0,Math.PI*2,0,Math.PI/2),0x4485dd,[0,top,0]);ball(0x2e64b3,[0,top+.025,.30+FACE_DZ],[.34,.035,.25]);cyl(0xf4d258,[0,top+.36,0],.035,.035);
 }else if(type==='beanie'){
  ball(0xb88ce5,[0,top+.15,0],[.34,.25,.32]);cyl(0x8a66bd,[0,top+.035,0],.35,.12);ball(0xffd9ec,[0,top+.43,0],[.11,.11,.11]);
 }else if(type==='party'||type==='wizard'){
  const c=type==='wizard'?0x6751b9:0xff72b6;cyl(c,[0,top+.02,0],type==='wizard'?.47:.26,.05);cone(c,[0,top+.34,0],.26,.65);
  for(let i=0;i<6;i++)ball(0xffd855,[Math.cos(i*2.4)*.17,top+.12+(i%3)*.13,Math.sin(i*2.4)*.17],[.035,.035,.035]);
  if(type==='party')ball(0xffdf68,[0,top+.67,0],[.07,.07,.07]);
 }else if(type==='king'){
  cyl(0xf2b832,[0,top+.09,0],.32,.18);for(let i=0;i<7;i++){const a=i*Math.PI*2/7;cone(0xffd454,[Math.cos(a)*.28,top+.25,Math.sin(a)*.28],.08,.23);ball(0xe64775,[Math.cos(a)*.31,top+.09,Math.sin(a)*.31],[.045,.045,.045]);}
 }else if(type==='pirate'){
  ball(0x343147,[0,top+.12,0],[.37,.22,.28]);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;ball(0x343147,[Math.sin(a)*.27,top+.06,Math.cos(a)*.27],[.30,.065,.17]);}ball(0xffe9cf,[0,top+.16,.27+FACE_DZ],[.08,.07,.025]);
 }else if(type==='headphones'){
  const pts=[];for(let i=0;i<=24;i++){const a=Math.PI*i/24;pts.push([Math.cos(a)*.69,top-.18+Math.sin(a)*.44,0]);}tube(pts,0x4b4368,.065);for(const s of [-1,1])ball(0xa58aef,[s*.73,top-.17,0],[.12,.19,.19]);
 }else if(type==='propeller'){
  cyl(0xff627f,[0,top+.09,0],.21,.18);cyl(0xe8e9f7,[0,top+.25,0],.025,.20);ball(0x59cee5,[0,top+.35,0],[.49,.025,.075]);ball(0xffc749,[0,top+.35,0],[.075,.025,.49]);
 }else if(type==='pineapple'){
  for(let i=0;i<9;i++){const a=i*2.4;mesh(new T.SphereGeometry(1,16,12),0x4ba86b,[Math.cos(a)*.10,top+.22,Math.sin(a)*.1],[.07,.35,.035],[Math.sin(a)*.4,0,Math.cos(a)*.4]);}
 }else if(['fox','rabbit','cat','bear','panda','cow','frog','chicken','bee','owl'].includes(type)){
  const c={fox:0xe59551,rabbit:0xffd6e6,cat:0x8399bf,bear:0xa97750,panda:0x35334a,cow:0xffe2ae,frog:0x63c87b,chicken:0xef4c67,bee:0x42364a,owl:0xa78264}[type];
  if(type==='chicken')for(let i=0;i<3;i++)ball(c,[0,top+.10+i*.045,(i-1)*.15],[.08,.15,.10]);
  else for(const s of [-1,1]){const p=[s*.31,top+(type==='rabbit'?.29:.13),0];ball(c,p,type==='rabbit'?[.10,.32,.10]:[.15,.17,.13]);if(type==='rabbit'||type==='fox'||type==='cat')ball(0xf3afbb,[p[0],p[1],.09],[.065,type==='rabbit'?.22:.09,.035]);if(type==='frog')ball(0x283242,[p[0],p[1]+.04,.12],[.06,.07,.03]);}
 }
 const full=CUBE_COSMETICS.find(c=>c.hat===type)?.full||false;
 if(full){
  function shape(w,h,r){const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(-x-r,y);s.quadraticCurveTo(-x,y,-x,y+r);s.lineTo(-x,-y-r);s.quadraticCurveTo(-x,-y,-x-r,-y);s.lineTo(x+r,-y);s.quadraticCurveTo(x,-y,x,-y-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
  const c={astronaut:0xe6eff7,diver:0xd6ac63,robot:0x8bacc2,dino:0x65bd7a,shark:0x75a3c6,dragon:0xb48adc,samurai:0x544366}[type];
  // The suit is the body itself inflated by SUIT: same pillowy silhouette, opening exactly around the face.
  const suit=mesh(cubeShellGeometry(T,{grow:SUIT}),c);
  printMaterials.push({material:suit.material,base:c});
  if(['astronaut','diver','robot','samurai'].includes(type)){
   const visor=mesh(new T.ExtrudeGeometry(shape(1.20,.74,.17),{depth:.015,bevelEnabled:false,curveSegments:16}),0x91d4e8,[0,0,CUBE.halfD+SUIT+.004]);visor.material= new T.MeshPhysicalMaterial({color:0x9cdaed,transparent:true,opacity:.18,roughness:.12,depthWrite:false});materials.set('visor',visor.material);
   for(const s of [-1,1])cyl(0x657b95,[s*(CUBE.halfW+SUIT+.02),0,0],.14,.10).rotation.z=Math.PI/2;
   mesh(new T.BoxGeometry(.68,.88,.20),0x657b95,[0,-.05,-(CUBE.halfD+SUIT+.09)]);
   for(let i=0;i<3;i++)ball([0xf4717c,0x67dab5,0xffd65b][i],[-.18+i*.18,-.56,.705],[.045,.035,.025]);
  } else {
   for(let i=0;i<5;i++)cone(type==='shark'?0x4d7a9d:0xf4c77a,[0,top+.16,(-.32+i*.13)*DEPTH],.11,.28);
   for(const s of [-1,1])cone(0xffeddb,[s*.42,.27,CUBE.face.z+.04],.06,.12).rotation.z=Math.PI;
   if(type==='dragon')for(const s of [-1,1])cone(0xffdc91,[s*.5,top+.17,0],.11,.35);
  }
 }
 for(const o of group.children)if(o.isMesh&&printMaterials.some(p=>p.material===o.material)){o.updateMatrix();o.geometry.applyMatrix4(o.matrix);o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);}
 return {group,full,printMaterials,dispose(){group.traverse(o=>o.geometry?.dispose());materials.forEach(m=>m.dispose());}};
}


// ---------- Costumes from asset meshes ----------
// The GLB is the cube's own suit inflated to the object's shape (face window included), coloured from the asset.
const costumeGeometry=new Map();
// One shared geometry per costume file; every contestant wearing it reuses it.
function loadCostumeGeometry(T,file){
 if(!costumeGeometry.has(file))costumeGeometry.set(file,import('../vendor/GLTFLoader.js').then(({GLTFLoader})=>new Promise((resolve,reject)=>{
  new GLTFLoader().load(new URL('../'+file,import.meta.url).href,gltf=>{let geo=null;gltf.scene.traverse(o=>{if(o.isMesh&&!geo)geo=o.geometry;});if(!geo.attributes.normal)geo.computeVertexNormals();geo.userData.shared=true;resolve(geo);},undefined,reject);
 })));
 return costumeGeometry.get(file);
}
export function preloadCostume(T,type){const c=COSTUME_ASSETS[type];return c&&typeof document!=='undefined'?loadCostumeGeometry(T,c.file):Promise.resolve(null);}
function assetCostume(T,type,group,mesh,mat,materials){
 const spec=COSTUME_ASSETS[type],main=parseInt(spec.palette[0].slice(1),16);
 // Until the mesh arrives the wearer shows a plain suit in the costume's main colour.
 const fallback=mesh(cubeShellGeometry(T,{grow:SUIT}),main);
 const suitMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.5,side:T.DoubleSide});
 let disposed=false;
 preloadCostume(T,type).then(geo=>{if(disposed||!geo)return;group.add(new T.Mesh(geo,suitMat));fallback.visible=false;}).catch(e=>console.warn('[costume]',type,e));
 return {group,full:true,printMaterials:[],dispose(){disposed=true;group.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();});suitMat.dispose();materials.forEach(m=>m.dispose());}};
}
