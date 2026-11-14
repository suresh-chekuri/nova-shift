// Optional real 3D models (GLB). If /models/manifest.json lists a file for a part, it is used.
// If the list is empty, the file is missing, or loading fails, the built-in procedural model is shown instead.
import { Suspense, useMemo, type ReactNode } from 'react';
import { create } from 'zustand';
import { useGLTF } from '@react-three/drei';
import { Safe, type Vec3 } from './kit';

export interface AssetEntry { url: string; scale?: number; rotation?: Vec3; position?: Vec3 }
export const useAssets = create<{ manifest: Record<string, AssetEntry> }>()(() => ({ manifest: {} }));

let started = false;
export function loadAssetManifest() {
  if (started || typeof fetch === 'undefined') return;
  started = true;
  const base = (import.meta as any).env?.BASE_URL ?? '/';
  fetch(base + 'models/manifest.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((json) => {
      const ok: Record<string, AssetEntry> = {};
      if (json && typeof json === 'object') for (const [k, v] of Object.entries(json as Record<string, any>)) if (v && typeof v.url === 'string' && v.url.endsWith('.glb')) ok[k] = v;
      useAssets.setState({ manifest: ok });
    })
    .catch(() => { /* no manifest: use the built-in models */ });
}

// where each kind of model is anchored on the ship (the built-in models use the same anchors)
const ANCHOR: Record<string, Vec3> = { structure: [0, 0, 0], power: [0, 0, 0], propulsion: [0, 0, -2.6], comms: [0, 1.3, 0.9], battery: [0, -1.5, -0.6], payload: [0, 0, 0] };

function Glb({ cat, e }: { cat: string; e: AssetEntry }) {
  const gltf = useGLTF(e.url, false) as any;
  const obj = useMemo(() => {
    const c = gltf.scene.clone(true);
    c.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return c;
  }, [gltf]);
  return (
    <group position={ANCHOR[cat] ?? [0, 0, 0]}>
      <primitive object={obj} scale={e.scale ?? 1} rotation={e.rotation ?? [0, 0, 0]} position={e.position ?? [0, 0, 0]} />
    </group>
  );
}

/** GLB if listed (with the built-in model as the loading placeholder and as the fallback), otherwise the built-in model */
export function WithAsset({ cat, id, children }: { cat: string; id: string; children: ReactNode }) {
  const entry = useAssets((s) => s.manifest[`${cat}.${id}`]);
  if (!entry) return <>{children}</>;
  return (
    <Safe fallback={<>{children}</>}>
      <Suspense fallback={<>{children}</>}>
        <Glb cat={cat} e={entry} />
      </Suspense>
    </Safe>
  );
}
