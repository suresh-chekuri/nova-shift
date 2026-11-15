// Hero equipment for the interior: the generator, battery bank, science instruments,
// communications dish, console screens, and a few extra pieces of room equipment.
// These replace the plain shapes that used to live in Ship.tsx. Same positions, same
// footprints and the same sim-linked animation, only with real construction detail.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../../store';
import { pose } from '../../controls';
import type { GameState, InstrId } from '../../sim';
import { Bx, Cy, Run, Inst, MAT, CYL, SPH, TOR, Led, LED, Plate, LiveScreen, SCR, mmss, shown, type V3, type Item, type Draw } from './kit';
import { blobMap } from './pbr';

const PI = Math.PI;
const DEG = PI / 180;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const COPPER = new THREE.MeshStandardMaterial({ color: '#b87333', roughness: 0.35, metalness: 0.9 });
const DISH = new THREE.MeshStandardMaterial({ color: '#dfe4e9', roughness: 0.4, metalness: 0.55, side: THREE.DoubleSide });
const RED_PAINT = new THREE.MeshStandardMaterial({ color: '#8f2a22', roughness: 0.55, metalness: 0.3 });

let blobMat: THREE.MeshBasicMaterial | null = null;
/** Soft dark patch on the floor under big equipment. A cheap stand-in for ambient occlusion. */
export function ContactShadow({ p = [0, 0, 0], w, d }: { p?: V3; w: number; d: number }) {
  if (!blobMat) blobMat = new THREE.MeshBasicMaterial({ map: blobMap(), color: '#000000', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  return (
    <mesh position={[p[0], 0.016, p[2]]} rotation={[-PI / 2, 0, 0]} material={blobMat}>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}

function useInstr(id: InstrId) {
  const color = useMemo(() => new THREE.Color(), []);
  return (g: GameState) => {
    if (g.running[id]) return { on: true, c: color.set('#34d399') };
    if (g.instruments[id]) return { on: false, c: color.set('#ef4444') };
    return { on: false, c: color.set('#f59e0b').multiplyScalar(0.35) };
  };
}

/** Round dial with a needle driven by the simulation. Faces +Z. */
function Gauge({ p, r = 0.09, get }: { p: V3; r?: number; get: (g: GameState) => number }) {
  const needle = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (needle.current) needle.current.rotation.z = 2.1 - clamp01(get(useGame.getState())) * 4.2;
  });
  return (
    <group position={p}>
      <Cy p={[0, 0, 0]} rad={r + 0.02} h={0.03} m={MAT.steel} r={[PI / 2, 0, 0]} />
      <Cy p={[0, 0, 0.012]} rad={r} h={0.02} m={MAT.paint} r={[PI / 2, 0, 0]} />
      <group ref={needle} position={[0, 0, 0.026]}>
        <Bx p={[0, r * 0.4, 0]} s={[0.008, r * 0.8, 0.006]} m={MAT.cableRed} />
      </group>
      <mesh geometry={SPH} material={MAT.black} position={[0, 0, 0.03]} scale={0.012} />
    </group>
  );
}

// =================================================================== ENGINEERING: generator
export function Generator() {
  const core = useRef<THREE.MeshStandardMaterial>(null!);
  const rotor = useRef<THREE.Group>(null!);
  useFrame(({ clock }, dt) => {
    const g = useGame.getState();
    const t = clock.elapsedTime;
    const on = g.genState === 'online', st = g.genState === 'starting';
    const col = on ? '#38bdf8' : st ? '#fb923c' : '#ef4444';
    if (core.current) {
      core.current.color.set(col);
      core.current.emissive.set(col);
      core.current.emissiveIntensity = on ? 1.8 : st ? 1.2 + Math.sin(t * 22) * 0.9 : 0.5 + Math.sin(t * 3) * 0.3;
    }
    if (rotor.current) rotor.current.rotation.y += dt * (on ? 5 : st ? 2.5 : 0);
  });
  const anchors = useMemo<Item[]>(() => Array.from({ length: 12 }, (_, i) => ({ p: [Math.cos((i / 12) * PI * 2) * 1.42, 0.31, Math.sin((i / 12) * PI * 2) * 1.42] as V3, s: [0.05, 0.06, 0.05] as V3 })), []);
  const finsLow = useMemo<Item[]>(() => [0.62, 0.72, 0.82, 0.92, 1.02].map((y) => ({ p: [0, y, 0] as V3, s: [1.19, 0.035, 1.19] as V3 })), []);
  const finsHigh = useMemo<Item[]>(() => [1.98, 2.08, 2.18].map((y) => ({ p: [0, y, 0] as V3, s: [1.19, 0.035, 1.19] as V3 })), []);
  const capBolts = useMemo<Item[]>(() => Array.from({ length: 8 }, (_, i) => ({ p: [Math.cos((i / 8) * PI * 2) * 1.16, 2.67, Math.sin((i / 8) * PI * 2) * 1.16] as V3, s: [0.045, 0.05, 0.045] as V3 })), []);
  return (
    <group position={[-27, 0, -2.8]}>
      <ContactShadow w={4.8} d={4.8} />
      {/* plinth with anchor bolts */}
      <Cy p={[0, 0.09, 0]} rad={1.62} h={0.18} m={MAT.darkSteel} />
      <Cy p={[0, 0.24, 0]} rad={1.5} h={0.12} m={MAT.paintGrey} />
      <Inst items={anchors} mat={MAT.steel} geo={CYL} />
      {/* main housing with cooling fins and access panels */}
      <Cy p={[0, 1.4, 0]} rad={1.1} h={2.0} m={MAT.paintGrey} />
      <Inst items={finsLow} mat={MAT.darkSteel} geo={CYL} />
      <Inst items={finsHigh} mat={MAT.darkSteel} geo={CYL} />
      {[-2.1, -1.05, 1.05, 2.1, PI].map((a) => (
        <group key={a} rotation={[0, a, 0]}>
          <Bx p={[0, 1.4, 1.1]} s={[0.56, 0.62, 0.03]} m={MAT.paint} />
          <Bx p={[0.2, 1.4, 1.12]} s={[0.03, 0.2, 0.025]} m={MAT.steel} />
          {[[-0.23, 0.26], [0.23, 0.26], [-0.23, -0.26], [0.23, -0.26]].map(([x, y]) => <Cy key={x + ':' + y} p={[x, 1.4 + y, 1.125]} rad={0.018} h={0.015} m={MAT.steel} r={[PI / 2, 0, 0]} />)}
        </group>
      ))}
      <Cy p={[0, 1.3, 0]} rad={1.13} h={0.06} m={MAT.darkSteel} />
      <Cy p={[0, 1.7, 0]} rad={1.13} h={0.06} m={MAT.darkSteel} />
      {/* spinning rotor ring (shows the generator state) */}
      <group ref={rotor} position={[0, 1.5, 0]}>
        <mesh rotation={[PI / 2, 0, 0]}>
          <torusGeometry args={[1.18, 0.1, 10, 32]} />
          <meshStandardMaterial ref={core} color="#ef4444" emissive="#ef4444" emissiveIntensity={1} roughness={0.4} />
        </mesh>
        <Bx p={[1.18, 0, 0]} s={[0.2, 0.3, 0.2]} m={MAT.steel} />
        <Bx p={[-1.18, 0, 0]} s={[0.2, 0.3, 0.2]} m={MAT.steel} />
      </group>
      {/* top cap, dome, bolt ring and coolant manifold */}
      <Cy p={[0, 2.5, 0]} rad={1.25} h={0.3} m={MAT.darkSteel} />
      <mesh geometry={SPH} material={MAT.steel} position={[0, 2.62, 0]} scale={[0.92, 0.46, 0.92]} />
      <Inst items={capBolts} mat={MAT.steel} geo={CYL} />
      <mesh geometry={TOR} material={MAT.pipeBlue} position={[0, 2.7, 0]} rotation={[PI / 2, 0, 0]} scale={1.03} />
      <Run a={[0, 2.6, 1.6]} b={[0, 2.6, 1.0]} rad={0.1} m={MAT.pipeBlue} />
      <Cy p={[0, 2.6, 1.42]} rad={0.16} h={0.05} m={MAT.steel} r={[PI / 2, 0, 0]} />
      <Cy p={[0, 2.6, 1.3]} rad={0.15} h={0.05} m={MAT.steel} r={[PI / 2, 0, 0]} />
      {/* coolant lines down both sides */}
      <Run a={[1.1, 1.9, 0]} b={[1.4, 1.9, 0]} rad={0.06} m={MAT.pipeOrange} />
      <Run a={[1.4, 1.9, 0]} b={[1.4, 0.32, 0]} rad={0.06} m={MAT.pipeOrange} />
      <Run a={[-1.1, 0.9, 0]} b={[-1.4, 0.9, 0]} rad={0.06} m={MAT.pipeBlue} />
      <Run a={[-1.4, 0.9, 0]} b={[-1.4, 0.32, 0]} rad={0.06} m={MAT.pipeBlue} />
      {[1.9, 1.1, 0.5].map((y) => <Cy key={y} p={[1.4, y, 0]} rad={0.09} h={0.05} m={MAT.steel} />)}
      {/* front control panel: dials, state lamps, emergency stop */}
      <Bx p={[0, 0.82, 1.06]} s={[0.96, 0.66, 0.16]} m={MAT.paintDark} />
      <Bx p={[0, 0.82, 1.145]} s={[0.9, 0.6, 0.02]} m={MAT.paintGrey} />
      <Gauge p={[-0.25, 0.95, 1.16]} get={(g) => g.genOutput / 130} />
      <Gauge p={[0.25, 0.95, 1.16]} get={(g) => (g.genState === 'online' ? 0.55 + 0.1 * Math.sin(performance.now() / 700) : g.genState === 'starting' ? 0.3 : 0.02)} />
      <Led p={[-0.3, 0.7, 1.165]} size={0.03} get={(g) => (g.genState === 'online' ? LED.green : LED.off)} />
      <Led p={[-0.15, 0.7, 1.165]} size={0.03} get={(g) => (g.genState === 'starting' ? LED.amber : LED.off)} />
      <Led p={[0, 0.7, 1.165]} size={0.03} get={(g) => (g.overloaded || g.surge ? LED.red : LED.off)} />
      <Cy p={[0.3, 0.7, 1.17]} rad={0.045} h={0.035} m={MAT.cableYellow} r={[PI / 2, 0, 0]} />
      <Cy p={[0.3, 0.7, 1.19]} rad={0.032} h={0.04} m={RED_PAINT} r={[PI / 2, 0, 0]} />
      <Plate text="GENERATOR 1" p={[0, 1.18, 1.16]} w={0.6} />
      <Plate text="HIGH VOLTAGE" p={[0, 0.5, 1.16]} w={0.55} kind="danger" />
    </group>
  );
}

// =================================================================== ENGINEERING: battery modules
export function BatteryBank() {
  const fills = useRef<THREE.Group[]>([]);
  const fillMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: new THREE.Color('#22c55e'), emissiveIntensity: 1.4, roughness: 0.4 }), []);
  useFrame(() => {
    const g = useGame.getState();
    const lvl = (g.battery / 100) * 5;
    const c = g.battery < 20 ? '#ef4444' : '#22c55e';
    fillMat.color.set(c); fillMat.emissive.set(c);
    fills.current.forEach((grp, i) => { if (grp) grp.scale.y = Math.max(0.02, clamp01(lvl - i)); });
  });
  const fins = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (let i = 0; i < 5; i++) for (let k = 0; k < 7; k++) out.push({ p: [-2 + i, 0.3 + k * 0.17, 0.72], s: [0.66, 0.03, 0.04] });
    return out;
  }, []);
  return (
    <group position={[-27, 0, 3.2]}>
      <ContactShadow w={6} d={2.8} />
      <Bx p={[0, 0.07, 0]} s={[5.3, 0.14, 1.6]} m={MAT.darkSteel} />
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i} position={[-2 + i, 0, 0]}>
          <Bx p={[0, 0.85, 0]} s={[0.85, 1.4, 1.4]} m={MAT.paintDark} />
          <Bx p={[0, 1.58, 0]} s={[0.9, 0.06, 1.46]} m={MAT.steel} />
          {/* charge window on the north face: frame and a fill bar that follows the battery level */}
          <Bx p={[0, 0.85, -0.705]} s={[0.62, 1.2, 0.02]} m={MAT.black} />
          <group ref={(el) => { if (el) fills.current[i] = el; }} position={[0, 0.3, -0.725]}>
            <mesh position={[0, 0.5, 0]} material={fillMat}><boxGeometry args={[0.5, 1.0, 0.03]} /></mesh>
          </group>
          {[0.45, 0.8, 1.15].map((y) => <Bx key={y} p={[0, 0.3 + y * 0.9, -0.73]} s={[0.56, 0.012, 0.012]} m={MAT.white} />)}
          {/* terminals and busbar */}
          <Cy p={[-0.2, 1.65, 0.3]} rad={0.05} h={0.1} m={COPPER} />
          <Cy p={[0.2, 1.65, 0.3]} rad={0.05} h={0.1} m={COPPER} />
          <Cy p={[-0.2, 1.7, 0.3]} rad={0.025} h={0.04} m={MAT.black} />
          {i < 4 && <Run a={[0.2, 1.72, 0.3]} b={[0.8, 1.72, 0.3]} rad={0.03} m={COPPER} />}
          {/* handles, label, status lamp on the service (south) face */}
          <Bx p={[-0.27, 1.38, 0.73]} s={[0.08, 0.2, 0.05]} m={MAT.steel} />
          <Bx p={[0.27, 1.38, 0.73]} s={[0.08, 0.2, 0.05]} m={MAT.steel} />
          <Plate text={'CELL 0' + (i + 1)} p={[0, 1.38, 0.705]} w={0.4} />
          <Led p={[0, 0.2, 0.71]} size={0.03} get={(g) => (g.battery > [5, 25, 45, 65, 85][i] ? (g.sw.bj1 || g.sw.bj2 ? LED.green : LED.amber) : LED.off)} />
        </group>
      ))}
      <Inst items={fins} mat={MAT.darkSteel} />
      <Plate text="DC BUS 120 V" p={[0, 0.18, 0.82]} w={1.2} kind="warn" />
    </group>
  );
}

// =================================================================== SCIENCE: instruments
export function Spectrometer() {
  const head = useRef<THREE.Group>(null!);
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  const st = useInstr('spectrometer');
  useFrame(({ clock }, dt) => {
    const s = st(useGame.getState());
    if (head.current && s.on) head.current.rotation.y += dt * 0.9;
    if (mat.current) { mat.current.emissive.copy(s.c); mat.current.emissiveIntensity = s.on ? 1.6 : 1; }
    if (beam.current) beam.current.visible = s.on;
    void clock;
  });
  const fins = useMemo<Item[]>(() => Array.from({ length: 6 }, (_, k) => ({ p: [-0.2 + k * 0.08, 0.27, -0.1] as V3, s: [0.025, 0.09, 0.6] as V3 })), []);
  return (
    <group position={[21, 0, -3.8]}>
      <ContactShadow w={2.8} d={2.8} />
      <Cy p={[0, 0.07, 0]} rad={0.82} h={0.14} m={MAT.darkSteel} />
      <Cy p={[0, 0.55, 0]} rad={0.7} h={0.82} m={MAT.paintGrey} />
      <Cy p={[0, 0.38, 0]} rad={0.715} h={0.06} m={MAT.cableYellow} />
      <Cy p={[0, 0.97, 0]} rad={0.74} h={0.06} m={MAT.steel} />
      <Bx p={[0, 0.58, 0.7]} s={[0.5, 0.36, 0.03]} m={MAT.paintDark} />
      <Plate text="SPECTROMETER" p={[0, 0.7, 0.72]} w={0.45} />
      <Led p={[-0.15, 0.5, 0.72]} size={0.025} get={(g) => (g.running.spectrometer ? LED.green : g.powered.sci ? LED.amber : LED.off)} />
      <Led p={[0, 0.5, 0.72]} size={0.025} get={(g) => (g.powered.sci ? LED.green : LED.off)} />
      <Cy p={[0, 1.3, 0]} rad={0.12} h={0.65} m={MAT.steel} />
      <Cy p={[0, 1.58, 0]} rad={0.2} h={0.12} m={MAT.darkSteel} />
      <group ref={head} position={[0, 1.7, 0]}>
        <Bx p={[0, 0, 0]} s={[0.5, 0.45, 1.0]} m={MAT.paintDark} />
        <Bx p={[0, 0.25, 0]} s={[0.52, 0.04, 1.02]} m={MAT.steel} />
        <Inst items={fins} mat={MAT.steel} />
        <Cy p={[0, 0, 0.6]} rad={0.2} h={0.3} m={MAT.darkSteel} r={[PI / 2, 0, 0]} />
        <mesh geometry={TOR} material={MAT.steel} position={[0, 0, 0.5]} scale={0.21} />
        <mesh geometry={TOR} material={MAT.steel} position={[0, 0, 0.7]} scale={0.21} />
        <Cy p={[0, 0, 0.76]} rad={0.15} h={0.02} m={MAT.black} r={[PI / 2, 0, 0]} />
        <mesh position={[0, 0, 0.77]} rotation={[PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.015, 20]} />
          <meshStandardMaterial ref={mat} color="#111827" emissive="#f59e0b" emissiveIntensity={1} roughness={0.2} />
        </mesh>
        <Bx p={[0, 0.05, -0.55]} s={[0.3, 0.26, 0.2]} m={MAT.comp} />
        <mesh ref={beam} position={[0, -0.2, 1.5]} rotation={[PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 1.6, 6]} />
          <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={2} transparent opacity={0.6} />
        </mesh>
      </group>
    </group>
  );
}

export function SeismicSensor() {
  const rings = useRef<THREE.Mesh[]>([]);
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const st = useInstr('seismic');
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = st(useGame.getState());
    rings.current.forEach((m, i) => {
      if (!m) return;
      const k = s.on ? 1 + 0.12 * Math.sin(t * 7 - i * 1.2) : 1;
      m.scale.set(k, k, 1);
    });
    if (mat.current) { mat.current.emissive.copy(s.c); mat.current.emissiveIntensity = s.on ? 1.8 : 1; }
  });
  const bolts = useMemo<Item[]>(() => Array.from({ length: 8 }, (_, i) => ({ p: [Math.cos((i / 8) * PI * 2) * 0.78, 0.115, Math.sin((i / 8) * PI * 2) * 0.78] as V3, s: [0.04, 0.03, 0.04] as V3 })), []);
  return (
    <group position={[26.5, 0, -3.8]}>
      <ContactShadow w={2.6} d={2.6} />
      <Cy p={[0, 0.05, 0]} rad={0.9} h={0.1} m={MAT.darkSteel} />
      <Inst items={bolts} mat={MAT.steel} geo={CYL} />
      {[0, 1, 2].map((i) => (
        <mesh key={'f' + i} material={MAT.steel} position={[Math.cos(i * 2.094) * 0.6, 0.27, Math.sin(i * 2.094) * 0.6]} rotation={[PI, 0, 0]}>
          <coneGeometry args={[0.08, 0.35, 8]} />
        </mesh>
      ))}
      <Cy p={[0, 0.7, 0]} rad={0.3} h={1.1} m={MAT.paintGrey} />
      {[0.3, 0.7, 1.1].map((y) => <Cy key={y} p={[0, y, 0]} rad={0.325} h={0.05} m={MAT.darkSteel} />)}
      <Plate text="SEISMIC" p={[0, 0.5, 0.32]} w={0.34} />
      <mesh position={[0, 1.35, 0]}>
        <sphereGeometry args={[0.22, 16, 14]} />
        <meshStandardMaterial ref={mat} color="#111827" emissive="#f59e0b" emissiveIntensity={1} roughness={0.25} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => { if (el) rings.current[i] = el; }} material={MAT.steel} position={[0, 0.5 + i * 0.3, 0]} rotation={[PI / 2, 0, 0]}>
          <torusGeometry args={[0.42 + i * 0.04, 0.025, 8, 28]} />
        </mesh>
      ))}
      <Run a={[0.3, 0.35, 0]} b={[0.85, 0.04, 0.4]} rad={0.03} m={MAT.cable} />
      <Run a={[0.28, 0.5, 0.1]} b={[0.8, 0.04, 0.55]} rad={0.025} m={MAT.cableBlue} />
    </group>
  );
}

export function SignalAnalyzer() {
  const ring = useRef<THREE.Mesh>(null!);
  const ring2 = useRef<THREE.Mesh>(null!);
  const core = useRef<THREE.MeshStandardMaterial>(null!);
  const st = useInstr('analyzer');
  useFrame(({ clock }, dt) => {
    const s = st(useGame.getState());
    if (s.on) {
      if (ring.current) ring.current.rotation.x += dt * 1.8;
      if (ring2.current) ring2.current.rotation.z += dt * 1.2;
    }
    if (core.current) { core.current.emissive.copy(s.c); core.current.emissiveIntensity = s.on ? 1.6 + Math.sin(clock.elapsedTime * 8) * 0.6 : 1; }
  });
  return (
    <group position={[26.5, 0, 3.8]}>
      <ContactShadow w={3} d={3} />
      <Cy p={[0, 0.4, 0]} rad={1.0} h={0.8} m={MAT.paintGrey} />
      <Cy p={[0, 0.24, 0]} rad={1.02} h={0.07} m={MAT.pipeBlue} />
      <Cy p={[0, 0.82, 0]} rad={0.95} h={0.06} m={MAT.steel} />
      <Bx p={[0, 0.5, 0.98]} s={[0.55, 0.34, 0.03]} m={MAT.paintDark} />
      <Plate text="ANALYZER" p={[0, 0.6, 1.0]} w={0.42} />
      <Led p={[-0.12, 0.42, 1.0]} size={0.025} get={(g) => (g.running.analyzer ? LED.green : g.powered.sci ? LED.amber : LED.off)} />
      <Cy p={[0, 1.1, 0]} rad={0.15} h={0.6} m={MAT.steel} />
      <mesh ref={ring} material={MAT.steel} position={[0, 1.7, 0]}><torusGeometry args={[0.7, 0.05, 10, 36]} /></mesh>
      <mesh ref={ring2} material={MAT.pipeSteel} position={[0, 1.7, 0]} rotation={[PI / 2, 0, 0]}><torusGeometry args={[0.55, 0.04, 10, 36]} /></mesh>
      <mesh position={[0, 1.7, 0]}>
        <sphereGeometry args={[0.22, 18, 16]} />
        <meshStandardMaterial ref={core} color="#111827" emissive="#f59e0b" emissiveIntensity={1} roughness={0.25} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = i * 2.094 + 0.5;
        return (
          <group key={i}>
            <mesh material={DISH} position={[Math.cos(a) * 0.7, 0.95, Math.sin(a) * 0.7]} rotation={[-0.9, -a + PI / 2, 0]}>
              <sphereGeometry args={[0.25, 14, 8, 0, PI * 2, 0, PI / 2.4]} />
            </mesh>
            <Run a={[Math.cos(a) * 0.7, 0.85, Math.sin(a) * 0.7]} b={[Math.cos(a) * 0.16, 1.15, Math.sin(a) * 0.16]} rad={0.02} m={MAT.darkSteel} />
          </group>
        );
      })}
    </group>
  );
}

export function HiResCamera() {
  const head = useRef<THREE.Group>(null!);
  const lens = useRef<THREE.MeshStandardMaterial>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const g = useGame.getState();
    const on = g.running.camera;
    if (head.current) head.current.rotation.y = PI * 1.5 + (on ? Math.sin(clock.elapsedTime * 0.8) * 0.5 : 0);
    if (lens.current) {
      const c = on ? '#60a5fa' : g.instruments.camera ? '#ef4444' : '#f59e0b';
      lens.current.emissive.set(c);
      lens.current.emissiveIntensity = on ? 2 : 0.7;
    }
    if (beam.current) beam.current.visible = on && Math.sin(clock.elapsedTime * 12) > -0.3;
  });
  return (
    <group position={[29.4, 0, 0]}>
      <ContactShadow w={2.2} d={2.2} />
      <Cy p={[0, 0.05, 0]} rad={0.62} h={0.1} m={MAT.darkSteel} />
      <Cy p={[0, 0.5, 0]} rad={0.52} h={0.8} m={MAT.paintGrey} />
      <Cy p={[0, 0.9, 0]} rad={0.55} h={0.06} m={MAT.steel} />
      <Bx p={[0, 0.45, 0.5]} s={[0.4, 0.3, 0.03]} m={MAT.paintDark} />
      <Plate text="HI-RES CAM" p={[0, 0.55, 0.52]} w={0.36} />
      {[0, 1, 2].map((i) => (
        <Run key={i} a={[Math.cos(i * 2.094) * 0.3, 0.95, Math.sin(i * 2.094) * 0.3]} b={[Math.cos(i * 2.094) * 0.12, 1.6, Math.sin(i * 2.094) * 0.12]} rad={0.028} m={MAT.pipeSteel} />
      ))}
      <Cy p={[0, 1.58, 0]} rad={0.14} h={0.1} m={MAT.darkSteel} />
      <group ref={head} position={[0, 1.78, 0]}>
        <Bx p={[0, 0, 0]} s={[0.5, 0.4, 0.7]} m={MAT.paintDark} />
        <Bx p={[0, 0.23, -0.05]} s={[0.12, 0.08, 0.4]} m={MAT.steel} />
        <Bx p={[0.27, 0, 0]} s={[0.04, 0.3, 0.5]} m={MAT.darkSteel} />
        <Bx p={[-0.27, 0, 0]} s={[0.04, 0.3, 0.5]} m={MAT.darkSteel} />
        <Cy p={[0, 0, 0.52]} rad={0.19} h={0.4} m={MAT.comp} r={[PI / 2, 0, 0]} />
        <mesh geometry={TOR} material={MAT.steel} position={[0, 0, 0.4]} scale={0.2} />
        <mesh geometry={TOR} material={MAT.steel} position={[0, 0, 0.58]} scale={0.2} />
        <Cy p={[0, 0, 0.74]} rad={0.24} h={0.14} m={MAT.black} r={[PI / 2, 0, 0]} />
        <mesh position={[0, 0, 0.745]} rotation={[PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.02, 20]} />
          <meshStandardMaterial ref={lens} color="#0f172a" emissive="#f59e0b" emissiveIntensity={0.7} roughness={0.15} />
        </mesh>
        <Bx p={[0, -0.1, -0.4]} s={[0.3, 0.18, 0.1]} m={MAT.comp} />
        <mesh ref={beam} position={[0, 0, 1.6]} rotation={[PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 1.8, 6]} />
          <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={3} transparent opacity={0.7} />
        </mesh>
      </group>
    </group>
  );
}

// =================================================================== COMMUNICATIONS: dish
export function Dish() {
  const yaw = useRef<THREE.Group>(null!);
  const tilt = useRef<THREE.Group>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  const az = useRef(0), el = useRef(45);
  useFrame(({ clock }, dt) => {
    const g = useGame.getState();
    const k = Math.min(1, dt * 4);
    az.current += (g.antenna.az - az.current) * k;
    el.current += (g.antenna.el - el.current) * k;
    const shake = g.antennaFault ? Math.sin(clock.elapsedTime * 30) * 0.05 : 0;
    if (yaw.current) yaw.current.rotation.y = PI - az.current * DEG + shake;
    if (tilt.current) tilt.current.rotation.x = (90 - el.current) * DEG;
    if (beam.current) {
      beam.current.visible = g.commsLinked;
      (beam.current.material as THREE.MeshStandardMaterial).emissiveIntensity = g.transmitting ? 2.5 + Math.sin(clock.elapsedTime * 14) : 1.2;
    }
  });
  const strutAngles = [0, 2.094, 4.189];
  return (
    <group position={[-3.5, 0, -25.5]}>
      <ContactShadow w={3.4} d={3.4} />
      {/* pedestal with status lights */}
      <Cy p={[0, 0.06, 0]} rad={1.0} h={0.12} m={MAT.darkSteel} />
      <Cy p={[0, 0.5, 0]} rad={0.85} h={0.76} m={MAT.paintGrey} />
      <Cy p={[0, 0.92, 0]} rad={0.9} h={0.08} m={MAT.steel} />
      <Cy p={[0, 1.0, 0]} rad={0.55} h={0.12} m={MAT.darkSteel} />
      <Bx p={[0, 0.5, 0.83]} s={[0.34, 0.5, 0.04]} m={MAT.paintDark} />
      <Led p={[0, 0.65, 0.86]} size={0.035} get={(g) => (g.commsLinked ? LED.green : LED.off)} />
      <Led p={[0, 0.52, 0.86]} size={0.035} get={(g) => (g.powered.comms && !g.commsLinked ? LED.amber : LED.off)} />
      <Led p={[0, 0.39, 0.86]} size={0.035} get={(g, t) => (g.antennaFault ? ((t * 4) % 1 < 0.5 ? LED.red : LED.off) : LED.off)} />
      <Plate text="ANT STATUS" p={[0, 0.78, 0.86]} w={0.32} />
      <group ref={yaw} position={[0, 1.6, 0]}>
        {/* azimuth platform and elevation yoke */}
        <Cy p={[0, -0.5, 0]} rad={0.5} h={0.14} m={MAT.paintGrey} />
        <Bx p={[0.95, -0.2, 0]} s={[0.1, 0.7, 0.24]} m={MAT.darkSteel} />
        <Bx p={[-0.95, -0.2, 0]} s={[0.1, 0.7, 0.24]} m={MAT.darkSteel} />
        <Bx p={[0, -0.52, 0]} s={[2.0, 0.08, 0.2]} m={MAT.darkSteel} />
        <Cy p={[0.95, 0, 0]} rad={0.1} h={0.16} m={MAT.steel} r={[0, 0, PI / 2]} />
        <Cy p={[-0.95, 0, 0]} rad={0.1} h={0.16} m={MAT.steel} r={[0, 0, PI / 2]} />
        <group ref={tilt}>
          <mesh material={DISH}>
            <sphereGeometry args={[1.0, 40, 14, 0, PI * 2, (PI * 2) / 3, PI / 3]} />
          </mesh>
          <mesh material={MAT.steel} position={[0, -0.5, 0]} rotation={[PI / 2, 0, 0]}><torusGeometry args={[0.866, 0.025, 8, 56]} /></mesh>
          <mesh material={MAT.pipeSteel} position={[0, -0.795, 0]} rotation={[PI / 2, 0, 0]}><torusGeometry args={[0.6, 0.008, 6, 40]} /></mesh>
          <mesh material={MAT.pipeSteel} position={[0, -0.95, 0]} rotation={[PI / 2, 0, 0]}><torusGeometry args={[0.3, 0.008, 6, 32]} /></mesh>
          <Cy p={[0, -0.98, 0]} rad={0.14} h={0.1} m={MAT.darkSteel} />
          <Run a={[0.9, 0, 0]} b={[0.8, -0.5, 0.3]} rad={0.03} m={MAT.darkSteel} />
          <Run a={[-0.9, 0, 0]} b={[-0.8, -0.5, 0.3]} rad={0.03} m={MAT.darkSteel} />
          {strutAngles.map((a) => <Run key={a} a={[Math.cos(a) * 0.82, -0.5, Math.sin(a) * 0.82]} b={[0, 1.1, 0]} rad={0.016} m={MAT.pipeSteel} />)}
          <Cy p={[0, 1.14, 0]} rad={0.07} h={0.14} m={MAT.darkSteel} />
          <mesh position={[0, 1.24, 0]}><sphereGeometry args={[0.07, 12, 12]} /><meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.5} /></mesh>
          <mesh ref={beam} position={[0, 2.4, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 2.4, 8]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.2} transparent opacity={0.45} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// =================================================================== console screens (animated)
/** The tilted screen of a console: a small canvas that scrolls data. Only redraws when the player is within 16 m. */
export function ConsoleScreen({ w, color, x, z }: { w: number; color: string; x: number; z: number }) {
  const sw = w - 0.3;
  const { canvas, tex, mat } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 384; c.height = Math.max(48, Math.round((384 * 0.75) / sw));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshStandardMaterial({ color: '#000000', emissive: new THREE.Color('#ffffff'), emissiveMap: t, emissiveIntensity: 0.95, roughness: 0.25, metalness: 0.1 });
    return { canvas: c, tex: t, mat: m };
  }, [sw]);
  const me = useRef<THREE.Group>(null!);
  const acc = useRef(10);
  useFrame(({ clock }, dt) => {
    if (!shown(me.current)) return;
    if (Math.hypot(pose.x - x, pose.z - z) > 16) return;
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    const c = canvas.getContext('2d');
    if (!c) return;
    const g = useGame.getState();
    const t = clock.elapsedTime, W = canvas.width, Hh = canvas.height;
    c.fillStyle = '#04100f'; c.fillRect(0, 0, W, Hh);
    c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 24) { c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, Hh); c.stroke(); }
    for (let gy = 0; gy < Hh; gy += 24) { c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke(); }
    // two scrolling traces
    c.lineWidth = 2;
    c.strokeStyle = color; c.beginPath();
    for (let px = 0; px < W; px += 4) {
      const yy = Hh * 0.38 + Math.sin(px * 0.04 + t * 2.2 + x) * Hh * 0.18 + Math.sin(px * 0.11 - t * 3.1) * Hh * 0.05;
      px === 0 ? c.moveTo(px, yy) : c.lineTo(px, yy);
    }
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.beginPath();
    for (let px = 0; px < W; px += 4) {
      const yy = Hh * 0.72 + Math.sin(px * 0.07 - t * 1.4 + z) * Hh * 0.1;
      px === 0 ? c.moveTo(px, yy) : c.lineTo(px, yy);
    }
    c.stroke();
    c.fillStyle = color; c.font = 'bold 15px monospace'; c.textBaseline = 'top';
    c.fillText('BATT ' + g.battery.toFixed(0).padStart(3) + '%   LINK ' + g.commsStrength.toFixed(0).padStart(3) + '%', 8, 6);
    c.fillStyle = Math.floor(t * 2) % 2 ? color : 'rgba(0,0,0,0)'; c.fillRect(W - 18, 8, 9, 13);
    tex.needsUpdate = true;
  });
  return (
    <group ref={me} position={[0, 1.4, -0.2]} rotation={[-0.45, 0, 0]}>
      <mesh position={[0, 0, 0.034]} material={mat}><planeGeometry args={[sw, 0.75]} /></mesh>
    </group>
  );
}

// =================================================================== COMMAND: central mission display
const centralDraw: Draw = (c, W, Hh, g, t) => {
  c.fillStyle = '#050c0b'; c.fillRect(0, 0, W, Hh);
  c.fillStyle = SCR.text; c.font = 'bold 20px monospace'; c.textBaseline = 'middle'; c.textAlign = 'left';
  c.fillText('MISSION', 14, Hh * 0.3);
  c.fillStyle = SCR.dim; c.font = '14px monospace'; c.fillText(g.phase.toUpperCase(), 14, Hh * 0.7);
  // objectives
  g.objectives.forEach((done, i) => {
    c.fillStyle = done ? SCR.green : '#16302b'; c.fillRect(120 + i * 34, Hh * 0.2, 26, Hh * 0.6);
    c.strokeStyle = SCR.line; c.strokeRect(120 + i * 34, Hh * 0.2, 26, Hh * 0.6);
  });
  c.fillStyle = g.timeLeft < 120 && Math.floor(t * 2) % 2 ? SCR.red : SCR.text;
  c.font = 'bold 40px monospace'; c.textAlign = 'center'; c.fillText(mmss(g.timeLeft), W * 0.55, Hh * 0.5);
  // system chips
  const chips: [string, boolean][] = [['LIFE', g.powered.life], ['COMM', g.powered.comms], ['SCI', g.powered.sci], ['ENG', g.powered.eng]];
  c.font = 'bold 14px monospace';
  chips.forEach(([n, on], i) => {
    const x0 = W * 0.7 + i * 62;
    c.fillStyle = on ? '#12351f' : '#3a1511'; c.fillRect(x0, Hh * 0.2, 56, Hh * 0.28);
    c.fillStyle = on ? SCR.green : SCR.red; c.fillText(n, x0 + 28, Hh * 0.34);
  });
  c.fillStyle = '#12201d'; c.fillRect(W * 0.7, Hh * 0.6, 242, 12);
  c.fillStyle = g.battery > 25 ? SCR.green : SCR.red; c.fillRect(W * 0.7, Hh * 0.6, 242 * clamp01(g.battery / 100), 12);
  c.textAlign = 'left';
};
export function CentralDisplay() {
  return (
    <group>
      <LiveScreen p={[0, 3.38, 2.55]} rotY={PI} w={4.6} h={0.62} draw={centralDraw} fps={4} />
      {[-2.1, 2.1].map((x) => <Bx key={x} p={[x, 3.84, 2.55]} s={[0.05, 0.34, 0.05]} m={MAT.steel} />)}
      {[-2.1, 2.1].map((x) => <Bx key={'b' + x} p={[x, 3.68, 2.55]} s={[0.12, 0.04, 0.12]} m={MAT.darkSteel} />)}
    </group>
  );
}

// =================================================================== SCIENCE: microscope and sample jars (placed inside the lab bench group)
export function Microscope() {
  return (
    <group position={[0.2, 0.925, 0.05]}>
      <Bx p={[0, 0.02, 0]} s={[0.3, 0.04, 0.34]} m={MAT.darkSteel} />
      <Bx p={[0, 0.2, -0.12]} s={[0.05, 0.36, 0.06]} m={MAT.paintDark} r={[-0.1, 0, 0]} />
      <Bx p={[0, 0.13, 0.0]} s={[0.2, 0.02, 0.18]} m={MAT.steel} />
      <Bx p={[0, 0.145, 0.0]} s={[0.07, 0.006, 0.025]} m={MAT.glass} />
      <Cy p={[0, 0.34, -0.03]} rad={0.035} h={0.3} m={MAT.paintDark} r={[0.25, 0, 0]} />
      <Cy p={[0, 0.5, -0.09]} rad={0.022} h={0.1} m={MAT.black} r={[0.25, 0, 0]} />
      <Cy p={[0, 0.2, 0.0]} rad={0.05} h={0.03} m={MAT.steel} />
      {[-0.025, 0, 0.025].map((x) => <Cy key={x} p={[x, 0.17, 0.01]} rad={0.012} h={0.05} m={MAT.steel} />)}
      <Cy p={[0.08, 0.1, -0.1]} rad={0.02} h={0.03} m={MAT.steel} r={[0, 0, PI / 2]} />
      <Led p={[-0.1, 0.045, 0.14]} size={0.015} get={(g) => (g.powered.sci ? LED.green : LED.off)} />
    </group>
  );
}
export function SampleJars() {
  const { jars, caps } = useMemo(() => {
    const colors = ['#9fc8d8', '#d8c27a', '#a9d49a', '#d99a8f', '#c3b6e0'];
    const jars: Item[] = [], caps: Item[] = [];
    for (let i = 0; i < 12; i++) {
      const x = -1.3 + i * 0.22;
      jars.push({ p: [x, 1.8, -0.35], s: [0.06, 0.16, 0.06], c: colors[i % colors.length] });
      caps.push({ p: [x, 1.9, -0.35], s: [0.065, 0.035, 0.065], c: '#2a2f36' });
    }
    return { jars, caps };
  }, []);
  return (
    <>
      <Inst items={jars} mat={MAT.glass} geo={CYL} />
      <Inst items={caps} mat={MAT.white} geo={CYL} />
    </>
  );
}

// =================================================================== ENGINEERING: coolant pump and maintenance cart
export function CoolantPump() {
  const spin = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    if (!shown(spin.current)) return;
    if (spin.current) spin.current.rotation.z += dt * (useGame.getState().powered.eng ? 14 : 0);
  });
  return (
    <group position={[-30.15, 0, -1.5]}>
      <ContactShadow w={2.0} d={2.4} />
      <Bx p={[0, 0.06, 0]} s={[0.85, 0.12, 1.5]} m={MAT.darkSteel} />
      {/* motor, coupling guard, pump casing */}
      <Cy p={[0, 0.45, -0.4]} rad={0.26} h={0.7} m={MAT.paintGrey} r={[PI / 2, 0, 0]} />
      {[-0.6, -0.5, -0.4, -0.3, -0.2].map((z) => <mesh key={z} geometry={TOR} material={MAT.darkSteel} position={[0, 0.45, z]} scale={0.27} />)}
      <Bx p={[0, 0.78, -0.4]} s={[0.2, 0.1, 0.3]} m={MAT.comp} />
      <Cy p={[0, 0.45, 0.07]} rad={0.14} h={0.24} m={MAT.glass} r={[PI / 2, 0, 0]} />
      <group ref={spin} position={[0, 0.45, 0.07]}>
        <Bx p={[0, 0, 0]} s={[0.22, 0.03, 0.03]} m={MAT.cableYellow} />
        <Bx p={[0, 0, 0]} s={[0.03, 0.22, 0.03]} m={MAT.cableYellow} />
      </group>
      <Cy p={[0, 0.45, 0.5]} rad={0.3} h={0.24} m={MAT.paintGrey} r={[0, 0, PI / 2]} />
      <mesh geometry={SPH} material={MAT.paintGrey} position={[0, 0.45, 0.5]} scale={0.32} />
      {[0, 1, 2, 3, 4, 5].map((k) => <Cy key={k} p={[Math.cos(k * 1.047) * 0.23, 0.45 + Math.sin(k * 1.047) * 0.23, 0.63]} rad={0.02} h={0.03} m={MAT.steel} r={[PI / 2, 0, 0]} />)}
      <Run a={[0, 0.7, 0.5]} b={[0, 3.35, 0.55]} rad={0.07} m={MAT.pipeBlue} />
      <Run a={[0, 3.35, 0.55]} b={[0.35, 3.35, -3.4]} rad={0.07} m={MAT.pipeBlue} />
      {[1.2, 2.2].map((y) => <Cy key={y} p={[0, y, 0.52]} rad={0.1} h={0.05} m={MAT.steel} />)}
      <Run a={[0, 0.3, 0.8]} b={[0, 0.1, 0.5]} rad={0.04} m={MAT.cable} />
      <Plate text="COOLANT PUMP" p={[0.43, 0.4, 0.1]} rotY={PI / 2} w={0.6} />
      <Led p={[0.0, 0.84, -0.55]} size={0.03} get={(g) => (g.powered.eng ? LED.green : LED.red)} />
    </group>
  );
}
export function ToolCart() {
  return (
    <group position={[-29.9, 0, 5.0]} rotation={[0, PI, 0]}>
      <ContactShadow w={1.8} d={1.4} />
      <Bx p={[0, 0.56, 0]} s={[1.0, 0.78, 0.6]} m={RED_PAINT} />
      <Bx p={[0, 0.97, 0]} s={[1.04, 0.04, 0.64]} m={MAT.darkSteel} />
      {[0, 1, 2, 3].map((k) => (
        <group key={k}>
          <Bx p={[0, 0.3 + k * 0.18, 0.305]} s={[0.9, 0.15, 0.012]} m={MAT.paintDark} />
          <Bx p={[0, 0.3 + k * 0.18, 0.325]} s={[0.5, 0.02, 0.02]} m={MAT.steel} />
        </group>
      ))}
      {[[-0.42, -0.24], [0.42, -0.24], [-0.42, 0.24], [0.42, 0.24]].map(([x, z]) => <Cy key={x + ':' + z} p={[x, 0.08, z]} rad={0.07} h={0.05} m={MAT.rubber} r={[0, 0, PI / 2]} />)}
      <Bx p={[0.5, 0.98, -0.05]} s={[0.03, 0.4, 0.5]} m={MAT.steel} />
      {/* tools on top: wrench, drill, canister */}
      <Bx p={[-0.3, 1.0, 0.1]} s={[0.4, 0.015, 0.04]} m={MAT.steel} r={[0, 0.3, 0]} />
      <Bx p={[0.05, 1.04, 0.0]} s={[0.22, 0.09, 0.07]} m={MAT.cableYellow} />
      <Cy p={[0.3, 1.1, 0.1]} rad={0.06} h={0.2} m={MAT.paint} />
      <Plate text="MAINTENANCE" p={[0, 0.9, 0.31]} w={0.5} kind="warn" />
    </group>
  );
}

// =================================================================== AIRLOCK: outer hatch hardware that moves
/** Hand wheel and eight locking dogs. When the player is in the airlock, the wheel turns and the dogs pull back. */
export function HatchHardware() {
  const wheel = useRef<THREE.Group>(null!);
  const dogs = useRef<THREE.Group[]>([]);
  const e = useRef(0);
  useFrame((_, dt) => {
    if (!shown(wheel.current)) return;
    const near = pose.z > 6.6 && pose.z < 13 && pose.x > -28.5 && pose.x < -22.5;
    e.current += ((near ? 1 : 0) - e.current) * Math.min(1, dt * 1.6);
    if (wheel.current) wheel.current.rotation.z = -e.current * PI * 2;
    dogs.current.forEach((g, k) => {
      if (!g) return;
      const a = (k * PI) / 4 + PI / 8, r = 0.95 - e.current * 0.14;
      g.position.set(Math.cos(a) * r, 1.45 + Math.sin(a) * r, 0.15);
    });
  });
  return (
    <>
      {Array.from({ length: 8 }, (_, k) => (
        <group key={k} ref={(el) => { if (el) dogs.current[k] = el; }} rotation={[0, 0, (k * PI) / 4 + PI / 8]} position={[Math.cos((k * PI) / 4 + PI / 8) * 0.95, 1.45 + Math.sin((k * PI) / 4 + PI / 8) * 0.95, 0.15]}>
          <Bx p={[0, 0, 0]} s={[0.2, 0.07, 0.06]} m={MAT.steel} />
          <Bx p={[-0.08, 0, -0.03]} s={[0.05, 0.1, 0.03]} m={MAT.darkSteel} />
        </group>
      ))}
      <group ref={wheel} position={[0, 1.3, 0.22]}>
        <mesh geometry={TOR} material={MAT.steel} scale={0.3} />
        <Bx p={[0, 0, 0]} s={[0.6, 0.04, 0.04]} m={MAT.steel} />
        <Bx p={[0, 0, 0]} s={[0.04, 0.6, 0.04]} m={MAT.steel} />
        <Cy p={[0, 0, -0.02]} rad={0.07} h={0.1} m={MAT.darkSteel} r={[PI / 2, 0, 0]} />
        <Cy p={[0.3, 0, 0.03]} rad={0.02} h={0.08} m={MAT.rubber} r={[PI / 2, 0, 0]} />
      </group>
    </>
  );
}
