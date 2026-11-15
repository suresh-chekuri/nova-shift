// Where everything is in the ship. Units are meters. North is -Z, east is +X.
import type { InstrId, PanelId } from '../sim';

export const H = 4; // ceiling height
export const WALL_T = 0.4;

export interface Rect { x0: number; x1: number; z0: number; z1: number }
export interface Seg { cx: number; cz: number; w: number; d: number; win: boolean }
export interface Box { minX: number; maxX: number; minZ: number; maxZ: number }

export const ROOMS = {
  command: { name: 'COMMAND DECK', x0: -7, x1: 7, z0: -6, z1: 6 },
  engineering: { name: 'ENGINEERING', x0: -31, x1: -17, z0: -6, z1: 6 },
  science: { name: 'SCIENCE LAB', x0: 17, x1: 31, z0: -6, z1: 6 },
  comms: { name: 'COMMUNICATIONS', x0: -7, x1: 7, z0: -31, z1: -17 },
  // V3: a small airlock behind Engineering (door in Engineering's south wall)
  airlock: { name: 'AIRLOCK', x0: -28.5, x1: -22.5, z0: 6, z1: 13 },
};
export const AIRLOCK_DOOR_X = -25.5;

export const CORRIDORS: (Rect & { name: string })[] = [
  { name: 'CORRIDOR', x0: -17, x1: -7, z0: -1.5, z1: 1.5 },
  { name: 'CORRIDOR', x0: 7, x1: 17, z0: -1.5, z1: 1.5 },
  { name: 'CORRIDOR', x0: -1.5, x1: 1.5, z0: -17, z1: -6 },
];

type Side = 'N' | 'S' | 'E' | 'W';
interface Opening { side: Side; c: number; half: number }

function sideSegs(r: Rect, side: Side, openings: Opening[], win: boolean): Seg[] {
  const alongX = side === 'N' || side === 'S';
  const a = alongX ? r.x0 : r.z0;
  const b = alongX ? r.x1 : r.z1;
  const fixed = side === 'N' ? r.z0 : side === 'S' ? r.z1 : side === 'W' ? r.x0 : r.x1;
  const ops = openings
    .filter((o) => o.side === side)
    .map((o) => [o.c - o.half, o.c + o.half])
    .sort((p, q) => p[0] - q[0]);
  const spans: number[][] = [];
  let start = a - WALL_T / 2;
  for (const [lo, hi] of ops) {
    if (lo > start) spans.push([start, lo]);
    start = hi;
  }
  spans.push([start, b + WALL_T / 2]);
  const out: Seg[] = [];
  for (const [s, e] of spans) {
    const len = e - s;
    if (len < 0.05) continue;
    const c = (s + e) / 2;
    out.push(
      alongX
        ? { cx: c, cz: fixed, w: len, d: WALL_T, win: win && len >= 3 }
        : { cx: fixed, cz: c, w: WALL_T, d: len, win: win && len >= 3 },
    );
  }
  return out;
}

function roomWalls(r: Rect, openings: Opening[], windowSide: Side): Seg[] {
  const sides: Side[] = ['N', 'S', 'E', 'W'];
  return sides.flatMap((s) => sideSegs(r, s, openings, s === windowSide));
}

const DOOR = 1.5;
export const WALL_SEGS: Seg[] = [
  ...roomWalls(ROOMS.command, [
    { side: 'E', c: 0, half: DOOR }, { side: 'W', c: 0, half: DOOR }, { side: 'N', c: 0, half: DOOR },
  ], 'S'),
  ...roomWalls(ROOMS.engineering, [{ side: 'E', c: 0, half: DOOR }, { side: 'S', c: AIRLOCK_DOOR_X, half: 1.2 }], 'W'),
  ...roomWalls(ROOMS.science, [{ side: 'W', c: 0, half: DOOR }], 'E'),
  ...roomWalls(ROOMS.comms, [{ side: 'S', c: 0, half: DOOR }], 'N'),
  // airlock: west, east and south walls (its north wall is Engineering's south wall)
  ...(['W', 'E', 'S'] as Side[]).flatMap((sd) => sideSegs(ROOMS.airlock, sd, [], false)),
  // corridor side walls
  { cx: -12, cz: -1.5, w: 10, d: WALL_T, win: false },
  { cx: -12, cz: 1.5, w: 10, d: WALL_T, win: false },
  { cx: 12, cz: -1.5, w: 10, d: WALL_T, win: false },
  { cx: 12, cz: 1.5, w: 10, d: WALL_T, win: false },
  { cx: -1.5, cz: -11.5, w: WALL_T, d: 11, win: false },
  { cx: 1.5, cz: -11.5, w: WALL_T, d: 11, win: false },
];

export const FLOOR_RECTS: Rect[] = [
  ...Object.values(ROOMS),
  ...CORRIDORS,
];

// Solid objects the player cannot walk through: [centerX, centerZ, width, depth]
const PROPS: [number, number, number, number][] = [
  [0, 4.2, 5.2, 1.2], // command console
  [-5, 4.5, 2.6, 1.2], // status console
  [5, 4.5, 2.6, 1.2], // comm status console
  [-27, -2.8, 3.1, 3.1], // generator
  [-27, 3.2, 5.2, 1.8], // battery bank
  [-22, -5.3, 4.2, 1.2], // power panel
  [-21, 5.3, 3.2, 1.2], // engine console
  [21, -3.8, 1.6, 1.6], // spectrometer
  [26.5, -3.8, 1.8, 1.8], // seismic sensor
  [26.5, 3.8, 2.2, 2.2], // signal analyzer
  [21, 5.3, 3.2, 1.2], // science data console
  [29.4, 0, 1.4, 1.4], // camera instrument
  [-29.8, -4.9, 1.4, 1.4], // coolant tank
  [-3.5, -25.5, 2.4, 2.4], // antenna pedestal
  [3, -30.2, 3.8, 1.2], // comms console
  // V3 equipment (big new objects are solid so the camera never clips into them)
  [-17.75, -4.1, 1.0, 3.0], [-17.75, 4.1, 1.0, 3.0], // power distribution cabinets
  [-26.6, -5.45, 4.2, 0.7], // battery rack
  [23.5, -5.4, 2.4, 0.8], [29.35, -5.4, 2.3, 0.8], // instrument racks
  [24, 5.45, 2.0, 0.7], // sample cabinet
  [17.75, -3.7, 1.0, 3.0], [17.8, 4.0, 1.2, 3.2], // lab bench, freezers
  [6.3, -24.5, 1.0, 2.0], [6.3, -27.5, 1.0, 2.0], [-6.3, -27.5, 1.0, 2.0], // radio racks
  [-6.4, -29.75, 0.6, 1.3], // antenna control unit
  [6.5, 3.2, 0.55, 1.6], // command spares cabinet
  [-27.6, 12.2, 1.6, 1.2], // suit locker (airlock)
  [-23.4, 12.2, 1.6, 1.2], // suit locker (airlock)
  [-30.15, -1.5, 0.95, 1.6], // coolant pump
  [-29.9, 5.0, 1.2, 0.8], // maintenance cart
  [-6.3, -21.5, 1.0, 2.0], // server racks
  [-6.3, -24.5, 1.0, 2.0],
  [6.3, -21.5, 1.0, 2.0],
];

export const COLLIDERS: Box[] = [
  ...WALL_SEGS.map((s) => ({ minX: s.cx - s.w / 2, maxX: s.cx + s.w / 2, minZ: s.cz - s.d / 2, maxZ: s.cz + s.d / 2 })),
  ...PROPS.map(([x, z, w, d]) => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 })),
];

export interface Interactable {
  id: string;
  panel: Exclude<PanelId, null>;
  focus?: InstrId;
  label: string;
  x: number;
  z: number;
  range: number;
}

export const INTERACTABLES: Interactable[] = [
  { id: 'command', panel: 'command', label: 'ACCESS MISSION CONSOLE', x: 0, z: 4.2, range: 3.4 },
  { id: 'power', panel: 'power', label: 'ACCESS POWER DISTRIBUTION', x: -22, z: -5.3, range: 3.4 },
  { id: 'engine', panel: 'engine', label: 'ACCESS ENGINE CONTROL', x: -21, z: 5.3, range: 3.0 },
  { id: 'spectrometer', panel: 'science', focus: 'spectrometer', label: 'ACCESS LUNAR SPECTROMETER', x: 21, z: -3.8, range: 2.8 },
  { id: 'seismic', panel: 'science', focus: 'seismic', label: 'ACCESS SEISMIC SENSOR', x: 26.5, z: -3.8, range: 2.8 },
  { id: 'analyzer', panel: 'science', focus: 'analyzer', label: 'ACCESS SIGNAL ANALYZER', x: 26.5, z: 3.8, range: 3.0 },
  { id: 'camera', panel: 'science', focus: 'camera', label: 'ACCESS HI-RES CAMERA', x: 29.4, z: 0, range: 3.0 },
  { id: 'sciconsole', panel: 'science', label: 'ACCESS SCIENCE DATA CONSOLE', x: 21, z: 5.3, range: 3.0 },
  { id: 'comms', panel: 'comms', label: 'ACCESS ANTENNA CONTROL', x: 3, z: -30.2, range: 3.2 },
  { id: 'dish', panel: 'comms', label: 'ACCESS ANTENNA CONTROL', x: -3.5, z: -25.5, range: 3.0 },
];

export function roomAt(x: number, z: number): string {
  for (const r of Object.values(ROOMS)) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.name;
  }
  return 'CORRIDOR';
}
