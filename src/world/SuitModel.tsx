// The crew escape suit (GLB) worn by the other players.
// If the file cannot load, the caller shows the simple built-in astronaut instead.
import { useEffect, useMemo, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const URL = () => ((import.meta as any).env?.BASE_URL ?? '/') + 'models/crew-suit.glb';
export const SUIT_HEIGHT = 1.78; // metres: the model is scaled to this

// The suit is Draco-compressed. Use the local decoder (public/draco) when it exists, else the internet copy.
let dracoChecked: Promise<void> | null = null;
function prepareDraco() {
  if (!dracoChecked) {
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    dracoChecked = fetch(base + 'draco/draco_decoder.wasm', { method: 'HEAD' })
      .then((r) => { if (r.ok) (useGLTF as any).setDecoderPath(base + 'draco/'); })
      .catch(() => { /* use the default (internet) decoder */ });
  }
  return dracoChecked;
}

function Suit({ flip }: { flip: boolean }) {
  const gltf = useGLTF(URL(), true) as any;
  const { obj, scale, off } = useMemo(() => {
    const c = gltf.scene.clone(true);
    c.traverse((o: any) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m: any) => {
        // "transmission" (see-through glass) makes the whole game slower: turn it off, keep plain solid materials
        m.transmission = 0; m.transparent = false; m.opacity = 1;
        m.ior = 1.45; m.specularIntensity = 0.4;
        m.roughness = Math.max(m.roughness ?? 0.7, 0.55);
        m.needsUpdate = true;
      });
    });
    // centre it on its feet and scale it to a person's height, whatever size the file uses
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const ctr = box.getCenter(new THREE.Vector3());
    const s = SUIT_HEIGHT / Math.max(0.001, size.y);
    return { obj: c, scale: s, off: [-ctr.x, -box.min.y, -ctr.z] as [number, number, number] };
  }, [gltf]);
  return (
    <group rotation={[0, flip ? Math.PI : 0, 0]} scale={scale}>
      <primitive object={obj} position={off} />
    </group>
  );
}

/** Loads the decoder first, then the suit. Throws (caught by <Safe>) if loading fails. */
export function SuitModel({ flip = false }: { flip?: boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { let on = true; prepareDraco().then(() => on && setReady(true)); return () => { on = false; }; }, []);
  return ready ? <Suit flip={flip} /> : null;
}
