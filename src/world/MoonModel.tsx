// The custom Moon (a GLB file you place at public/models/moon.glb).
// If the file is missing or broken, the game keeps the code-made Moon and prints a report in the console.
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

/** Turn the model if its "front" is not the side you want to see. Radians around Y. */
export const MOON_ROTATION_Y = Math.PI;
const MOON_SPIN = 0.003; // rad/s — very slow

let loading: Promise<THREE.Object3D | null> | null = null;

function report(msg: string, err?: unknown) {
  console.warn(`[NOVA SHIFT] Moon model: ${msg}. Using the built-in procedural Moon instead.` + ' Put the GLB at public/models/moon.glb (see public/models/README.md).', err ?? '');
  setMoonStatus('fallback', msg);
}

/** Loads the GLB once. Resolves to a centred model with radius 1, or null on any problem. */
export function loadMoon(): Promise<THREE.Object3D | null> {
  if (loading) return loading;
  loading = (async () => {
    try {
      // Download the file ourselves, so we can tell a real GLB from a web page (dev servers answer a missing file with HTML).
      const res = await fetch(MOON_URL).catch(() => null);
      if (!res || !res.ok) { report('file not found at ' + MOON_URL + (res ? ' (HTTP ' + res.status + ')' : ' (network error)')); return null; }
      const data = await res.arrayBuffer();
      const head = new Uint8Array(data.slice(0, 4));
      const magic = String.fromCharCode(...head);
      if (magic !== 'glTF' && head[0] !== 0x7b) { report('the file is not a GLB (it starts with "' + magic.replace(/[^\x20-\x7e]/g, '?') + '"). Is it a .zip or a web page?'); return null; }
      if (magic !== 'glTF') { report('this is a .gltf text file. Please convert it to one .glb file'); return null; }
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
      // centre and scale to radius 1 (bounding sphere of the whole model)
      const box = new THREE.Box3().setFromObject(root);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      if (!isFinite(sphere.radius) || sphere.radius <= 0) { report('the model has no size'); return null; }
      root.position.sub(sphere.center);
      const holder = new THREE.Group();
      holder.add(root);
      holder.scale.setScalar(1 / sphere.radius);
      root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.frustumCulled = true; m.castShadow = false; m.receiveShadow = false; } });
      setMoonStatus('model');
      return holder;
    } catch (e) {
      report('could not load the file', e);
      return null;
    }
  })();
  return loading;
}

/** Clone the model so each scene owns its materials. mode 'baked' = sunlight painted in a shader (ship windows). */
function useMoonObject(mode: 'baked' | 'lit', worldPos: THREE.Vector3) {
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let dead = false; let made: THREE.Object3D | null = null;
    loadMoon().then((base) => {
      if (dead || !base) return;
      made = base.clone(true);
      made.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
        if (mode === 'baked') {
          const mb = new THREE.MeshBasicMaterial({ map: src.map || null, color: src.map ? '#ffffff' : (src.color || '#bbbbbb') });
          if (mb.map) mb.map.colorSpace = THREE.SRGBColorSpace;
          m.material = sunLit(mb, worldPos, 0.035);
        } else {
          const ms = new THREE.MeshStandardMaterial({ map: src.map || null, normalMap: src.normalMap || null, bumpMap: src.bumpMap || null, color: src.map ? '#ffffff' : (src.color || '#bbbbbb'), roughness: 1, metalness: 0 });
          m.material = ms;
        }
      });
      setObj(made);
    });
    return () => { dead = true; };
  }, [mode, worldPos]);
  return obj;
}

/** Moon behind the ship windows. Falls back to the procedural Moon until/unless the model is ready. */
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
  return status === 'fallback' || status === 'loading' ? <WindowMoon radius={radius} position={position} sun={sun} /> : null;
}

/** Moon for the main menu (real scene lights). */
export function CustomMenuMoon({ radius, position }: { radius: number; position: [number, number, number] }) {
  const pos = useMemo(() => new THREE.Vector3(...position), [position]);
  const obj = useMoonObject('lit', pos);
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * MOON_SPIN; });
  if (obj) {
    return (
      <group position={position} scale={radius}>
        <group ref={ref} rotation={[0, MOON_ROTATION_Y, 0]}><primitive object={obj} /></group>
      </group>
    );
  }
  return <Moon radius={radius} position={position} />;
}
