import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useGame, useSettings, useUI } from '../store';
import { isEmergency, nextGoal, type GameState, type InstrId } from '../sim';
import { Instrument } from './ShipModel';
import { InteriorExtras, ConsoleDetail } from './interior/Rooms';
import { WindowMoon, WindowEarth, WindowHorizon } from './space';
import { LAMP_SPOTS, DOOR_LIST, spansAround } from './interior/spots';
import { H, WALL_SEGS, FLOOR_RECTS, INTERACTABLES, type Seg } from './layout';

const DEG = Math.PI / 180;
const lerp = THREE.MathUtils.lerp;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ---------- Procedural textures (drawn with code, no image files) ----------
const canvases: Record<string, HTMLCanvasElement> = {};
function baseCanvas(kind: 'wall' | 'floor' | 'ceil') {
  if (canvases[kind]) return canvases[kind];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const base = kind === 'wall' ? '#b5b9be' : kind === 'floor' ? '#3a3e44' : '#8f949a';
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.06})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = 'rgba(10,15,25,0.75)';
  g.lineWidth = 5;
  g.strokeRect(2, 2, 252, 252);
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(10,15,25,0.35)';
  g.beginPath();
  g.moveTo(128, 0); g.lineTo(128, 256);
  g.moveTo(0, 128); g.lineTo(256, 128);
  g.stroke();
  g.fillStyle = 'rgba(15,20,30,0.7)';
  for (const [x, y] of [[14, 14], [242, 14], [14, 242], [242, 242]]) {
    g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
  }
  if (kind === 'floor') {
    g.fillStyle = 'rgba(250,204,21,0.25)';
    for (let i = 0; i < 8; i++) g.fillRect(8 + i * 30, 240, 14, 8);
  }
  canvases[kind] = c;
  return c;
}
function useTiled(kind: 'wall' | 'floor' | 'ceil', rx: number, ry: number) {
  return useMemo(() => {
    const t = new THREE.CanvasTexture(baseCanvas(kind));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.repeat.set(Math.max(1, rx), Math.max(1, ry));
    return t;
  }, [kind, rx, ry]);
}

// One shared material for ceiling lamps. The lights controller changes its color.
const lampMat = new THREE.MeshStandardMaterial({ color: '#eef3f8', emissive: new THREE.Color('#e6eef7'), emissiveIntensity: 2 });

// ---------- Walls, floors, ceilings ----------
function WallSeg({ s }: { s: Seg }) {
  const long = Math.max(s.w, s.d);
  const tex = useTiled('wall', long / 2.5, H / 2.5);
  const alongX = s.w > s.d;
  if (!s.win) {
    return (
      <mesh position={[s.cx, H / 2, s.cz]}>
        <boxGeometry args={[s.w, H, s.d]} />
        <meshStandardMaterial map={tex} roughness={0.7} metalness={0.3} />
      </mesh>
    );
  }
  const n = Math.max(1, Math.round(long / 3.5));
  const posts = Array.from({ length: n + 1 }, (_, i) => -long / 2 + (i * long) / n);
  return (
    <group position={[s.cx, 0, s.cz]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[s.w, 1, s.d]} />
        <meshStandardMaterial map={tex} roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position={[0, H - 0.5, 0]}>
        <boxGeometry args={[s.w, 1, s.d]} />
        <meshStandardMaterial map={tex} roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={alongX ? [s.w, 2, 0.05] : [0.05, 2, s.d]} />
        <meshStandardMaterial color="#9cd1ff" transparent opacity={0.1} roughness={0.1} depthWrite={false} />
      </mesh>
      {posts.map((p, i) => (
        <mesh key={i} position={alongX ? [p, 2, 0] : [0, 2, p]}>
          <boxGeometry args={alongX ? [0.22, 2, s.d + 0.05] : [s.w + 0.05, 2, 0.22]} />
          <meshStandardMaterial color="#4a4f57" roughness={0.6} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function FloorCeil({ r, lift = 0 }: { r: { x0: number; x1: number; z0: number; z1: number }; lift?: number }) {
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  const floor = useTiled('floor', w / 2, d / 2);
  const ceil = useTiled('ceil', w / 3, d / 3);
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  return (
    <>
      <mesh position={[cx, lift, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w + 0.4, d + 0.4]} />
        <meshStandardMaterial map={floor} roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[cx, H - lift, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w + 0.4, d + 0.4]} />
        <meshStandardMaterial map={ceil} roughness={0.8} metalness={0.2} />
      </mesh>
    </>
  );
}

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

function CeilingLamps() {
  return (
    <>
      {LAMP_SPOTS.map(([x, z, w, d], i) => (
        <group key={i}>
          <mesh position={[x, H - 0.04, z]} material={lampMat}>
            <boxGeometry args={[w, 0.06, d]} />
          </mesh>
          {/* dark housing frame around each light panel */}
          <mesh position={[x, H - 0.025, z]}>
            <boxGeometry args={[w + 0.14, 0.04, d + 0.14]} />
            <meshStandardMaterial color="#2c3036" roughness={0.6} metalness={0.5} />
          </mesh>
        </group>
      ))}
    </>
  );
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

function Console({ x, z, rotY = 0, w = 3, color = '#38bdf8', title, children }: { x: number; z: number; rotY?: number; w?: number; color?: string; title?: string; children?: ReactNode }) {
  const scr = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(({ clock }) => {
    if (scr.current) scr.current.emissiveIntensity = 0.9 + Math.sin(clock.elapsedTime * 3 + x) * 0.15;
  });
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 1, 1]} />
        <meshStandardMaterial color="#4a4f57" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.02, 0.2]}>
        <boxGeometry args={[w - 0.2, 0.06, 0.5]} />
        <meshStandardMaterial color="#22272d" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.4, -0.2]} rotation={[-0.45, 0, 0]}>
        <boxGeometry args={[w - 0.3, 0.75, 0.06]} />
        <meshStandardMaterial ref={scr} color="#06202c" emissive={color} emissiveIntensity={1} />
      </mesh>
      {Array.from({ length: Math.max(3, Math.floor(w * 2.5)) }, (_, i) => (
        <mesh key={i} position={[(i - (Math.max(3, Math.floor(w * 2.5)) - 1) / 2) * 0.28, 1.07, 0.3]}>
          <boxGeometry args={[0.14, 0.05, 0.1]} />
          <meshStandardMaterial color={i % 3 === 0 ? '#c9951c' : i % 3 === 1 ? '#8fb7c9' : '#8fbf6a'} emissive={i % 3 === 0 ? '#c9951c' : i % 3 === 1 ? '#5f9db5' : '#6fa04a'} emissiveIntensity={0.55} />
        </mesh>
      ))}
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
function Generator() {
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
  return (
    <group position={[-27, 0, -2.8]}>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[1.5, 1.6, 0.4, 24]} /><meshStandardMaterial color="#4a4f57" metalness={0.6} roughness={0.5} /></mesh>
      <mesh position={[0, 1.4, 0]} castShadow><cylinderGeometry args={[1.1, 1.2, 2, 24]} /><meshStandardMaterial color="#5a6069" metalness={0.6} roughness={0.45} /></mesh>
      <mesh position={[0, 2.5, 0]}><cylinderGeometry args={[1.25, 1.1, 0.3, 24]} /><meshStandardMaterial color="#4a4f57" metalness={0.6} roughness={0.5} /></mesh>
      <group ref={rotor} position={[0, 1.5, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.18, 0.1, 10, 32]} />
          <meshStandardMaterial ref={core} color="#ef4444" emissive="#ef4444" emissiveIntensity={1} />
        </mesh>
        <mesh position={[1.18, 0, 0]}><boxGeometry args={[0.2, 0.3, 0.2]} /><meshStandardMaterial color="#cbd5e1" metalness={0.7} /></mesh>
      </group>
    </group>
  );
}

function BatteryBank() {
  const fills = useRef<THREE.Mesh[]>([]);
  useFrame(() => {
    const g = useGame.getState();
    const lvl = g.battery / 100 * 5;
    fills.current.forEach((m, i) => {
      if (!m) return;
      const f = clamp01(lvl - i);
      m.scale.y = Math.max(0.02, f);
      const mat = m.material as THREE.MeshStandardMaterial;
      const c = g.battery < 20 ? '#ef4444' : '#22c55e';
      mat.color.set(c); mat.emissive.set(c);
    });
  });
  return (
    <group position={[-27, 0, 3.2]}>
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i} position={[-2 + i * 1, 0, 0]}>
          <mesh position={[0, 0.8, 0]} castShadow><boxGeometry args={[0.85, 1.6, 1.4]} /><meshStandardMaterial color="#4a4f57" metalness={0.6} roughness={0.5} /></mesh>
          <group position={[0, 0.15, -0.72]}>
            <mesh ref={(el) => { if (el) fills.current[i] = el; }} position={[0, 0.65, 0]}>
              <boxGeometry args={[0.55, 1.3, 0.05]} />
              <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.5} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

const SW_LAMPS: [string, number][] = [['gj1', 0], ['gj2', 1], ['bj1', 2], ['bj2', 3], ['life', 4], ['comms', 5], ['sci', 6], ['eng', 7]];

function EngineeringProps() {
  return (
    <>
      <Generator />
      <BatteryBank />
      <EngineeringExtras />
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
function useInstrState(id: InstrId) {
  const color = useRef(new THREE.Color());
  return (g: GameState, t: number) => {
    if (g.running[id]) return { on: true, c: color.current.set('#34d399') };
    if (g.instruments[id]) return { on: false, c: color.current.set('#ef4444') };
    return { on: false, c: color.current.set('#f59e0b').multiplyScalar(0.35) };
  };
}

function Spectrometer() {
  const head = useRef<THREE.Group>(null!);
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  const st = useInstrState('spectrometer');
  useFrame(({ clock }, dt) => {
    const g = useGame.getState();
    const s = st(g, clock.elapsedTime);
    if (head.current && s.on) head.current.rotation.y += dt * 0.9;
    if (mat.current) { mat.current.emissive.copy(s.c); mat.current.emissiveIntensity = s.on ? 1.6 : 1; }
    if (beam.current) beam.current.visible = s.on;
  });
  return (
    <group position={[21, 0, -3.8]}>
      <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.7, 0.8, 0.9, 20]} /><meshStandardMaterial color="#4a4f57" metalness={0.6} roughness={0.5} /></mesh>
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.12, 0.12, 0.7, 10]} /><meshStandardMaterial color="#64748b" metalness={0.7} /></mesh>
      <group ref={head} position={[0, 1.7, 0]}>
        <mesh><boxGeometry args={[0.5, 0.45, 1.0]} /><meshStandardMaterial color="#5a6069" metalness={0.6} roughness={0.4} /></mesh>
        <mesh position={[0, 0, 0.6]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.18, 0.22, 0.3, 14]} /><meshStandardMaterial ref={mat} color="#111827" emissive="#f59e0b" emissiveIntensity={1} /></mesh>
        <mesh ref={beam} position={[0, -0.2, 1.4]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.02, 0.02, 1.6, 6]} /><meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={2} transparent opacity={0.6} /></mesh>
      </group>
    </group>
  );
}

function SeismicSensor() {
  const rings = useRef<THREE.Mesh[]>([]);
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const st = useInstrState('seismic');
  useFrame(({ clock }) => {
    const g = useGame.getState();
    const t = clock.elapsedTime;
    const s = st(g, t);
    rings.current.forEach((m, i) => {
      if (!m) return;
      const k = s.on ? 1 + 0.12 * Math.sin(t * 7 - i * 1.2) : 1;
      m.scale.set(k, k, 1);
    });
    if (mat.current) { mat.current.emissive.copy(s.c); mat.current.emissiveIntensity = s.on ? 1.8 : 1; }
  });
  return (
    <group position={[26.5, 0, -3.8]}>
      <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.85, 0.9, 0.12, 20]} /><meshStandardMaterial color="#4a4f57" metalness={0.6} /></mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.cos(i * 2.094) * 0.6, 0.25, Math.sin(i * 2.094) * 0.6]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.08, 0.35, 8]} /><meshStandardMaterial color="#94a3b8" metalness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.25, 0.3, 1.1, 14]} /><meshStandardMaterial color="#5a6069" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 1.35, 0]}><sphereGeometry args={[0.22, 14, 14]} /><meshStandardMaterial ref={mat} color="#111827" emissive="#f59e0b" emissiveIntensity={1} /></mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => { if (el) rings.current[i] = el; }} position={[0, 0.5 + i * 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42 + i * 0.04, 0.025, 8, 28]} /><meshStandardMaterial color="#94a3b8" metalness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function SignalAnalyzer() {
  const ring = useRef<THREE.Mesh>(null!);
  const ring2 = useRef<THREE.Mesh>(null!);
  const core = useRef<THREE.MeshStandardMaterial>(null!);
  const st = useInstrState('analyzer');
  useFrame(({ clock }, dt) => {
    const g = useGame.getState();
    const s = st(g, clock.elapsedTime);
    if (s.on) {
      if (ring.current) ring.current.rotation.x += dt * 1.8;
      if (ring2.current) ring2.current.rotation.z += dt * 1.2;
    }
    if (core.current) { core.current.emissive.copy(s.c); core.current.emissiveIntensity = s.on ? 1.6 + Math.sin(clock.elapsedTime * 8) * 0.6 : 1; }
  });
  return (
    <group position={[26.5, 0, 3.8]}>
      <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.9, 1.0, 0.8, 24]} /><meshStandardMaterial color="#4a4f57" metalness={0.6} roughness={0.5} /></mesh>
      <mesh position={[0, 1.0, 0]}><cylinderGeometry args={[0.15, 0.15, 0.6, 10]} /><meshStandardMaterial color="#64748b" metalness={0.7} /></mesh>
      <mesh ref={ring} position={[0, 1.7, 0]}><torusGeometry args={[0.7, 0.05, 10, 36]} /><meshStandardMaterial color="#94a3b8" metalness={0.7} /></mesh>
      <mesh ref={ring2} position={[0, 1.7, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.55, 0.04, 10, 36]} /><meshStandardMaterial color="#cbd5e1" metalness={0.7} /></mesh>
      <mesh position={[0, 1.7, 0]}><sphereGeometry args={[0.22, 16, 16]} /><meshStandardMaterial ref={core} color="#111827" emissive="#f59e0b" emissiveIntensity={1} /></mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.cos(i * 2.094 + 0.5) * 0.7, 0.9, Math.sin(i * 2.094 + 0.5) * 0.7]} rotation={[-0.9, -(i * 2.094 + 0.5) + Math.PI / 2, 0]}>
          <sphereGeometry args={[0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

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

function HiResCamera() {
  const head = useRef<THREE.Group>(null!);
  const lens = useRef<THREE.MeshStandardMaterial>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const g = useGame.getState();
    const on = g.running.camera;
    if (head.current) head.current.rotation.y = Math.PI * 1.5 + (on ? Math.sin(clock.elapsedTime * 0.8) * 0.5 : 0);
    if (lens.current) {
      const c = on ? '#60a5fa' : g.instruments.camera ? '#ef4444' : '#f59e0b';
      lens.current.emissive.set(c);
      lens.current.emissiveIntensity = on ? 2 : 0.7;
    }
    if (beam.current) beam.current.visible = on && Math.sin(clock.elapsedTime * 12) > -0.3;
  });
  return (
    <group position={[29.4, 0, 0]}>
      <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.55, 0.65, 0.9, 20]} /><meshStandardMaterial color="#4a4f57" metalness={0.6} roughness={0.5} /></mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.cos(i * 2.094) * 0.3, 1.2, Math.sin(i * 2.094) * 0.3]} rotation={[Math.sin(i * 2.094) * 0.3, 0, -Math.cos(i * 2.094) * 0.3]}>
          <cylinderGeometry args={[0.025, 0.025, 0.9, 6]} /><meshStandardMaterial color="#94a3b8" metalness={0.8} />
        </mesh>
      ))}
      <group ref={head} position={[0, 1.75, 0]}>
        <mesh><boxGeometry args={[0.5, 0.4, 0.7]} /><meshStandardMaterial color="#2a2e34" metalness={0.7} roughness={0.4} /></mesh>
        <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.16, 0.2, 0.4, 16]} /><meshStandardMaterial ref={lens} color="#0f172a" emissive="#f59e0b" emissiveIntensity={0.7} /></mesh>
        <mesh ref={beam} position={[0, 0, 1.4]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.01, 0.01, 1.8, 6]} /><meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={3} transparent opacity={0.7} /></mesh>
      </group>
    </group>
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

function Ribs() {
  const ribs: [number, number][] = [];
  for (const [cx, w] of [[-24, 14], [24, 14]] as const) {
    for (const k of [-5.25, -1.75, 1.75, 5.25]) {
      ribs.push([cx + k, -5.72]);
      ribs.push([cx + k, 5.72]);
    }
  }
  const beams: [number, number, number, number][] = [];
  for (const [cx, cz, w, d] of [[0, 0, 14, 12], [-24, 0, 14, 12], [24, 0, 14, 12], [0, -24, 14, 14]] as const) {
    for (const k of [-3.5, 0, 3.5]) beams.push([cx + k, cz, 0.3, d]);
  }
  return (
    <>
      {ribs.map(([x, z], i) => (
        <group key={i} position={[x, 2, z]}>
          <mesh><boxGeometry args={[0.4, 4, 0.2]} /><meshStandardMaterial color="#5a6069" metalness={0.7} roughness={0.45} /></mesh>
          <mesh position={[0, 0, z > 0 ? -0.11 : 0.11]}><boxGeometry args={[0.04, 3.6, 0.02]} /><meshStandardMaterial color="#8fb3c4" emissive="#8fb3c4" emissiveIntensity={0.25} /></mesh>
        </group>
      ))}
      {beams.map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, H - 0.17, z]}><boxGeometry args={[w, 0.3, d]} /><meshStandardMaterial color="#555b64" metalness={0.7} roughness={0.5} /></mesh>
      ))}
      {/* dark strips at the foot of the walls: cheap fake ambient occlusion */}
      {[[0, -5.8, 14, 0.1], [0, 5.8, 14, 0.1], [-24, -5.8, 14, 0.1], [-24, 5.8, 14, 0.1], [24, -5.8, 14, 0.1], [24, 5.8, 14, 0.1], [0, -30.8, 14, 0.1], [-6.8, -24, 0.1, 14], [6.8, -24, 0.1, 14]].map(([x, z, w, d], i) => (
        <mesh key={'ao' + i} position={[x, 0.12, z]}><boxGeometry args={[w, 0.24, d]} /><meshStandardMaterial color="#10161f" roughness={0.9} /></mesh>
      ))}
    </>
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

// ---------- Communications ----------
function Dish() {
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
    if (yaw.current) yaw.current.rotation.y = Math.PI - az.current * DEG + shake;
    if (tilt.current) tilt.current.rotation.x = (90 - el.current) * DEG;
    if (beam.current) {
      beam.current.visible = g.commsLinked;
      (beam.current.material as THREE.MeshStandardMaterial).emissiveIntensity = g.transmitting ? 2.5 + Math.sin(clock.elapsedTime * 14) : 1.2;
    }
  });
  return (
    <group position={[-3.5, 0, -25.5]}>
      <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.8, 1, 1, 20]} /><meshStandardMaterial color="#4a4f57" metalness={0.6} roughness={0.5} /></mesh>
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.15, 0.15, 0.8, 10]} /><meshStandardMaterial color="#64748b" metalness={0.7} /></mesh>
      <group ref={yaw} position={[0, 1.6, 0]}>
        <group ref={tilt}>
          <mesh rotation={[0, 0, 0]}>
            <sphereGeometry args={[1.0, 32, 12, 0, Math.PI * 2, (Math.PI * 2) / 3, Math.PI / 3]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.5} roughness={0.35} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.025, 0.025, 1.2, 6]} /><meshStandardMaterial color="#94a3b8" metalness={0.8} /></mesh>
          <mesh position={[0, 1.2, 0]}><sphereGeometry args={[0.08, 10, 10]} /><meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.5} /></mesh>
          <mesh ref={beam} position={[0, 2.4, 0]}><cylinderGeometry args={[0.04, 0.04, 2.4, 8]} /><meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.2} transparent opacity={0.45} /></mesh>
        </group>
      </group>
    </group>
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

function Lights() {
  const amb = useRef<THREE.AmbientLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const pts = useRef<THREE.PointLight[]>([]);
  const flash = useRef<THREE.PointLight>(null!);
  const mix = useRef(1);
  const shadows = useSettings((s) => s.shadows);
  const cur = useMemo(() => new THREE.Color(), []);
  const cNormal = useMemo(() => new THREE.Color('#eaf0f7'), []);
  const cEmer = useMemo(() => new THREE.Color('#ff3b30'), []);
  useFrame(({ clock, camera }, dt) => {
    const g = useGame.getState();
    const em = g.phase === 'won' ? false : g.phase === 'lost' ? true : isEmergency(g);
    mix.current += ((em ? 1 : 0) - mix.current) * Math.min(1, dt * 3);
    const m = mix.current;
    const t = clock.elapsedTime;
    const pulse = 0.65 + 0.35 * Math.sin(t * 4.5);
    cur.copy(cNormal).lerp(cEmer, m);
    const boost = g.elapsed - g.flashAt < 1.5 ? 1.4 : 1;
    pts.current.forEach((p) => {
      if (!p) return;
      p.color.copy(cur);
      p.intensity = lerp(80, 55 * pulse, m) * boost;
    });
    if (amb.current) amb.current.intensity = lerp(1.2, 0.55, m);
    if (hemi.current) hemi.current.intensity = lerp(0.9, 0.35, m);
    lampMat.emissive.copy(cur);
    lampMat.emissiveIntensity = lerp(2.2, 0.5 + 1.3 * pulse, m);
    if (flash.current) flash.current.position.copy(camera.position);
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.6} color="#b4bdca" />
      <hemisphereLight ref={hemi} args={['#c9d3e0', '#2a2d33', 0.6]} />
      {LIGHT_POS.map((p, i) => (
        <pointLight key={i} ref={(el) => { if (el) pts.current[i] = el; }} position={p} distance={26} decay={2} intensity={60} color="#eaf0f7" />
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
  const moonSun = useMemo(() => ({ dir: [270, 14, -75] as [number, number, number], rotY: Math.PI }), []);
  const earthSun = useMemo(() => ({ dir: [270, 8, 140] as [number, number, number], rotY: 0 }), []);
  return (
    <>
      <Stars radius={260} depth={80} count={5000} factor={6} saturation={0} fade speed={0.4} />
      <WindowMoon radius={30} position={[0, 8, 95]} sun={moonSun} />
      {/* a nearby piece of lunar horizon below the Command Deck window */}
      <WindowHorizon radius={160} position={[0, -150, 60]} />
      {/* the Sun: low in the east, seen through the Science Lab window. Hard white, no atmosphere. */}
      <mesh position={[270, 22, 20]}><sphereGeometry args={[9, 24, 16]} /><meshBasicMaterial color="#fffaf0" /></mesh>
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
      <Outside />
      {WALL_SEGS.map((s, i) => <WallSeg key={i} s={s} />)}
      {FLOOR_RECTS.map((r, i) => <FloorCeil key={i} r={r} lift={i >= 4 ? 0.012 : 0} />)}
      <Trim r={{ x0: -7, x1: 7, z0: -6, z1: 6 }} color="#5aa7c7" />
      <Trim r={{ x0: -31, x1: -17, z0: -6, z1: 6 }} color="#c98a3d" />
      <Trim r={{ x0: 17, x1: 31, z0: -6, z1: 6 }} color="#5fae8c" />
      <Trim r={{ x0: -7, x1: 7, z0: -31, z1: -17 }} color="#8b7fc7" />
      <Trim r={{ x0: -28.5, x1: -22.5, z0: 6, z1: 13 }} color="#d1a23a" />
      <CeilingLamps />
      <Conduits />
      <Ribs />
      <InteriorExtras />
      <CommandProps />
      <EngineeringProps />
      <ScienceProps />
      <CommsProps />
      <Marker />
    </group>
  );
}
