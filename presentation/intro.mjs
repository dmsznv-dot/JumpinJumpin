const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);

// Returns camera and look-at positions.  The last frame matches gameplay.
export function introFrame(kind, progress, player, yaw, distance, height, topY=0) {
  const t=Math.max(0,Math.min(1,progress)), end=smooth(Math.max(0,(t-.72)/.28));
  const target={x:player.x,y:player.y+1.6,z:player.z};
  const final={x:target.x+Math.sin(yaw)*distance,y:target.y+height-.25,z:target.z+Math.cos(yaw)*distance};
  let pos,look;
  if(kind==='big-fans') {
    // Travel from the finish through the route and end behind the contestants.
    const z=mix(155,0,smooth(Math.min(1,t/.8)));
    pos={x:mix(16,-10,t),y:mix(17,11,t),z:z+18};
    look={x:0,y:0,z:z-8};
  } else {
    const angle=yaw+Math.PI*1.25*(1-t), radius=mix(32,21,t);
    const y=kind==='hex' ? mix(-5,topY+2,t) : 0;
    look={x:0,y,z:0};pos={x:Math.sin(angle)*radius,y:y+mix(17,12,t),z:Math.cos(angle)*radius};
  }
  return {position:{x:mix(pos.x,final.x,end),y:mix(pos.y,final.y,end),z:mix(pos.z,final.z,end)},
    look:{x:mix(look.x,target.x,end),y:mix(look.y,target.y,end),z:mix(look.z,target.z,end)}};
}
