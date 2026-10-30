// Original accessories designed around a 1.6 m rounded cube, attached to Body.
export const CUBE_COSMETICS = [
 ['none','Без украшения','🟨'],['cherry','Вишенка','🍒'],['strawberry','Клубничка','🍓'],['orange','Мандарин','🍊'],['lemon','Лимончик','🍋'],['sprout','Росток','🌱'],['mushroom','Мухомор','🍄'],['cap','Бейсболка','🧢'],['beanie','Шапка с помпоном','🧶'],['party','Праздничный колпак','🎉'],['king','Корона','👑'],['wizard','Шляпа волшебника','🧙'],['pirate','Пиратская треуголка','🏴‍☠️'],['flower','Ромашка','🌼'],['headphones','Наушники','🎧'],['propeller','Пропеллер','🚁'],['pineapple','Ананасовая корона','🍍'],
 ['fox','Лисьи ушки','🦊'],['rabbit','Заячьи ушки','🐰'],['cat','Кошачьи ушки','🐱'],['bear','Медвежьи ушки','🐻'],['frog','Лягушачьи глазки','🐸'],['chicken','Петушиный гребень','🐓'],['bee','Усики пчёлки','🐝'],['cow','Рожки','🐮'],['panda','Ушки панды','🐼'],['owl','Совёнок','🦉'],
 ['astronaut','Кубонавт','👩‍🚀',true],['diver','Глубоководный скафандр','🤿',true],['robot','Робокуб','🤖',true],['dino','Кубозавр','🦖',true],['shark','Акулокуб','🦈',true],['dragon','Дракончик','🐉',true],['samurai','Кубо-самурай','👹',true],['hotdog','Хот-дог','🌭',true]
].map(([hat,title,icon,full=false])=>({id:'hat_'+hat,hat,title,icon,full,sub:full?'Полная оболочка корпуса':'Украшение сверху',rarity:'ОБЫЧНЫЙ',unlockType:'free',cost:0}));

export function createCubeAccessories(T, type='none') {
 const group=new T.Group();group.name='CubeAccessory_'+type;
 const materials=new Map();
 const mat=(c,metal=0)=>{const k=c+':'+metal;if(!materials.has(k))materials.set(k,new T.MeshStandardMaterial({color:c,roughness:.45,metalness:metal}));return materials.get(k);};
 function mesh(g,c,p=[0,0,0],s=[1,1,1],r=[0,0,0],metal=0){const m=new T.Mesh(g,mat(c,metal));m.position.fromArray(p);m.scale.fromArray(s);m.rotation.set(...r);m.castShadow=true;group.add(m);return m;}
 const ball=(c,p,s)=>mesh(new T.SphereGeometry(1,20,14),c,p,s);
 const cone=(c,p,r=.18,h=.35)=>mesh(new T.ConeGeometry(r,h,24),c,p);
 const cyl=(c,p,r=.25,h=.12)=>mesh(new T.CylinderGeometry(r,r,h,28),c,p);
 const tube=(points,c,r=.025)=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),20,r,8,false),c);
 const leaf=(p,r=0)=>mesh(new T.SphereGeometry(1,16,12),0x50a957,p,[.14,.035,.065],[0,0,r]);
 const top=.79;
 if(type==='none')return {group,full:false,dispose(){}};
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
  mesh(new T.SphereGeometry(.36,28,16,0,Math.PI*2,0,Math.PI/2),0x4485dd,[0,top,0]);ball(0x2e64b3,[0,top+.025,.30],[.34,.035,.25]);cyl(0xf4d258,[0,top+.36,0],.035,.035);
 }else if(type==='beanie'){
  ball(0xb88ce5,[0,top+.15,0],[.34,.25,.32]);cyl(0x8a66bd,[0,top+.035,0],.35,.12);ball(0xffd9ec,[0,top+.43,0],[.11,.11,.11]);
 }else if(type==='party'||type==='wizard'){
  const c=type==='wizard'?0x6751b9:0xff72b6;cyl(c,[0,top+.02,0],type==='wizard'?.47:.26,.05);cone(c,[0,top+.34,0],.26,.65);
  for(let i=0;i<6;i++)ball(0xffd855,[Math.cos(i*2.4)*.17,top+.12+(i%3)*.13,Math.sin(i*2.4)*.17],[.035,.035,.035]);
  if(type==='party')ball(0xffdf68,[0,top+.67,0],[.07,.07,.07]);
 }else if(type==='king'){
  cyl(0xf2b832,[0,top+.09,0],.32,.18);for(let i=0;i<7;i++){const a=i*Math.PI*2/7;cone(0xffd454,[Math.cos(a)*.28,top+.25,Math.sin(a)*.28],.08,.23);ball(0xe64775,[Math.cos(a)*.31,top+.09,Math.sin(a)*.31],[.045,.045,.045]);}
 }else if(type==='pirate'){
  ball(0x343147,[0,top+.12,0],[.37,.22,.28]);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;ball(0x343147,[Math.sin(a)*.27,top+.06,Math.cos(a)*.27],[.30,.065,.17]);}ball(0xffe9cf,[0,top+.16,.27],[.08,.07,.025]);
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
  const c={astronaut:0xe6eff7,diver:0xd6ac63,robot:0x8bacc2,dino:0x65bd7a,shark:0x75a3c6,dragon:0xb48adc,samurai:0x544366,hotdog:0xe3a562}[type];
  const shell=shape(1.57,1.57,.25);shell.holes.push(shape(1.14,.67,.14));
  mesh(new T.ExtrudeGeometry(shell,{depth:1.28,bevelEnabled:true,bevelThickness:.06,bevelSize:.06,bevelSegments:5,curveSegments:12}),c,[0,0,-.61]);
  mesh(new T.ExtrudeGeometry(shape(1.57,1.57,.25),{depth:.045,bevelEnabled:true,bevelThickness:.05,bevelSize:.05,bevelSegments:4,curveSegments:12}),c,[0,0,-.67]);
  if(['astronaut','diver','robot','samurai'].includes(type)){
   const visor=mesh(new T.ExtrudeGeometry(shape(1.16,.69,.14),{depth:.015,bevelEnabled:false,curveSegments:16}),0x91d4e8,[0,0,.745]);visor.material= new T.MeshPhysicalMaterial({color:0x9cdaed,transparent:true,opacity:.18,roughness:.12,depthWrite:false});materials.set('visor',visor.material);
   for(const s of [-1,1])cyl(0x657b95,[s*.85,0,0],.14,.10).rotation.z=Math.PI/2;
   mesh(new T.BoxGeometry(.68,.88,.20),0x657b95,[0,-.05,-.82]);
   for(let i=0;i<3;i++)ball([0xf4717c,0x67dab5,0xffd65b][i],[-.18+i*.18,-.58,.75],[.045,.035,.025]);
  } else if(type==='hotdog'){
   for(const s of [-1,1])ball(0xe5b077,[s*.70,0,.28],[.13,.73,.23]);tube([[-.40,-.5,.49],[-.15,-.57,.49],[.1,-.48,.49],[.4,-.56,.49]],0xffcf37,.035);
  } else {
   for(let i=0;i<5;i++)cone(type==='shark'?0x4d7a9d:0xf4c77a,[0,top+.16,-.32+i*.13],.11,.28);
   for(const s of [-1,1])cone(0xffeddb,[s*.45,.32,.49],.06,.12).rotation.z=Math.PI;
   if(type==='dragon')for(const s of [-1,1])cone(0xffdc91,[s*.5,top+.17,0],.11,.35);
  }
 }
 return {group,full,dispose(){group.traverse(o=>o.geometry?.dispose());materials.forEach(m=>m.dispose());}};
}

// Square-face projection keeps motif sizes consistent on the cube's six faces.
export function patternPixels(primary,secondary,pattern='plain',size=256) {
 const out=new Uint8Array(size*size*4),a=[primary>>16&255,primary>>8&255,primary&255],b=[secondary>>16&255,secondary>>8&255,secondary&255];
 const star=(x,y)=>{const angle=Math.atan2(y,x),r=Math.hypot(x,y);return r < .15+.055*Math.cos(angle*5);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,tx=(u*4)%1-.5,ty=(v*4)%1-.5;let on=false;
  switch(pattern){
   case 'belly':on=(u-.5)**2/.09+(v-.45)**2/.13<1;break;
   case 'stripes':on=(u*5+v*2)%1<.27;break;
   case 'polka':on=tx*tx+ty*ty<.045;break;
   case 'stars':on=star(tx,ty);break;
   case 'diamonds':on=Math.abs(tx)+Math.abs(ty)<.25;break;
   case 'rings':on=Math.hypot(tx,ty)>.20&&Math.hypot(tx,ty)<.27;break;
   case 'lightning':on=Math.abs(tx-(ty>0?-.08:.08))<.055&&Math.abs(ty)<.33;break;
   case 'flames':on=v<.2+.14*Math.sin(u*28)+.06*Math.sin(u*57);break;
  }
  const c=on?b:a,i=(y*size+x)*4;out[i]=c[0];out[i+1]=c[1];out[i+2]=c[2];out[i+3]=255;
 }return out;
}
