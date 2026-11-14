// The Shipyard: a hangar with the spacecraft on a platform. Click glowing points to pick what to change.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { SpacecraftModel } from './ShipModel';
import { EnvRig } from './EnvRig';
import { useDesign, useYard, pickHardpoint } from '../store';
import { computeStats } from '../design';

function HoloBars() {
  const bars = useRef<THREE.Mesh[]>([]);
  const rings = useRef<THREE.Group>(null!);
  useFrame(({ clock }, dt) => {
    const s = computeStats(useDesign.getState().design);
    const vals = [s.mass / s.launchCapacity, s.cost / s.budget, s.genCapacity / 140, s.battCapacity / 160];
    bars.current.forEach((m, i) => {
      if (!m) return;
      const target = Math.max(0.03, Math.min(1.2, vals[i]) * 3);
      m.scale.y += (target - m.scale.y) * Math.min(1, dt * 6);
      m.position.y = m.scale.y / 2;
      const over = vals[i] > 1 && i < 2;
      const mat = m.material as THREE.MeshStandardMaterial;
      const col = over ? '#ef4444' : ['#38bdf8', '#facc15', '#34d399', '#a78bfa'][i];
      mat.color.set(col); mat.emissive.set(col);
    });
    if (rings.current) rings.current.rotation.y = clock.elapsedTime * 0.4;
  });
  return (
    <group position={[-5.5, 0, -1]}>
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[i * 0.9, 0, 0]}>
          <mesh position={[0, 1.65, 0]}><boxGeometry args={[0.55, 3.3, 0.55]} /><meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.25} /></mesh>
          <mesh ref={(el) => { if (el) bars.current[i] = el; }}><boxGeometry args={[0.4, 1, 0.4]} /><meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.6} transparent opacity={0.85} /></mesh>
        </group>
      ))}
      <group ref={rings} position={[1.35, 3.9, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.7, 0.01, 6, 48]} /><meshBasicMaterial color="#22d3ee" /></mesh>
        <mesh rotation={[Math.PI / 3, 0, 0]}><torusGeometry args={[0.55, 0.01, 6, 48]} /><meshBasicMaterial color="#38bdf8" /></mesh>
      </group>
    </group>
  );
}

function CamInit() {
  const { camera } = useThree();
  useEffect(() => { camera.position.set(8, 3, 9); camera.lookAt(0, 0, 0.3); }, [camera]);
  return null;
}

export function ShipyardScene() {
  const design = useDesign((s) => s.design);
  const { cat, autoRotate, pending } = useYard();
  const sw = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => { if (sw.current) { sw.current.rotation.y = clock.elapsedTime * 0.9; } });
  const ring = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => { if (ring.current) (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(clock.elapsedTime * 2) * 0.2; });
  return (
    <>
      <color attach="background" args={['#04070e']} />
      <fog attach="fog" args={['#04070e', 25, 70]} />
      <ambientLight intensity={0.25} color="#9db4d6" />
      <hemisphereLight args={['#b7d3ff', '#1a2233', 0.35]} />
      <spotLight position={[0, 14, 3]} angle={0.6} penumbra={0.8} intensity={600} color="#e0f2fe" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
      <EnvRig intensity={0.5} />
      <spotLight position={[10, 6, 8]} angle={0.7} penumbra={0.9} intensity={250} color="#38bdf8" />
      <spotLight position={[-10, 5, -8]} angle={0.7} penumbra={0.9} intensity={250} color="#f97316" />
      <Stars radius={90} depth={30} count={1200} factor={3} fade speed={0.2} />

      {/* platform */}
      <mesh position={[0, -2.4, 0]} receiveShadow>
        <cylinderGeometry args={[6.5, 7, 0.6, 64]} />
        <meshStandardMaterial color="#27313f" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, -2.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.4, 5.55, 64]} /><meshBasicMaterial color="#22d3ee" />
      </mesh>
      <mesh ref={ring} position={[0, -2.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.0, 3.1, 64]} /><meshBasicMaterial color="#38bdf8" transparent opacity={0.6} />
      </mesh>
      {/* support cradle */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.1, -1.6, 0.2]}><boxGeometry args={[0.25, 1.4, 3]} /><meshStandardMaterial color="#334155" metalness={0.8} roughness={0.4} /></mesh>
      ))}
      {/* hangar: floor, back wall panels, gantry arches */}
      <mesh position={[0, -2.75, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[120, 120]} /><meshStandardMaterial color="#0d131c" metalness={0.6} roughness={0.5} /></mesh>
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 1.1 + Math.PI * 0.95;
        return (
          <group key={i} position={[Math.cos(a) * 24, 4, Math.sin(a) * 24]} rotation={[0, -a + Math.PI / 2, 0]}>
            <mesh position={[0, 4, 0]}><boxGeometry args={[5, 16, 0.8]} /><meshStandardMaterial color="#1c2430" metalness={0.7} roughness={0.5} /></mesh>
            <mesh position={[0, 4, 0.45]}><boxGeometry args={[0.15, 14, 0.05]} /><meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.6} /></mesh>
          </group>
        );
      })}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 9, 0, -2]}>
          <mesh position={[0, 3, 0]}><boxGeometry args={[0.6, 11, 0.6]} /><meshStandardMaterial color="#222c3a" metalness={0.8} roughness={0.4} /></mesh>
          <mesh position={[0, 8.6, 0]}><boxGeometry args={[0.8, 0.3, 14]} /><meshStandardMaterial color="#222c3a" metalness={0.8} roughness={0.4} /></mesh>
          <mesh position={[0, 8.4, 0]}><boxGeometry args={[0.3, 0.1, 12]} /><meshStandardMaterial color="#e0f2fe" emissive="#e0f2fe" emissiveIntensity={2} /></mesh>
        </group>
      ))}

      {/* ceiling trusses */}
      {[-12, -6, 0, 6, 12].map((z) => (
        <group key={z} position={[0, 10.5, z]}>
          <mesh><boxGeometry args={[26, 0.35, 0.5]} /><meshStandardMaterial color="#1b2432" metalness={0.8} roughness={0.4} /></mesh>
          {[-10, -5, 0, 5, 10].map((x) => (
            <mesh key={x} position={[x, -0.6, 0]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[1.2, 0.12, 0.12]} /><meshStandardMaterial color="#26324a" metalness={0.8} roughness={0.4} /></mesh>
          ))}
        </group>
      ))}
      {[-12, 0, 12].map((x) => (
        <mesh key={x} position={[x, 10.3, 0]}><boxGeometry args={[0.35, 0.3, 28]} /><meshStandardMaterial color="#1b2432" metalness={0.8} roughness={0.4} /></mesh>
      ))}
      {/* floor guide lines */}
      {[-8, -4, 4, 8].map((x) => (
        <mesh key={x} position={[x, -2.73, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.06, 40]} /><meshBasicMaterial color="#0e7490" /></mesh>
      ))}
      {/* light cones from the inspection spotlights (fake volumetric light) */}
      <mesh position={[0, 5.5, 3]}><coneGeometry args={[4.2, 16, 32, 1, true]} /><meshBasicMaterial color="#7dd3fc" transparent opacity={0.035} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} /></mesh>
      {/* animated scanning beam around the ship */}
      <mesh ref={sw} position={[0, -2.0, 0]}>
        <planeGeometry args={[11, 0.05]} /><meshBasicMaterial color="#22d3ee" transparent opacity={0.35} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* holographic display panels on the walls */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 13, 3.2, -6]} rotation={[0, -sd * 0.9, 0]}>
          <mesh><planeGeometry args={[5, 3]} /><meshBasicMaterial color="#0e7490" transparent opacity={0.16} side={THREE.DoubleSide} /></mesh>
          <mesh><planeGeometry args={[5.1, 3.1]} /><meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.25} side={THREE.DoubleSide} /></mesh>
          {[0, 1, 2, 3].map((r) => (
            <mesh key={r} position={[-1.2 + r * 0.25, -0.8 + (r % 2) * 0.5, 0.02]}><planeGeometry args={[1.8 - r * 0.3, 0.08]} /><meshBasicMaterial color="#67e8f9" transparent opacity={0.55} /></mesh>
          ))}
        </group>
      ))}
      <Sparkles count={60} scale={[14, 8, 14]} size={2} speed={0.25} opacity={0.5} color="#7dd3fc" position={[0, 2, 0]} />

      <CamInit />
      <HoloBars />
      <group rotation={[0, 0.5, 0]} position={[0, -0.3, 0]} scale={0.95}>
        <SpacecraftModel design={design} markers selected={cat} onPick={pickHardpoint} />
      </group>
      <OrbitControls target={[0, 0, 0.3]} enablePan={false} minDistance={5} maxDistance={20} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2 + 0.2} autoRotate={autoRotate && !pending} autoRotateSpeed={0.6} />
    </>
  );
}
