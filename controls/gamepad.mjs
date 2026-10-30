// Standard Gamepad API layout: Xbox, PlayStation, Switch and compatible pads.
export function deadzone(value, threshold = .18) {
  if (!Number.isFinite(value) || Math.abs(value) <= threshold) return 0;
  return Math.sign(value) * Math.min(1, (Math.abs(value) - threshold) / (1 - threshold));
}
// rest — значения осей в покое для нестандартных раскладок: там axes[2/3] часто триггеры, которые в покое равны -1.
// Такие оси (|покой| > .5) не читаем, остальные отсчитываем от положения покоя.
export function readAxis(pad, i, rest) {
  const v = pad?.axes?.[i];
  if (!Number.isFinite(v)) return 0;
  const r = rest?.[i] ?? 0;
  return Math.abs(r) > .5 ? 0 : v - r;
}
export function sampleGamepad(pad, rest = null) {
  const down = i => !!pad?.buttons?.[i]?.pressed;
  const axis = i => deadzone(readAxis(pad, i, rest));
  let x = axis(0), y = axis(1);
  if (down(12) || down(13)) y = Number(down(13)) - Number(down(12));
  if (down(14) || down(15)) x = Number(down(15)) - Number(down(14));
  const length = Math.max(1, Math.hypot(x,y));
  return {x:x/length,y:y/length,lookX:axis(2),lookY:axis(3),
    buttons: Array.from({length:16}, (_,i)=>down(i))};
}
export function createGamepadReader() {
  let index = null, previous = [];
  const rests = new Map();
  const restOf = p => {
    if (p.mapping === 'standard') return null;
    const key = p.index + '|' + p.id;
    if (!rests.has(key)) rests.set(key, Array.from(p.axes || [], a => Number.isFinite(a) ? a : 0));
    return rests.get(key);
  };
  return pads => {
    const connected = Array.from(pads || []).filter(p=>p?.connected);
    // A newly used pad takes control, without combining multiple controllers.
    const used = connected.find(p=>p.buttons.some(b=>b.pressed) || (p.axes||[]).some((_,i)=>Math.abs(readAxis(p,i,restOf(p)))>.25));
    const pad = used || connected.find(p=>p.index===index) || connected[0];
    if (!pad) {index=null;previous=[];return null;}
    if(index!==pad.index) previous=[];
    index=pad.index;
    const state=sampleGamepad(pad, restOf(pad));
    const pressed=state.buttons.map((down,i)=>down&&!previous[i]);
    previous=state.buttons;
    return {...state,pressed,id:pad.id,mapping:pad.mapping};
  };
}
