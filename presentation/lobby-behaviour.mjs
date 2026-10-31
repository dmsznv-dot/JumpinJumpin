// What the cube does on the lobby pedestal: stands and fidgets, waves, looks around, dances in place, spins round in
// a hop, bounces a few times for fun, sits down for a while. The feet stay on the pedestal except in real hops,
// which crouch before take-off and squash on landing. Each update returns
//   { pose, hop, squash, spin }: character pose name, height of the whole cube above the pedestal (m),
//   squash for the body (+ = flattened), extra turn around the vertical axis (rad).
const ACTIONS = {
  idle: { length: [3, 5], weight: 3 },
  look: { length: [3, 4], weight: 2 },
  wave: { length: [2.4, 3], weight: 2 },
  dance: { length: [3, 4], weight: 1.5 },
  spin: { length: [1.3, 1.3], weight: 1.5 },
  bounce: { length: [1.8, 1.8], weight: 1.5 },
  sit: { length: [6, 8], weight: 1.5 }
};
const easeInOut = t => t * t * (3 - 2 * t);

// One hop inside an action: crouch, take off, fly a parabola, squash on landing. t in seconds from the hop start.
function hopAt(t, { crouch = .18, air = .5, land = .2, height = .45 } = {}) {
  if (t < crouch) return { hop: 0, squash: .45 * Math.sin(t / crouch * Math.PI / 2) };
  if (t < crouch + air) { const u = (t - crouch) / air; return { hop: 4 * height * u * (1 - u), squash: -.15 * (1 - u), airborne: u }; }
  if (t < crouch + air + land) return { hop: 0, squash: .4 * Math.sin((t - crouch - air) / land * Math.PI) };
  return { hop: 0, squash: 0 };
}

export function createLobbyBehaviour(random = Math.random) {
  let action = 'wave', time = 0, length = 2.6, previous = 'idle';
  const pickNext = () => {
    // After sitting or any lively action, stand still for a moment; never the same action twice.
    if (action !== 'idle' && random() < .55) return 'idle';
    const options = Object.keys(ACTIONS).filter(a => a !== action && a !== previous);
    let total = 0;
    for (const a of options) total += ACTIONS[a].weight;
    let r = random() * total;
    for (const a of options) { r -= ACTIONS[a].weight; if (r <= 0) return a; }
    return options[options.length - 1];
  };
  return {
    get action() { return action; },
    update(dt) {
      time += dt;
      if (time >= length) {
        previous = action; action = pickNext(); time = 0;
        const [a, b] = ACTIONS[action].length; length = a + (b - a) * random();
      }
      if (action === 'spin') {
        // A full turn while in the air: the cube hops round to face the camera again.
        const h = hopAt(time, { air: .6, height: .5 });
        const turn = h.airborne !== undefined ? easeInOut(h.airborne) : time > .78 ? 1 : 0;
        return { pose: h.airborne !== undefined ? 'jump' : 'idle', hop: h.hop, squash: h.squash, spin: turn * Math.PI * 2 };
      }
      if (action === 'bounce') {
        // Three playful little hops in a row.
        const h = hopAt(time % .6, { crouch: .1, air: .36, land: .14, height: .22 });
        return { pose: h.airborne !== undefined ? 'jump' : 'idle', hop: h.hop, squash: h.squash, spin: 0 };
      }
      if (action === 'sit') {
        // Bend the knees first, then sit; a little squash as the body settles.
        const settle = time < .5 ? Math.sin(time / .5 * Math.PI) * .25 : 0;
        return { pose: time < .25 ? 'land' : 'sit', hop: 0, squash: settle, spin: 0 };
      }
      return { pose: action, hop: 0, squash: 0, spin: 0 };
    }
  };
}
