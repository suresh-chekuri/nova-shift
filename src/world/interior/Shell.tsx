// The ship shell: wall panels, floor plates, ceiling, I-beams, wall ribs, light fixtures
// and blue accent strips. Visual only. Walls keep their exact size, so collisions do not change.
// Repeated parts use instancing (one draw call for many copies).
import { useMemo } from 'react';
import * as THREE from 'three';
import { H, WALL_SEGS, FLOOR_RECTS, ROOMS, type Seg, type Rect } from '../layout';
import { LAMP_SPOTS, DOOR_LIST, spansAround } from './spots';
import { Bx, Inst, MAT, type Item, type V3 } from './kit';
import { wallMat, floorMat, ceilMat } from './pbr';

/** Shared by every ceiling light panel. Lights() in Ship.tsx changes its colour (white -> warm red in an emergency). */
export const lampMat = new THREE.MeshStandardMaterial({ color: '#eef3f8', emissive: new THREE.Color('#e6eef7'), emissiveIntensity: 2 });
/** Subtle blue accent strips along the ceiling edge. Also driven by Lights(). */
export const accentMat = new THREE.MeshStandardMaterial({ color: '#16222f', emissive: new THREE.Color('#4aa3ff'), emissiveIntensity: 1.0, roughness: 0.4 });
const windowGlass = new THREE.MeshStandardMaterial({ color: '#9cd1ff', roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.1, depthWrite: false });

// ------------------------------------------------------------ walls
function WallSeg({ s }: { s: Seg }) {
  const long = Math.max(s.w, s.d);
  const alongX = s.w > s.d;
  const full = useMemo(() => wallMat(long / 2), [long]);
  if (!s.win) {
    return (
      <mesh position={[s.cx, H / 2, s.cz]} material={full}>
        <boxGeometry args={[s.w, H, s.d]} />
      </mesh>
    );
  }
  // wall with a window: solid band below (the floor-level 1 m), solid band above, glass and mullions between
  const low = wallMat(long / 2, 0.25, 0);
  const high = wallMat(long / 2, 0.25, 0.75);
  const n = Math.max(1, Math.round(long / 3.5));
  const posts = Array.from({ length: n + 1 }, (_, i) => -long / 2 + (i * long) / n);
  return (
    <group position={[s.cx, 0, s.cz]}>
      <mesh position={[0, 0.5, 0]} material={low}><boxGeometry args={[s.w, 1, s.d]} /></mesh>
      <mesh position={[0, H - 0.5, 0]} material={high}><boxGeometry args={[s.w, 1, s.d]} /></mesh>
      <mesh position={[0, 2, 0]} material={windowGlass}><boxGeometry args={alongX ? [s.w, 2, 0.05] : [0.05, 2, s.d]} /></mesh>
      {posts.map((p, i) => (
        <group key={i} position={alongX ? [p, 2, 0] : [0, 2, p]}>
          <Bx p={[0, 0, 0]} s={alongX ? [0.2, 2, s.d + 0.04] : [s.w + 0.04, 2, 0.2]} m={MAT.darkSteel} />
          <Bx p={[0, 0, 0]} s={alongX ? [0.34, 2, 0.1] : [0.1, 2, 0.34]} m={MAT.steel} />
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------ floors and ceilings
function FloorCeil({ r, lift = 0 }: { r: Rect; lift?: number }) {
  const w = r.x1 - r.x0 + 0.4, d = r.z1 - r.z0 + 0.4;
  const fm = useMemo(() => floorMat(w, d), [w, d]);
  const cm = useMemo(() => ceilMat(w, d), [w, d]);
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  return (
    <>
      <mesh position={[cx, lift, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={fm}>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh position={[cx, H - lift, cz]} rotation={[Math.PI / 2, 0, 0]} material={cm}>
        <planeGeometry args={[w, d]} />
      </mesh>
    </>
  );
}

// ------------------------------------------------------------ structure: beams, ribs, light fixtures, accent strips
type Side = 'N' | 'S' | 'E' | 'W';
function holesOn(alongX: boolean, wallCentre: number): [number, number][] {
  return DOOR_LIST.filter((d) => d.alongX === alongX && Math.abs((alongX ? d.z : d.x) - wallCentre) < 0.6).map((d) => {
    const c = alongX ? d.x : d.z;
    return [c - d.w / 2 - 0.1, c + d.w / 2 + 0.1] as [number, number];
  });
}

function useStructure() {
  return useMemo(() => {
    const flanges: Item[] = [], webs: Item[] = [], stiff: Item[] = [];
    // I-beams across each room (run along X, kept clear of the light panels)
    const beamRooms: [Rect, number[]][] = [
      [ROOMS.command, [-4.2, 4.2]], [ROOMS.engineering, [-4.2, 4.2]], [ROOMS.science, [-4.2, 4.2]], [ROOMS.comms, [-28.4, -21.4]],
    ];
    for (const [r, zs] of beamRooms) {
      const x0 = r.x0 + 0.2, x1 = r.x1 - 0.2, len = x1 - x0, cx = (x0 + x1) / 2;
      for (const z of zs) {
        flanges.push({ p: [cx, H - 0.3, z], s: [len, 0.035, 0.3] }, { p: [cx, H - 0.065, z], s: [len, 0.035, 0.34] });
        webs.push({ p: [cx, H - 0.18, z], s: [len, 0.2, 0.05] });
        for (let x = x0 + 0.9; x < x1 - 0.4; x += 1.75) stiff.push({ p: [x, H - 0.18, z], s: [0.04, 0.2, 0.22] });
      }
    }
    // wall ribs on the long walls of Engineering and the Science Lab
    const ribW: Item[] = [], ribF: Item[] = [], ribP: Item[] = [];
    for (const cx of [-24, 24]) {
      for (const k of [-5.25, -1.75, 1.75, 5.25]) {
        for (const sg of [-1, 1]) {
          const x = cx + k, z = sg * 5.72;
          ribW.push({ p: [x, 1.9, z], s: [0.06, 3.7, 0.16] });
          ribF.push({ p: [x, 1.9, z - sg * 0.1], s: [0.36, 3.7, 0.04] });
          ribP.push({ p: [x, 0.04, z - sg * 0.03], s: [0.5, 0.08, 0.3] }, { p: [x, 3.74, z - sg * 0.03], s: [0.5, 0.08, 0.3] });
        }
      }
    }
    // fake ambient occlusion: dark strips where wall meets floor
    const ao: Item[] = [[0, -5.8, 14, 0.1], [0, 5.8, 14, 0.1], [-24, -5.8, 14, 0.1], [-24, 5.8, 14, 0.1], [24, -5.8, 14, 0.1], [24, 5.8, 14, 0.1], [0, -30.8, 14, 0.1], [-6.8, -24, 0.1, 14], [6.8, -24, 0.1, 14]]
      .map(([x, z, w, d]) => ({ p: [x, 0.12, z] as V3, s: [w, 0.24, d] as V3, c: '#10161f' }));
    // ceiling light fixtures
    const frames: Item[] = [], lenses: Item[] = [], ribsL: Item[] = [], hang: Item[] = [];
    for (const [x, z, w, d] of LAMP_SPOTS) {
      frames.push({ p: [x, H - 0.035, z], s: [w + 0.16, 0.07, d + 0.16] });
      lenses.push({ p: [x, H - 0.055, z], s: [w, 0.02, d] });
      const alongLong = w >= d;
      for (const f of [-0.33, 0, 0.33]) {
        ribsL.push(alongLong ? { p: [x + f * w, H - 0.0665, z], s: [0.02, 0.004, d] } : { p: [x, H - 0.0665, z + f * d], s: [w, 0.004, 0.02] });
      }
      hang.push(alongLong ? { p: [x - w / 2 - 0.05, H - 0.05, z], s: [0.04, 0.1, d + 0.2] } : { p: [x, H - 0.05, z - d / 2 - 0.05], s: [w + 0.2, 0.1, 0.04] });
    }
    // blue accent strips along the top of every wall (skipping doorways)
    const accent: Item[] = [];
    const y = H - 0.22;
    for (const r of Object.values(ROOMS)) {
      (['N', 'S', 'E', 'W'] as Side[]).forEach((side) => {
        const alongX = side === 'N' || side === 'S';
        const centre = side === 'N' ? r.z0 : side === 'S' ? r.z1 : side === 'W' ? r.x0 : r.x1;
        const fixed = side === 'N' ? r.z0 + 0.23 : side === 'S' ? r.z1 - 0.23 : side === 'W' ? r.x0 + 0.23 : r.x1 - 0.23;
        const lo = (alongX ? r.x0 : r.z0) + 0.25, hi = (alongX ? r.x1 : r.z1) - 0.25;
        spansAround(lo, hi, holesOn(alongX, centre)).forEach(([a, b]) => {
          const len = b - a, mid = (a + b) / 2;
          accent.push(alongX ? { p: [mid, y, fixed], s: [len, 0.05, 0.035] } : { p: [fixed, y, mid], s: [0.035, 0.05, len] });
        });
      });
    }
    return { flanges, webs, stiff, ribW, ribF, ribP, ao, frames, lenses, ribsL, hang, accent };
  }, []);
}

function Structure() {
  const s = useStructure();
  return (
    <>
      <Inst items={s.flanges} mat={MAT.darkSteel} />
      <Inst items={s.webs} mat={MAT.paintGrey} />
      <Inst items={s.stiff} mat={MAT.darkSteel} />
      <Inst items={s.ribW} mat={MAT.paintGrey} />
      <Inst items={s.ribF} mat={MAT.steel} />
      <Inst items={s.ribP} mat={MAT.darkSteel} />
      <Inst items={s.ao} mat={MAT.white} />
      <Inst items={s.frames} mat={MAT.paintDark} />
      <Inst items={s.hang} mat={MAT.darkSteel} />
      <Inst items={s.lenses} mat={lampMat} />
      <Inst items={s.ribsL} mat={MAT.black} />
      <Inst items={s.accent} mat={accentMat} />
    </>
  );
}

export function Shell() {
  return (
    <>
      {WALL_SEGS.map((s, i) => <WallSeg key={i} s={s} />)}
      {FLOOR_RECTS.map((r, i) => <FloorCeil key={i} r={r} lift={i >= 4 ? 0.012 : 0} />)}
      <Structure />
    </>
  );
}
