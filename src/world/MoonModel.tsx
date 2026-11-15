// The Moon: your GLB file at public/models/moon.glb.
// If the file is missing or broken, the code-made Moon is shown instead (never both at once) and a report is printed in the console.
// Model: "Moon (blend)" by ThePangel, CC BY 4.0 — https://sketchfab.com/3d-models/moon-blend-e706ce13b917471797479ef1f6dccc0c
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Moon, WindowMoon } from './space';
import { sunLit } from './deepspace';
import { MOON_URL, setMoonStatus, useScenery } from './scenery';
import type { Sun } from './planets';

/** Turn the model if the wrong side faces you. Radians around Y. */
export const MOON_ROTATION_Y = Math.PI;
const MOON_SPIN = 0.003; // rad/s — very slow

let loading: Promise<THREE.Object3D | null> | null = null;

function report(msg: string, err?: unknown) {
  console.warn(`[NOVA SHIFT] Moon model: ${msg}. Using the built-in Moon instead. Put the GLB at public/models/moon.glb (see public/models/README.md).`, err ?? '');
  setMoonStatus('fallback', msg);
}

/** Loads the GLB once. Resolves to a centred model with radius 1, or null on any problem. */
export function loadMoon(): Promise<THREE.Object3D | null> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const res = await fetch(MOON_URL).catch(() => null);
      if (!res || !res.ok) { report('file not found at ' + MOON_URL + (res ? ' (HTTP ' + res.status + ')' : ' (network error)')); return null; }
      const data = await res.arrayBuffer();
      const magic = String.fromCharCode(...new Uint8Array(data.slice(0, 4)));
      if (magic !== 'glTF') { report('the file is not a .glb (it starts with "' + magic.replace(/[^\x20-\x7e]/g, '?') + '"). Is it a .zip, a .gltf or a web page?'); return null; }
      const loader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      loader.setDRACOLoader(draco);
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.parseAsync(data, MOON_URL.slice(0, MOON_URL.lastIndexOf('/') + 1));
      const root = gltf.scene;
      let meshes = 0;
      root.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
      if (!meshes) { report('the file has no meshes'); return null; }
      const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
      if (!isFinite(sphere.radius) || sphere.radius <= 0) { report('the model has no size'); return null; }
      root.position.sub(sphere.center);           // centre it
      const holder = new THREE.Group();
      holder.add(root);
      holder.scale.setScalar(1 / sphere.radius);  // radius 1
      setMoonStatus('model');
      return holder;
    } catch (e) {
      report('could not load the file', e);
      return null;
    }
  })();
  return loading;
}

/** Clone the model so each scene owns its materials. 'baked' = sunlight painted in a shader (ship windows, no scene lights). */
function useMoonObject(mode: 'baked' | 'lit', worldPos: THREE.Vector3) {
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let dead = false;
    loadMoon().then((base) => {
      if (dead || !base) return;
      const made = base.clone(true);
      made.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
        const color = src.map ? '#ffffff' : (src.color || '#bbbbbb');
        if (mode === 'baked') {
          const mb = new THREE.MeshBasicMaterial({ map: src.map || null, color });
          m.material = sunLit(mb, worldPos, 0.035);
        } else {
          m.material = new THREE.MeshStandardMaterial({ map: src.map || null, normalMap: src.normalMap || null, bumpMap: src.bumpMap || null, color, roughness: 1, metalness: 0 });
        }
      });
      setObj(made);
    });
    return () => { dead = true; };
  }, [mode, worldPos]);
  return obj;
}

/** Moon behind the ship windows. Shows nothing while loading, the code-made Moon only if the file failed. */
export function CustomWindowMoon({ radius, position, sun }: { radius: number; position: [number, number, number]; sun: Sun }) {
  const pos = useMemo(() => new THREE.Vector3(...position), [position]);
  const obj = useMoonObject('baked', pos);
  const ref = useRef<THREE.Group>(null!);
  const status = useScenery((s) => s.moon);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * MOON_SPIN; });
  if (obj) {
    return (
      <group position={position} scale={radius}>
        <group ref={ref} rotation={[0, MOON_ROTATION_Y, 0]}><primitive object={obj} /></group>
      </group>
    );
  }
  return status === 'fallback' ? <WindowMoon radius={radius} position={position} sun={sun} /> : null;
}

/** Moon for the main menu (real scene lights). */
export function CustomMenuMoon({ radius, position }: { radius: number; position: [number, number, number] }) {
  const pos = useMemo(() => new THREE.Vector3(...position), [position]);
  const obj = useMoonObject('lit', pos);
  const ref = useRef<THREE.Group>(null!);
  const status = useScenery((s) => s.moon);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * MOON_SPIN; });
  if (obj) {
    return (
      <group position={position} scale={radius}>
        <group ref={ref} rotation={[0, MOON_ROTATION_Y, 0]}><primitive object={obj} /></group>
      </group>
    );
  }
  return status === 'fallback' ? <Moon radius={radius} position={position} /> : null;
}
