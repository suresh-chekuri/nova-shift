// The spacecraft seen from outside. Built from the player's Design, so every choice changes the model.
import { useEffect, useRef, type MutableRefObject, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PartView } from './parts';
import { validate, type Design, type Cat } from '../design';
import { useYard } from '../store';

// Where parts attach (shown as rings in the Shipyard)
export const HARDPOINTS: { id: string; cat: Cat; slot?: number; pos: [number, number, number]; label: string }[] = [
  { id: 'structure', cat: 'structure', pos: [0, 0, 0.4], label: 'STRUCTURE' },
  { id: 'power', cat: 'power', pos: [2.1, 0, 0.3], label: 'POWER' },
  { id: 'propulsion', cat: 'propulsion', pos: [0, 0, -3.6], label: 'PROPULSION' },
  { id: 'comms', cat: 'comms', pos: [0, 1.5, 0.9], label: 'COMMS' },
  { id: 'battery', cat: 'battery', pos: [0, -1.5, -0.6], label: 'BATTERY' },
  { id: 'payload0', cat: 'payload', slot: 0, pos: [-1.0, 0.55, 3.0], label: 'PAYLOAD 1' },
  { id: 'payload1', cat: 'payload', slot: 1, pos: [1.0, 0.55, 3.0], label: 'PAYLOAD 2' },
  { id: 'payload2', cat: 'payload', slot: 2, pos: [0, -0.9, 3.1], label: 'PAYLOAD 3' },
];

/** Used by the interior science console too. */
export function Instrument({ id }: { id: string }) {
  return <PartView cat="payload" id={id} />;
}

// Parts grow in when they are attached (the parent gives each part a new `key`, so this runs on every change).
function Anim({ children, from = [0, 0.6, 0] }: { children: ReactNode; from?: [number, number, number] }) {
  const g = useRef<THREE.Group>(null!);
  const t0 = useRef(-1);
  useFrame(({ clock }) => {
    if (!g.current) return;
    if (t0.current < 0) t0.current = clock.elapsedTime;
    const k = Math.min(1, (clock.elapsedTime - t0.current) / 0.7);
    const e = 1 - Math.pow(1 - k, 3);
    const over = 1 + Math.sin(k * Math.PI) * 0.12; // little overshoot
    g.current.scale.setScalar(Math.max(0.001, e * over));
    g.current.position.set(from[0] * (1 - e), from[1] * (1 - e), from[2] * (1 - e));
  });
  return <group ref={g}>{children}</group>;
}

// A removed part shrinks away and fades out.
function Leaving({ children, at }: { children: ReactNode; at: number }) {
  const g = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (!g.current) return;
    const k = Math.min(1, (Date.now() - at) / 450);
    g.current.scale.setScalar(Math.max(0.001, 1 - k));
    g.current.position.y = k * 0.8;
    g.current.visible = k < 1;
  });
  return <group ref={g}>{children}</group>;
}

// Preview of the selected part: a blue hologram of it, drawn on top of the ship.
function Hologram({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null!);
  const mats = useRef<THREE.MeshBasicMaterial[]>([]);
  useEffect(() => {
    mats.current = [];
    g.current.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const mat = new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.4, depthWrite: false, wireframe: true });
        mesh.material = mat;
        mesh.castShadow = false;
        mats.current.push(mat);
      }
    });
    return () => mats.current.forEach((x) => x.dispose());
  }, []);
  useFrame(({ clock }) => { const o = 0.35 + Math.sin(clock.elapsedTime * 5) * 0.2; mats.current.forEach((x) => (x.opacity = o)); });
  return <group ref={g}>{children}</group>;
}

function renderPart(cat: Cat, id: string, glow: MutableRefObject<THREE.MeshStandardMaterial[]>) {
  return <PartView cat={cat} id={id} glow={glow} />;
}

export function SpacecraftModel({ design, markers = false, onPick, selected }: {
  design: Design; markers?: boolean; onPick?: (cat: Cat, slot?: number) => void; selected?: Cat | null;
}) {
  const glow = useRef<THREE.MeshStandardMaterial[]>([]);
  const blink = useRef<THREE.MeshStandardMaterial>(null!);
  const rings = useRef<THREE.Mesh[]>([]);
  const dish = useRef<THREE.Group>(null!);
  const pending = useYard((s) => s.pending);
  const removed = useYard((s) => s.removed);
  const validated = useYard((s) => s.validated);
  // which parts fail the launch checks (shown in red after VALIDATE)
  const badCats = new Set<Cat>(validated ? validate(design).filter((c) => !c.ok).flatMap((c) => c.cats) : []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    glow.current.forEach((m) => { m.emissiveIntensity = 1.6 + Math.sin(t * 18) * 0.4 + Math.sin(t * 7) * 0.3; });
    if (blink.current) blink.current.emissiveIntensity = Math.sin(t * 4) > 0.6 ? 3 : 0.1;
    rings.current.forEach((m, i) => {
      if (!m) return;
      const hot = m.userData.hot;
      const k = (hot ? 1.35 : 1) + Math.sin(t * (hot ? 7 : 3) + i) * (hot ? 0.22 : 0.08);
      m.scale.set(k, k, k);
    });
    if (dish.current) dish.current.rotation.y = selected === 'comms' ? t * 1.2 : 0; // the whole antenna spins when selected (the dishes scan on their own)
  });
  const selCat = pending ? selected : null;
  const pendCat = selCat ?? null;
  return (
    <group>
      <Anim key={'st' + design.structure} from={[0, 0, 0]}>{design.structure && renderPart('structure', design.structure, glow)}</Anim>
      <Anim key={'pw' + design.power} from={[0, 0.8, 0]}>{design.power && renderPart('power', design.power, glow)}</Anim>
      <Anim key={'pr' + design.propulsion} from={[0, 0, -1.2]}>{design.propulsion && renderPart('propulsion', design.propulsion, glow)}</Anim>
      <Anim key={'cm' + design.comms} from={[0, 1, 0]}><group position={[0, 1.5, 0.9]}><group ref={dish}><group position={[0, -1.5, -0.9]}>{design.comms && renderPart('comms', design.comms, glow)}</group></group></group></Anim>
      <Anim key={'bt' + design.battery} from={[0, -1, 0]}>{design.battery && renderPart('battery', design.battery, glow)}</Anim>
      {design.payload.slice(0, 3).map((id, i) => {
        const hp = HARDPOINTS.find((h) => h.slot === i)!;
        return <group key={id + i} position={hp.pos}><Anim from={[0, 0.5, 1.2]}>{renderPart('payload', id, glow)}</Anim></group>;
      })}

      {removed && Date.now() - removed.at < 500 && (
        <Leaving key={removed.at} at={removed.at}>
          {removed.cat === 'payload'
            ? <group position={HARDPOINTS.find((h) => h.slot === removed.slot)!.pos}>{renderPart('payload', removed.id, glow)}</group>
            : renderPart(removed.cat, removed.id, glow)}
        </Leaving>
      )}

      {/* hologram preview of the selected part */}
      {pending && pendCat && (pendCat !== 'payload'
        ? (((design as any)[pendCat] !== pending) && <Hologram key={'h' + pendCat + pending}>{renderPart(pendCat, pending, glow)}</Hologram>)
        : (!design.payload.includes(pending) && (
            <group position={HARDPOINTS.find((h) => h.slot === Math.min(design.payload.length, 2))!.pos}>
              <Hologram key={'h' + pending}>{renderPart('payload', pending, glow)}</Hologram>
            </group>)))}

      <mesh position={[0.0, 0.9, 2.2]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial ref={blink} color="#ef4444" emissive="#ef4444" emissiveIntensity={1} /></mesh>

      {markers && HARDPOINTS.map((h, i) => {
        const filled = h.cat === 'payload' ? !!design.payload[h.slot ?? 0] : !!(design as any)[h.cat];
        const compatible = !!pending && h.cat === pendCat; // glowing = this part fits here
        const dimmed = !!pending && !compatible; // does not fit
        const bad = badCats.has(h.cat) && !pending;
        const color = bad ? '#ef4444' : compatible ? '#fbbf24' : filled ? '#22d3ee' : '#f87171';
        return (
          <mesh
            key={h.id}
            ref={(el) => { if (el) { rings.current[i] = el; el.userData.hot = compatible || bad; } }}
            position={h.pos}
            onClick={(e) => { e.stopPropagation(); onPick?.(h.cat, h.slot); }}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => (document.body.style.cursor = 'auto')}
          >
            <sphereGeometry args={[h.cat === 'structure' ? 0.14 : 0.18, 12, 12]} />
            <meshBasicMaterial color={color} transparent opacity={dimmed ? 0.18 : compatible || bad ? 1 : 0.6} depthTest={false} />
          </mesh>
        );
      })}
    </group>
  );
}
