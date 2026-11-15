import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { DeepSpace } from './deepspace';
import { WindowMoon } from './space';
import * as THREE from 'three';
import { useGame, useSettings, useUI } from '../store';
import { isEmergency, nextGoal, type GameState, type InstrId } from '../sim';
import { Instrument } from './ShipModel';
import { InteriorExtras, ConsoleDetail } from './interior/Rooms';
import { WindowEarth, WindowHorizon } from './space';
import { DOOR_LIST, spansAround } from './interior/spots';
import { Shell, lampMat, accentMat } from './interior/Shell';
import { Generator, BatteryBank, Spectrometer, SeismicSensor, SignalAnalyzer, HiResCamera, Dish, ConsoleScreen, ContactShadow, CentralDisplay, CoolantPump, ToolCart } from './interior/Hero';
import { EnvRig } from './EnvRig';
import { MAT, Inst, Gate, type Item, type V3 } from './interior/kit';
import { H, INTERACTABLES } from './layout';

const DEG = Math.PI / 180;
const lerp = THREE.MathUtils.lerp;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function Trim({ r, color }: { r: { x0: number; x1: number; z0: number; z1: number }; color: string }) {
  const m = <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />;
  // floor trim runs along the walls but stops at every doorway
  const holesOn = (alongX: boolean, fixed: number): [number, number][] =>
    DOOR_LIST.filter((d) => d.alongX === alongX && Math.abs((alongX ? d.z : d.x) - fixed) < 0.6).map((d) => { const c = alongX ? d.x : d.z; return [c - d.w / 2 - 0.1, c + d.w / 2 + 0.1] as [number, number]; });
  const strips: ReactNode[] = [];
  const add = (alongX: boolean, fixed: number, lo: number, hi: number, wall: number, key: string) => {
    spansAround(lo, hi, holesOn(alongX, wall)).forEach(([a, b], i) => {
      const len = b - a, mid = (a + b) / 2;
      strips.push(<mesh key={key + i} position={alongX ? [mid, 0.04, fixed] : [fixed, 0.04, mid]}><boxGeometry args={alongX ? [len, 0.05, 0.06] : [0.06, 0.05, len]} />{m}</mesh>);
    });
  };
  add(true, r.z0 + 0.25, r.x0 + 0.25, r.x1 - 0.25, r.z0, 'n');
  add(true, r.z1 - 0.25, r.x0 + 0.25, r.x1 - 0.25, r.z1, 's');
  add(false, r.x0 + 0.25, r.z0 + 0.25, r.z1 - 0.25, r.x0, 'w');
  add(false, r.x1 - 0.25, r.z0 + 0.25, r.z1 - 0.25, r.x1, 'e');
  return <group>{strips}</group>;
}

// ---------- Pipes and conduits ----------
function Pipe({ a, b, r = 0.07, color, glow }: { a: [number, number, number]; b: [number, number, number]; r?: number; color: string; glow?: (g: GameState) => number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const l = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return { pos: va.clone().add(vb).multiplyScalar(0.5), quat: q, len: l };
  }, [a, b]);
  useFrame(() => {
    if (!glow || !mat.current) return;
    mat.current.emissiveIntensity = 0.15 + glow(useGame.getState()) * 1.6;
  });
  return (
    <mesh position={pos} quaternion={quat}>
      <cylinderGeometry args={[r, r, len, 10]} />
      <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.3} roughness={0.5} metalness={0.4} />
    </mesh>
  );
}

// Pipe runs stop short of every door, so nothing crosses a doorway or the sliding door leaves.
const X_RUNS: [number, number][] = [[-30.4, -17.6], [-16.4, -7.6], [-6.4, 6.4], [7.6, 16.4], [17.6, 30.4]];
const Z_RUNS: [number, number][] = [[-30.4, -17.6], [-16.4, -6.6]];
function Conduits() {
  const y = 3.65;
  const xRun = (z: number, color: string, glow?: (g: GameState) => number) =>
    X_RUNS.map(([x0, x1]) => <Pipe key={color + z + x0} a={[x0, y, z]} b={[x1, y, z]} color={color} glow={glow} />);
  const zRun = (x: number, color: string, glow?: (g: GameState) => number) =>
    Z_RUNS.map(([z0, z1]) => <Pipe key={color + x + z0} a={[x, y, z0]} b={[x, y, z1]} color={color} glow={glow} />);
  return (
    <>
      {xRun(-1.2, '#38bdf8', (g) => (g.j1 || g.j2 ? 1 : 0))}
      {xRun(-0.85, '#facc15', (g) => (g.powered.eng ? 1 : 0))}
      {xRun(-0.5, '#ef4444', (g) => (g.overloaded || g.surge ? 1 : 0))}
      {xRun(-0.15, '#22c55e', (g) => (g.powered.life ? 1 : 0))}
      {zRun(-1.15, '#38bdf8', (g) => (g.powered.comms ? 1 : 0))}
      {zRun(-0.8, '#a78bfa', (g) => (g.commsLinked ? 1 : 0))}
      {zRun(-0.45, '#facc15')}
      {/* vertical drops into engineering equipment */}
      <Pipe a={[-27, y, -1.2]} b={[-27, 2.6, -1.2]} color="#38bdf8" r={0.1} glow={(g) => (g.genState === 'online' ? 1 : 0)} />
      <Pipe a={[-22, y, -1.2]} b={[-22, 2.2, -5.4]} color="#38bdf8" r={0.06} glow={(g) => (g.j1 || g.j2 ? 1 : 0)} />
    </>
  );
}

// ---------- Generic console ----------
function Lamp({ pos, size = 0.07, get }: { pos: [number, number, number]; size?: number; get: (g: GameState, t: number) => string }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    const c = get(useGame.getState(), clock.elapsedTime);
    mat.current.emissive.set(c);
    mat.current.color.set(c);
  });
  return (
    <mesh position={pos}>
      <sphereGeometry args={[size, 10, 10]} />
      <meshStandardMaterial ref={mat} color="#3d434b" emissive="#3d434b" emissiveIntensity={2} />
    </mesh>
  );
}

const KEYS = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#3a3a3a'), emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.2 });
const KEY_COLORS = ['#c9951c', '#8fb7c9', '#8fbf6a'];

function Console({ x, z, rotY = 0, w = 3, color = '#38bdf8', title, children }: { x: number; z: number; rotY?: number; w?: number; color?: string; title?: string; children?: ReactNode }) {
  const n = Math.max(3, Math.floor(w * 2.5));
  const keys = useMemo<Item[]>(() => Array.from({ length: n }, (_, i) => ({ p: [(i - (n - 1) / 2) * 0.28, 1.07, 0.3] as V3, s: [0.14, 0.05, 0.1] as V3, c: KEY_COLORS[i % 3] })), [n]);
  // x and z are world positions: the screen skips redrawing when the player is far away
  const rx = x, rz = z;
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <ContactShadow p={[0, 0, 0.1]} w={w + 1} d={2.2} />
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow material={MAT.paintGrey}>
        <boxGeometry args={[w, 1, 1]} />
      </mesh>
      <mesh position={[0, 1.02, 0.2]} material={MAT.comp}>
        <boxGeometry args={[w - 0.2, 0.06, 0.5]} />
      </mesh>
      <mesh position={[0, 1.4, -0.2]} rotation={[-0.45, 0, 0]} material={MAT.black}>
        <boxGeometry args={[w - 0.3, 0.75, 0.06]} />
      </mesh>
      <ConsoleScreen w={w} color={color} x={rx} z={rz} />
      <Inst items={keys} mat={KEYS} />
      <ConsoleDetail w={w} title={title} />
      {children}
    </group>
  );
}

function Bar({ x, color, get }: { x: number; color: string; get: (g: GameState) => number }) {
  const grp = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (grp.current) grp.current.scale.y = Math.max(0.02, clamp01(get(useGame.getState())));
  });
  return (
    <group ref={grp} position={[x, 1.08, 0.15]}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

// ---------- Command deck ----------
function CommandProps() {
  return (
    <>
      <Console x={0} z={4.2} rotY={Math.PI} w={5} color="#38bdf8" title="MISSION COMMAND" />
      <NavHologram />
      <CentralDisplay />
      <Console x={-5} z={4.5} rotY={Math.PI} w={2.6} color="#a78bfa" title="SHIP STATUS">
        <Bar x={-0.9} color="#facc15" get={(g) => (g.genOutput ? g.demand / g.genOutput : 0)} />
        <Bar x={-0.45} color="#22c55e" get={(g) => g.battery / 100} />
        <Bar x={0} color="#38bdf8" get={(g) => (g.data.spectrometer + g.data.seismic + g.data.analyzer) / 100} />
        <Bar x={0.45} color="#a78bfa" get={(g) => g.commsStrength / 100} />
        <Bar x={0.9} color="#f472b6" get={(g) => g.integrity / 100} />
      </Console>
      <Console x={5} z={4.5} rotY={Math.PI} w={2.6} color="#34d399" title="COMM STATUS">
        <Lamp pos={[0, 1.2, 0.3]} size={0.12} get={(g, t) => (g.commsLinked ? '#22c55e' : g.powered.comms ? (Math.sin(t * 6) > 0 ? '#f59e0b' : '#7c4a03') : '#ef4444')} />
      </Console>
      {/* Mission objective wall display (west wall) */}
      <group position={[-6.72, 2, -3]} rotation={[0, Math.PI / 2, 0]}>
        <mesh><boxGeometry args={[3.2, 1.5, 0.1]} /><meshStandardMaterial color="#0c1214" metalness={0.5} roughness={0.5} /></mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Lamp key={i} pos={[-1.25 + i * 0.5, 0.35, 0.08]} size={0.12} get={(g) => (g.objectives[i] ? '#22c55e' : '#3d434b')} />
        ))}
        <TimerBar />
      </group>
    </>
  );
}

function TimerBar() {
  const m = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(() => {
    const g = useGame.getState();
    const f = clamp01(g.timeLeft / 600);
    if (m.current) { m.current.scale.x = Math.max(0.01, f); m.current.position.x = -1.4 + 1.4 * f; }
    if (mat.current) { const c = f < 0.2 ? '#ef4444' : '#38bdf8'; mat.current.color.set(c); mat.current.emissive.set(c); }
  });
  return (
    <mesh ref={m} position={[0, -0.3, 0.08]}>
      <boxGeometry args={[2.8, 0.18, 0.04]} />
      <meshStandardMaterial ref={mat} color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.6} />
    </mesh>
  );
}

// ---------- Engineering ----------
const SW_LAMPS: [string, number][] = [['gj1', 0], ['gj2', 1], ['bj1', 2], ['bj2', 3], ['life', 4], ['comms', 5], ['sci', 6], ['eng', 7]];

function EngineeringProps() {
  return (
    <>
      <Generator />
      <BatteryBank />
      <EngineeringExtras />
      <Gate cx={-27} cz={0} r={12}><CoolantPump /><ToolCart /></Gate>
      <Console x={-22} z={-5.3} rotY={0} w={4} color="#facc15" title="POWER DISTRIBUTION">
        {SW_LAMPS.map(([id, i]) => (
          <Lamp key={id} pos={[-1.4 + i * 0.4, 1.12, 0.32]} size={0.06} get={(g) => (g.sw[id as keyof typeof g.sw] ? '#22d3ee' : '#3d434b')} />
        ))}
        <Lamp pos={[1.8, 1.2, 0.3]} size={0.1} get={(g, t) => (g.surge || g.overloaded ? (Math.sin(t * 10) > 0 ? '#ef4444' : '#450a0a') : '#22c55e')} />
      </Console>
      <Console x={-21} z={5.3} rotY={Math.PI} w={3} color="#fb923c" title="ENGINE CONTROL">
        <Lamp pos={[1.2, 1.2, 0.3]} size={0.1} get={(g) => (g.powered.eng ? '#22c55e' : '#ef4444')} />
      </Console>
    </>
  );
}

// ---------- Science lab ----------
function Installed({ id, x, z, children }: { id: string; x: number; z: number; children: ReactNode }) {
  const grp = useRef<THREE.Group>(null!);
  const pad = useRef<THREE.Group>(null!);
  useFrame(() => {
    const ok = !!useGame.getState().stats.installed[id as keyof GameState['stats']['installed']];
    if (grp.current) grp.current.visible = ok;
    if (pad.current) pad.current.visible = !ok;
  });
  return (
    <>
      <group ref={grp}>{children}</group>
      <group ref={pad} position={[x, 0.02, z]} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.55, 0.7, 28]} /><meshBasicMaterial color="#ef4444" /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.55, 28]} /><meshStandardMaterial color="#22272d" /></mesh>
      </group>
    </>
  );
}

// A floating animated bar display (holographic style)
function HoloBarsDisplay({ pos, rotY = 0, count = 10, color = '#38bdf8', get }: { pos: [number, number, number]; rotY?: number; count?: number; color?: string; get: (g: GameState, t: number, i: number) => number }) {
  const bars = useRef<THREE.Mesh[]>([]);
  useFrame(({ clock }) => {
    const g = useGame.getState();
    bars.current.forEach((m, i) => { if (m) { const v = Math.max(0.04, Math.min(1, get(g, clock.elapsedTime, i))); m.scale.y = v; m.position.y = v * 0.3; } });
  });
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.3, -0.02]}><planeGeometry args={[count * 0.13 + 0.1, 0.7]} /><meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} ref={(el) => { if (el) bars.current[i] = el; }} position={[(i - (count - 1) / 2) * 0.13, 0.1, 0]}>
          <boxGeometry args={[0.08, 0.6, 0.02]} /><meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function NavHologram() {
  const globe = useRef<THREE.Group>(null!);
  const dot = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (globe.current) globe.current.rotation.y = t * 0.3;
    if (dot.current) dot.current.position.set(Math.cos(t * 0.8) * 0.75, Math.sin(t * 0.4) * 0.15, Math.sin(t * 0.8) * 0.75);
  });
  return (
    <group position={[0, 2.15, 3.55]}>
      <mesh position={[0, -0.9, 0]}><cylinderGeometry args={[0.55, 0.12, 0.8, 16, 1, true]} /><meshBasicMaterial color="#38bdf8" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <group ref={globe}>
        <mesh><sphereGeometry args={[0.38, 16, 12]} /><meshBasicMaterial color="#7dd3fc" wireframe transparent opacity={0.55} /></mesh>
      </group>
      <mesh rotation={[Math.PI / 2 + 0.2, 0, 0]}><torusGeometry args={[0.75, 0.008, 6, 64]} /><meshBasicMaterial color="#22d3ee" /></mesh>
      <mesh ref={dot}><sphereGeometry args={[0.04, 8, 8]} /><meshBasicMaterial color="#fbbf24" /></mesh>
    </group>
  );
}

function SciHologram() {
  const ico = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    const g = useGame.getState();
    if (ico.current) { ico.current.rotation.y = clock.elapsedTime * 0.6; ico.current.rotation.x = clock.elapsedTime * 0.3; }
    if (mat.current) mat.current.color.set(g.running.analyzer ? '#34d399' : g.powered.sci ? '#fbbf24' : '#475569');
  });
  return (
    <mesh ref={ico} position={[21, 2.05, 4.55]}>
      <icosahedronGeometry args={[0.4, 1]} />
      <meshBasicMaterial ref={mat} wireframe transparent opacity={0.7} />
    </mesh>
  );
}

function EngineeringExtras() {
  return (
    <>
      {/* coolant tank in the corner */}
      <group position={[-29.8, 0, -4.9]}>
        <mesh position={[0, 1.4, 0]} castShadow><cylinderGeometry args={[0.6, 0.6, 2.8, 20]} /><meshStandardMaterial color="#475569" metalness={0.8} roughness={0.35} /></mesh>
        {[0.5, 1.4, 2.3].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.62, 0.04, 6, 20]} /><meshStandardMaterial color="#facc15" metalness={0.5} /></mesh>)}
      </group>
      {/* glowing floor cables: battery -> generator -> power panel */}
      <Pipe a={[-27, 0.07, 2.2]} b={[-27, 0.07, -1.3]} r={0.06} color="#38bdf8" glow={(g) => (g.battery > 0 && (g.sw.bj1 || g.sw.bj2) ? 1 : 0.1)} />
      <Pipe a={[-27, 0.07, -1.3]} b={[-22, 0.07, -4.7]} r={0.06} color="#38bdf8" glow={(g) => (g.j1 || g.j2 ? 1 : 0.1)} />
      <Pipe a={[-25.7, 0.07, -2.8]} b={[-22, 0.07, -4.7]} r={0.05} color="#facc15" glow={(g) => (g.genState === 'online' ? 1 : 0.1)} />
    </>
  );
}

function ScienceExtras() {
  return (
    <>
      <SciHologram />
      {(['spectrometer', 'seismic', 'analyzer', 'camera'] as InstrId[]).map((id, i) => {
        const x = [21, 26.5, 26.5, 29.4][i], z = [-3.8, -3.8, 3.8, 0][i];
        return (
          <HoloBarsDisplay key={id} pos={[x, 2.75, z]} rotY={0} count={7} color={['#f59e0b', '#fb923c', '#34d399', '#60a5fa'][i]}
            get={(g, t, k) => (g.running[id] ? 0.35 + 0.35 * Math.sin(t * 5 + k * 1.3) + 0.2 * Math.sin(t * 9 + k) : 0)} />
        );
      })}
    </>
  );
}

function CommsExtras() {
  return (
    <>
      {/* wall display: live signal spectrum */}
      <group position={[-2.4, 2.1, -30.72]}>
        <mesh><boxGeometry args={[4.2, 1.5, 0.08]} /><meshStandardMaterial color="#0c1214" metalness={0.5} roughness={0.5} /></mesh>
        <HoloBarsDisplay pos={[0, -0.3, 0.06]} count={26} color="#a78bfa"
          get={(g, t, k) => (g.powered.comms && !g.antennaFault ? (0.2 + 0.15 * Math.sin(k * 1.7 + t * 9)) * (1 - g.commsStrength / 130) + Math.exp(-Math.pow((k - 13) / 3, 2)) * (g.commsStrength / 100) : 0.03)} />
      </group>
    </>
  );
}

function ScienceProps() {
  return (
    <>
      <Installed id="spectrometer" x={21} z={-3.8}><Spectrometer /></Installed>
      <Installed id="seismic" x={26.5} z={-3.8}><SeismicSensor /></Installed>
      <Installed id="analyzer" x={26.5} z={3.8}><SignalAnalyzer /></Installed>
      <Installed id="camera" x={29.4} z={0}><HiResCamera /></Installed>
      <ScienceExtras />
      <Console x={21} z={5.3} rotY={Math.PI} w={3} color="#34d399" title="SCIENCE DATA">
        <Lamp pos={[1.2, 1.2, 0.3]} size={0.1} get={(g) => (g.powered.sci ? '#22c55e' : '#ef4444')} />
      </Console>
    </>
  );
}

function CommsProps() {
  return (
    <>
      <Dish />
      <CommsExtras />
      <Console x={3} z={-30.2} rotY={0} w={3.6} color="#a78bfa" title="ANTENNA CONTROL">
        <Lamp pos={[1.5, 1.2, 0.3]} size={0.1} get={(g, t) => (g.antennaFault ? (Math.sin(t * 10) > 0 ? '#ef4444' : '#450a0a') : g.commsLinked ? '#22c55e' : g.powered.comms ? '#f59e0b' : '#3d434b')} />
      </Console>
    </>
  );
}

// ---------- Lights ----------
const LIGHT_POS: [number, number, number][] = [
  [-25.5, 3.3, 9.5], [0, 3.3, 0], [-24, 3.3, 0], [24, 3.3, 0], [0, 3.3, -24], [0, 3.3, -11.5],
];

function RoomSpot({ p, shadows }: { p: [number, number, number]; shadows: boolean }) {
  const light = useRef<THREE.SpotLight>(null!);
  const target = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    target.position.set(p[0], 0, p[2]);
    if (light.current) light.current.target = target;
  }, [target, p]);
  return (
    <>
      <spotLight ref={light} position={p} angle={1.25} penumbra={0.8} intensity={shadows ? 60 : 0} distance={26} decay={2} color="#dbeafe" castShadow={shadows} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0006} />
      <primitive object={target} />
    </>
  );
}

// One tint per room light, so each room has its own mood (all stay close to white).
const LIGHT_TINT = ['#ffe9c8', '#e4efff', '#fff0dc', '#e6fff4', '#ece6ff', '#eaf0f7'];

function Lights() {
  const amb = useRef<THREE.AmbientLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const pts = useRef<THREE.PointLight[]>([]);
  const flash = useRef<THREE.PointLight>(null!);
  const mix = useRef(1);
  const shadows = useSettings((s) => s.shadows);
  const quality = useSettings((s) => s.quality);
  const withEnv = quality !== 'low'; // reflections add light, so the flat fill light is lower
  const tints = useMemo(() => LIGHT_TINT.map((c) => new THREE.Color(c)), []);
  const cur = useMemo(() => new THREE.Color(), []);
  const cLamp = useMemo(() => new THREE.Color(), []);
  const cNormal = useMemo(() => new THREE.Color('#eaf0f7'), []);
  const cEmer = useMemo(() => new THREE.Color('#ff4a1c'), []);   // warm emergency light
  const cBlue = useMemo(() => new THREE.Color('#4aa3ff'), []);
  const cAmber = useMemo(() => new THREE.Color('#ff8a3c'), []);
  useFrame(({ clock, camera }, dt) => {
    const g = useGame.getState();
    const em = g.phase === 'won' ? false : g.phase === 'lost' ? true : isEmergency(g);
    mix.current += ((em ? 1 : 0) - mix.current) * Math.min(1, dt * 3);
    const m = mix.current;
    const t = clock.elapsedTime;
    const pulse = 0.65 + 0.35 * Math.sin(t * 4.5);
    cur.copy(cNormal).lerp(cEmer, m);
    const boost = g.elapsed - g.flashAt < 1.5 ? 1.4 : 1;
    pts.current.forEach((p, i) => {
      if (!p) return;
      p.color.copy(tints[i % tints.length]).lerp(cEmer, m);
      p.intensity = lerp(80, 55 * pulse, m) * boost;
    });
    if (amb.current) amb.current.intensity = lerp(withEnv ? 0.85 : 1.2, 0.55, m);
    if (hemi.current) hemi.current.intensity = lerp(withEnv ? 0.6 : 0.9, 0.35, m);
    cLamp.copy(cNormal).lerp(cEmer, m);
    lampMat.emissive.copy(cLamp);
    lampMat.emissiveIntensity = lerp(2.2, 0.5 + 1.3 * pulse, m);
    accentMat.emissive.copy(cBlue).lerp(cAmber, m);
    accentMat.emissiveIntensity = lerp(1.0, 0.7 + 0.5 * pulse, m);
    if (flash.current) flash.current.position.copy(camera.position);
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.6} color="#b4bdca" />
      <hemisphereLight ref={hemi} args={['#cfd8e6', '#2f333a', 0.6]} />
      {LIGHT_POS.map((p, i) => (
        <pointLight key={i} ref={(el) => { if (el) pts.current[i] = el; }} position={p} distance={26} decay={2} intensity={60} color={LIGHT_TINT[i]} />
      ))}
      <pointLight ref={flash} intensity={9} distance={9} decay={2} color="#e0f2fe" />
      {/* shadow lights only exist when Shadows is ON (unused lights still cost speed) */}
      {shadows && [[0, 3.9, 0], [-24, 3.9, 0], [24, 3.9, 0], [0, 3.9, -24]].map((p, i) => (
        <RoomSpot key={'sp' + i} p={p as [number, number, number]} shadows={shadows} />
      ))}
    </>
  );
}

// ---------- Outside ----------
function Outside() {
  // sun is low in the east. These are the directions from each planet to the sun (used to paint the light on them).
  const moonSun = useMemo(() => ({ dir: [270, 14, -75] as [number, number, number], rotY: Math.PI / 2 }), []);
  const earthSun = useMemo(() => ({ dir: [270, 8, 140] as [number, number, number], rotY: 0 }), []);
  return (
    <>
      <DeepSpace />
      <WindowMoon radius={30} position={[0, 8, 95]} sun={moonSun} />
      {/* a nearby piece of lunar horizon below the Command Deck window */}
      <WindowHorizon radius={160} position={[0, -150, 60]} />
      {/* the Sun: low in the east, seen through the Science Lab window. Hard white, no atmosphere. */}
      <mesh position={[270, 22, 20]} renderOrder={-50}><sphereGeometry args={[9, 24, 16]} /><meshBasicMaterial color="#fffaf0" /></mesh>
      <mesh position={[270, 22, 20]}><sphereGeometry args={[16, 24, 16]} /><meshBasicMaterial color="#ffe9b8" transparent opacity={0.16} depthWrite={false} /></mesh>
      <WindowEarth radius={14} position={[0, 14, -120]} sun={earthSun} />
    </>
  );
}

// ---------- Floating marker above the current goal ----------
function Marker() {
  const g3 = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const g = useGame.getState();
    const ui = useUI.getState();
    if (!g3.current) return;
    if (g.phase !== 'playing' || ui.panel) { g3.current.visible = false; return; }
    const goal = { target: ui.markerTarget !== undefined ? ui.markerTarget : nextGoal(g).target };
    const it = INTERACTABLES.find((i) => i.id === goal.target);
    if (!it) { g3.current.visible = false; return; }
    g3.current.visible = true;
    g3.current.position.set(it.x, 2.9 + Math.sin(clock.elapsedTime * 2.5) * 0.12, it.z);
    g3.current.rotation.y = clock.elapsedTime * 1.5;
  });
  return (
    <group ref={g3}>
      <mesh><octahedronGeometry args={[0.2, 0]} /><meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2.2} /></mesh>
    </group>
  );
}

// ---------- Whole ship ----------
export function Ship() {
  return (
    <group>
      <Lights />
      <EnvRig intensity={0.5} />
      <Outside />
      <Shell />
      <Trim r={{ x0: -7, x1: 7, z0: -6, z1: 6 }} color="#5aa7c7" />
      <Trim r={{ x0: -31, x1: -17, z0: -6, z1: 6 }} color="#c98a3d" />
      <Trim r={{ x0: 17, x1: 31, z0: -6, z1: 6 }} color="#5fae8c" />
      <Trim r={{ x0: -7, x1: 7, z0: -31, z1: -17 }} color="#8b7fc7" />
      <Trim r={{ x0: -28.5, x1: -22.5, z0: 6, z1: 13 }} color="#d1a23a" />
      <Conduits />
      <InteriorExtras />
      <CommandProps />
      <EngineeringProps />
      <ScienceProps />
      <CommsProps />
      <Marker />
    </group>
  );
}
