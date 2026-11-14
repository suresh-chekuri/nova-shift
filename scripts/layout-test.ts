import { COLLIDERS, INTERACTABLES, roomAt } from '../src/world/layout.ts';
const R = 0.38;
const blocked = (x: number, z: number) => COLLIDERS.some(c => {
  const nx = Math.max(c.minX, Math.min(x, c.maxX)), nz = Math.max(c.minZ, Math.min(z, c.maxZ));
  return (x - nx) ** 2 + (z - nz) ** 2 < R * R;
});
const step = 0.25, seen = new Set<string>();
const q: [number, number][] = [[0, -2]];
const key = (x: number, z: number) => Math.round(x / step) + ',' + Math.round(z / step);
seen.add(key(0, -2));
while (q.length) {
  const [x, z] = q.pop()!;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx * step, nz = z + dz * step;
    if (Math.abs(nx) > 40 || Math.abs(nz) > 40) continue;
    const k = key(nx, nz);
    if (seen.has(k) || blocked(nx, nz)) continue;
    seen.add(k); q.push([nx, nz]);
  }
}
const reach = (x: number, z: number) => seen.has(key(x, z));
console.log('start blocked?', blocked(0, -2));
for (const [n, x, z] of [['engineering', -24, 0], ['science', 24, 0], ['comms', 0, -24], ['command', 0, 0], ['airlock', -25.5, 10]] as const)
  console.log(n, reach(x, z) ? 'REACHABLE' : 'UNREACHABLE');
// can the player stand in range of every interactable (and be inside the world)?
for (const it of INTERACTABLES) {
  let ok = false;
  for (const k of seen) {
    const [a, b] = k.split(',').map(Number);
    const px = a * step, pz = b * step;
    if (Math.hypot(px - it.x, pz - it.z) <= it.range - 0.2) { ok = true; break; }
  }
  console.log(it.id, ok ? 'ok' : 'NOT REACHABLE', roomAt(it.x, it.z));
}
