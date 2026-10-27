// Big Fans platform geometry shared by rendering and collision calculations.
// Coordinates are in the horizontal X/Z plane; positive angles rotate X toward Z.
export function fanSurfaceAt(fan, x, z) {
  const dx = x - fan.x;
  const dz = z - fan.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= fan.hubRadius) return { part: 'hub', distance };
  if (distance > fan.radius) return null;
  const angle = Math.atan2(dz, dx) - fan.angle;
  const spacing = Math.PI * 2 / fan.blades;
  const local = ((angle + spacing / 2) % spacing + spacing) % spacing - spacing / 2;
  // Blades widen from the hub towards the outer edge.
  const t = (distance - fan.hubRadius) / (fan.radius - fan.hubRadius);
  const halfWidth = fan.innerHalfWidth + t * (fan.outerHalfWidth - fan.innerHalfWidth);
  return Math.abs(Math.sin(local) * distance) <= halfWidth && Math.cos(local) > 0
    ? { part: 'blade', distance } : null;
}

export function advanceFan(fan, dt) {
  fan.angle = (fan.angle + fan.angularSpeed * dt) % (Math.PI * 2);
}

// Carry a grounded actor with the rotating platform without changing facing.
export function carryByFan(fan, x, z, dt) {
  const delta = fan.angularSpeed * dt;
  const c = Math.cos(delta), s = Math.sin(delta);
  const dx = x - fan.x, dz = z - fan.z;
  return { x: fan.x + dx * c - dz * s, z: fan.z + dx * s + dz * c };
}
