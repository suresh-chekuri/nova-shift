// Spacecraft bus (STRUCTURE): three clearly different frames.
import { useMemo } from 'react';
import { G, P, M, Bolts, boltRing, Strut, Pipe, useQ, seg, ds } from './kit';

const A = (i: number, n: number, off = 0) => (i / n) * Math.PI * 2 + off;

// small helpers used by all three frames -------------------------------------------------
function Rcs({ r, z }: { r: number; z: number }) {
  // four thruster clusters (reaction-control) around the hull
  const m = M();
  return (
    <group>
      {[0, 1, 2, 3].map((i) => {
        const a = A(i, 4, Math.PI / 4);
        return (
          <group key={i} position={[Math.cos(a) * r, Math.sin(a) * r, z]} rotation={[0, 0, a - Math.PI / 2]}>
            <P geo={G.box(0.2, 0.1, 0.2)} m={m.dark} position={[0, 0.04, 0]} />
            <P geo={G.cone(0.045, 0.14, 10)} m={m.steel} position={[0.05, 0.14, 0]} rotation={[0, 0, -0.2]} />
            <P geo={G.cone(0.045, 0.14, 10)} m={m.steel} position={[-0.05, 0.14, 0]} rotation={[0, 0, 0.2]} />
            <P geo={G.cone(0.04, 0.12, 8)} m={m.steel} position={[0, 0.12, 0.07]} rotation={[0.5, 0, 0]} />
          </group>
        );
      })}
    </group>
  );
}

function StarTracker({ pos }: { pos: [number, number, number] }) {
  const m = M();
  return (
    <group position={pos}>
      <P geo={G.box(0.2, 0.08, 0.2)} m={m.dark} />
      <P geo={G.cyl(0.07, 0.09, 0.16, 12, true)} m={ds(m.black)} position={[0, 0.12, 0]} />
      <P geo={G.cyl(0.055, 0.055, 0.02, 12)} m={m.lens} position={[0, 0.06, 0]} />
    </group>
  );
}

function Noseport({ r, z }: { r: number; z: number }) {
  const m = M();
  return (
    <group position={[0, 0, z]}>
      <P geo={G.tor(r * 0.34, 0.035, 8, 24)} m={m.gold} />
      <P geo={G.cyl(r * 0.3, r * 0.3, 0.05, 20)} m={m.dark} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.03]} />
      <P geo={G.sph(0.07, 12)} m={m.cyan} position={[0, 0, 0.1]} />
    </group>
  );
}

export function Bus({ id }: { id: string | null }) {
  if (id === 'light') return <LightFrame />;
  if (id === 'reinforced') return <ReinforcedFrame />;
  if (id === 'standard') return <StandardFrame />;
  return null;
}

// ================================================================ STANDARD: painted monocoque bus with gold thermal blankets
function StandardFrame() {
  const q = useQ();
  const r = 1.0;
  const m = M();
  const s = seg(q, 32);
  const shell = useMemo(() => G.lathe([[0.88, -2.6], [0.96, -2.52], [1.0, -2.4], [1.0, 2.35], [0.96, 2.5], [0.9, 2.6]], s), [s]);
  const nose = useMemo(() => G.lathe([[0.9, 2.6], [0.8, 2.95], [0.58, 3.2], [0.3, 3.38], [0.1, 3.45], [0, 3.46]], s), [s]);
  return (
    <group>
      <P geo={shell} m={m.paint} rotation={[Math.PI / 2, 0, 0]} />
      <P geo={nose} m={m.paint} rotation={[Math.PI / 2, 0, 0]} />
      <Noseport r={r} z={3.4} />
      {/* gold multi-layer insulation over the lower half */}
      <P geo={G.arc(r + 0.015, 2.0, Math.PI * 0.95, Math.PI * 1.1, s)} m={ds(m.gold)} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.35]} />
      <P geo={G.arc(r + 0.015, 1.2, Math.PI * 0.95, Math.PI * 1.1, s)} m={ds(m.gold)} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 1.55]} />
      {/* structural rings with bolts */}
      {[-2.3, -0.2, 2.15].map((z) => <P key={z} geo={G.tor(r + 0.01, 0.045, 8, s)} m={m.steel} position={[0, 0, z]} />)}
      <P geo={G.tor(r + 0.012, 0.035, 8, s)} m={m.orange} position={[0, 0, 1.0]} />
      <Bolts pts={[...boltRing(24, r + 0.05, -2.3), ...boltRing(24, r + 0.05, -0.2), ...boltRing(24, r + 0.05, 2.15)]} />
      {/* equipment bays on both sides */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * (r + 0.1), -0.1, -0.2]}>
          <P geo={G.box(0.24, 0.7, 1.5)} m={m.paint} />
          <P geo={G.box(0.02, 0.5, 1.2)} m={m.dark} position={[sd * 0.125, 0, 0]} />
          {[-0.45, -0.15, 0.15, 0.45].map((z) => <P key={z} geo={G.box(0.03, 0.05, 0.05)} m={z > 0 ? m.green : m.amber} position={[sd * 0.135, 0.2, z]} />)}
          <Bolts pts={[[sd * 0.125, 0.3, -0.65, sd, 0, 0], [sd * 0.125, 0.3, 0.65, sd, 0, 0], [sd * 0.125, -0.3, -0.65, sd, 0, 0], [sd * 0.125, -0.3, 0.65, sd, 0, 0]]} r={0.018} />
        </group>
      ))}
      {/* radiator panel on top (louvres) */}
      <group position={[0, r + 0.03, -1.3]}>
        <P geo={G.box(1.1, 0.04, 1.6)} m={m.paint} />
        {Array.from({ length: 10 }, (_, i) => <P key={i} geo={G.box(1.0, 0.03, 0.04)} m={m.dark} position={[0, 0.03, -0.7 + i * 0.155]} />)}
      </group>
      <StarTracker pos={[0.45, r + 0.02, 1.9]} />
      <StarTracker pos={[-0.45, r + 0.02, 1.9]} />
      <Rcs r={r + 0.02} z={2.05} />
      <Rcs r={r + 0.02} z={-2.0} />
      {/* handrails and a status window */}
      {[-1, 1].map((sd) => <Pipe key={sd} pts={[[sd * 0.75, 0.74, 0.6], [sd * 0.78, 0.8, 1.0], [sd * 0.78, 0.8, 1.6], [sd * 0.75, 0.74, 2.0]]} r={0.012} m={m.alu} />)}
      <P geo={G.box(0.5, 0.02, 0.32)} m={m.cyan} position={[0, r + 0.0, 2.0]} />
    </group>
  );
}

// ================================================================ LIGHT: open truss space-frame with exposed tanks
function LightFrame() {
  const q = useQ();
  const m = M();
  const R = 0.8;
  const zs = [-2.4, -0.8, 0.8, 2.4];
  const node = (i: number, z: number): [number, number, number] => [Math.cos(A(i, 8, Math.PI / 8)) * R, Math.sin(A(i, 8, Math.PI / 8)) * R, z];
  const braces = useMemo(() => {
    const out: { a: [number, number, number]; b: [number, number, number] }[] = [];
    for (let k = 0; k < zs.length - 1; k++) for (let i = 0; i < 8; i++) {
      out.push({ a: node(i, zs[k]), b: node((i + 1) % 8, zs[k + 1]) });
      if (q !== 'low') out.push({ a: node((i + 1) % 8, zs[k]), b: node(i, zs[k + 1]) });
    }
    return out;
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      {/* longerons */}
      {Array.from({ length: 8 }, (_, i) => <Strut key={'l' + i} a={node(i, -2.5)} b={node(i, 2.5)} r={0.035} m={m.alu} />)}
      {/* ring frames (octagons) */}
      {zs.map((z) => <P key={z} geo={G.tor(R * 1.04, 0.035, 6, 8)} m={m.steel} position={[0, 0, z]} rotation={[0, 0, Math.PI / 8]} />)}
      {braces.map((b, i) => <Strut key={'b' + i} a={b.a} b={b.b} r={0.016} m={m.steel} />)}
      <Bolts pts={zs.flatMap((z) => Array.from({ length: 8 }, (_, i) => { const n = node(i, z); return [n[0] * 1.03, n[1] * 1.03, z, n[0], n[1], 0]; }))} r={0.02} h={0.03} m={m.dark} />
      {/* exposed propellant tanks, strapped in */}
      {[-1.4, 0.0].map((z) => (
        <group key={z} position={[0, -0.05, z]}>
          <P geo={G.sph(0.42, 24)} m={m.silver} />
          <P geo={G.tor(0.425, 0.018, 6, 28)} m={m.dark} rotation={[Math.PI / 2, 0, 0]} />
          <P geo={G.tor(0.425, 0.018, 6, 28)} m={m.dark} rotation={[0, Math.PI / 2, 0]} />
          <P geo={G.cyl(0.05, 0.05, 0.18, 8)} m={m.steel} position={[0, 0.46, 0]} />
        </group>
      ))}
      <Pipe pts={[[0, 0.2, -1.4], [0.3, 0.45, -0.8], [0.3, 0.45, 0], [0.1, 0.3, 0.9]]} r={0.022} />
      <Pipe pts={[[0, -0.3, -1.4], [-0.3, -0.5, -0.8], [-0.3, -0.5, 0], [-0.1, -0.3, 0.9]]} r={0.022} m={m.silver} />
      {/* avionics block + reaction wheel */}
      <group position={[0, 0, 1.55]}>
        <P geo={G.box(0.62, 0.5, 0.7)} m={m.dark} />
        <P geo={G.box(0.5, 0.02, 0.58)} m={m.paint} position={[0, 0.26, 0]} />
        {[-0.2, -0.1, 0, 0.1, 0.2].map((x) => <P key={x} geo={G.box(0.03, 0.04, 0.04)} m={x > 0 ? m.green : m.red} position={[x, 0.1, 0.36]} />)}
      </group>
      <P geo={G.cyl(0.16, 0.16, 0.08, 16)} m={m.alu} position={[0.35, -0.45, 0.4]} rotation={[0, 0, Math.PI / 2]} />
      {/* a few skin patches so it still reads as a spacecraft */}
      <P geo={G.arc(R + 0.02, 1.4, -0.35, 0.7 * Math.PI / 2, 12)} m={ds(m.paint)} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 1.6]} />
      <P geo={G.arc(R + 0.02, 1.2, Math.PI * 0.55, 0.7, 12)} m={ds(m.gold)} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.5]} />
      {/* nose: four struts to a sensor ball */}
      {[0, 1, 2, 3].map((i) => <Strut key={i} a={node(i * 2, 2.4)} b={[0, 0, 3.35]} r={0.03} m={m.alu} />)}
      <P geo={G.sph(0.17, 16)} m={m.dark} position={[0, 0, 3.4]} />
      <P geo={G.sph(0.07, 10)} m={m.cyan} position={[0, 0, 3.55]} />
      <StarTracker pos={[0.3, R + 0.02, 2.2]} />
      <Rcs r={R + 0.04} z={2.3} />
      <Rcs r={R + 0.04} z={-2.3} />
    </group>
  );
}

// ================================================================ REINFORCED: faceted armored hull with ribs and hazard stripes
function ReinforcedFrame() {
  const m = M();
  const R = 1.25;
  const apo = R * Math.cos(Math.PI / 8);
  const plate = (i: number, z: number, len: number) => {
    const a = A(i, 8, Math.PI / 8);
    return (
      <group key={i + ':' + z} position={[Math.cos(a) * (apo + 0.05), Math.sin(a) * (apo + 0.05), z]} rotation={[0, 0, a - Math.PI / 2]}>
        <P geo={G.box(0.92, 0.1, len)} m={m.armor} />
        <P geo={G.box(0.6, 0.012, 0.1)} m={m.hazard} position={[0, 0.056, len / 2 - 0.12]} />
        <P geo={G.box(0.6, 0.012, 0.1)} m={m.dark} position={[0, 0.057, len / 2 - 0.25]} />
      </group>
    );
  };
  const boltPts = useMemo(() => {
    const pts: number[][] = [];
    for (let i = 0; i < 8; i++) { const a = A(i, 8, Math.PI / 8); for (const z of [-2.1, -0.65, 0.65, 2.1]) for (const t of [-0.38, 0.38]) {
      const c = Math.cos(a), s = Math.sin(a);
      pts.push([c * (apo + 0.115) - s * t, s * (apo + 0.115) + c * t, z, c, s, 0]);
    } }
    return pts;
  }, [apo]);
  return (
    <group>
      <P geo={G.cyl(R, R, 5.2, 8)} m={m.armor} rotation={[Math.PI / 2, 0, 0]} />
      {Array.from({ length: 8 }, (_, i) => plate(i, -1.4, 2.3))}
      {Array.from({ length: 8 }, (_, i) => plate(i, 1.35, 2.3))}
      <Bolts pts={boltPts} r={0.025} h={0.03} m={m.alu} />
      {/* heavy ribs */}
      {[-2.5, -0.0, 2.5].map((z) => <P key={z} geo={G.tor(R * 1.04, 0.1, 6, 8)} m={m.dark} position={[0, 0, z]} />)}
      {[-1.25, 1.25].map((z) => <P key={z} geo={G.tor(R * 1.02, 0.06, 6, 8)} m={m.orange} position={[0, 0, z]} />)}
      {/* armored nose with a bumper ring */}
      <P geo={G.cyl(0.7, R * 0.98, 0.9, 8)} m={m.armor} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 3.05]} />
      <P geo={G.cyl(0.62, 0.7, 0.3, 8)} m={m.dark} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 3.65]} />
      <P geo={G.tor(0.66, 0.05, 6, 8)} m={m.hazard} position={[0, 0, 3.8]} />
      <Noseport r={1.4} z={3.85} />
      {/* sensor pods and cable trays */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * (apo + 0.18), 0.1, 0.3]}>
          <P geo={G.box(0.2, 0.5, 2.4)} m={m.dark} />
          {[-0.9, -0.3, 0.3, 0.9].map((z) => <P key={z} geo={G.box(0.04, 0.06, 0.06)} m={z < 0 ? m.amber : m.green} position={[sd * 0.1, 0.12, z]} />)}
        </group>
      ))}
      <P geo={G.box(0.7, 0.12, 2.8)} m={m.dark} position={[0, R + 0.08, -0.2]} />
      {Array.from({ length: 9 }, (_, i) => <P key={i} geo={G.box(0.6, 0.02, 0.05)} m={m.steel} position={[0, R + 0.15, -1.45 + i * 0.3]} />)}
      <StarTracker pos={[0.5, R + 0.1, 1.9]} />
      <StarTracker pos={[-0.5, R + 0.1, 1.9]} />
      <Rcs r={R + 0.02} z={2.35} />
      <Rcs r={R + 0.02} z={-2.35} />
      <P geo={G.box(0.7, 0.02, 0.4)} m={m.cyan} position={[0, apo + 0.12, 2.2]} />
    </group>
  );
}
