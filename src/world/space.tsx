// Moon, Earth and their glow. Used by the main menu, the shipyard windows and the ship windows.
//
// The pictures are drawn by code (planets.ts), so no files are needed.
// Want real NASA photos? Put these files in public/textures/ (see the README there). Missing files are ignored:
//   moon.jpg, moon_bump.jpg, earth.jpg, earth_clouds.jpg
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSettings } from '../store';
import { moonMaps, earthMaps, cached, planetSize, type Sun } from './planets';

/** Load a real picture from public/textures if it exists. Gives null if there is none. */
function useRealTexture(file: string, srgb = true) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let dead = false;
    new THREE.TextureLoader().load(
      import.meta.env.BASE_URL + 'textures/' + file,
      (t) => {
        if (dead) return;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        setTex(t);
      },
      undefined,
      () => { /* no such file: use the drawn planet */ },
    );
    return () => { dead = true; };
  }, [file, srgb]);
  return tex;
}

/** Draw the pictures a moment after the first frame, so the screen never freezes while they are made. */
export function useLater<T>(make: () => T, deps: unknown[]): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    let dead = false;
    const id = window.setTimeout(() => {
      try { const r = make(); if (!dead) setV(r); } catch (e) { console.error('[NOVA SHIFT] planet picture failed', e); }
    }, 30);
    return () => { dead = true; window.clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

const sunKey = (s?: Sun) => (s ? s.dir.join(',') + '@' + s.rotY : 'raw');

function canvasTex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// A soft blue glow around a planet: bright at the planet's edge, fading to nothing.
export function Atmosphere({ radius, color = '#5aa8ff', strength = 1 }: { radius: number; color?: string; strength?: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
        vertexShader: `
          varying vec3 vN; varying vec3 vV;
          void main() {
            vN = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 uColor; uniform float uStrength;
          varying vec3 vN; varying vec3 vV;
          void main() {
            float d = abs(dot(normalize(vN), normalize(vV)));
            float i = pow(clamp(d / 0.36, 0.0, 1.0), 2.0) * uStrength;
            gl_FragColor = vec4(uColor, i);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      }),
    [color, strength],
  );
  return (
    <mesh>
      <sphereGeometry args={[radius * 1.07, 64, 48]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// ---------------------------------------------------------------- lit Moon and Earth (menu, shipyard)
export function Moon({ radius, position }: { radius: number; position: [number, number, number] }) {
  const quality = useSettings((s) => s.quality);
  const size = Math.min(1536, planetSize(quality)); // the Moon picture is heavy to draw, so cap it
  const maps = useLater(() => cached('moon' + size, () => moonMaps(size)), [size]);
  const drawn = useMemo(() => (maps ? { map: canvasTex(maps.color), bump: canvasTex(maps.bump, false) } : null), [maps]);
  const realMap = useRealTexture('moon.jpg');
  const realBump = useRealTexture('moon_bump.jpg', false);
  const map = realMap ?? drawn?.map ?? null;
  const bump = realBump ?? (realMap ? null : drawn?.bump ?? null);
  return (
    <mesh position={position} rotation={[0, 0, Math.PI / 2]}>
      <sphereGeometry args={[radius, 128, 96]} />
      <meshStandardMaterial
        key={(map ? 1 : 0) + (bump ? 2 : 0)}
        color={map ? '#ffffff' : '#9a9892'}
        map={map}
        bumpMap={bump}
        bumpScale={radius * 0.05}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

export function Earth({ radius, position }: { radius: number; position: [number, number, number] }) {
  const quality = useSettings((s) => s.quality);
  const size = Math.min(1024, planetSize(quality));
  const maps = useLater(() => cached('earth' + size, () => earthMaps(size)), [size]);
  const drawn = useMemo(
    () => (maps ? { map: canvasTex(maps.color), rough: canvasTex(maps.rough, false), clouds: canvasTex(maps.clouds) } : null),
    [maps],
  );
  const realMap = useRealTexture('earth.jpg');
  const realClouds = useRealTexture('earth_clouds.jpg', false);
  const map = realMap ?? drawn?.map ?? null;
  const surface = useRef<THREE.Mesh>(null!);
  const clouds = useRef<THREE.Mesh>(null!);
  useFrame((_, dt) => {
    if (surface.current) surface.current.rotation.y += dt * 0.02;
    if (clouds.current) clouds.current.rotation.y += dt * 0.026;
  });
  return (
    <group position={position}>
      <mesh ref={surface}>
        <sphereGeometry args={[radius, 96, 72]} />
        <meshStandardMaterial
          key={map ? 1 : 0}
          color={map ? '#ffffff' : '#1d4ed8'}
          map={map}
          roughnessMap={realMap ? null : drawn?.rough ?? null}
          roughness={realMap ? 0.7 : 1}
          metalness={0}
        />
      </mesh>
      {(realClouds || drawn) && (
        <mesh ref={clouds}>
          <sphereGeometry args={[radius * 1.012, 96, 72]} />
          {realClouds ? (
            <meshStandardMaterial key="rc" color="#ffffff" alphaMap={realClouds} transparent depthWrite={false} roughness={1} />
          ) : (
            <meshStandardMaterial key="dc" map={drawn!.clouds} transparent depthWrite={false} roughness={1} />
          )}
        </mesh>
      )}
      <Atmosphere radius={radius} />
    </group>
  );
}

// ---------------------------------------------------------------- planets seen through the ship windows
// The window scene has no real sun light, so the sun light is painted into the picture. The planets do not turn.
export function WindowMoon({ radius, position, sun }: { radius: number; position: [number, number, number]; sun: Sun }) {
  const quality = useSettings((s) => s.quality);
  const size = Math.min(1024, planetSize(quality));
  const maps = useLater(() => cached('moon' + size + sunKey(sun), () => moonMaps(size, sun)), [size, sunKey(sun)]);
  const map = useMemo(() => (maps ? canvasTex(maps.color) : null), [maps]);
  const real = useRealTexture('moon.jpg');
  const tex = real ?? map;
  return (
    <mesh position={position} rotation={[0, sun.rotY, 0]}>
      <sphereGeometry args={[radius, 96, 72]} />
      <meshBasicMaterial key={tex ? 1 : 0} map={tex} color={tex ? '#ffffff' : '#555555'} />
    </mesh>
  );
}

export function WindowEarth({ radius, position, sun }: { radius: number; position: [number, number, number]; sun: Sun }) {
  const quality = useSettings((s) => s.quality);
  const size = Math.min(1024, planetSize(quality));
  const maps = useLater(() => cached('earthw' + size + sunKey(sun), () => earthMaps(size, sun, true)), [size, sunKey(sun)]);
  const map = useMemo(() => (maps ? canvasTex(maps.color) : null), [maps]);
  const real = useRealTexture('earth.jpg');
  const tex = real ?? map;
  return (
    <group position={position}>
      <mesh rotation={[0, sun.rotY, 0]}>
        <sphereGeometry args={[radius, 96, 72]} />
        <meshBasicMaterial key={tex ? 1 : 0} map={tex} color={tex ? '#ffffff' : '#1d4ed8'} />
      </mesh>
      <Atmosphere radius={radius} strength={0.9} />
    </group>
  );
}

// the close lunar ground below the Command Deck window (no sun painted in)
export function WindowHorizon({ radius, position }: { radius: number; position: [number, number, number] }) {
  const quality = useSettings((s) => s.quality);
  const size = planetSize(quality);
  const maps = useLater(() => cached('moon' + size, () => moonMaps(size)), [size]);
  const map = useMemo(() => (maps ? canvasTex(maps.color) : null), [maps]);
  const real = useRealTexture('moon.jpg');
  const tex = real ?? map;
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 64, 32]} />
      <meshBasicMaterial key={tex ? 1 : 0} map={tex} color={tex ? '#8a8a86' : '#444444'} />
    </mesh>
  );
}
