// Science payload instruments. Each is built along +Z (the direction it points) and sits on a hardpoint.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { G, P, M, Bolts, Strut, Pipe, ds, useQ, seg } from './kit';

function MountPlate({ w = 0.5, d = 0.55 }: { w?: number; d?: number }) {
  const m = M();
  return (
    <group position={[0, -0.2, -0.05]}>
      <P geo={G.box(w, 0.05, d)} m={m.dark} />
      <Bolts pts={[[w / 2 - 0.05, 0.03, d / 2 - 0.05, 0, 1, 0], [-w / 2 + 0.05, 0.03, d / 2 - 0.05, 0, 1, 0], [w / 2 - 0.05, 0.03, -d / 2 + 0.05, 0, 1, 0], [-w / 2 + 0.05, 0.03, -d / 2 + 0.05, 0, 1, 0]]} r={0.016} />
    </group>
  );
}

// ---- Lunar spectrometer: telescope with baffled barrel, sun hood, gold-wrapped electronics
function Spectrometer() {
  const m = M();
  const q = useQ();
  const s = seg(q, 20);
  return (
    <group>
      <MountPlate />
      <P geo={G.box(0.4, 0.3, 0.38)} m={m.gold} position={[0, -0.02, -0.12]} />
      <P geo={G.box(0.42, 0.02, 0.3)} m={m.paint} position={[0, 0.15, -0.12]} />
      <group position={[0, 0.02, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <P geo={G.lathe([[0.15, -0.3], [0.15, 0.3], [0.17, 0.32], [0.17, 0.36]], s)} m={ds(m.alu)} />
        {[-0.2, -0.05, 0.1, 0.25].map((y) => <P key={y} geo={G.tor(0.158, 0.012, 6, s)} m={m.steel} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} />)}
        {/* sun hood */}
        <P geo={G.cyl(0.26, 0.17, 0.3, s, true)} m={ds(m.paint)} position={[0, 0.5, 0]} />
        <P geo={G.tor(0.26, 0.012, 6, s)} m={m.alu} position={[0, 0.65, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <P geo={G.cyl(0.14, 0.14, 0.02, s)} m={m.lens} position={[0, 0.34, 0]} />
        <P geo={G.tor(0.14, 0.01, 6, s)} m={m.amber} position={[0, 0.345, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
      <P geo={G.box(0.3, 0.02, 0.22)} m={m.silver} position={[0.26, 0.05, -0.15]} rotation={[0, 0, 0.3]} />
      <Pipe pts={[[0.1, 0, -0.1], [0.12, 0.12, 0.05], [0.08, 0.1, 0.2]]} r={0.012} m={m.black} />
    </group>
  );
}

// ---- Seismic sensor: probe in a cradle with folded legs, tether reel and whip antenna
function Seismic() {
  const m = M();
  return (
    <group>
      <MountPlate w={0.46} d={0.7} />
      {/* cradle clamps */}
      {[-0.18, 0.18].map((z) => <P key={z} geo={G.tor(0.2, 0.025, 6, 18)} m={m.alu} position={[0, 0.02, z]} />)}
      <group position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <P geo={G.cyl(0.17, 0.17, 0.55, 18)} m={m.paint} />
        {[-0.18, 0, 0.18].map((y) => <P key={y} geo={G.tor(0.172, 0.01, 6, 18)} m={m.dark} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} />)}
        <P geo={G.cone(0.17, 0.35, 18)} m={m.steel} position={[0, 0.45, 0]} />
        <P geo={G.sph(0.17, 14)} m={m.dark} position={[0, -0.28, 0]} />
      </group>
      {/* folded landing legs */}
      {[0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2 + 0.6; return <Strut key={i} a={[Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.2]} b={[Math.cos(a) * 0.3, Math.sin(a) * 0.3, -0.12]} r={0.015} m={m.alu} />; })}
      {/* tether reel */}
      <P geo={G.cyl(0.11, 0.11, 0.08, 16)} m={m.dark} position={[0.26, 0.05, -0.2]} rotation={[0, 0, Math.PI / 2]} />
      <P geo={G.tor(0.09, 0.025, 6, 16)} m={m.gold} position={[0.3, 0.05, -0.2]} rotation={[0, Math.PI / 2, 0]} />
      <P geo={G.cyl(0.01, 0.01, 0.55, 6)} m={m.steel} position={[-0.22, 0.28, -0.25]} rotation={[0.1, 0, 0.1]} />
      <P geo={G.sph(0.03, 8)} m={m.green} position={[0, 0.2, -0.25]} />
    </group>
  );
}

// ---- Signal analyzer: processor with heat fins and a rotating ring antenna array
function Analyzer() {
  const m = M();
  const ring = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => { if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.8; });
  return (
    <group>
      <MountPlate />
      <P geo={G.box(0.5, 0.28, 0.32)} m={m.dark} position={[0, -0.02, -0.12]} />
      {Array.from({ length: 8 }, (_, i) => <P key={i} geo={G.box(0.015, 0.1, 0.28)} m={m.alu} position={[-0.21 + i * 0.06, 0.17, -0.12]} />)}
      {[-0.15, -0.05, 0.05, 0.15].map((x) => <P key={x} geo={G.box(0.035, 0.035, 0.02)} m={x > 0 ? m.green : m.cyan} position={[x, 0.0, 0.05]} />)}
      <P geo={G.cyl(0.04, 0.05, 0.3, 10)} m={m.alu} position={[0, 0.05, 0.2]} rotation={[Math.PI / 2, 0, 0]} />
      <group position={[0, 0.05, 0.4]} ref={ring}>
        <P geo={G.tor(0.3, 0.02, 6, 28)} m={m.steel} />
        <P geo={G.tor(0.18, 0.012, 6, 24)} m={m.paint} />
        {Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return <Strut key={i} a={[Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0]} b={[Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.0]} r={0.008} m={m.alu} />; })}
        {Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return <P key={i} geo={G.cyl(0.012, 0.012, 0.14, 6)} m={m.gold} position={[Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.07]} rotation={[Math.PI / 2, 0, 0]} />; })}
        <P geo={G.sph(0.07, 12)} m={m.green} position={[0, 0, 0.04]} />
      </group>
    </group>
  );
}

// ---- High-resolution camera: telephoto lens, glass element, hood, heat sink and gimbal yoke
function Camera() {
  const m = M();
  const q = useQ();
  const s = seg(q, 22);
  return (
    <group>
      <MountPlate w={0.55} d={0.6} />
      {/* gimbal yoke */}
      {[-1, 1].map((sd) => <P key={sd} geo={G.box(0.05, 0.4, 0.14)} m={m.alu} position={[sd * 0.25, 0.0, -0.05]} />)}
      <P geo={G.cyl(0.04, 0.04, 0.56, 10)} m={m.steel} position={[0, 0.0, -0.05]} rotation={[0, 0, Math.PI / 2]} />
      <P geo={G.box(0.4, 0.32, 0.46)} m={m.paint} position={[0, 0.0, -0.05]} />
      {Array.from({ length: 7 }, (_, i) => <P key={i} geo={G.box(0.015, 0.07, 0.4)} m={m.alu} position={[-0.17 + i * 0.057, 0.2, -0.05]} />)}
      <P geo={G.box(0.12, 0.05, 0.02)} m={m.red} position={[0.12, 0.08, -0.29]} />
      {/* lens barrel */}
      <group position={[0, 0, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <P geo={G.lathe([[0.12, -0.2], [0.12, 0.05], [0.16, 0.08], [0.16, 0.42], [0.2, 0.46], [0.2, 0.55]], s)} m={ds(m.black)} />
        {[0.12, 0.28, 0.4].map((y) => <P key={y} geo={G.tor(0.165, 0.014, 6, s)} m={m.alu} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} />)}
        <P geo={G.cyl(0.185, 0.185, 0.03, s)} m={m.lens} position={[0, 0.54, 0]} />
        <P geo={G.tor(0.17, 0.009, 6, s)} m={m.cyan} position={[0, 0.555, 0]} rotation={[Math.PI / 2, 0, 0]} />
        {/* hood */}
        <P geo={G.cyl(0.3, 0.21, 0.22, s, true)} m={ds(m.dark)} position={[0, 0.66, 0]} />
        <P geo={G.tor(0.3, 0.012, 6, s)} m={m.alu} position={[0, 0.77, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
      <P geo={G.cyl(0.09, 0.09, 0.05, 14)} m={m.dark} position={[0.22, -0.12, 0.2]} rotation={[0, 0, Math.PI / 2]} />
    </group>
  );
}

export function Instrument({ id }: { id: string }) {
  if (id === 'spectrometer') return <Spectrometer />;
  if (id === 'seismic') return <Seismic />;
  if (id === 'analyzer') return <Analyzer />;
  return <Camera />;
}
