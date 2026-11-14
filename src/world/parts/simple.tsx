// Simple (V2) spacecraft parts. Kept as the safe fallback: if a detailed model fails, these are shown instead.
import { useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { part } from '../../design';

const M = {
  hull: new THREE.MeshStandardMaterial({ color: '#e5e7eb', metalness: 0.5, roughness: 0.35 }),
  dark: new THREE.MeshStandardMaterial({ color: '#1f2937', metalness: 0.7, roughness: 0.4 }),
  metal: new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.8, roughness: 0.3 }),
  gold: new THREE.MeshStandardMaterial({ color: '#d4a017', metalness: 0.9, roughness: 0.3 }),
  orange: new THREE.MeshStandardMaterial({ color: '#f97316', metalness: 0.4, roughness: 0.5 }),
  white: new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.3, roughness: 0.4 }),
};

function solarTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b1e4a'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#3b82f6'; g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  g.fillStyle = 'rgba(147,197,253,0.15)'; g.fillRect(0, 0, 128, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Dish({ r = 0.5, depth = Math.PI / 3 }: { r?: number; depth?: number }) {
  return (
    <group>
      <mesh rotation={[0, 0, 0]}>
        <sphereGeometry args={[r, 28, 10, 0, Math.PI * 2, Math.PI - depth, depth]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.5} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, r * 0.55, 0]}><cylinderGeometry args={[0.012, 0.012, r * 1.1, 6]} /><primitive object={M.metal} attach="material" /></mesh>
      <mesh position={[0, r * 1.1, 0]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2} /></mesh>
    </group>
  );
}

export function Structure({ id }: { id: string | null }) {
  const p = part('structure', id);
  const r = id === 'reinforced' ? 1.25 : id === 'light' ? 0.8 : 1.0;
  return (
    <group>
      {/* core bus */}
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[r, r, 5.2, 24]} /><primitive object={M.hull} attach="material" /></mesh>
      <mesh position={[0, 0, 2.6 + 0.4]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[r, 0.9, 24]} /><primitive object={M.white} attach="material" /></mesh>
      {/* panel seams */}
      {[-2, -0.8, 0.4, 1.6].map((z) => (
        <mesh key={z} position={[0, 0, z]} rotation={[0, 0, 0]}><torusGeometry args={[r + 0.005, 0.02, 6, 28]} /><primitive object={M.dark} attach="material" /></mesh>
      ))}
      {id === 'light' && (
        // open truss frame
        <group>
          {[0, 1, 2, 3].map((i) => {
            const a = (i * Math.PI) / 2 + Math.PI / 4;
            return <mesh key={i} position={[Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0.2]}><boxGeometry args={[0.05, 0.05, 5.6]} /><primitive object={M.metal} attach="material" /></mesh>;
          })}
          {[-2.2, -0.2, 1.8].map((z) => <mesh key={z} position={[0, 0, z]}><torusGeometry args={[1.0, 0.025, 6, 4]} /><primitive object={M.metal} attach="material" /></mesh>)}
        </group>
      )}
      {id === 'standard' && (
        <group>
          {[-1.6, 1.0].map((z) => <mesh key={z} position={[0, 0, z]}><torusGeometry args={[1.07, 0.06, 8, 28]} /><primitive object={M.metal} attach="material" /></mesh>)}
          <mesh position={[0, 0, 0]}><boxGeometry args={[0.5, 0.06, 4.4]} /><primitive object={M.orange} attach="material" /></mesh>
        </group>
      )}
      {id === 'reinforced' && (
        <group>
          {[-2.0, -1.0, 0, 1.0, 2.0].map((z) => <mesh key={z} position={[0, 0, z]}><torusGeometry args={[1.3, 0.09, 8, 28]} /><primitive object={M.dark} attach="material" /></mesh>)}
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return <mesh key={i} position={[Math.cos(a) * 1.28, Math.sin(a) * 1.28, 0]}><boxGeometry args={[0.18, 0.18, 4.6]} /><primitive object={M.orange} attach="material" /></mesh>;
          })}
        </group>
      )}
      {!p && <mesh position={[0, 0, 0]}><boxGeometry args={[0.2, 0.2, 0.2]} /><meshBasicMaterial color="#ef4444" /></mesh>}
      {/* windows on the hull */}
      <mesh position={[0, r * 0.99, 2.0]}><boxGeometry args={[0.5, 0.02, 0.35]} /><meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={1.5} /></mesh>
    </group>
  );
}

export function Power({ id }: { id: string | null }) {
  const p = part('power', id);
  const tex = useMemo(() => solarTexture(), []);
  if (!p) return null;
  const segs = id === 'compact' ? 1 : id === 'advanced' ? 2 : 3;
  const w = id === 'highcap' ? 1.7 : 1.4;
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.2, 0, 0.3]}>
          <mesh position={[side * (0.2 + (segs * w) / 2), 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.04, 0.04, 0.4 + segs * w, 8]} /><primitive object={M.metal} attach="material" /></mesh>
          {Array.from({ length: segs }, (_, i) => (
            <mesh key={i} position={[side * (0.3 + i * (w + 0.05) + w / 2), 0, 0]}>
              <boxGeometry args={[w, 0.05, id === 'compact' ? 1.6 : 2.4]} />
              <meshStandardMaterial map={tex} metalness={0.7} roughness={0.25} emissive="#1d4ed8" emissiveIntensity={0.25} />
            </mesh>
          ))}
        </group>
      ))}
      {id === 'highcap' && [-1, 1].map((s) => <mesh key={s} position={[s * 1.2, 0, 0.3]}><cylinderGeometry args={[0.2, 0.2, 0.5, 12]} /><primitive object={M.gold} attach="material" /></mesh>)}
    </group>
  );
}

export function Propulsion({ id, glow }: { id: string | null; glow: MutableRefObject<THREE.MeshStandardMaterial[]> }) {
  const reg = (m: THREE.MeshStandardMaterial | null) => { if (m && !glow.current.includes(m)) glow.current.push(m); };
  if (!id) return null;
  const nozzle = (x: number, y: number, s: number, color: string, key: string | number) => (
    <group key={key} position={[x, y, 0]} scale={s}>
      <mesh position={[0, 0, -0.35]} rotation={[-Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.55, 0.28, 0.9, 20, 1, true]} /><meshStandardMaterial color="#334155" metalness={0.85} roughness={0.35} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0, -0.9]} rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[0.46, 1.0, 20]} /><meshStandardMaterial ref={reg} color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.75} /></mesh>
    </group>
  );
  return (
    <group position={[0, 0, -2.6]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.7, 0.9, 0.7, 20]} /><primitive object={M.dark} attach="material" /></mesh>
      {id === 'chemical' && (
        <group>
          {nozzle(0, 0, 1.15, '#fb923c', 'a')}
          {[-0.9, 0.9].map((x) => <mesh key={x} position={[x, 0.2, 0.9]} rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.25, 1.4, 6, 12]} /><primitive object={M.white} attach="material" /></mesh>)}
        </group>
      )}
      {id === 'ion' && (
        <group>
          {nozzle(-0.3, 0, 0.6, '#67e8f9', 'a')}{nozzle(0.3, 0, 0.6, '#67e8f9', 'b')}
          <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.75, 0.05, 8, 24]} /><primitive object={M.gold} attach="material" /></mesh>
        </group>
      )}
      {id === 'advprop' && (
        <group>
          {nozzle(0, 0.45, 0.55, '#a78bfa', 'a')}{nozzle(-0.4, -0.25, 0.55, '#a78bfa', 'b')}{nozzle(0.4, -0.25, 0.55, '#a78bfa', 'c')}
          <mesh position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.0, 0.08, 8, 28]} /><primitive object={M.gold} attach="material" /></mesh>
          <mesh position={[0, 0, 0.9]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.05, 0.05, 8, 28]} /><primitive object={M.metal} attach="material" /></mesh>
        </group>
      )}
    </group>
  );
}

export function Comms({ id }: { id: string | null }) {
  if (!id) return null;
  return (
    <group position={[0, 1.0, 0.9]}>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.06, 0.1, id === 'deep' ? 0.9 : 0.5, 8]} /><primitive object={M.metal} attach="material" /></mesh>
      {id === 'basic' && <group position={[0, 0.5, 0]} rotation={[0.5, 0, 0]}><Dish r={0.4} /></group>}
      {id === 'highgain' && <group position={[0, 0.65, 0]} rotation={[0.6, 0, 0]}><Dish r={0.75} /></group>}
      {id === 'deep' && (
        <group position={[0, 0.7, 0]}>
          {[[-0.55, 0], [0.55, 0], [0, 0.55], [0, -0.55]].map(([x, z], i) => (
            <group key={i} position={[x, 0.15, z]} rotation={[0.5, Math.atan2(x, z) , 0]}><Dish r={0.5} /></group>
          ))}
          <mesh position={[0, 0.55, 0]}><sphereGeometry args={[0.12, 10, 10]} /><meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={2} /></mesh>
        </group>
      )}
    </group>
  );
}

export function Battery({ id }: { id: string | null }) {
  const p = part('battery', id);
  if (!p) return null;
  const n = id === 'compact' ? 1 : id === 'standard' ? 2 : 3;
  const r = id === 'advanced' ? 0.36 : id === 'standard' ? 0.3 : 0.24;
  return (
    <group position={[0, -1.05, -0.6]}>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position={[(i - (n - 1) / 2) * (r * 2.3), 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[r, 1.4 + (id === 'advanced' ? 0.4 : 0), 6, 14]} /><primitive object={M.dark} attach="material" /></mesh>
          {[-0.4, 0, 0.4].map((z) => <mesh key={z} position={[0, 0, z]} rotation={[0, 0, 0]}><torusGeometry args={[r + 0.01, 0.02, 6, 20]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.8} /></mesh>)}
        </group>
      ))}
    </group>
  );
}

export function Instrument({ id }: { id: string }) {
  if (id === 'spectrometer') {
    return (
      <group>
        <mesh><boxGeometry args={[0.35, 0.3, 0.7]} /><primitive object={M.dark} attach="material" /></mesh>
        <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.13, 0.16, 0.25, 14]} /><meshStandardMaterial color="#111827" emissive="#f59e0b" emissiveIntensity={1.2} /></mesh>
      </group>
    );
  }
  if (id === 'seismic') {
    return (
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.18, 0.25, 0.5, 12]} /><primitive object={M.metal} attach="material" /></mesh>
        {[0, 1, 2].map((i) => <mesh key={i} position={[Math.cos(i * 2.094) * 0.25, Math.sin(i * 2.094) * 0.25, 0.4]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.04, 0.35, 6]} /><primitive object={M.gold} attach="material" /></mesh>)}
      </group>
    );
  }
  if (id === 'analyzer') {
    return (
      <group>
        <mesh><torusGeometry args={[0.26, 0.03, 8, 24]} /><primitive object={M.metal} attach="material" /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.2, 0.025, 8, 24]} /><primitive object={M.white} attach="material" /></mesh>
        <mesh><sphereGeometry args={[0.1, 12, 12]} /><meshStandardMaterial color="#111827" emissive="#34d399" emissiveIntensity={2} /></mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh><boxGeometry args={[0.4, 0.3, 0.35]} /><primitive object={M.dark} attach="material" /></mesh>
      <mesh position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.12, 0.12, 0.3, 14]} /><meshStandardMaterial color="#0f172a" emissive="#60a5fa" emissiveIntensity={1.2} /></mesh>
    </group>
  );
}

