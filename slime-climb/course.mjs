// Rising-slime race: the route climbs through nine connected obstacle zones.
export const LENGTH=180;
export const RISE=.17;
export const LIMIT=140;
export const TRACK_HALF=7;
export const zones=[
 {name:'Старт и бамперы',from:0,to:20,type:'bumpers'},
 {name:'Движущиеся блоки',from:20,to:39,type:'pushers'},
 {name:'Склон с шарами',from:39,to:58,type:'balls'},
 {name:'Блоки и разрывы',from:58,to:77,type:'gaps'},
 {name:'Конвейер',from:77,to:97,type:'conveyor'},
 {name:'Узкие балки',from:97,to:116,type:'beams'},
 {name:'Скользкий склон и молоты',from:116,to:137,type:'hammers'},
 {name:'Последние блоки',from:137,to:157,type:'pushers'},
 {name:'Маятники',from:157,to:180,type:'pendulums'}
];
export function courseY(z){return Math.max(0,z)*RISE;}
export function slimeY(t){return -4 + Math.min(t,LIMIT)*(courseY(LENGTH)+4)/LIMIT;}
export function inGap(z){return (z>65&&z<67)||(z>73&&z<75);}
export function onBeam(x,z){
 if(z<97||z>116)return true;
 // two beams converging into one, with a safe connector at each end.
 if(z<99||z>114)return true;
 const offset = z<103 ? 2.1 : z<109 ? 2.1*(109-z)/6 : 0;
 return Math.abs(Math.abs(x)-offset)<1.05;
}
export function surface(x,z){
 if(z < -6 || z>LENGTH+8 || Math.abs(x)>TRACK_HALF || inGap(z) || !onBeam(x,z))return null;
 return courseY(z);
}
export function createCourse(){return {time:0, balls:[]};}
export function advanceCourse(c,dt){c.time+=dt;}
export function obstaclesAt(t){
 const out=[];
 for(const z of [8,14])for(const x of [-3.2,3.2])out.push({type:'bumper',x,z,radius:.85});
 for(const z of [23,29,35,61,69,140,145,150,155])out.push({type:'pusher',x:Math.sin(t*1.4+z)*3.6,z,radius:1.35});
 for(const z of [81,87,93,160,165])out.push({type:'bumper',x:Math.sin(t*1.1+z)*3.5,z,radius:1});
 for(const z of [121,128,135])out.push({type:'hammer',x:0,z,angle:t*1.8+z,radius:.6,length:4.5});
 for(const z of [170,174,178])out.push({type:'pendulum',x:Math.sin(t*1.7+z)*4.5,z,radius:1.2});
 // Repeating balls roll down the ramp from the cannon.
 for(let i=0;i<3;i++)out.push({type:'ball',x:[-3,0,3][i],z:58-((t*5+i*7)%19),radius:1.05});
 return out;
}

export function obstacleContact(o,x,z) {
 if(o.type!=='hammer')return {dx:x-o.x,dz:z-o.z};
 const dx=x-o.x,dz=z-o.z,ux=Math.cos(o.angle),uz=Math.sin(o.angle);
 const along=Math.max(-o.length,Math.min(o.length,dx*ux+dz*uz));
 return {dx:dx-ux*along,dz:dz-uz*along};
}
export function botDecision(c,a){
 const elite=a.id==='bot_0';const ahead=obstaclesAt(c.time+.55).filter(o=>o.z>a.z && o.z<a.z+6);
 let targetX=0;
 if(a.z>=90 && a.z<114){const offset=a.z<103?2.1:a.z<109?2.1*(109-a.z)/6:0;targetX=(a.x>=0?1:-1)*offset;}
 const nearest=ahead.sort((x,y)=>x.z-y.z)[0];
 if(nearest && Math.abs(nearest.x-targetX)<nearest.radius+1.1 && !(a.z>=90&&a.z<=116)) targetX=nearest.x>0?-3.5:3.5;
 targetX=Math.max(-4,Math.min(4,targetX));
 const dx=targetX-a.x;
 let vx=Math.max(-5,Math.min(5,dx*(elite?2.3:1.5)));
 let vz=elite?7.0:6.2;
 const jumpGap=(a.z>62.7&&a.z<65)||(a.z>70.7&&a.z<73);
 const jumpBeam=false;
 return {vx,vz,jump:a.onGround&&(jumpGap||jumpBeam)};
}
