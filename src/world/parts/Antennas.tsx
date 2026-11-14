// Communications: small dish, high-gain dish with feed horn, deep-space array. Dishes scan slowly.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { G, P, M, Bolts, Strut, Pipe, ds } from './kit';
import { useQ, seg } from './kit';

// a parabolic reflector with rim, back ribs, struts and a feed horn at the focus. Dish opens toward +Y.
function Reflector({ r, depth, q, feedLen = 0.25, ribs = 6 }: { r: number; depth: number; q: ReturnType<typeof useQ>; feedLen?: number; ribs?: number }) {
  const m = M();
  const s = seg(q, 32);
  const focus = Math.max(depth * 1.7, 0.2) + feedLen * 0.4;
  return (
    <group>
      <P geo={G.dish(r, depth, s)} m={ds(m.paint)} />
      <P geo={G.tor(r, r * 0.022, 6, s)} m={m.alu} position={[0, depth, 0]} rotation={[Math.PI / 2, 0, 0]} />
      {/* ribs on the back */}
      {Array.from({ length: ribs }, (_, i) => { const a = (i / ribs) * Math.PI * 2; return <Strut key={i} a={[0, -0.04, 0]} b={[Math.cos(a) * r * 0.95, depth - 0.02, Math.sin(a) * r * 0.95]} r={r * 0.012} m={m.steel} />; })}
      <P geo={G.cyl(r * 0.12, r * 0.16, 0.08, 14)} m={m.dark} position={[0, -0.05, 0]} />
      {/* feed support struts */}
      {[0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2 + 0.5; return <Strut key={i} a={[Math.cos(a) * r * 0.8, depth * 0.64, Math.sin(a) * r * 0.8]} b={[0, focus - 0.02, 0]} r={r * 0.014} m={m.alu} />; })}
      {/* feed horn + sub-reflector */}
      <P geo={G.cone(r * 0.1, feedLen, 14, true)} m={ds(m.gold)} position={[0, focus - feedLen / 2, 0]} rotation={[Math.PI, 0, 0]} />
      <P geo={G.cyl(r * 0.05, r * 0.05, feedLen * 0.6, 10)} m={m.dark} position={[0, focus + feedLen * 0.2, 0]} />
      <P geo={G.sph(r * 0.05, 10)} m={m.cyan} position={[0, focus + feedLen * 0.55, 0]} />
    </group>
  );
}

// ---------------------------------------------------------------- BASIC: small dish on a simple azimuth/elevation mount
function Basic({ q }: { q: ReturnType<typeof useQ> }) {
  const m = M();
  const az = useRef<THREE.Group>(null!);
  const el = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (az.current) az.current.rotation.y = Math.sin(t * 0.5) * 0.9;
    if (el.current) el.current.rotation.x = 0.7 + Math.sin(t * 0.8) * 0.12;
  });
  return (
    <group>
      <P geo={G.cyl(0.07, 0.09, 0.45, 10)} m={m.alu} position={[0, 0.4, 0]} />
      <P geo={G.cyl(0.14, 0.16, 0.12, 16)} m={m.dark} position={[0, 0.66, 0]} />
      <group ref={az} position={[0, 0.72, 0]}>
        <P geo={G.box(0.05, 0.22, 0.05)} m={m.alu} position={[0.15, 0.1, 0]} />
        <P geo={G.box(0.05, 0.22, 0.05)} m={m.alu} position={[-0.15, 0.1, 0]} />
        <group ref={el} position={[0, 0.2, 0]}>
          <P geo={G.cyl(0.03, 0.03, 0.34, 8)} m={m.steel} rotation={[0, 0, Math.PI / 2]} />
          <group position={[0, 0.05, 0]}><Reflector r={0.42} depth={0.12} q={q} feedLen={0.18} ribs={4} /></group>
        </group>
      </group>
      <P geo={G.cyl(0.012, 0.012, 0.35, 6)} m={m.steel} position={[0.2, 0.55, -0.2]} />
    </group>
  );
}

// ---------------------------------------------------------------- HIGH-GAIN: big dish, two-axis gimbal, LNA, whip antenna
function HighGain({ q }: { q: ReturnType<typeof useQ> }) {
  const m = M();
  const az = useRef<THREE.Group>(null!);
  const el = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (az.current) az.current.rotation.y = Math.sin(t * 0.38) * 0.9;
    if (el.current) el.current.rotation.x = 0.75 + Math.sin(t * 0.6) * 0.1;
  });
  return (
    <group>
      <P geo={G.cyl(0.08, 0.1, 0.7, 10)} m={m.alu} position={[0, 0.5, 0]} />
      <Strut a={[0.0, 0.35, 0]} b={[0.32, 0.18, 0.0]} r={0.02} m={m.steel} />
      <Strut a={[0.0, 0.35, 0]} b={[-0.32, 0.18, 0.0]} r={0.02} m={m.steel} />
      <P geo={G.cyl(0.2, 0.22, 0.18, 20)} m={m.gold} position={[0, 0.88, 0]} />
      <P geo={G.cyl(0.16, 0.16, 0.06, 20)} m={m.dark} position={[0, 0.99, 0]} />
      <group ref={az} position={[0, 1.02, 0]}>
        {[-1, 1].map((sd) => <P key={sd} geo={G.box(0.06, 0.42, 0.1)} m={m.alu} position={[sd * 0.26, 0.19, 0]} />)}
        <P geo={G.box(0.54, 0.05, 0.1)} m={m.alu} position={[0, 0.0, 0]} />
        <group ref={el} position={[0, 0.34, 0]}>
          <P geo={G.cyl(0.07, 0.07, 0.6, 12)} m={m.dark} rotation={[0, 0, Math.PI / 2]} />
          <P geo={G.box(0.2, 0.18, 0.2)} m={m.dark} position={[0, 0.0, -0.22]} />
          <group position={[0, 0.08, 0]}><Reflector r={0.8} depth={0.26} q={q} feedLen={0.3} ribs={8} /></group>
        </group>
      </group>
      {/* omnidirectional whip + low-gain horn on the base */}
      <P geo={G.cyl(0.012, 0.012, 0.6, 6)} m={m.steel} position={[0.3, 0.62, -0.28]} rotation={[0.2, 0, -0.15]} />
      <P geo={G.cone(0.08, 0.16, 10, true)} m={ds(m.gold)} position={[-0.3, 0.5, -0.1]} rotation={[0.4, 0, 0.3]} />
      <Pipe pts={[[0, 0.1, 0], [0.1, 0.5, -0.1], [0.12, 0.9, -0.12]]} r={0.012} m={m.black} />
      <Bolts pts={[[0.18, 0.78, 0.1, 0, 1, 0], [-0.18, 0.78, 0.1, 0, 1, 0], [0.18, 0.78, -0.1, 0, 1, 0], [-0.18, 0.78, -0.1, 0, 1, 0]]} r={0.014} m={m.alu} />
    </group>
  );
}

// ---------------------------------------------------------------- DEEP SPACE ARRAY: lattice mast, four dishes on a rotating head, phased-array panel
function Deep({ q }: { q: ReturnType<typeof useQ> }) {
  const m = M();
  const head = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => { if (head.current) head.current.rotation.y = clock.elapsedTime * 0.25; });
  const cols = q === 'low' ? 4 : 6;
  return (
    <group>
      {/* lattice mast */}
      {[0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2; return <Strut key={i} a={[Math.cos(a) * 0.2, 0.25, Math.sin(a) * 0.2]} b={[Math.cos(a) * 0.1, 1.45, Math.sin(a) * 0.1]} r={0.022} m={m.alu} />; })}
      {[0.5, 0.85, 1.2].map((y) => <P key={y} geo={G.tor(0.2 - y * 0.07, 0.012, 5, 3)} m={m.steel} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0.5]} />)}
      <P geo={G.cyl(0.26, 0.3, 0.14, 18)} m={m.gold} position={[0, 0.3, 0]} />
      <group ref={head} position={[0, 1.5, 0]}>
        <P geo={G.cyl(0.2, 0.2, 0.18, 18)} m={m.dark} />
        <P geo={G.tor(0.21, 0.02, 6, 20)} m={m.steel} rotation={[Math.PI / 2, 0, 0]} />
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <group key={i} rotation={[0, a, 0]}>
              <Strut a={[0.1, 0, 0]} b={[0.55, 0.06, 0]} r={0.025} m={m.alu} />
              <group position={[0.7, 0.12, 0]} rotation={[0, 0, -0.9]}><Reflector r={0.42} depth={0.14} q={q} feedLen={0.18} ribs={5} /></group>
            </group>
          );
        })}
        <P geo={G.sph(0.1, 12)} m={m.violet} position={[0, 0.2, 0]} />
        <P geo={G.cyl(0.012, 0.012, 0.45, 6)} m={m.steel} position={[0, 0.45, 0]} />
      </group>
      {/* phased-array patch panel (instanced elements are plain meshes here: small count) */}
      <group position={[0, 0.65, 0.4]} rotation={[-0.5, 0, 0]}>
        <P geo={G.box(0.7, 0.04, 0.5)} m={m.dark} />
        {Array.from({ length: cols * 4 }, (_, k) => <P key={k} geo={G.box(0.07, 0.012, 0.07)} m={m.gold} position={[-0.3 + (k % cols) * (0.6 / (cols - 1)), 0.03, -0.18 + Math.floor(k / cols) * 0.12]} />)}
        {[0, 1, 2].map((i) => <P key={i} geo={G.box(0.05, 0.05, 0.02)} m={m.green} position={[-0.25 + i * 0.25, 0.0, 0.27]} />)}
      </group>
      <Pipe pts={[[0, 0.3, 0], [0.12, 0.8, 0.1], [0.1, 1.4, 0.05]]} r={0.014} m={m.black} />
    </group>
  );
}

export function Antenna({ id }: { id: string | null }) {
  const q = useQ();
  const m = M();
  if (!id) return null;
  // group origin matches the COMMS hardpoint on top of the bus
  return (
    <group position={[0, 1.0, 0.9]}>
      {/* mounting plinth (works on every frame type) */}
      <P geo={G.cyl(0.24, 0.3, 0.55, 18)} m={m.dark} position={[0, 0.0, 0]} />
      <P geo={G.tor(0.26, 0.03, 6, 20)} m={m.alu} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <Bolts pts={Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return [Math.cos(a) * 0.2, 0.28, Math.sin(a) * 0.2, 0, 1, 0]; })} r={0.014} />
      <group position={[0, 0.3, 0]}>
        {id === 'basic' && <Basic q={q} />}
        {id === 'highgain' && <HighGain q={q} />}
        {id === 'deep' && <Deep q={q} />}
      </group>
    </group>
  );
}
