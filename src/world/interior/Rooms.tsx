// V3 interiors. Every room gets real equipment, and the ship gets panelling,
// trays, vents, hatches and markings. Visual only: gameplay, walls and
// consoles are unchanged (big new objects have matching colliders in layout.ts).
import { useMemo } from 'react';
import * as THREE from 'three';
import { pose } from '../../controls';
import { ROOMS } from '../layout';
import {
  Bx, Cy, Run, Inst, MAT, CYL, SPH, TOR, LM, LED, Led, Gate, Plate, FloorHazard, HazardStripe, Grate, Hatch, Vent, LedDriver, Beacon, TaskLight,
  LiveScreen, SlidingDoor, screenFrame, meter, mmss, SCR, blink, type V3, type Item, type Draw,
} from './kit';
import { Microscope, SampleJars, HatchHardware } from './Hero';

const PI = Math.PI;
const WEBBING = new THREE.MeshStandardMaterial({ color: '#a4501c', roughness: 0.9, metalness: 0 });
const COPPER = new THREE.MeshStandardMaterial({ color: '#b87333', roughness: 0.35, metalness: 0.9 });
const CANISTER = new THREE.MeshStandardMaterial({ color: '#cfd5da', roughness: 0.4, metalness: 0.6 });
const GREEN_BAND = new THREE.MeshStandardMaterial({ color: '#2f7d4f', roughness: 0.6, metalness: 0.3 });

// =================================================================== environment (all rooms)
type Side = 'N' | 'S' | 'E' | 'W';
// wall sides that have a window, and openings (side, centre, half width) to leave free
const NO_PANEL: Record<string, Side[]> = { command: ['S'], engineering: ['W'], science: ['E'], comms: ['N'], airlock: [] };
const OPENINGS: Record<string, [Side, number, number][]> = {
  command: [['E', 0, 1.9], ['W', 0, 1.9], ['N', 0, 1.9]],
  engineering: [['E', 0, 1.9], ['S', -25.5, 1.6]],
  science: [['W', 0, 1.9]],
  comms: [['S', 0, 1.9]],
  airlock: [['N', -25.5, 1.6], ['S', -25.5, 1.8]],
};

/** Low wall panels, a rail and a kick strip on every wall. One instanced draw call each. */
function useWallPanels() {
  return useMemo(() => {
    const panels: Item[] = [], rails: Item[] = [], kicks: Item[] = [];
    Object.entries(ROOMS).forEach(([key, r]) => {
      (['N', 'S', 'E', 'W'] as Side[]).forEach((side) => {
        if (NO_PANEL[key]?.includes(side)) return;
        const alongX = side === 'N' || side === 'S';
        const a = (alongX ? r.x0 : r.z0) + 0.4, b = (alongX ? r.x1 : r.z1) - 0.4;
        const fixed = side === 'N' ? r.z0 + 0.2 + 0.02 : side === 'S' ? r.z1 - 0.2 - 0.02 : side === 'W' ? r.x0 + 0.2 + 0.02 : r.x1 - 0.2 - 0.02;
        const holes = (OPENINGS[key] ?? []).filter((o) => o[0] === side).map((o) => [o[1] - o[2], o[1] + o[2]]);
        const free = (lo: number, hi: number) => !holes.some(([h0, h1]) => hi > h0 && lo < h1);
        const pitch = 1.75;
        for (let c = a + 0.85, i = 0; c + 0.85 <= b; c += pitch, i++) {
          if (!free(c - 0.85, c + 0.85)) continue;
          const col = i % 2 ? '#b2b6bb' : '#a7acb2';
          panels.push(alongX ? { p: [c, 0.58, fixed], s: [1.5, 0.84, 0.05], c: col } : { p: [fixed, 0.58, c], s: [0.05, 0.84, 1.5], c: col });
        }
        // rail and kick strip: split so they never cross a doorway
        const sgn = side === 'N' || side === 'W' ? 1 : -1;
        const cuts = holes.map(([h0, h1]) => [h0, h1]).sort((u, v) => u[0] - v[0]);
        const spans: [number, number][] = [];
        let from = a;
        for (const [h0, h1] of cuts) { if (h0 > from) spans.push([from, Math.min(h0, b)]); from = Math.max(from, h1); }
        if (from < b) spans.push([from, b]);
        for (const [lo, hi] of spans) {
          if (hi - lo < 0.2) continue;
          const len = hi - lo, mid = (lo + hi) / 2;
          rails.push(alongX ? { p: [mid, 1.12, fixed + sgn * 0.01], s: [len, 0.05, 0.05], c: '#8a9098' } : { p: [fixed + sgn * 0.01, 1.12, mid], s: [0.05, 0.05, len], c: '#8a9098' });
          kicks.push(alongX ? { p: [mid, 0.07, fixed + sgn * 0.01], s: [len, 0.14, 0.06], c: '#1b1e22' } : { p: [fixed + sgn * 0.01, 0.07, mid], s: [0.06, 0.14, len], c: '#1b1e22' });
        }
      });
    });
    return { panels, rails, kicks };
  }, []);
}

/** A cable tray: steel channel with three cables in it. Runs along X or Z only. */
function Tray({ a, b, w = 0.36 }: { a: V3; b: V3; w?: number }) {
  const alongX = Math.abs(b[0] - a[0]) > Math.abs(b[2] - a[2]);
  const len = alongX ? Math.abs(b[0] - a[0]) : Math.abs(b[2] - a[2]);
  const c: V3 = [(a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2];
  const half = len / 2;
  return (
    <group position={c} rotation={[0, alongX ? 0 : PI / 2, 0]}>
      <Bx p={[0, 0, 0]} s={[len, 0.03, w]} m={MAT.darkSteel} />
      <Bx p={[0, 0.05, w / 2]} s={[len, 0.1, 0.025]} m={MAT.darkSteel} />
      <Bx p={[0, 0.05, -w / 2]} s={[len, 0.1, 0.025]} m={MAT.darkSteel} />
      <Run a={[-half, 0.06, -0.09]} b={[half, 0.06, -0.09]} rad={0.028} m={MAT.cable} />
      <Run a={[-half, 0.06, 0]} b={[half, 0.06, 0]} rad={0.028} m={MAT.cableBlue} />
      <Run a={[-half, 0.06, 0.09]} b={[half, 0.06, 0.09]} rad={0.028} m={MAT.cableRed} />
      {Array.from({ length: Math.floor(len / 1.6) }, (_, i) => (
        <Bx key={i} p={[-half + 0.8 + i * 1.6, 0.075, 0]} s={[0.05, 0.02, w]} m={MAT.steel} />
      ))}
    </group>
  );
}

const DOORS: { x: number; z: number; alongX: boolean; name: string; w?: number; airlock?: boolean }[] = [
  { x: -7, z: 0, alongX: false, name: 'COMMAND / PORT' },
  { x: 7, z: 0, alongX: false, name: 'COMMAND / STBD' },
  { x: -17, z: 0, alongX: false, name: 'ENGINEERING' },
  { x: 17, z: 0, alongX: false, name: 'SCIENCE LAB' },
  { x: 0, z: -6, alongX: true, name: 'COMMS ACCESS' },
  { x: 0, z: -17, alongX: true, name: 'COMMUNICATIONS' },
  { x: -25.5, z: 6, alongX: true, name: 'AIRLOCK', w: 2.4, airlock: true },
];

function Environment() {
  const { panels, rails, kicks } = useWallPanels();
  return (
    <>
      <Inst items={panels} mat={MAT.paint} />
      <Inst items={rails} mat={MAT.steel} />
      <Inst items={kicks} mat={MAT.white} />
      {/* ceiling cable trays, in the rooms and the corridors */}
      {/* trays stop short of every door so nothing crosses a doorway */}
      {[[-30.3, -17.6], [-16.4, -7.6], [-6.4, 6.4], [7.6, 16.4], [17.6, 30.3]].map(([x0, x1]) => <Tray key={x0} a={[x0, 3.5, 1.15]} b={[x1, 3.5, 1.15]} />)}
      <Tray a={[1.05, 3.5, -30.3]} b={[1.05, 3.5, -17.6]} />
      <Tray a={[1.05, 3.5, -16.4]} b={[1.05, 3.5, -6.6]} />
      <Tray a={[-6.3, 3.55, 2.2]} b={[6.3, 3.55, 2.2]} w={0.3} />
      {/* wall vents */}
      <Vent p={[-5.2, 3.2, -5.76]} /><Vent p={[5.2, 3.2, -5.76]} />
      <Vent p={[6.76, 3.2, 3.5]} rotY={-PI / 2} /><Vent p={[-6.76, 3.2, 3.5]} rotY={PI / 2} />
      <Vent p={[-20, 3.2, -5.76]} /><Vent p={[-28.5, 3.2, -5.76]} />
      <Vent p={[-29.5, 3.2, 5.76]} rotY={PI} /><Vent p={[-21, 3.2, 5.76]} rotY={PI} />
      <Vent p={[19.5, 3.2, -5.76]} /><Vent p={[28, 3.2, -5.76]} />
      <Vent p={[19, 3.2, 5.76]} rotY={PI} /><Vent p={[29, 3.2, 5.76]} rotY={PI} />
      <Vent p={[6.76, 3.2, -20]} rotY={-PI / 2} /><Vent p={[6.76, 3.2, -29]} rotY={-PI / 2} />
      <Vent p={[-6.76, 3.2, -19.5]} rotY={PI / 2} />
      <Vent p={[-22.74, 3.2, 8]} rotY={-PI / 2} w={0.7} /><Vent p={[-28.26, 3.2, 8]} rotY={PI / 2} w={0.7} />
      <Vent p={[-12, 3.1, -1.28]} w={0.8} h={0.4} /><Vent p={[12, 3.1, 1.28]} rotY={PI} w={0.8} h={0.4} />
      {/* floor grates and maintenance hatches */}
      <Hatch x={0} z={-3.4} /><Grate x={-4.6} z={-1.8} w={1.6} d={0.9} /><Grate x={4.6} z={-1.8} w={1.6} d={0.9} />
      <Hatch x={-19.8} z={0.2} /><Grate x={-24} z={0.4} w={1.4} d={1} />
      <Hatch x={24} z={0.2} /><Grate x={19.4} z={0.8} w={1.4} d={1} /><Grate x={28} z={0} w={1} d={1.4} />
      <Hatch x={1.8} z={-22} /><Grate x={-1.6} z={-28.4} w={1.6} d={0.9} />
      <Grate x={-12} z={0} w={3} d={0.9} /><Grate x={12} z={0} w={3} d={0.9} /><Grate x={0} z={-11.5} w={0.9} d={3} />
      <Grate x={-25.5} z={9.3} w={1.5} d={1.5} />
      {/* markings on the floor */}
      <FloorHazard x={-27} z={-4.7} w={3.5} d={0.18} /><FloorHazard x={-27} z={-0.9} w={3.5} d={0.18} />
      <FloorHazard x={-28.85} z={-2.8} w={3.5} d={0.18} rotY={PI / 2} /><FloorHazard x={-25.15} z={-2.8} w={3.5} d={0.18} rotY={PI / 2} />
      <FloorHazard x={-25.5} z={6.9} w={2.7} d={0.3} /><FloorHazard x={-25.5} z={11.9} w={3} d={0.4} />
      <FloorHazard x={-21.5} z={3.3} w={2.4} d={0.14} />
      {/* sliding pressure doors in every doorway */}
      {DOORS.map((d) => <SlidingDoor key={d.name} {...d} />)}
      {/* window trim: sill, seals and a glare shield on every window wall */}
      <WindowTrim cx={0} cz={6} len={14} rot={PI} />
      <WindowTrim cx={-31} cz={0} len={12} rot={PI / 2} />
      <WindowTrim cx={31} cz={0} len={12} rot={-PI / 2} />
      <WindowTrim cx={0} cz={-31} len={14} rot={0} />
      {/* general labels */}
      <Plate text="HIGH PRESSURE" p={[-12, 2.2, -1.28]} w={0.55} kind="warn" />
      <Plate text="NO OBSTRUCTION" p={[12, 2.2, 1.28]} rotY={PI} w={0.6} kind="warn" />
      <Plate text="EXIT" p={[1.28, 2.6, -11.5]} rotY={-PI / 2} w={0.3} kind="safe" />
      <Plate text="FIRE EXT." p={[-6.76, 1.5, 4.9]} rotY={PI / 2} w={0.4} kind="danger" />
      <Cy p={[-6.62, 0.9, 4.9]} rad={0.07} h={0.45} m={MAT.cableRed} />
      <Bx p={[-6.62, 1.25, 4.9]} s={[0.09, 0.07, 0.1]} m={MAT.darkSteel} />
      <LedDriver />
    </>
  );
}

function WindowTrim({ cx, cz, len, rot }: { cx: number; cz: number; len: number; rot: number }) {
  const foil = useMemo<Item[]>(() => [-0.32, 0.05, 0.38].map((f) => ({ p: [f * len, 1.1, 0.37] as V3, s: [len * 0.2, 0.025, 0.3] as V3 })), [len]);
  return (
    <group position={[cx, 0, cz]} rotation={[0, rot, 0]}>
      <Bx p={[0, 1.04, 0.36]} s={[len - 0.2, 0.07, 0.36]} m={MAT.paintDark} />
      <Inst items={foil} mat={MAT.foil} />
      <Bx p={[0, 1.02, 0.2]} s={[len - 0.2, 0.06, 0.07]} m={MAT.rubber} />
      <Bx p={[0, 2.98, 0.2]} s={[len - 0.2, 0.06, 0.07]} m={MAT.rubber} />
      <Bx p={[0, 2.93, 0.36]} s={[len - 0.2, 0.1, 0.34]} m={MAT.comp} />
      <Bx p={[0, 2.86, 0.4]} s={[len - 0.6, 0.02, 0.05]} m={MAT.white} />
    </group>
  );
}

// =================================================================== command deck
function PilotSeat({ x, z = 1.4 }: { x: number; z?: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* floor rails, base, swivel and gas strut */}
      <Bx p={[-0.26, 0.03, 0]} s={[0.06, 0.05, 1.1]} m={MAT.darkSteel} />
      <Bx p={[0.26, 0.03, 0]} s={[0.06, 0.05, 1.1]} m={MAT.darkSteel} />
      <Cy p={[0, 0.09, 0]} rad={0.34} h={0.07} m={MAT.darkSteel} />
      <Cy p={[0, 0.38, 0]} rad={0.07} h={0.5} m={MAT.steel} />
      <Cy p={[0, 0.34, 0]} rad={0.11} h={0.2} m={MAT.paintDark} />
      <Cy p={[0, 0.62, 0]} rad={0.2} h={0.05} m={MAT.darkSteel} />
      {/* seat pan, cushion and side bolsters */}
      <Bx p={[0, 0.69, 0]} s={[0.58, 0.1, 0.6]} m={MAT.comp} />
      <Bx p={[0, 0.76, -0.01]} s={[0.5, 0.07, 0.52]} m={MAT.paintDark} />
      <Bx p={[-0.27, 0.8, -0.02]} s={[0.07, 0.12, 0.5]} m={MAT.paintDark} />
      <Bx p={[0.27, 0.8, -0.02]} s={[0.07, 0.12, 0.5]} m={MAT.paintDark} />
      {/* backrest, shoulder bolsters, headrest on posts */}
      <Bx p={[0, 1.15, 0.3]} s={[0.56, 0.8, 0.09]} m={MAT.comp} r={[-0.12, 0, 0]} />
      <Bx p={[0, 1.16, 0.25]} s={[0.46, 0.7, 0.07]} m={MAT.paintDark} r={[-0.12, 0, 0]} />
      <Bx p={[-0.26, 1.35, 0.23]} s={[0.07, 0.35, 0.1]} m={MAT.paintDark} r={[-0.12, 0, 0]} />
      <Bx p={[0.26, 1.35, 0.23]} s={[0.07, 0.35, 0.1]} m={MAT.paintDark} r={[-0.12, 0, 0]} />
      <Cy p={[-0.09, 1.62, 0.34]} rad={0.015} h={0.28} m={MAT.steel} />
      <Cy p={[0.09, 1.62, 0.34]} rad={0.015} h={0.28} m={MAT.steel} />
      <Bx p={[0, 1.76, 0.32]} s={[0.3, 0.2, 0.09]} m={MAT.paintDark} r={[-0.1, 0, 0]} />
      {/* armrests: left has a hand controller, right has a button pad */}
      <Bx p={[-0.38, 0.9, 0.12]} s={[0.05, 0.3, 0.05]} m={MAT.steel} />
      <Bx p={[0.38, 0.9, 0.12]} s={[0.05, 0.3, 0.05]} m={MAT.steel} />
      <Bx p={[-0.38, 1.05, -0.02]} s={[0.1, 0.05, 0.46]} m={MAT.comp} />
      <Bx p={[0.38, 1.05, -0.02]} s={[0.1, 0.05, 0.46]} m={MAT.comp} />
      <Cy p={[-0.38, 1.14, -0.14]} rad={0.018} h={0.14} m={MAT.black} />
      <mesh geometry={SPH} material={MAT.black} position={[-0.38, 1.23, -0.14]} scale={0.035} />
      <Bx p={[0.38, 1.085, -0.1]} s={[0.07, 0.015, 0.14]} m={MAT.black} />
      <mesh geometry={SPH} material={LM.power} position={[0.38, 1.1, -0.14]} scale={0.014} />
      <mesh geometry={SPH} material={LM.amber} position={[0.38, 1.1, -0.1]} scale={0.014} />
      <mesh geometry={SPH} material={LM.alert} position={[0.38, 1.1, -0.06]} scale={0.014} />
      {/* five-point harness: shoulder straps, lap belt, buckle */}
      <Bx p={[-0.13, 1.18, 0.22]} s={[0.06, 0.72, 0.012]} m={WEBBING} r={[-0.12, 0, 0]} />
      <Bx p={[0.13, 1.18, 0.22]} s={[0.06, 0.72, 0.012]} m={WEBBING} r={[-0.12, 0, 0]} />
      <Bx p={[-0.17, 0.84, -0.02]} s={[0.22, 0.03, 0.012]} m={WEBBING} r={[0, 0, 0.25]} />
      <Bx p={[0.17, 0.84, -0.02]} s={[0.22, 0.03, 0.012]} m={WEBBING} r={[0, 0, -0.25]} />
      <Bx p={[0, 0.86, -0.06]} s={[0.08, 0.08, 0.025]} m={MAT.steel} />
      {/* footrest */}
      <Bx p={[0, 0.17, -0.55]} s={[0.5, 0.04, 0.26]} m={MAT.darkSteel} r={[0.3, 0, 0]} />
      <Bx p={[0, 0.1, -0.5]} s={[0.05, 0.2, 0.05]} m={MAT.steel} />
    </group>
  );
}

const navDraw: Draw = (c, W, H, g, t) => {
  screenFrame(c, W, H, 'NAVIGATION', 'MET ' + mmss(g.elapsed));
  const cx = W * 0.25, cy = H * 0.6, R = Math.min(W * 0.22, H * 0.3);
  c.strokeStyle = SCR.dim; c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(cx, cy, R * 1.6, R, -0.3, 0, PI * 2); c.stroke();
  c.fillStyle = '#7d8a86'; c.beginPath(); c.arc(cx, cy, R * 0.42, 0, PI * 2); c.fill();
  const a = t * 0.35;
  c.fillStyle = SCR.amber; c.beginPath(); c.arc(cx + Math.cos(a) * R * 1.6 * Math.cos(-0.3) - Math.sin(a) * R * Math.sin(-0.3), cy + Math.cos(a) * R * 1.6 * Math.sin(-0.3) + Math.sin(a) * R * Math.cos(-0.3), 6, 0, PI * 2); c.fill();
  c.fillStyle = SCR.text; c.font = '17px monospace'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  const x = W * 0.52;
  c.fillText('ANT AZ  ' + g.antenna.az.toFixed(0).padStart(3) + ' deg', x, 80);
  c.fillText('ANT EL  ' + g.antenna.el.toFixed(0).padStart(3) + ' deg', x, 104);
  c.fillStyle = SCR.dim; c.fillText('TGT AZ  ' + g.target.az.toFixed(0).padStart(3) + '   EL ' + g.target.el.toFixed(0).padStart(3), x, 128);
  meter(c, x, 170, W * 0.4, 'LINK STRENGTH', g.commsStrength / 100, g.commsLinked ? SCR.green : SCR.amber);
  meter(c, x, 218, W * 0.4, 'HULL INTEGRITY', g.integrity / 100, g.integrity > 40 ? SCR.cyan : SCR.red);
  c.fillStyle = g.commsLinked ? SCR.green : SCR.amber; c.font = 'bold 18px monospace';
  c.fillText(g.commsLinked ? 'EARTH LINK: LOCKED' : 'EARTH LINK: SEARCHING', x, H - 24);
};
const missionDraw: Draw = (c, W, H, g) => {
  screenFrame(c, W, H, 'MISSION STATUS', g.phase.toUpperCase());
  c.font = '18px monospace'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  g.objectives.forEach((done, i) => {
    c.fillStyle = done ? SCR.green : SCR.dim;
    c.fillText((done ? '[OK] ' : '[  ] ') + 'OBJECTIVE ' + (i + 1), 18, 74 + i * 26);
  });
  const x = W * 0.55;
  c.fillStyle = g.timeLeft < 120 ? SCR.red : SCR.text; c.font = 'bold 40px monospace'; c.fillText(mmss(g.timeLeft), x, 96);
  c.fillStyle = SCR.dim; c.font = '14px monospace'; c.fillText('TIME REMAINING', x, 118);
  meter(c, x, 160, W * 0.38, 'BATTERY', g.battery / 100, g.battery > 25 ? SCR.green : SCR.red);
  meter(c, x, 206, W * 0.38, 'DATA GATHERED', (g.data.spectrometer + g.data.seismic + g.data.analyzer + g.data.camera) / 400, SCR.cyan);
  meter(c, x, 252, W * 0.38, 'DATA SENT', Math.min(1, g.transmitted / 100), SCR.amber);
};

function OverheadPanel() {
  const { toggles, tips, rowsBase } = useMemo(() => {
    const toggles: Item[] = [], tips: Item[] = [], rowsBase: Item[] = [];
    for (let r = 0; r < 3; r++) {
      rowsBase.push({ p: [0, 0.2 - r * 0.28, 0.065], s: [5.0, 0.2, 0.012], c: '#20252b' });
      for (let k = 0; k < 16; k++) {
        const x = -2.3 + k * 0.307;
        const up = (k * 7 + r * 3) % 5 !== 0;
        toggles.push({ p: [x, 0.2 - r * 0.28, 0.1 + 0.0], s: [0.016, 0.07, 0.016], c: '#9aa1a9' });
        tips.push({ p: [x, 0.2 - r * 0.28 + (up ? 0.032 : -0.032), 0.1], s: [0.026, 0.026, 0.026], c: up ? '#d8dde2' : '#7a7f86' });
      }
    }
    return { toggles, tips, rowsBase };
  }, []);
  const labels = ['ELECTRICAL', 'PROPULSION', 'COMMS', 'LIFE SUPPORT', 'THERMAL', 'DATA'];
  return (
    <group position={[0, 3.3, -0.2]} rotation={[0.85, 0, 0]}>
      <Bx p={[0, 0, 0]} s={[5.4, 0.95, 0.12]} m={MAT.paintDark} />
      <Bx p={[0, 0, -0.02]} s={[5.5, 1.05, 0.06]} m={MAT.darkSteel} />
      <Inst items={rowsBase} mat={MAT.white} />
      <Inst items={toggles} mat={MAT.white} geo={CYL} />
      <Inst items={tips} mat={MAT.white} geo={SPH} />
      {labels.map((t, i) => <Plate key={t} text={t} p={[-2.15 + i * 0.86, 0.385, 0.068]} w={0.62} kind={i === 3 ? 'warn' : 'info'} />)}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Led key={i} p={[-2.2 + i * 0.63, -0.42, 0.075]} size={0.022} get={(g, t) => {
          if (i === 0) return g.powered.life ? LED.green : LED.red;
          if (i === 1) return g.powered.comms ? LED.green : LED.off;
          if (i === 2) return g.powered.sci ? LED.green : LED.off;
          if (i === 3) return g.powered.eng ? LED.green : LED.off;
          if (i === 4) return g.genState === 'online' ? LED.green : g.genState === 'starting' ? (blink(t, 2) ? LED.amber : LED.off) : LED.red;
          if (i === 5) return g.battery < 25 ? (blink(t, 3) ? LED.red : LED.off) : g.battery < 50 ? LED.amber : LED.green;
          if (i === 6) return g.overloaded || g.surge ? (blink(t, 4) ? LED.red : LED.off) : LED.off;
          return g.commsLinked ? LED.blue : LED.off;
        }} />
      ))}
    </group>
  );
}

const STRIP_BTNS: Item[] = Array.from({ length: 12 }, (_, i) => ({ p: [-1.38 + i * 0.25, 0, 0.07] as V3, s: [0.14, 0.1, 0.03] as V3, c: i % 4 === 3 ? '#8c7421' : '#9aa1a9' }));
const SPARE_DOORS: Item[] = Array.from({ length: 4 }, (_, i) => ({ p: [6.2, 0.45, 2.6 + i * 0.4] as V3, s: [0.02, 0.7, 0.34] as V3, c: '#4c525a' }));
function CommandDetail() {
  return (
    <>
      <PilotSeat x={-2.5} /><PilotSeat x={2.5} />
      <OverheadPanel />
      {/* large navigation and mission displays on the north wall, with button strips below */}
      <LiveScreen p={[-3.9, 2.35, -5.74]} w={3.3} h={1.65} draw={navDraw} />
      <LiveScreen p={[3.9, 2.35, -5.74]} w={3.3} h={1.65} draw={missionDraw} />
      {[-3.9, 3.9].map((x) => (
        <group key={x} position={[x, 1.2, -5.7]}>
          <Bx p={[0, 0, 0]} s={[3.2, 0.26, 0.12]} m={MAT.comp} />
          <Inst items={STRIP_BTNS} mat={MAT.white} />
        </group>
      ))}
      <Plate text="NAV" p={[-3.9, 1.38, -5.62]} w={0.35} /><Plate text="MISSION" p={[3.9, 1.38, -5.62]} w={0.5} />
      {/* equipment cabinet under the east-wall display, and a side switch panel */}
      <Bx p={[6.5, 0.45, 3.2]} s={[0.55, 0.9, 1.6]} m={MAT.paintGrey} />
      <Inst items={SPARE_DOORS} mat={MAT.white} />
      <Plate text="SPARES" p={[6.21, 0.95, 3.2]} rotY={-PI / 2} w={0.45} />
      {/* ceiling light housings */}
      <TaskLight p={[0, 3.93, -3.4]} s={[3.2, 0.04, 0.25]} />
    </>
  );
}

// =================================================================== engineering
function PduCabinet({ x, z, rotY, title, bus }: { x: number; z: number; rotY: number; title: string; bus: 'A' | 'B' }) {
  const leds = useMemo<Item[]>(() => Array.from({ length: 18 }, (_, i) => ({ p: [-1.2 + (i % 6) * 0.48, 1.9 - Math.floor(i / 6) * 0.18, 0.51] as V3, s: [0.03, 0.03, 0.03] as V3 })), []);
  const handles = useMemo<Item[]>(() => [-0.95, 0, 0.95].map((cx) => ({ p: [cx + 0.38, 1.25, 0.52] as V3, s: [0.03, 0.34, 0.03] as V3, c: '#aab0b7' })), []);
  const seams = useMemo<Item[]>(() => [-0.95, 0, 0.95].map((cx) => ({ p: [cx, 1.2, 0.505] as V3, s: [0.86, 1.7, 0.012] as V3, c: '#7b8189' })), []);
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <Bx p={[0, 1.2, 0]} s={[2.9, 2.4, 1.0]} m={MAT.paintGrey} />
      <Bx p={[0, 0.08, 0.02]} s={[2.95, 0.16, 1.02]} m={MAT.black} />
      <Inst items={seams} mat={MAT.white} />
      <Inst items={handles} mat={MAT.white} />
      {/* louvres and the indicator block */}
      <Bx p={[0, 2.22, 0.51]} s={[2.5, 0.2, 0.01]} m={MAT.black} />
      <Inst items={leds} mat={bus === 'A' ? LM.power : LM.comms} geo={SPH} />
      <Plate text={title} p={[0, 2.05, 0.512]} w={1.4} />
      <Plate text="HIGH VOLTAGE" p={[-0.95, 0.55, 0.512]} w={0.7} kind="danger" />
      <Plate text="LOCK OUT / TAG OUT" p={[0.95, 0.55, 0.512]} w={0.8} kind="warn" />
      {/* breaker status lights tied to the simulation */}
      {bus === 'A' ? (
        <>
          <Led p={[-0.95, 0.95, 0.52]} size={0.04} get={(g) => (g.j1 ? LED.green : LED.red)} />
          <Led p={[0, 0.95, 0.52]} size={0.04} get={(g) => (g.powered.life ? LED.green : LED.red)} />
          <Led p={[0.95, 0.95, 0.52]} size={0.04} get={(g) => (g.powered.comms ? LED.green : LED.off)} />
        </>
      ) : (
        <>
          <Led p={[-0.95, 0.95, 0.52]} size={0.04} get={(g) => (g.j2 ? LED.green : LED.red)} />
          <Led p={[0, 0.95, 0.52]} size={0.04} get={(g) => (g.powered.sci ? LED.green : LED.off)} />
          <Led p={[0.95, 0.95, 0.52]} size={0.04} get={(g) => (g.powered.eng ? LED.green : LED.off)} />
        </>
      )}
      {/* cable glands at the top, into the ceiling tray */}
      {[-0.9, -0.3, 0.3, 0.9].map((cx, i) => <Run key={cx} a={[cx, 2.4, 0.1]} b={[cx, 3.5, 0.1 + (i % 2) * 0.1]} rad={0.04} m={i % 2 ? MAT.cableRed : MAT.cable} />)}
    </group>
  );
}

function BatteryRack({ x, z }: { x: number; z: number }) {
  const { mods, terms } = useMemo(() => {
    const mods: Item[] = [], terms: Item[] = [];
    for (let col = 0; col < 4; col++) for (let row = 0; row < 6; row++) {
      const px = -1.5 + col * 1.0, py = 0.32 + row * 0.34;
      mods.push({ p: [px, py, 0.01], s: [0.9, 0.3, 0.6], c: row % 2 ? '#2a3038' : '#323943' });
      terms.push({ p: [px - 0.28, py + 0.06, 0.33], s: [0.035, 0.035, 0.035] }, { p: [px + 0.28, py + 0.06, 0.33], s: [0.035, 0.035, 0.035] });
    }
    return { mods, terms };
  }, []);
  return (
    <group position={[x, 0, z]}>
      <Bx p={[0, 1.2, -0.06]} s={[4.2, 2.4, 0.5]} m={MAT.paintDark} />
      <Inst items={mods} mat={MAT.white} />
      <Inst items={terms} mat={COPPER} geo={CYL} />
      <Run a={[-1.8, 2.28, 0.32]} b={[1.8, 2.28, 0.32]} rad={0.035} m={COPPER} />
      <Plate text="BATTERY RACK B" p={[0, 2.3, 0.33]} w={1.2} />
      <Plate text="DC BUS - 120 V" p={[-1.3, 0.15, 0.33]} w={0.8} kind="warn" />
      {[0, 1, 2, 3].map((c) => (
        <Led key={c} p={[-1.5 + c * 1.0, 2.18, 0.34]} size={0.035} get={(g) => (g.battery > [10, 35, 60, 85][c] ? (g.sw.bj1 || g.sw.bj2 ? LED.green : LED.amber) : LED.off)} />
      ))}
    </group>
  );
}

const powerDraw: Draw = (c, W, H, g) => {
  screenFrame(c, W, H, 'POWER DISTRIBUTION', g.genState.toUpperCase());
  meter(c, 18, 78, W - 36, 'GENERATOR OUTPUT  ' + g.genOutput.toFixed(0) + ' PU', g.genOutput / 130, g.genState === 'online' ? SCR.green : SCR.dim);
  meter(c, 18, 126, W - 36, 'DEMAND  ' + g.demand.toFixed(0) + ' PU', g.demand / 130, g.demand > g.supply ? SCR.red : SCR.cyan);
  meter(c, 18, 174, W - 36, 'BATTERY  ' + g.battery.toFixed(0) + '%', g.battery / 100, g.battery > 25 ? SCR.green : SCR.red);
  c.font = '17px monospace'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  c.fillStyle = g.j1 ? SCR.green : SCR.red; c.fillText('JUNCTION 1 ' + (g.j1 ? 'LIVE' : 'OPEN'), 18, H - 30);
  c.fillStyle = g.j2 ? SCR.green : SCR.red; c.fillText('JUNCTION 2 ' + (g.j2 ? 'LIVE' : 'OPEN'), W * 0.38, H - 30);
  c.fillStyle = g.overloaded ? SCR.red : g.surge ? SCR.amber : SCR.dim; c.fillText(g.overloaded ? 'OVERLOAD' : g.surge ? 'SURGE: ' + g.surge : 'LOAD NOMINAL', W * 0.72, H - 30);
};
const engineDraw: Draw = (c, W, H, g, t) => {
  screenFrame(c, W, H, 'ENGINEERING', 'GEN ' + g.genState.toUpperCase());
  c.font = '17px monospace'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const sys: [string, boolean][] = [['LIFE SUPPORT', g.powered.life], ['COMMUNICATIONS', g.powered.comms], ['SCIENCE', g.powered.sci], ['ENGINEERING', g.powered.eng]];
  sys.forEach(([n, on], i) => { c.fillStyle = on ? SCR.green : SCR.red; c.fillText((on ? '[ON ] ' : '[OFF] ') + n, 18, 78 + i * 26); });
  c.fillStyle = SCR.dim; c.fillText('GEN TEMP', W * 0.58, 78);
  c.strokeStyle = g.genState === 'online' ? SCR.green : SCR.dim; c.lineWidth = 2; c.beginPath();
  for (let x = 0; x < W * 0.36; x += 4) { const y = 130 + (g.genState === 'online' ? Math.sin((x + t * 60) / 12) * 16 : 0); x === 0 ? c.moveTo(W * 0.58 + x, y) : c.lineTo(W * 0.58 + x, y); }
  c.stroke();
};

function GantryHoist() {
  return (
    <group>
      {[-28.2, -25.8].map((x) => (
        <group key={x}>
          <Bx p={[x, 3.5, -2.2]} s={[0.22, 0.04, 6]} m={MAT.darkSteel} />
          <Bx p={[x, 3.44, -2.2]} s={[0.05, 0.12, 6]} m={MAT.darkSteel} />
          <Bx p={[x, 3.38, -2.2]} s={[0.22, 0.04, 6]} m={MAT.darkSteel} />
        </group>
      ))}
      <Bx p={[-27, 3.3, -2.8]} s={[2.6, 0.12, 0.3]} m={MAT.paintGrey} />
      <Bx p={[-27, 3.14, -2.8]} s={[0.4, 0.22, 0.34]} m={MAT.comp} />
      <Run a={[-27, 3.05, -2.8]} b={[-27, 2.98, -2.8]} rad={0.012} m={MAT.steel} />
      <Cy p={[-27, 2.92, -2.8]} rad={0.04} h={0.12} m={MAT.steel} />
      <Plate text="SWL 500 kg" p={[-27, 3.14, -2.62]} w={0.3} kind="warn" />
    </group>
  );
}
function CoolantPiping() {
  const clamps = useMemo<Item[]>(() => Array.from({ length: 8 }, (_, i) => ({ p: [-29 + i * 1.65, 3.45, -5.5] as V3, s: [0.05, 0.38, 0.1] as V3 })), []);
  return (
    <group>
      <Run a={[-29.8, 2.8, -4.9]} b={[-29.8, 3.35, -4.9]} rad={0.07} m={MAT.pipeBlue} />
      <Run a={[-29.8, 3.35, -5.5]} b={[-29.8, 3.35, -4.9]} rad={0.07} m={MAT.pipeBlue} />
      <Run a={[-29.8, 3.35, -5.5]} b={[-17.6, 3.35, -5.5]} rad={0.07} m={MAT.pipeBlue} />
      <Run a={[-29.5, 3.58, -5.5]} b={[-17.6, 3.58, -5.5]} rad={0.07} m={MAT.pipeOrange} />
      <Run a={[-29.5, 3.58, -5.5]} b={[-29.5, 2.3, -4.6]} rad={0.05} m={MAT.pipeOrange} />
      <Inst items={clamps} mat={MAT.darkSteel} />
      {/* wheel valve */}
      <group position={[-25.6, 3.35, -5.5]}>
        <Cy p={[0, 0.1, 0]} rad={0.06} h={0.2} m={MAT.steel} />
        <Cy p={[0, 0.25, 0]} rad={0.015} h={0.2} m={MAT.steel} />
        <mesh geometry={TOR} material={MAT.cableRed} position={[0, 0.36, 0]} rotation={[PI / 2, 0, 0]} scale={0.13} />
      </group>
      <Plate text="COOLANT SUPPLY" p={[-27.5, 3.35, -5.76]} w={0.6} kind="info" />
      <Plate text="COOLANT RETURN" p={[-22, 3.62, -5.76]} w={0.6} kind="warn" />
    </group>
  );
}
function EngineeringDetail() {
  return (
    <>
      <PduCabinet x={-17.75} z={-4.1} rotY={-PI / 2} title="MAIN BUS A" bus="A" />
      <PduCabinet x={-17.75} z={4.1} rotY={-PI / 2} title="MAIN BUS B" bus="B" />
      <BatteryRack x={-26.6} z={-5.45} />
      <GantryHoist />
      <CoolantPiping />
      <LiveScreen p={[-22, 2.45, -5.74]} w={3.4} h={1.3} draw={powerDraw} />
      <LiveScreen p={[-21, 2.45, 5.74]} rotY={PI} w={3} h={1.3} draw={engineDraw} />
      {/* maintenance panels with warning labels */}
      {[[-29.2, 1.6, 5.77, PI], [-19.1, 1.6, -5.77, 0]].map(([x, y, z, ry], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, ry, 0]}>
          <Bx p={[0, 0, 0]} s={[0.9, 0.9, 0.04]} m={MAT.paintGrey} />
          <Bx p={[0, 0, 0.03]} s={[0.78, 0.78, 0.02]} m={MAT.paint} />
          {[[-0.36, 0.36], [0.36, 0.36], [-0.36, -0.36], [0.36, -0.36]].map(([a, b]) => <Cy key={a + ':' + b} p={[a, b, 0.045]} rad={0.025} h={0.02} m={MAT.steel} r={[PI / 2, 0, 0]} />)}
          <Bx p={[0.25, 0, 0.05]} s={[0.04, 0.22, 0.03]} m={MAT.steel} />
          <Plate text="MAINT. ACCESS" p={[0, 0.58, 0.03]} w={0.6} />
        </group>
      ))}
      <Beacon p={[-25.5, 2.4, -5.5]} on={(g) => g.overloaded || g.surge !== null} />
      <Bx p={[-17.4, 3.0, 1.9]} s={[0.3, 0.04, 0.3]} m={MAT.darkSteel} />
      <Beacon p={[-17.4, 3.02, 1.9]} on={(g) => g.genState === 'starting' || g.overloaded} color={LED.amber} />
      <Plate text="BATTERY ACID / ARC FLASH" p={[-26.6, 2.6, -5.79]} w={1.0} kind="warn" />
      <TaskLight p={[-24, 3.93, -2]} s={[3, 0.04, 0.25]} warm />
    </>
  );
}

// =================================================================== science lab
function InstrumentRack({ x, z, rotY = 0, w = 2.4, title }: { x: number; z: number; rotY?: number; w?: number; title: string }) {
  const { units, leds, vents } = useMemo(() => {
    const units: Item[] = [], leds: Item[] = [], vents: Item[] = [];
    for (let i = 0; i < 8; i++) {
      const y = 0.4 + i * 0.24;
      units.push({ p: [0, y, 0.41], s: [w - 0.2, 0.2, 0.03], c: i % 3 ? '#3a4048' : '#4a515a' });
      leds.push({ p: [-w / 2 + 0.25, y, 0.43], s: [0.03, 0.03, 0.03] }, { p: [-w / 2 + 0.36, y, 0.43], s: [0.03, 0.03, 0.03] });
      if (i % 2) vents.push({ p: [0.15, y, 0.43], s: [w * 0.4, 0.08, 0.01], c: '#0e1013' });
    }
    return { units, leds, vents };
  }, [w]);
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <Bx p={[0, 1.2, 0]} s={[w, 2.4, 0.8]} m={MAT.paintGrey} />
      <Inst items={units} mat={MAT.white} />
      <Inst items={vents} mat={MAT.white} />
      <Inst items={leds} mat={LM.sci} geo={SPH} />
      <Plate text={title} p={[0, 2.25, 0.415]} w={1.2} />
      {[0.4, 1.0, 1.6].map((y) => <Bx key={y} p={[w / 2 - 0.2, y, 0.43]} s={[0.04, 0.12, 0.03]} m={MAT.steel} />)}
    </group>
  );
}
function SampleCabinet({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const cans = useMemo<Item[]>(() => Array.from({ length: 12 }, (_, i) => ({ p: [-0.75 + (i % 6) * 0.3, 1.45 + Math.floor(i / 6) * 0.38, 0.05] as V3, s: [0.09, 0.28, 0.09] as V3 })), []);
  const drawers = useMemo<Item[]>(() => Array.from({ length: 3 }, (_, i) => ({ p: [0, 0.2 + i * 0.3, 0.32] as V3, s: [1.85, 0.26, 0.03] as V3, c: '#4d545d' })), []);
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <Bx p={[0, 1.0, 0]} s={[2.0, 2.0, 0.7]} m={MAT.paintGrey} />
      <Inst items={drawers} mat={MAT.white} />
      <Inst items={cans} mat={CANISTER} geo={CYL} />
      <Bx p={[0, 1.65, 0.34]} s={[1.9, 0.9, 0.02]} m={MAT.glass} />
      <Plate text="SAMPLE STORAGE" p={[0, 2.08, 0.36]} w={1.0} />
      <Plate text="CRYO -80 C" p={[-0.6, 0.98, 0.34]} w={0.5} kind="warn" />
      <Led p={[0.85, 2.08, 0.36]} size={0.03} get={(g) => (g.powered.sci ? LED.green : LED.red)} />
    </group>
  );
}
function LabBench() {
  const vials = useMemo<Item[]>(() => Array.from({ length: 10 }, (_, i) => ({ p: [0, 1.0, -1.3 + i * 0.12] as V3, s: [0.025, 0.1, 0.025] as V3, c: i % 3 ? '#9fc8d8' : '#d8c27a' })), []);
  return (
    <group position={[17.75, 0, -3.7]} rotation={[0, PI / 2, 0]}>
      <Bx p={[0, 0.44, 0]} s={[3.0, 0.88, 1.0]} m={MAT.paintGrey} />
      <Bx p={[0, 0.9, 0.02]} s={[3.04, 0.05, 1.04]} m={MAT.black} />
      {[-1.0, 0, 1.0].map((cx) => <Bx key={cx} p={[cx, 0.42, 0.505]} s={[0.92, 0.7, 0.012]} m={MAT.paint} />)}
      {/* centrifuge */}
      <Cy p={[-1.0, 1.0, 0]} rad={0.26} h={0.2} m={MAT.paint} />
      <mesh geometry={SPH} material={MAT.paint} position={[-1.0, 1.1, 0]} scale={[0.26, 0.1, 0.26]} />
      <Led p={[-1.0, 0.98, 0.27]} size={0.025} get={(g) => (g.running.analyzer ? LED.green : LED.off)} />
      {/* microscope and sample jars on the shelf */}
      <Microscope />
      <SampleJars />
      {/* vial rack and glove box */}
      <Inst items={vials} mat={MAT.white} geo={CYL} />
      <Bx p={[1.0, 1.25, 0]} s={[0.9, 0.6, 0.7]} m={MAT.glass} />
      <Bx p={[1.0, 0.97, 0]} s={[0.92, 0.05, 0.72]} m={MAT.darkSteel} />
      <Bx p={[1.0, 1.58, 0]} s={[0.94, 0.05, 0.74]} m={MAT.darkSteel} />
      {/* shelf above the bench */}
      <Bx p={[0, 1.7, -0.35]} s={[3.0, 0.04, 0.3]} m={MAT.steel} />
      <Plate text="BENCH 01 - CHEMISTRY" p={[0, 1.88, -0.5]} w={1.0} />
    </group>
  );
}
function Freezers() {
  return (
    <group position={[17.85, 0, 4]} rotation={[0, PI / 2, 0]}>
      {[-0.8, 0.8].map((cx, i) => (
        <group key={cx} position={[cx, 0, 0]}>
          <Bx p={[0, 0.95, 0]} s={[1.3, 1.9, 1.0]} m={MAT.paint} />
          <Bx p={[0, 0.95, 0.505]} s={[1.2, 1.8, 0.01]} m={MAT.paintGrey} />
          <Bx p={[0.5, 0.95, 0.53]} s={[0.04, 0.5, 0.04]} m={MAT.steel} />
          <Bx p={[0, 1.65, 0.515]} s={[0.4, 0.12, 0.01]} m={MAT.black} />
          <Led p={[-0.4, 1.65, 0.525]} size={0.025} get={(g) => (g.powered.sci ? LED.green : LED.red)} />
          <Plate text={i ? 'FREEZER -80 C' : 'FRIDGE 4 C'} p={[0, 1.82, 0.515]} w={0.7} kind={i ? 'warn' : 'info'} />
        </group>
      ))}
    </group>
  );
}
const sciDraw: Draw = (c, W, H, g) => {
  screenFrame(c, W, H, 'SCIENCE DATA', g.powered.sci ? 'ONLINE' : 'NO POWER');
  const ids: ['spectrometer' | 'seismic' | 'analyzer' | 'camera', string][] = [['spectrometer', 'SPECTROMETER'], ['seismic', 'SEISMIC'], ['analyzer', 'SIGNAL ANALYZER'], ['camera', 'HI-RES CAMERA']];
  ids.forEach(([id, n], i) => {
    meter(c, 18, 80 + i * 44, W * 0.62, n + (g.running[id] ? '  RUNNING' : ''), g.data[id] / 100, g.running[id] ? SCR.green : SCR.cyan);
  });
  c.fillStyle = SCR.text; c.font = '16px monospace'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.fillText('SENT', W * 0.76, 100); c.font = 'bold 30px monospace'; c.fillText(g.transmitted.toFixed(0), W * 0.76, 136);
};
function ScienceDetail() {
  return (
    <>
      <InstrumentRack x={23.5} z={-5.4} title="RACK S1 - OPTICS" />
      <InstrumentRack x={29.35} z={-5.4} w={2.3} title="RACK S2 - DATA" />
      <SampleCabinet x={24} z={5.45} rotY={PI} />
      <LabBench />
      <Freezers />
      <LiveScreen p={[21, 2.5, 5.74]} rotY={PI} w={3} h={1.35} draw={sciDraw} />
      <Plate text="BIOHAZARD CLASS 1" p={[17.22, 2.2, -2.3]} rotY={PI / 2} w={0.8} kind="warn" />
      <Plate text="EYE WASH" p={[17.22, 1.5, 2.4]} rotY={PI / 2} w={0.4} kind="safe" />
      {[[21, -2], [27, -2], [21, 2], [27, 2]].map(([x, z]) => <TaskLight key={x + ':' + z} p={[x, 3.93, z]} s={[3.2, 0.04, 0.28]} />)}
    </>
  );
}

// =================================================================== communications
function RadioRack({ x, z, title }: { x: number; z: number; title: string }) {
  const { units, leds, knobs } = useMemo(() => {
    const units: Item[] = [], leds: Item[] = [], knobs: Item[] = [];
    for (let i = 0; i < 9; i++) {
      const y = 0.32 + i * 0.22;
      units.push({ p: [0, y, 0.46], s: [1.78, 0.19, 0.03], c: i % 2 ? '#30363d' : '#3f464e' });
      for (let k = 0; k < 4; k++) leds.push({ p: [-0.78 + k * 0.1, y + 0.04, 0.485], s: [0.022, 0.022, 0.022] });
      knobs.push({ p: [0.55, y, 0.49], s: [0.035, 0.03, 0.035] }, { p: [0.7, y, 0.49], s: [0.035, 0.03, 0.035] });
    }
    return { units, leds, knobs };
  }, []);
  return (
    <group position={[x, 0, z]} rotation={[0, x < 0 ? PI / 2 : -PI / 2, 0]}>
      <Bx p={[0, 1.2, 0]} s={[1.9, 2.4, 0.9]} m={MAT.paintDark} />
      <Inst items={units} mat={MAT.white} />
      <Inst items={leds} mat={LM.comms} geo={SPH} />
      <Inst items={knobs} mat={MAT.steel} geo={CYL} />
      <Plate text={title} p={[0, 2.3, 0.465]} w={1.1} />
      {/* cable loom up into the ceiling tray */}
      {[-0.5, -0.2, 0.2].map((cx, i) => <Run key={cx} a={[cx, 2.4, -0.1]} b={[cx + 0.1, 3.5, -0.1]} rad={0.045} m={i === 1 ? MAT.cableBlue : MAT.cable} />)}
    </group>
  );
}
const spectrumDraw: Draw = (c, W, H, g, t) => {
  screenFrame(c, W, H, 'SIGNAL MONITOR', g.antennaFault ? 'ANTENNA FAULT' : g.commsLinked ? 'LOCKED' : 'SEARCH');
  const base = H - 40, strength = g.powered.comms && !g.antennaFault ? g.commsStrength / 100 : 0.02;
  c.strokeStyle = g.commsLinked ? SCR.green : SCR.amber; c.lineWidth = 2; c.beginPath();
  for (let x = 12; x < W - 12; x += 3) {
    const f = (x - 12) / (W - 24);
    const noise = (Math.sin(x * 0.7 + t * 9) * 0.5 + Math.sin(x * 1.9 - t * 13) * 0.5) * (1 - strength * 0.7) * 0.12;
    const peak = Math.exp(-Math.pow((f - 0.5) / 0.05, 2)) * strength * 0.8;
    const y = base - (0.06 + Math.abs(noise) + peak) * (H - 90);
    x === 12 ? c.moveTo(x, y) : c.lineTo(x, y);
  }
  c.stroke();
  c.fillStyle = SCR.dim; c.font = '14px monospace'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText('8.2 GHz', 12, H - 12); c.textAlign = 'right'; c.fillText('S/N ' + (strength * 30).toFixed(0) + ' dB', W - 12, H - 12);
};
const linkDraw: Draw = (c, W, H, g, t) => {
  screenFrame(c, W, H, 'EARTH LINK', g.transmitting ? 'TRANSMITTING' : 'STANDBY');
  c.font = 'bold 26px monospace'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.fillStyle = g.antennaFault ? SCR.red : g.commsLinked ? SCR.green : SCR.amber;
  c.fillText(g.antennaFault ? 'FAULT' : g.commsLinked ? 'LINK LOCKED' : 'NO LOCK', 18, 90);
  meter(c, 18, 130, W - 36, 'SIGNAL ' + g.commsStrength.toFixed(0) + '%', g.commsStrength / 100, SCR.cyan);
  meter(c, 18, 180, W - 36, 'POINTING ERROR', Math.min(1, g.signalError / 60), g.signalError > 25 ? SCR.red : SCR.green);
  c.fillStyle = g.transmitting && blink(t, 3) ? SCR.amber : SCR.dim; c.font = '18px monospace'; c.fillText(g.transmitting ? 'DATA OUT >>>' : 'DATA OUT ---', 18, H - 26);
};
const aczDraw: Draw = (c, W, H, g) => {
  c.fillStyle = '#050c0b'; c.fillRect(0, 0, W, H);
  c.fillStyle = SCR.green; c.font = 'bold 54px monospace'; c.textBaseline = 'middle'; c.textAlign = 'left';
  c.fillText('AZ ' + g.antenna.az.toFixed(0).padStart(3, '0'), 20, H * 0.3);
  c.fillStyle = SCR.amber; c.fillText('EL ' + g.antenna.el.toFixed(0).padStart(3, '0'), 20, H * 0.75);
};
function CommsDetail() {
  return (
    <>
      <RadioRack x={-6.3} z={-21.5} title="RF-1 TRANSCEIVER" />
      <RadioRack x={-6.3} z={-24.5} title="RF-2 AMPLIFIER" />
      <RadioRack x={-6.3} z={-27.5} title="RF-3 MODEM" />
      <RadioRack x={6.3} z={-21.5} title="DSN LINK A" />
      <RadioRack x={6.3} z={-24.5} title="DSN LINK B" />
      <RadioRack x={6.3} z={-27.5} title="ENCODER / TLM" />
      <LiveScreen p={[-4.3, 2.3, -17.26]} rotY={PI} w={3} h={1.5} draw={spectrumDraw} />
      <LiveScreen p={[4.3, 2.3, -17.26]} rotY={PI} w={3} h={1.5} draw={linkDraw} />
      {/* antenna control unit on the west wall */}
      <group position={[-6.55, 0, -29.75]} rotation={[0, PI / 2, 0]}>
        <Bx p={[0, 1.25, 0]} s={[1.3, 1.5, 0.45]} m={MAT.paintGrey} />
        <Bx p={[0, 0.5, 0]} s={[1.2, 0.9, 0.4]} m={MAT.paintDark} />
        <LiveScreen p={[0, 1.65, 0.24]} w={0.95} h={0.5} draw={aczDraw} fps={4} />
        {[-0.4, 0, 0.4].map((cx) => <Cy key={cx} p={[cx, 1.1, 0.26]} rad={0.06} h={0.06} m={MAT.steel} r={[PI / 2, 0, 0]} />)}
        {[-0.4, 0, 0.4].map((cx) => <Bx key={'g' + cx} p={[cx, 0.85, 0.24]} s={[0.12, 0.12, 0.06]} m={MAT.cableRed} />)}
        <Plate text="ANTENNA CONTROL" p={[0, 2.08, 0.24]} w={1.0} />
        <Plate text="DRIVE ENABLE" p={[0, 0.7, 0.21]} w={0.6} kind="warn" />
        <Led p={[0.5, 1.45, 0.25]} size={0.03} get={(g, t) => (g.antennaFault ? (blink(t, 4) ? LED.red : LED.off) : g.powered.comms ? LED.green : LED.off)} />
      </group>
      {/* cable duct from the dish base to the racks, and an ON AIR sign */}
      <Bx p={[-4.9, 0.03, -25.5]} s={[2.4, 0.05, 0.3]} m={MAT.darkSteel} />
      <Bx p={[3, 3.3, -30.6]} s={[0.95, 0.32, 0.1]} m={MAT.comp} />
      <Plate text="ON AIR" p={[3, 3.3, -30.54]} w={0.7} kind="danger" />
      <Led p={[3.55, 3.3, -30.52]} size={0.04} get={(g, t) => (g.transmitting ? (blink(t, 2) ? LED.red : '#4a1410') : LED.off)} />
      <Plate text="RF HAZARD" p={[-2.25, 1.6, -17.21]} rotY={PI} w={0.45} kind="warn" />
      <TaskLight p={[0, 3.93, -20]} s={[3.4, 0.04, 0.25]} />
    </>
  );
}

// =================================================================== airlock
function EvaSuit() {
  return (
    <group>
      <Bx p={[0, 1.35, 0]} s={[0.5, 0.58, 0.28]} m={MAT.suit} />
      <Bx p={[0, 1.38, 0.15]} s={[0.3, 0.2, 0.05]} m={MAT.comp} />
      <mesh geometry={SPH} material={LM.power} position={[-0.08, 1.4, 0.18]} scale={0.014} />
      <mesh geometry={SPH} material={LM.amber} position={[0.0, 1.4, 0.18]} scale={0.014} />
      <Bx p={[0, 1.04, 0]} s={[0.46, 0.16, 0.26]} m={MAT.suit} />
      <Cy p={[-0.32, 1.28, 0.02]} rad={0.07} h={0.5} m={MAT.suit} r={[0, 0, 0.18]} />
      <Cy p={[0.32, 1.28, 0.02]} rad={0.07} h={0.5} m={MAT.suit} r={[0, 0, -0.18]} />
      <Cy p={[-0.12, 0.62, 0]} rad={0.1} h={0.78} m={MAT.suit} />
      <Cy p={[0.12, 0.62, 0]} rad={0.1} h={0.78} m={MAT.suit} />
      <Bx p={[-0.12, 0.14, 0.04]} s={[0.17, 0.14, 0.3]} m={MAT.darkSteel} />
      <Bx p={[0.12, 0.14, 0.04]} s={[0.17, 0.14, 0.3]} m={MAT.darkSteel} />
      <mesh geometry={SPH} material={MAT.suit} position={[0, 1.78, 0]} scale={0.19} />
      <mesh geometry={SPH} material={MAT.visor} position={[0, 1.78, 0.07]} scale={[0.15, 0.12, 0.13]} />
      <Bx p={[0, 1.38, -0.23]} s={[0.44, 0.62, 0.2]} m={MAT.paintGrey} />
      <Run a={[-0.15, 1.3, -0.12]} b={[-0.15, 1.15, 0.12]} rad={0.012} m={MAT.cable} />
      <Bx p={[0, 1.5, 0.15]} s={[0.5, 0.05, 0.05]} m={WEBBING} />
    </group>
  );
}
function SuitLocker({ x, z, n }: { x: number; z: number; n: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, PI, 0]}>
      <Bx p={[0, 1.1, -0.36]} s={[1.4, 2.2, 0.06]} m={MAT.paintDark} />
      <Bx p={[-0.7, 1.1, 0]} s={[0.06, 2.2, 0.8]} m={MAT.paintGrey} />
      <Bx p={[0.7, 1.1, 0]} s={[0.06, 2.2, 0.8]} m={MAT.paintGrey} />
      <Bx p={[0, 2.2, 0]} s={[1.46, 0.08, 0.8]} m={MAT.paintGrey} />
      <Bx p={[0, 0.04, 0]} s={[1.46, 0.08, 0.8]} m={MAT.black} />
      <group position={[0, 0.05, -0.05]}><EvaSuit /></group>
      <Bx p={[0.52, 1.1, 0.4]} s={[0.36, 2.0, 0.02]} m={MAT.glass} r={[0, -1.1, 0]} />
      <Plate text={'EVA SUIT 0' + n} p={[0, 2.12, 0.415]} w={0.8} kind="info" />
      <Led p={[-0.55, 2.12, 0.42]} size={0.03} get={(g) => (g.powered.life ? LED.green : LED.amber)} />
    </group>
  );
}
function OuterHatch() {
  return (
    <group position={[-25.5, 0, 12.78]} rotation={[0, PI, 0]}>
      <Bx p={[0, 1.55, 0.0]} s={[2.5, 3.1, 0.1]} m={MAT.paintDark} />
      <mesh geometry={TOR} material={MAT.darkSteel} position={[0, 1.45, 0.05]} scale={[1.15, 1.15, 2.4]} />
      <Cy p={[0, 1.45, 0.07]} rad={1.0} h={0.1} m={MAT.paintGrey} r={[PI / 2, 0, 0]} />
      <Cy p={[0, 1.45, 0.14]} rad={0.88} h={0.04} m={MAT.paint} r={[PI / 2, 0, 0]} />
      {/* locking dogs and hand wheel: they move when the player is inside the airlock */}
      <HatchHardware />
      {/* porthole */}
      <Cy p={[0, 1.95, 0.16]} rad={0.2} h={0.05} m={MAT.black} r={[PI / 2, 0, 0]} />
      <Cy p={[0, 1.95, 0.19]} rad={0.17} h={0.03} m={MAT.glass} r={[PI / 2, 0, 0]} />
      <mesh geometry={TOR} material={MAT.steel} position={[0, 1.95, 0.18]} scale={0.2} />
      {/* status lamps: sealed (red) / open (green) */}
      <Led p={[0.9, 2.7, 0.08]} size={0.05} get={() => LED.red} />
      <Led p={[1.05, 2.7, 0.08]} size={0.05} get={() => LED.off} />
      <Plate text="OUTER HATCH" p={[0, 3.0, 0.07]} w={1.1} kind="info" />
      <Plate text="DANGER - VACUUM BEYOND" p={[0, 0.5, 0.07]} w={1.4} kind="danger" />
      <HazardStripe p={[0, 0.2, 0.06]} w={2.4} h={0.2} />
      <HazardStripe p={[0, 2.9, 0.06]} w={2.4} h={0.14} />
    </group>
  );
}
const airlockDraw: Draw = (c, W, H, g, t) => {
  const life = g.powered.life;
  screenFrame(c, W, H, 'AIRLOCK', life ? 'ECLSS NOMINAL' : 'ECLSS OFFLINE');
  c.font = '17px monospace'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  const inside = Math.hypot(pose.x + 25.5, pose.z - 6) < 3.4;
  c.fillStyle = life ? SCR.text : blink(t, 2) ? SCR.red : SCR.dim;
  c.fillText('PRESSURE  ' + (life ? '101.3 kPa' : '-- kPa'), 16, 76);
  c.fillText('OXYGEN    ' + (life ? '20.9 %' : 'SUPPLY LOST'), 16, 102);
  c.fillStyle = SCR.dim; c.fillText('TEMP      21 C', 16, 128);
  c.fillStyle = inside ? SCR.amber : SCR.green; c.fillText('INNER DOOR ' + (inside ? 'OPEN' : 'SEALED'), 16, 160);
  c.fillStyle = SCR.green; c.fillText('OUTER HATCH SEALED', 16, 186);
};
function AirlockDetail() {
  const bottles = useMemo<Item[]>(() => [0, 1, 2].map((i) => ({ p: [-28.0, 0.55, 8.1 + i * 0.32] as V3, s: [0.1, 0.9, 0.1] as V3 })), []);
  const bands = useMemo<Item[]>(() => [0, 1, 2].map((i) => ({ p: [-28.0, 0.9, 8.1 + i * 0.32] as V3, s: [0.105, 0.12, 0.105] as V3 })), []);
  const collars = useMemo<Item[]>(() => Array.from({ length: 5 }, (_, i) => ({ p: [-28.2, 2.4, 7.2 + i * 1.1] as V3, s: [0.065, 0.06, 0.065] as V3 })), []);
  return (
    <>
      <OuterHatch />
      <SuitLocker x={-27.6} z={12.4} n={1} />
      <SuitLocker x={-23.4} z={12.4} n={2} />
      <LiveScreen p={[-22.76, 2.0, 9.2]} rotY={-PI / 2} w={1.9} h={1.05} draw={airlockDraw} fps={4} />
      <Plate text="PRESSURE / O2" p={[-22.74, 1.3, 9.2]} rotY={-PI / 2} w={0.7} />
      {/* oxygen bottles on the west wall, helmet shelf, oxygen line */}
      <Inst items={bottles} mat={MAT.steel} geo={CYL} />
      <Inst items={bands} mat={GREEN_BAND} geo={CYL} />
      <Bx p={[-28.1, 1.5, 9.4]} s={[0.35, 0.04, 2.0]} m={MAT.steel} />
      {[8.6, 9.4, 10.2].map((z) => (
        <group key={z}>
          <mesh geometry={SPH} material={MAT.suit} position={[-28.1, 1.66, z]} scale={0.13} />
          <mesh geometry={SPH} material={MAT.visor} position={[-27.99, 1.66, z]} scale={[0.07, 0.09, 0.1]} />
        </group>
      ))}
      <Plate text="HELMETS" p={[-28.28, 1.9, 9.4]} rotY={PI / 2} w={0.5} />
      <Plate text="O2 BOTTLES" p={[-28.28, 1.15, 8.4]} rotY={PI / 2} w={0.55} kind="safe" />
      <Run a={[-28.2, 2.4, 6.5]} b={[-28.2, 2.4, 12.5]} rad={0.045} m={MAT.pipeSteel} />
      <Inst items={collars} mat={GREEN_BAND} geo={CYL} />
      <Run a={[-22.82, 2.6, 6.4]} b={[-22.82, 2.6, 12.4]} rad={0.05} m={MAT.pipeBlue} />
      <Run a={[-22.82, 2.45, 6.4]} b={[-22.82, 2.45, 12.4]} rad={0.04} m={MAT.pipeSteel} />
      <Plate text="PRESSURE EQ." p={[-22.74, 2.75, 7.6]} rotY={-PI / 2} w={0.5} kind="warn" />
      {/* safety */}
      <Bx p={[-23.6, 2.66, 12.68]} s={[0.22, 0.05, 0.22]} m={MAT.darkSteel} />
      <Beacon p={[-23.6, 2.68, 12.68]} on={() => pose.z > 6.6 && pose.x > -28.5 && pose.x < -22.5} />
      <TaskLight p={[-25.5, 3.93, 9]} s={[2.4, 0.04, 0.28]} />
    </>
  );
}

// =================================================================== everything
export function InteriorExtras() {
  return (
    <>
      <Environment />
      <Gate cx={0} cz={0} r={11}><CommandDetail /></Gate>
      <Gate cx={-24} cz={0} r={13}><EngineeringDetail /></Gate>
      <Gate cx={24} cz={0} r={13}><ScienceDetail /></Gate>
      <Gate cx={0} cz={-24} r={13}><CommsDetail /></Gate>
      <Gate cx={-25.5} cz={9.5} r={9}><AirlockDetail /></Gate>
    </>
  );
}

// =================================================================== console detail (used by every console in Ship.tsx)
const ESTOP = new THREE.MeshStandardMaterial({ color: '#c0322a', roughness: 0.4, metalness: 0.2 });
export function ConsoleDetail({ w, title }: { w: number; title?: string }) {
  const { toggles, tips, leds1, leds2, leds3 } = useMemo(() => {
    const n = Math.max(3, Math.floor((w - 0.9) / 0.22));
    const toggles: Item[] = [], tips: Item[] = [];
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.55 + i * 0.22, up = (i * 5 + Math.round(w * 3)) % 3 !== 0;
      toggles.push({ p: [x, 1.09, 0.1], s: [0.014, 0.07, 0.014], c: '#9aa1a9' });
      tips.push({ p: [x, 1.09 + (up ? 0.04 : -0.01), 0.1], s: [0.024, 0.024, 0.024], c: up ? '#d9dde1' : '#80858c' });
    }
    const m = Math.max(3, Math.floor(w * 3));
    const row = (a: number, b: number) => Array.from({ length: Math.max(0, b - a) }, (_, i) => ({ p: [-w / 2 + 0.3 + (a + i) * 0.15, 1.075, -0.02] as V3, s: [0.02, 0.02, 0.02] as V3 }));
    const t = Math.floor(m / 3);
    return { toggles, tips, leds1: row(0, t), leds2: row(t, 2 * t), leds3: row(2 * t, m) };
  }, [w]);
  const third = (w - 0.3) / 3;
  return (
    <>
      <Bx p={[0, 1.05, 0.46]} s={[w, 0.035, 0.07]} m={MAT.rubber} />
      <Bx p={[-w / 2 - 0.01, 0.5, 0]} s={[0.04, 1.0, 1.02]} m={MAT.comp} />
      <Bx p={[w / 2 + 0.01, 0.5, 0]} s={[0.04, 1.0, 1.02]} m={MAT.comp} />
      {[-1, 0, 1].map((k) => (
        <group key={k}>
          <Bx p={[k * (third + 0.05), 0.42, 0.505]} s={[third - 0.05, 0.56, 0.012]} m={MAT.paintGrey} />
          <Bx p={[k * (third + 0.05) + third * 0.38, 0.42, 0.52]} s={[0.025, 0.18, 0.02]} m={MAT.steel} />
        </group>
      ))}
      {title && <Plate text={title} p={[0, 0.8, 0.51]} w={Math.min(1.6, w * 0.55)} />}
      {/* toggle switches, an emergency stop with its guard ring, and dials */}
      <Inst items={toggles} mat={MAT.white} geo={CYL} />
      <Inst items={tips} mat={MAT.white} geo={SPH} />
      <Cy p={[-w / 2 + 0.25, 1.07, 0.16]} rad={0.075} h={0.025} m={MAT.cableYellow} />
      <Cy p={[-w / 2 + 0.25, 1.1, 0.16]} rad={0.05} h={0.04} m={ESTOP} />
      {[0.35, 0.7].map((o) => (
        <group key={o} position={[w / 2 - o, 1.08, 0.12]}>
          <Cy p={[0, 0, 0]} rad={0.05} h={0.04} m={MAT.steel} />
          <Bx p={[0.0, 0.025, -0.02]} s={[0.012, 0.01, 0.04]} m={MAT.black} />
        </group>
      ))}
      <Inst items={leds1} mat={LM.power} geo={SPH} />
      <Inst items={leds2} mat={LM.comms} geo={SPH} />
      <Inst items={leds3} mat={LM.amber} geo={SPH} />
      {/* bezel around the tilted screen */}
      <group position={[0, 1.4, -0.2]} rotation={[-0.45, 0, 0]}>
        <Bx p={[0, 0.4, 0.005]} s={[w - 0.14, 0.05, 0.07]} m={MAT.comp} />
        <Bx p={[0, -0.4, 0.005]} s={[w - 0.14, 0.05, 0.07]} m={MAT.comp} />
        <Bx p={[-(w - 0.3) / 2 - 0.04, 0, 0.005]} s={[0.06, 0.8, 0.07]} m={MAT.comp} />
        <Bx p={[(w - 0.3) / 2 + 0.04, 0, 0.005]} s={[0.06, 0.8, 0.07]} m={MAT.comp} />
      </group>
    </>
  );
}
