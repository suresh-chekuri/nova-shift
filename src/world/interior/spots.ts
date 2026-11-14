// Ceiling lamp panels: [x, z, width, depth]. Shared by the lamp meshes and their housings.
export const LAMP_SPOTS: [number, number, number, number][] = [
  [-3, -2, 2.2, 0.5], [3, -2, 2.2, 0.5], [-3, 2, 2.2, 0.5], [3, 2, 2.2, 0.5],
  [-24, -2, 2.4, 0.5], [-24, 2, 2.4, 0.5], [24, -2, 2.4, 0.5], [24, 2, 2.4, 0.5],
  [-3, -24, 2.2, 0.5], [3, -24, 2.2, 0.5],
  [-12, 0, 2, 0.4], [-9.5, 0, 1.2, 0.4], [-14.5, 0, 1.2, 0.4],
  [12, 0, 2, 0.4], [9.5, 0, 1.2, 0.4], [14.5, 0, 1.2, 0.4],
  [0, -11.5, 0.4, 2], [0, -8.5, 0.4, 1.2], [0, -14.5, 0.4, 1.2],
  [-25.5, 8, 2.0, 0.45], [-25.5, 11, 2.0, 0.45],
];

/** Every doorway: centre, direction of the wall, and opening width. */
export const DOOR_LIST: { x: number; z: number; alongX: boolean; w: number }[] = [
  { x: -7, z: 0, alongX: false, w: 3 }, { x: 7, z: 0, alongX: false, w: 3 },
  { x: -17, z: 0, alongX: false, w: 3 }, { x: 17, z: 0, alongX: false, w: 3 },
  { x: 0, z: -6, alongX: true, w: 3 }, { x: 0, z: -17, alongX: true, w: 3 },
  { x: -25.5, z: 6, alongX: true, w: 2.4 },
];
/** Split the span [a, b] so it skips the given [lo, hi] holes. */
export function spansAround(a: number, b: number, holes: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let from = a;
  for (const [h0, h1] of [...holes].sort((p, q) => p[0] - q[0])) {
    if (h0 > from) out.push([from, Math.min(h0, b)]);
    from = Math.max(from, h1);
  }
  if (from < b) out.push([from, b]);
  return out.filter(([lo, hi]) => hi - lo > 0.15);
}
