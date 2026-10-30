// Standard Gamepad API layout: Xbox, PlayStation, Switch and compatible pads.
export function deadzone(value, threshold = .18) {
  if (!Number.isFinite(value) || Math.abs(value) <= threshold) return 0;
  return Math.sign(value) * Math.min(1, (Math.abs(value) - threshold) / (1 - threshold));
}
export function sampleGamepad(pad) {
  const down = i => !!pad?.buttons?.[i]?.pressed;
  let x = deadzone(pad?.axes?.[0]), y = deadzone(pad?.axes?.[1]);
  if (down(12) || down(13)) y = Number(down(13)) - Number(down(12));
  if (down(14) || down(15)) x = Number(down(15)) - Number(down(14));
  const length = Math.max(1, Math.hypot(x,y));
  return {x:x/length,y:y/length,lookX:deadzone(pad?.axes?.[2]),lookY:deadzone(pad?.axes?.[3]),
    buttons: Array.from({length:16}, (_,i)=>down(i))};
}
export function createGamepadReader() {
  let index = null, previous = [];
  return pads => {
    const connected = Array.from(pads || []).filter(p=>p?.connected);
    // A newly used pad takes control, without combining multiple controllers.
    const used = connected.find(p=>p.buttons.some(b=>b.pressed) || p.axes.some(a=>Math.abs(a)>.25));
    const pad = used || connected.find(p=>p.index===index) || connected[0];
    if (!pad) {index=null;previous=[];return null;}
    if(index!==pad.index) previous=[];
    index=pad.index;
    const state=sampleGamepad(pad);
    const pressed=state.buttons.map((down,i)=>down&&!previous[i]);
    previous=state.buttons;
    return {...state,pressed,id:pad.id,mapping:pad.mapping};
  };
}
