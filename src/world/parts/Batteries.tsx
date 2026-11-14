// Battery pods (BATTERY): compact pack, caged twin pack, advanced triple pack with heat pipes.
import { RoundedBox } from '@react-three/drei';
import { G, P, M, Bolts, Strut, Pipe } from './kit';

function Pack({ w, h, d, x = 0, led = 'green' }: { w: number; h: number; d: number; x?: number; led?: 'green' | 'cyan' | 'amber' }) {
  const m = M();
  const fins = Math.max(4, Math.round(d / 0.12));
  return (
    <group position={[x, 0, 0]}>
      <RoundedBox args={[w, h, d]} radius={0.05} smoothness={3} castShadow receiveShadow material={m.paint} />
      {/* terminals + status LEDs on the front face */}
      <P geo={G.box(w * 0.7, 0.05, 0.02)} m={m.black} position={[0, h * 0.18, d / 2 + 0.005]} />
      {[-0.3, -0.1, 0.1, 0.3].map((t) => <P key={t} geo={G.box(0.04, 0.04, 0.02)} m={m[led]} position={[t * w, h * 0.18, d / 2 + 0.02]} />)}
      <P geo={G.cyl(0.035, 0.035, 0.05, 8)} m={m.copper} position={[-w * 0.25, -h * 0.15, d / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]} />
      <P geo={G.cyl(0.035, 0.035, 0.05, 8)} m={m.steel} position={[w * 0.25, -h * 0.15, d / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]} />
      {/* cooling fins on both sides */}
      {[-1, 1].map((sd) => Array.from({ length: fins }, (_, i) => <P key={sd + ':' + i} geo={G.box(0.03, h * 0.7, 0.025)} m={m.alu} position={[sd * (w / 2 + 0.015), 0, -d / 2 + 0.12 + i * ((d - 0.24) / (fins - 1))]} />))}
      <P geo={G.box(w * 0.55, 0.012, 0.35)} m={m.hazard} position={[0, h / 2 + 0.002, 0]} />
    </group>
  );
}

export function Battery({ id }: { id: string | null }) {
  const m = M();
  if (!id) return null;
  const n = id === 'compact' ? 1 : id === 'standard' ? 2 : 3;
  const w = id === 'advanced' ? 0.62 : id === 'standard' ? 0.52 : 0.5;
  const h = id === 'advanced' ? 0.5 : 0.4;
  const d = id === 'compact' ? 1.0 : id === 'standard' ? 1.3 : 1.7;
  const gap = w + 0.1;
  const width = n * gap;
  // group origin matches the BATTERY hardpoint under the bus
  return (
    <group position={[0, -1.5, -0.6]}>
      {/* pylons up into the hull */}
      {[-1, 1].map((sd) => <P key={sd} geo={G.cyl(0.05, 0.07, 0.8, 8)} m={m.alu} position={[sd * (width / 2 - 0.1), 0.45, d * 0.3]} />)}
      {[-1, 1].map((sd) => <P key={'b' + sd} geo={G.cyl(0.05, 0.07, 0.8, 8)} m={m.alu} position={[sd * (width / 2 - 0.1), 0.45, -d * 0.3]} />)}
      {Array.from({ length: n }, (_, i) => <Pack key={i} w={w} h={h} d={d} x={(i - (n - 1) / 2) * gap} led={id === 'advanced' ? 'cyan' : i === 0 ? 'green' : 'amber'} />)}
      {id !== 'compact' && (
        <>
          {/* aluminium cage */}
          {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Strut key={sx + ':' + sz} a={[sx * (width / 2 + 0.03), -h / 2 - 0.03, sz * (d / 2 + 0.03)]} b={[sx * (width / 2 + 0.03), h / 2 + 0.03, sz * (d / 2 + 0.03)]} r={0.025} m={m.alu} />))}
          {[-1, 1].map((sz) => <P key={sz} geo={G.box(width + 0.1, 0.04, 0.05)} m={m.alu} position={[0, h / 2 + 0.03, sz * (d / 2 + 0.03)]} />)}
          {[-1, 1].map((sz) => <P key={'l' + sz} geo={G.box(width + 0.1, 0.04, 0.05)} m={m.alu} position={[0, -h / 2 - 0.03, sz * (d / 2 + 0.03)]} />)}
          {/* copper bus bars */}
          <P geo={G.box(width * 0.8, 0.025, 0.06)} m={m.copper} position={[0, h / 2 + 0.06, d * 0.2]} />
          <P geo={G.box(width * 0.8, 0.025, 0.06)} m={m.copper} position={[0, h / 2 + 0.06, -d * 0.2]} />
        </>
      )}
      {id === 'advanced' && (
        <>
          {/* heat pipes + gold-wrapped end caps */}
          <Pipe pts={[[-width / 2, h / 2 + 0.1, -d / 2], [-width / 4, h / 2 + 0.18, 0], [0, h / 2 + 0.1, d / 2]]} r={0.025} m={m.copper} />
          <Pipe pts={[[width / 2, h / 2 + 0.1, -d / 2], [width / 4, h / 2 + 0.18, 0], [0, h / 2 + 0.1, d / 2]]} r={0.025} m={m.copper} />
          {[-1, 1].map((sz) => <P key={sz} geo={G.box(width + 0.08, h + 0.08, 0.1)} m={m.gold} position={[0, 0, sz * (d / 2 + 0.1)]} />)}
          <P geo={G.box(width * 0.9, 0.025, 0.4)} m={m.cyan} position={[0, -h / 2 - 0.07, 0]} />
        </>
      )}
      <Bolts pts={[[0, h / 2 + 0.01, d * 0.4, 0, 1, 0], [0, h / 2 + 0.01, -d * 0.4, 0, 1, 0], [width * 0.3, h / 2 + 0.01, 0, 0, 1, 0], [-width * 0.3, h / 2 + 0.01, 0, 0, 1, 0]]} r={0.02} />
    </group>
  );
}
