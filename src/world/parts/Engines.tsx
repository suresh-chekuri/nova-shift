// Propulsion: chemical bell engine, twin ion thrusters, advanced cluster. All with animated exhaust.
import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { G, P, M, Bolts, boltRing, Strut, Pipe, useQ, seg, ds } from './kit';
import { useYard } from '../../store';

// ---------------------------------------------------------------- exhaust plume (soft additive cones, flickering)
function Plume({ color, core = '#ffffff', len = 1.4, r = 0.5, pos = [0, 0, 0] as [number, number, number] }: { color: string; core?: string; len?: number; r?: number; pos?: [number, number, number] }) {
  const g = useRef<THREE.Group>(null!);
  const outer = useRef<THREE.MeshBasicMaterial>(null!);
  const inner = useRef<THREE.MeshBasicMaterial>(null!);
  const k = useRef(0.5);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    // the engine "fires" while the PROPULSION tab is open; otherwise it idles
    const firing = useYard.getState().cat === 'propulsion' ? 1 : 0.45;
    k.current += (firing - k.current) * Math.min(1, dt * 3);
    const f = 0.9 + Math.sin(t * 31) * 0.06 + Math.sin(t * 13.7) * 0.05;
    if (g.current) g.current.scale.set(0.75 + k.current * 0.4, 0.75 + k.current * 0.4, (0.5 + k.current) * f);
    if (outer.current) outer.current.opacity = 0.16 + k.current * 0.2;
    if (inner.current) inner.current.opacity = 0.35 + k.current * 0.35;
  });
  const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;
  return (
    <group ref={g} position={pos}>
      <mesh geometry={G.cone(r, len, 20, true)} position={[0, 0, -len / 2]} rotation={[-Math.PI / 2, 0, 0]}><meshBasicMaterial ref={outer} color={color} {...add} /></mesh>
      <mesh geometry={G.cone(r * 0.48, len * 0.7, 16, true)} position={[0, 0, -len * 0.35]} rotation={[-Math.PI / 2, 0, 0]}><meshBasicMaterial ref={inner} color={core} {...add} /></mesh>
    </group>
  );
}

// ---------------------------------------------------------------- a bell nozzle (surface of revolution around Z, exit toward -Z)
function bellProfile(throatR: number, exitR: number, throatY: number, exitY: number, chamberR: number, chamberY: number): [number, number][] {
  const pts: [number, number][] = [[exitR, exitY]];
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    const rr = throatR + (exitR - throatR) * Math.pow(1 - t, 2.1);
    pts.push([rr, exitY + (throatY - exitY) * t]);
  }
  pts.push([throatR * 1.5, throatY + 0.12], [chamberR, throatY + 0.28], [chamberR, chamberY]);
  return pts;
}

function Bell({ s, throatR, exitR, throatY, exitY, chamberR, chamberY, rings = 4, hot = '#fb923c' }: { s: number; throatR: number; exitR: number; throatY: number; exitY: number; chamberR: number; chamberY: number; rings?: number; hot?: string }) {
  const m = M();
  const outer = useMemo(() => G.lathe(bellProfile(throatR, exitR, throatY, exitY, chamberR, chamberY), s), [s, throatR, exitR, throatY, exitY, chamberR, chamberY]);
  const inner = useMemo(() => G.lathe(bellProfile(throatR * 0.93, exitR * 0.96, throatY, exitY + 0.01, chamberR * 0.9, chamberY - 0.02), s), [s, throatR, exitR, throatY, exitY, chamberR, chamberY]);
  const ringY = Array.from({ length: rings }, (_, i) => exitY + ((throatY - exitY) * (i + 0.6)) / (rings + 0.6));
  const ringR = (y: number) => throatR + (exitR - throatR) * Math.pow(1 - (y - exitY) / (throatY - exitY), 2.1) + 0.01;
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <P geo={outer} m={ds(m.steel)} />
      <P geo={inner} m={ds(m.black)} />
      <mesh geometry={G.tor(exitR, 0.025, 8, s)} material={m.alu} position={[0, exitY, 0]} rotation={[Math.PI / 2, 0, 0]} />
      {ringY.map((y) => <mesh key={y} geometry={G.tor(ringR(y), 0.016, 6, s)} material={m.copper} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />)}
    </group>
  );
}

// ================================================================ CHEMICAL: big bell, tanks, turbopumps, plumbing
function Chemical({ q }: { q: ReturnType<typeof useQ> }) {
  const m = M();
  const s = seg(q, 32);
  return (
    <group>
      {/* thrust structure from the hull ring down to the engine */}
      <P geo={G.cyl(0.95, 0.55, 0.45, 20, true)} m={ds(m.dark)} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.05]} />
      <Bolts pts={boltRing(18, 0.97, 0.12)} r={0.02} />
      <P geo={G.cyl(0.4, 0.4, 0.2, 18)} m={m.dark} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.35]} />
      {/* injector head + main bell */}
      <group position={[0, 0, -0.4]}>
        <Bell s={s} throatR={0.2} exitR={0.7} throatY={0.0} exitY={-1.25} chamberR={0.36} chamberY={0.32} rings={5} />
        <P geo={G.cyl(0.33, 0.28, 0.2, 18)} m={m.alu} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.35]} />
        <Bolts pts={boltRing(12, 0.31, 0.46).map((p) => [p[0], p[1], p[2], 0, 0, 1])} r={0.018} />
      </group>
      {/* gimbal actuators */}
      {[0, 1].map((i) => <Strut key={i} a={[i ? 0 : 0.8, i ? 0.8 : 0, 0.3]} b={[i ? 0 : 0.34, i ? 0.34 : 0, -0.45]} r={0.03} m={m.alu} />)}
      {/* turbopumps */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 0.42, -0.1, -0.1]}>
          <P geo={G.cyl(0.11, 0.11, 0.4, 14)} m={m.dark} />
          <P geo={G.sph(0.14, 12)} m={m.steel} position={[0, 0.22, 0]} />
        </group>
      ))}
      {/* propellant tanks, strapped to the sides */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 1.58, -0.15, 0.5]}>
          <Strut a={[-sd * 0.3, 0, -0.4]} b={[-sd * 0.58, 0, -0.4]} r={0.03} m={m.alu} />
          <Strut a={[-sd * 0.3, 0, 0.4]} b={[-sd * 0.58, 0, 0.4]} r={0.03} m={m.alu} />
          <P geo={G.cap(0.3, 1.2, 18)} m={m.silver} rotation={[Math.PI / 2, 0, 0]} />
          {[-0.55, 0, 0.55].map((z) => <P key={z} geo={G.tor(0.305, 0.022, 6, 22)} m={m.dark} position={[0, 0, z]} />)}
                    <P geo={G.cyl(0.04, 0.04, 0.14, 8)} m={m.copper} position={[0, 0.34, 0.3]} />
          <P geo={G.box(0.01, 0.2, 0.5)} m={m.orange} position={[sd * 0.3, 0, 0]} />
        </group>
      ))}
      <Pipe pts={[[-1.55, -0.15, 0.0], [-1.0, -0.3, -0.2], [-0.5, -0.1, -0.2]]} r={0.028} />
      <Pipe pts={[[1.55, -0.15, 0.0], [1.0, -0.3, -0.2], [0.5, -0.1, -0.2]]} r={0.028} />
      <Pipe pts={[[-1.55, 0.1, 0.9], [-0.9, 0.3, 0.2], [-0.4, 0.2, -0.2]]} r={0.02} m={m.silver} />
      <Pipe pts={[[1.55, 0.1, 0.9], [0.9, 0.3, 0.2], [0.4, 0.2, -0.2]]} r={0.02} m={m.silver} />
      <Plume color="#fb923c" core="#fff1d6" len={1.7} r={0.62} pos={[0, 0, -1.62]} />
    </group>
  );
}

// ================================================================ ION: two grid thrusters, xenon tank, power processing units
function Ion({ q }: { q: ReturnType<typeof useQ> }) {
  const m = M();
  const s = seg(q, 28);
  return (
    <group>
      <P geo={G.cyl(0.9, 0.9, 0.22, 24)} m={m.dark} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.05]} />
      <Bolts pts={boltRing(16, 0.86, 0.07).map((p) => [p[0], p[1], p[2], 0, 0, 1])} r={0.02} />
      {/* xenon tank on top, with bands */}
      <group position={[0, 0.95, 0.25]}>
        <P geo={G.sph(0.46, 26)} m={m.silver} />
        <P geo={G.tor(0.465, 0.02, 6, 28)} m={m.dark} />
        <P geo={G.tor(0.465, 0.02, 6, 28)} m={m.dark} rotation={[Math.PI / 2, 0, 0]} />
        <P geo={G.cyl(0.06, 0.06, 0.16, 10)} m={m.copper} position={[0, 0.5, 0]} />
        <P geo={G.cyl(0.4, 0.5, 0.12, 12)} m={m.dark} position={[0, -0.5, 0]} />
      </group>
      <Pipe pts={[[0, 0.6, 0.25], [0.3, 0.3, 0.05], [0.5, 0.1, -0.25]]} r={0.022} m={m.silver} />
      <Pipe pts={[[0, 0.6, 0.25], [-0.3, 0.3, 0.05], [-0.5, 0.1, -0.25]]} r={0.022} m={m.silver} />
      {/* power processing units with radiator fins */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 0.2, -0.7, -0.3]}>
          <P geo={G.box(0.8, 0.28, 0.55)} m={m.dark} />
          {Array.from({ length: 9 }, (_, i) => <P key={i} geo={G.box(0.015, 0.2, 0.5)} m={m.alu} position={[-0.34 + i * 0.085, -0.22, 0]} />)}
          <P geo={G.box(0.05, 0.05, 0.02)} m={m.green} position={[0.3, 0.1, 0.28]} />
        </group>
      ))}
      {/* two grid-ion thrusters on gimbal arms */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 0.5, 0, -0.5]}>
          <Strut a={[sd * 0.15, 0.25, 0.4]} b={[0, 0.12, 0.0]} r={0.025} m={m.alu} />
          <Strut a={[sd * 0.15, -0.25, 0.4]} b={[0, -0.12, 0.0]} r={0.025} m={m.alu} />
          <P geo={G.cyl(0.3, 0.3, 0.55, s)} m={m.dark} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.1]} />
          <P geo={G.cyl(0.32, 0.32, 0.05, s)} m={m.gold} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.2]} />
          <P geo={G.tor(0.31, 0.02, 6, s)} m={m.alu} position={[0, 0, -0.24]} />
          {[0.1, 0.19, 0.27].map((rr) => <P key={rr} geo={G.tor(rr, 0.008, 5, 24)} m={m.steel} position={[0, 0, -0.28]} />)}
          <P geo={G.cyl(0.26, 0.26, 0.02, s)} m={m.cyan} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.27]} />
          <P geo={G.tor(0.3, 0.02, 6, s)} m={m.steel} position={[0, 0, 0.1]} />
          <Plume color="#7dd3fc" core="#e0f7ff" len={2.2} r={0.25} pos={[0, 0, -0.3]} />
        </group>
      ))}
    </group>
  );
}

// ================================================================ ADVANCED: main bell + three gimbaled engines, torus tank, plasma coil
function Advanced({ q }: { q: ReturnType<typeof useQ> }) {
  const m = M();
  const s = seg(q, 26);
  const outer = [0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2 + Math.PI / 2; return [Math.cos(a) * 0.78, Math.sin(a) * 0.78] as [number, number]; });
  return (
    <group>
      <P geo={G.cyl(1.0, 0.8, 0.4, 24, true)} m={ds(m.dark)} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.0]} />
      {/* toroidal propellant ring */}
      <P geo={G.tor(1.12, 0.2, 14, seg(q, 40))} m={m.silver} position={[0, 0, 0.55]} />
      {Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return <Strut key={i} a={[Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0.15]} b={[Math.cos(a) * 1.12, Math.sin(a) * 1.12, 0.55]} r={0.035} m={m.alu} />; })}
      {/* main engine */}
      <group position={[0, 0, -0.25]}>
        <Bell s={s} throatR={0.14} exitR={0.5} throatY={0} exitY={-1.0} chamberR={0.26} chamberY={0.34} rings={4} />
        <P geo={G.tor(0.46, 0.05, 8, s)} m={m.gold} position={[0, 0, -0.35]} />
        <P geo={G.tor(0.46, 0.022, 8, s)} m={m.violet} position={[0, 0, -0.35]} />
        <P geo={G.tor(0.42, 0.05, 8, s)} m={m.gold} position={[0, 0, -0.12]} />
      </group>
      {/* three outer gimbal engines */}
      {outer.map(([x, y], i) => (
        <group key={i} position={[x, y, -0.15]}>
          <Strut a={[x * 0.2, y * 0.2, 0.55]} b={[0, 0, 0.05]} r={0.02} m={m.alu} />
          <group scale={0.62}><Bell s={seg(q, 20)} throatR={0.12} exitR={0.42} throatY={0} exitY={-0.8} chamberR={0.2} chamberY={0.34} rings={2} /></group>
          <Plume color="#c4b5fd" core="#f5f3ff" len={1.0} r={0.27} pos={[0, 0, -0.55]} />
          <Pipe pts={[[0, 0, 0.1], [-x * 0.3, -y * 0.3, 0.35], [-x * 0.7, -y * 0.7, 0.55]]} r={0.018} />
        </group>
      ))}
      {/* radiators */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return <group key={i} position={[Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0.45]} rotation={[0, 0, a]}>
          <P geo={G.box(0.55, 0.03, 0.9)} m={m.paint} />
          <P geo={G.box(0.06, 0.05, 0.9)} m={m.alu} position={[-0.3, 0, 0]} />
        </group>;
      })}
      <Plume color="#a78bfa" core="#ede9fe" len={2.0} r={0.5} pos={[0, 0, -1.3]} />
    </group>
  );
}

export function Engine({ id, glow: _glow }: { id: string | null; glow?: MutableRefObject<THREE.MeshStandardMaterial[]> }) {
  const q = useQ();
  if (!id) return null;
  // group origin = the aft end of the bus (z = -2.6)
  return (
    <group position={[0, 0, -2.6]}>
      {id === 'chemical' && <Chemical q={q} />}
      {id === 'ion' && <Ion q={q} />}
      {id === 'advprop' && <Advanced q={q} />}
    </group>
  );
}
