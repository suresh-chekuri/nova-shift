// Solar arrays (POWER): individual photovoltaic cells (instanced), frames, hinges, drive assemblies.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { G, P, M, Bolts, Strut, Pipe, useQ } from './kit';

interface Spec { panels: number; w: number; d: number; cols: number; rows: number; tint: string[] }
const SPEC: Record<string, Spec> = {
  compact: { panels: 1, w: 1.35, d: 1.7, cols: 5, rows: 8, tint: ['#9fb4ff', '#b3c4ff'] },
  advanced: { panels: 2, w: 1.3, d: 2.5, cols: 5, rows: 12, tint: ['#8fa8ff', '#a8bcff', '#7f9bff'] },
  highcap: { panels: 3, w: 1.45, d: 2.9, cols: 6, rows: 14, tint: ['#7f9bff', '#98aeff', '#6f8cff', '#b5c6ff'] },
};

// all the cells of one wing in a single InstancedMesh (one draw call)
function Cells({ spec, side, q }: { spec: Spec; side: number; q: string }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const cols = q === 'low' ? Math.ceil(spec.cols / 2) : spec.cols;
  const rows = q === 'low' ? Math.ceil(spec.rows / 2) : spec.rows;
  const n = spec.panels * cols * rows;
  const cw = (spec.w - 0.14) / cols, cd = (spec.d - 0.14) / rows;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    let k = 0;
    for (let p = 0; p < spec.panels; p++) for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x0 = 0.35 + p * (spec.w + 0.06) + 0.07 + cw * (i + 0.5);
      o.position.set(side * x0, 0.022, -spec.d / 2 + 0.07 + cd * (j + 0.5));
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      mesh.setMatrixAt(k, o.matrix);
      c.set(spec.tint[(i * 7 + j * 3 + p) % spec.tint.length]).multiplyScalar(0.85 + ((i * 13 + j * 5 + p * 3) % 7) * 0.03);
      mesh.setColorAt(k, c);
      k++;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [spec, side, cols, rows, cw, cd]);
  return <instancedMesh key={n} ref={ref} args={[G.box(cw * 0.94, 0.012, cd * 0.94), M().cell, n]} castShadow receiveShadow frustumCulled={false} />;
}

function Wing({ id, side }: { id: string; side: number }) {
  const m = M();
  const q = useQ();
  const spec = SPEC[id];
  const wing = useRef<THREE.Group>(null!);
  const span = 0.35 + spec.panels * (spec.w + 0.06);
  useFrame(({ clock }) => {
    // the wing slowly tracks the Sun (rotates about its own long axis)
    if (wing.current) wing.current.rotation.x = Math.sin(clock.elapsedTime * 0.22 + side) * 0.22;
  });
  const boltPts = useMemo(() => {
    const pts: number[][] = [];
    for (let p = 0; p < spec.panels; p++) {
      const x0 = 0.35 + p * (spec.w + 0.06);
      for (const [dx, dz] of [[0.04, -spec.d / 2 + 0.04], [spec.w - 0.04, -spec.d / 2 + 0.04], [0.04, spec.d / 2 - 0.04], [spec.w - 0.04, spec.d / 2 - 0.04]]) pts.push([side * (x0 + dx), 0.02, dz, 0, 1, 0]);
    }
    return pts;
  }, [spec, side]);
  return (
    <group position={[side * 1.15, 0, 0.3]}>
      {/* drive assembly: gold drum + motor housing */}
      <P geo={G.cyl(0.2, 0.2, 0.4, 20)} m={m.gold} rotation={[0, 0, Math.PI / 2]} position={[side * 0.1, 0, 0]} />
      <P geo={G.cyl(0.13, 0.13, 0.22, 14)} m={m.dark} rotation={[0, 0, Math.PI / 2]} position={[side * 0.32, 0, 0]} />
      <P geo={G.tor(0.205, 0.025, 6, 20)} m={m.steel} rotation={[0, Math.PI / 2, 0]} position={[side * 0.1, 0, 0]} />
      <group ref={wing}>
        {/* central spine boom */}
        <P geo={G.cyl(0.035, 0.035, span, 8)} m={m.alu} rotation={[0, 0, Math.PI / 2]} position={[side * (0.2 + span / 2), -0.04, 0]} />
        {Array.from({ length: spec.panels }, (_, p) => {
          const x0 = 0.35 + p * (spec.w + 0.06);
          const cx = side * (x0 + spec.w / 2);
          return (
            <group key={p}>
              {/* backing sheet + frame */}
              <P geo={G.box(spec.w, 0.025, spec.d)} m={m.panelBack} position={[cx, 0, 0]} />
              <P geo={G.box(spec.w + 0.02, 0.04, 0.04)} m={m.alu} position={[cx, 0.01, -spec.d / 2]} />
              <P geo={G.box(spec.w + 0.02, 0.04, 0.04)} m={m.alu} position={[cx, 0.01, spec.d / 2]} />
              <P geo={G.box(0.04, 0.04, spec.d)} m={m.alu} position={[side * x0, 0.01, 0]} />
              <P geo={G.box(0.04, 0.04, spec.d)} m={m.alu} position={[side * (x0 + spec.w), 0.01, 0]} />
              {/* hinges between panels */}
              {p > 0 && [-spec.d / 2 + 0.15, spec.d / 2 - 0.15].map((z) => <P key={z} geo={G.cyl(0.03, 0.03, 0.22, 8)} m={m.gold} rotation={[Math.PI / 2, 0, 0]} position={[side * (x0 - 0.03), 0.0, z]} />)}
              {/* back truss */}
              <Strut a={[cx - spec.w / 2, -0.03, -spec.d / 2]} b={[cx + spec.w / 2, -0.03, spec.d / 2]} r={0.012} m={m.steel} />
              <Strut a={[cx + spec.w / 2, -0.03, -spec.d / 2]} b={[cx - spec.w / 2, -0.03, spec.d / 2]} r={0.012} m={m.steel} />
            </group>
          );
        })}
        <Cells spec={spec} side={side} q={q} />
        <Bolts pts={boltPts} r={0.016} h={0.02} m={m.steel} />
        {/* power harness along the boom */}
        <Pipe pts={[[side * 0.4, -0.07, 0.04], [side * (0.2 + span * 0.5), -0.075, 0.05], [side * (0.2 + span * 0.95), -0.07, 0.04]]} r={0.01} m={m.black} />
        {/* tip: hold-down + sun sensor */}
        <P geo={G.box(0.07, 0.07, 0.07)} m={m.dark} position={[side * (0.38 + spec.panels * (spec.w + 0.06) + 0.03), 0, 0]} />
        <P geo={G.sph(0.025, 8)} m={m.cyan} position={[side * (0.38 + spec.panels * (spec.w + 0.06) + 0.03), 0.05, 0]} />
        {id === 'highcap' && (
          <>
            {/* concentrator radiator vanes */}
            {[0.6, 1.1].map((t) => <P key={t} geo={G.box(0.5, 0.012, 0.9)} m={m.silver} position={[side * (0.35 + spec.panels * (spec.w + 0.06) * t), -0.12, 0]} rotation={[0.35, 0, 0]} />)}
          </>
        )}
      </group>
      {id === 'highcap' && <P geo={G.cyl(0.26, 0.26, 0.5, 16)} m={m.gold} rotation={[0, 0, Math.PI / 2]} position={[side * 0.1, 0, 0]} />}
    </group>
  );
}

export function Solar({ id }: { id: string | null }) {
  if (!id || !SPEC[id]) return null;
  return (
    <group>
      <Wing id={id} side={1} />
      <Wing id={id} side={-1} />
    </group>
  );
}
