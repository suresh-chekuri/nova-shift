// Deep space behind the windows: stars, Milky Way, nebulae, galaxies, distant planets,
// asteroids, a satellite, a comet and a little debris. Everything is made by code.
//
// Rules this file follows:
//  * Stars, nebulae and galaxies follow the camera, so they have no parallax and look infinitely far.
//  * Planets, rocks and the satellite sit at fixed world positions, so every window shows the same scene.
//  * Nothing here uses scene lights (no light leaks onto the interior). Sunlight is painted in a tiny shader.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSettings } from '../store';
import { fbm, noise3, rng } from './planets';
import { useLater } from './space';

const PI = Math.PI;
/** The Sun, as seen from the ship. It stays in the east (Science Lab window). */
export const SUN_POS = new THREE.Vector3(270, 22, 20);

/** Paint simple sunlight on a MeshBasicMaterial: lit side, soft terminator, faint earthshine. No scene lights needed. */
export function sunLit(mat: THREE.MeshBasicMaterial, from: THREE.Vector3, ambient = 0.05) {
  const dir = SUN_POS.clone().sub(from).normalize();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSun = { value: dir };
    sh.uniforms.uAmb = { value: ambient };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWN = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWN;\nuniform vec3 uSun;\nuniform float uAmb;')
      .replace('#include <opaque_fragment>', 'float ndl = dot(normalize(vWN), uSun);\noutgoingLight *= uAmb + (1.0 - uAmb) * smoothstep(-0.05, 0.45, ndl);\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'sunlit';
  mat.needsUpdate = true;
  return mat;
}

const tex = (c: HTMLCanvasElement, srgb = true) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};
const mkCanvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ============================================================ stars
const STAR_VERT = `
attribute float aSize;
attribute vec3 aColor;
varying vec3 vColor;
uniform float uPx;
void main() {
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPx;
}`;
const STAR_FRAG = `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = clamp(1.0 - d, 0.0, 1.0);
  a = a * a;
  gl_FragColor = vec4(vColor, a);
}`;

function makeStars(count: number) {
  const rand = rng(7771);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count);
  const bandN = new THREE.Vector3(0.28, 0.9, 0.33).normalize();
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    // random direction on the sphere
    const u = rand() * 2 - 1, th = rand() * PI * 2, r = Math.sqrt(1 - u * u);
    v.set(r * Math.cos(th), u, r * Math.sin(th));
    const inBand = rand() < 0.38;
    if (inBand) {
      // squash towards the Milky Way plane (a soft band of many faint stars)
      const along = v.dot(bandN);
      v.addScaledVector(bandN, -along * (1 - 0.14 * (0.4 + rand() * 0.6))).normalize();
    }
    pos[i * 3] = v.x * 450; pos[i * 3 + 1] = v.y * 450; pos[i * 3 + 2] = v.z * 450;
    // size and brightness: many faint stars, a few bright ones
    const k = rand();
    const bright = inBand ? 0.18 + Math.pow(rand(), 4) * 0.5 : 0.22 + Math.pow(k, 5) * 0.78;
    size[i] = (inBand ? 1.0 : 1.1) + Math.pow(k, 9) * 2.6;
    // colour: blue-white, white, warm
    const t = rand();
    const c: [number, number, number] = t < 0.18 ? [0.72, 0.82, 1.0] : t < 0.72 ? [1.0, 0.98, 0.95] : t < 0.92 ? [1.0, 0.88, 0.7] : [1.0, 0.72, 0.5];
    col[i * 3] = c[0] * bright; col[i * 3 + 1] = c[1] * bright; col[i * 3 + 2] = c[2] * bright;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  return g;
}

/** One draw call. Follows the camera so the stars never shift when you walk. */
export function Starfield({ count = 7000 }: { count?: number }) {
  const grp = useRef<THREE.Group>(null!);
  const gl = useThree((s) => s.gl);
  const geo = useMemo(() => makeStars(count), [count]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, uniforms: { uPx: { value: 1 } },
  }), []);
  useEffect(() => { mat.uniforms.uPx.value = gl.getPixelRatio(); }, [gl, mat]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ camera }) => { if (grp.current) grp.current.position.copy(camera.position); });
  return (
    <group ref={grp}>
      <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-90} />
    </group>
  );
}

// ============================================================ nebulae, deep-space cloud and Milky Way glow
interface Neb { c: [number, number, number]; r: number; col: [number, number, number]; seed: number }
const NEBULAE: Neb[] = [
  { c: [0.5, 0.35, -0.8], r: 0.6, col: [44, 84, 170], seed: 11 },   // blue
  { c: [-0.7, 0.1, -0.6], r: 0.5, col: [96, 58, 150], seed: 23 },   // violet
  { c: [0.2, -0.4, 0.9], r: 0.34, col: [40, 112, 140], seed: 37 },  // teal-blue
  { c: [-0.3, 0.6, 0.7], r: 0.38, col: [118, 56, 104], seed: 41 },  // dim rose
];
export function makeSky(W: number, Hh: number) {
  const c = mkCanvas(W, Hh);
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, Hh);
  const d = img.data;
  const cs = NEBULAE.map((n) => { const l = Math.hypot(...n.c); return n.c.map((x) => x / l) as [number, number, number]; });
  const bn = [0.28, 0.9, 0.33], bl = Math.hypot(bn[0], bn[1], bn[2]);
  for (let y = 0; y < Hh; y++) {
    const th = ((y + 0.5) / Hh) * PI, sy = Math.sin(th), cy = Math.cos(th);
    for (let x = 0; x < W; x++) {
      const ph = ((x + 0.5) / W) * PI * 2;
      const px = -Math.cos(ph) * sy, py = cy, pz = Math.sin(ph) * sy;
      let R = 0, G = 0, B = 0;
      // deep-space cloud: very faint, large and soft
      const cl = Math.pow(fbm(px * 1.4 + 4, py * 1.4, pz * 1.4, 4, 77), 3) * 0.9;
      R += 20 * cl; G += 26 * cl; B += 46 * cl;
      // Milky Way glow
      const bd = (px * bn[0] + py * bn[1] + pz * bn[2]) / bl;
      const band = Math.exp(-(bd * bd) / 0.026);
      if (band > 0.01) {
        const m = 0.35 + 0.65 * fbm(px * 4, py * 4, pz * 4, 5, 5);
        const dust = 0.55 + 0.45 * fbm(px * 9 + 3, py * 9, pz * 9, 4, 9);
        const v = band * m * dust;
        R += 62 * v; G += 58 * v; B += 56 * v;
      }
      // nebulae
      for (let i = 0; i < NEBULAE.length; i++) {
        const n = NEBULAE[i], cc = cs[i];
        const dot = px * cc[0] + py * cc[1] + pz * cc[2];
        if (dot < 0.2) continue;
        const ang = Math.acos(Math.min(1, dot));
        const blob = Math.exp(-Math.pow(ang / n.r, 2) * 1.7);
        if (blob < 0.02) continue;
        const nz = fbm(px * 3 + n.seed, py * 3, pz * 3, 5, n.seed);
        const dens = Math.max(0, nz - 0.38) * 2.3 * blob;
        R += n.col[0] * dens; G += n.col[1] * dens; B += n.col[2] * dens;
      }
      const o = (y * W + x) * 4;
      d[o] = Math.min(255, R); d[o + 1] = Math.min(255, G); d[o + 2] = Math.min(255, B); d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
function NebulaSky() {
  const grp = useRef<THREE.Group>(null!);
  const sky = useLater(() => tex(makeSky(1024, 512)), []);
  useFrame(({ camera }) => { if (grp.current) grp.current.position.copy(camera.position); });
  useEffect(() => () => sky?.dispose(), [sky]);
  if (!sky) return null;
  return (
    <group ref={grp}>
      <mesh renderOrder={-100} frustumCulled={false}>
        <sphereGeometry args={[600, 48, 24]} />
        <meshBasicMaterial map={sky} side={THREE.BackSide} depthWrite={false} depthTest={false} fog={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ============================================================ distant galaxies
function galaxyTex(seed: number, tilt: number, core: string, arm: string) {
  const c = mkCanvas(256, 256), g = c.getContext('2d')!;
  const rand = rng(seed);
  g.translate(128, 128); g.rotate(seed * 0.7); g.scale(1, tilt);
  const grd = g.createRadialGradient(0, 0, 1, 0, 0, 60);
  grd.addColorStop(0, core); grd.addColorStop(0.25, core.replace(/[\d.]+\)$/, '0.35)')); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 60, 0, PI * 2); g.fill();
  g.fillStyle = arm;
  for (let i = 0; i < 2600; i++) {
    const t = Math.pow(rand(), 0.7), a = t * 9 + (i % 2) * PI + (rand() - 0.5) * 0.5;
    const r = 6 + t * 112;
    const x = Math.cos(a) * r + (rand() - 0.5) * 9, y = Math.sin(a) * r + (rand() - 0.5) * 9;
    g.globalAlpha = (0.05 + rand() * 0.22) * (1 - t * 0.7);
    g.fillRect(x, y, 1.6, 1.6);
  }
  return tex(c);
}
function clusterTex() {
  const c = mkCanvas(256, 256), g = c.getContext('2d')!;
  const rand = rng(404);
  for (let i = 0; i < 34; i++) {
    const a = rand() * PI * 2, r = Math.pow(rand(), 0.8) * 100;
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r * 0.8, s = 2 + rand() * 6;
    const gr = g.createRadialGradient(x, y, 0, x, y, s);
    const warm = rand() < 0.6;
    gr.addColorStop(0, warm ? 'rgba(255,235,205,0.9)' : 'rgba(200,220,255,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.save(); g.translate(x, y); g.rotate(rand() * PI); g.scale(1.5, 0.8); g.translate(-x, -y);
    g.beginPath(); g.arc(x, y, s, 0, PI * 2); g.fill(); g.restore();
  }
  return tex(c);
}
function Galaxies() {
  const grp = useRef<THREE.Group>(null!);
  useFrame(({ camera }) => { if (grp.current) grp.current.position.copy(camera.position); });
  const items = useMemo(() => {
    const mk = (dir: [number, number, number], size: number, t: THREE.Texture, op: number) => ({ dir: new THREE.Vector3(...dir).normalize().multiplyScalar(520), size, t, op });
    return [
      mk([-0.6, 0.45, -0.66], 46, galaxyTex(3, 0.42, 'rgba(255,230,190,0.95)', '#aac4ff'), 0.55),
      mk([0.72, 0.3, 0.62], 30, galaxyTex(8, 0.8, 'rgba(255,240,210,0.9)', '#ffd9a8'), 0.42),
      mk([0.3, 0.7, -0.64], 24, galaxyTex(12, 0.55, 'rgba(230,240,255,0.9)', '#b9ccff'), 0.4),
      mk([-0.2, -0.25, 0.95], 34, clusterTex(), 0.5),
    ];
  }, []);
  useEffect(() => () => items.forEach((i) => i.t.dispose()), [items]);
  return (
    <group ref={grp}>
      {items.map((it, i) => (
        <sprite key={i} position={it.dir} scale={[it.size, it.size, 1]} renderOrder={-95}>
          <spriteMaterial map={it.t} transparent opacity={it.op} depthWrite={false} depthTest blending={THREE.AdditiveBlending} fog={false} />
        </sprite>
      ))}
    </group>
  );
}

// ============================================================ distant planets
function bandedTex(kind: 'gas' | 'mars') {
  const W = 512, Hh = 256;
  const c = mkCanvas(W, Hh), g = c.getContext('2d')!;
  const img = g.createImageData(W, Hh), d = img.data;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / Hh;
    let r: number, gg: number, b: number;
    if (kind === 'gas') {
      const warp = fbm(u * 6, v * 3, 1.3, 4, 3) * 0.12;
      const band = 0.5 + 0.5 * Math.sin((v + warp) * 38) * (0.55 + 0.45 * fbm(0.5, v * 9, 2.2, 3, 8));
      const t = Math.min(1, Math.max(0, band));
      r = 150 + 90 * t; gg = 118 + 80 * t; b = 80 + 62 * t;
    } else {
      const n = fbm(Math.cos(u * PI * 2) * 2.2, v * 4, Math.sin(u * PI * 2) * 2.2, 5, 21);
      const t = Math.min(1, Math.max(0, (n - 0.3) * 2.2));
      r = 120 + 80 * t; gg = 58 + 52 * t; b = 38 + 36 * t;
      if (v < 0.07 || v > 0.93) { r = 225; gg = 225; b = 230; }
    }
    const o = (y * W + x) * 4;
    d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c);
}
function ringTex() {
  const c = mkCanvas(256, 4), g = c.getContext('2d')!;
  const rand = rng(99);
  for (let x = 0; x < 256; x++) {
    const t = x / 256;
    let a = 0.15 + 0.7 * Math.abs(Math.sin(t * 31 + rand() * 0.3)) * (0.6 + 0.4 * noise3(t * 20, 0, 0, 5));
    if (t > 0.5 && t < 0.56) a = 0.04; // a gap
    a *= Math.min(1, t * 9) * Math.min(1, (1 - t) * 9);
    g.fillStyle = `rgba(215,190,150,${a})`; g.fillRect(x, 0, 1, 4);
  }
  return tex(c);
}
function Planet({ pos, radius, kind, ringed = false, spin = 0.012 }: { pos: [number, number, number]; radius: number; kind: 'gas' | 'mars'; ringed?: boolean; spin?: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  const map = useLater(() => bandedTex(kind), [kind]);
  const rings = useLater(() => (ringed ? ringTex() : null), [ringed]);
  const from = useMemo(() => new THREE.Vector3(...pos), [pos]);
  const mat = useMemo(() => sunLit(new THREE.MeshBasicMaterial({ color: '#ffffff' }), from, 0.06), [from]);
  const ringGeo = useMemo(() => {
    const g = new THREE.RingGeometry(1.5, 2.45, 96, 1);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (Math.hypot(p.getX(i), p.getY(i)) - 1.5) / 0.95, 0.5);
    return g;
  }, []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, color: '#ffffff' }), []);
  useEffect(() => { mat.map = map; mat.needsUpdate = true; }, [map, mat]);
  useEffect(() => { ringMat.map = rings; ringMat.needsUpdate = true; }, [rings, ringMat]);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * spin; });
  return (
    <group position={pos}>
      <mesh ref={ref} scale={radius} material={mat}><sphereGeometry args={[1, 48, 32]} /></mesh>
      {ringed && <mesh geometry={ringGeo} material={ringMat} scale={radius} rotation={[PI / 2 - 0.42, 0, 0.18]} />}
    </group>
  );
}
function DistantPlanets() {
  return (
    <>
      {/* a ringed gas giant: seen through the Engineering window (west) */}
      <Planet pos={[-270, 34, 24]} radius={15} kind="gas" ringed />
      {/* a small red world, far off to the north-east */}
      <Planet pos={[250, 46, -150]} radius={5.5} kind="mars" spin={0.02} />
    </>
  );
}

// ============================================================ asteroids, satellite, comet, debris
function rockGeometry(seed: number) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.6 + seed, v.y * 1.6, v.z * 1.6, 3, seed);
    v.multiplyScalar(0.62 + 0.7 * n);
    p.setXYZ(i, v.x, v.y * 0.85, v.z);
  }
  const flat = g.toNonIndexed();   // faceted, rocky look
  flat.computeVertexNormals();
  g.dispose();
  return flat;
}
function rockTex() {
  const c = mkCanvas(128, 128), g = c.getContext('2d')!;
  const rand = rng(5);
  g.fillStyle = '#7d756c'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { const v = 70 + rand() * 90; g.fillStyle = `rgba(${v},${v - 6},${v - 14},0.35)`; g.fillRect(rand() * 128, rand() * 128, 2 + rand() * 6, 2 + rand() * 6); }
  return tex(c);
}
const ROCKS: { p: [number, number, number]; s: number; seed: number; drift: [number, number, number] }[] = [
  { p: [-95, 26, 150], s: 4, seed: 2, drift: [0.03, 0, -0.01] },
  { p: [125, 42, 170], s: 6.5, seed: 6, drift: [-0.02, 0.005, 0] },
  { p: [-215, 12, -70], s: 9, seed: 9, drift: [0.01, 0, 0.02] },
  { p: [235, 62, -95], s: 5, seed: 13, drift: [0, 0.004, 0.03] },
  { p: [40, 70, -230], s: 3.5, seed: 17, drift: [0.02, 0, 0.01] },
];
function Rocks() {
  const refs = useRef<THREE.Mesh[]>([]);
  const geos = useMemo(() => ROCKS.map((r) => rockGeometry(r.seed)), []);
  const map = useMemo(() => rockTex(), []);
  const mats = useMemo(() => ROCKS.map((r) => sunLit(new THREE.MeshBasicMaterial({ map, color: '#ffffff' }), new THREE.Vector3(...r.p), 0.04)), [map]);
  useEffect(() => () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); map.dispose(); }, [geos, mats, map]);
  useFrame((_, dt) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.rotation.x += dt * (0.02 + i * 0.004); m.rotation.y += dt * (0.03 - i * 0.003);
      const d = ROCKS[i].drift;
      m.position.x += d[0] * dt; m.position.y += d[1] * dt; m.position.z += d[2] * dt;
    });
  });
  return (
    <>
      {ROCKS.map((r, i) => (
        <mesh key={i} ref={(el) => { if (el) refs.current[i] = el; }} position={r.p} scale={r.s} geometry={geos[i]} material={mats[i]} />
      ))}
    </>
  );
}

/** A small satellite on a slow orbit around the Moon (passes behind it now and then). */
function Satellite() {
  const grp = useRef<THREE.Group>(null!);
  const lamp = useRef<THREE.MeshBasicMaterial>(null!);
  const mats = useMemo(() => {
    const from = new THREE.Vector3(0, 8, 95);
    const m = (c: string) => sunLit(new THREE.MeshBasicMaterial({ color: c }), from, 0.08);
    return { body: m('#b9bcc0'), panel: m('#2c3f6b'), foil: m('#c9a24a'), dish: m('#e4e6e8') };
  }, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const a = 1.2 + t * 0.018;
    if (grp.current) {
      // orbit centre = the Moon. Radius 62 keeps it well outside the Moon and far from the ship.
      grp.current.position.set(Math.cos(a) * 62, 8 + Math.sin(a * 0.9) * 14, 95 + Math.sin(a) * 62 * 0.8);
      grp.current.rotation.y = a + PI / 2; grp.current.rotation.z = Math.sin(t * 0.05) * 0.1;
    }
    if (lamp.current) lamp.current.color.set(t % 1.6 < 0.14 ? '#ff4a3a' : '#2a0c08');
  });
  return (
    <group ref={grp}>
      <mesh material={mats.body}><boxGeometry args={[1.3, 1.1, 1.8]} /></mesh>
      <mesh position={[0, 0, 1.0]} material={mats.foil}><boxGeometry args={[1.0, 0.9, 0.3]} /></mesh>
      <mesh position={[2.6, 0, 0]} material={mats.panel}><boxGeometry args={[3.4, 0.05, 1.3]} /></mesh>
      <mesh position={[-2.6, 0, 0]} material={mats.panel}><boxGeometry args={[3.4, 0.05, 1.3]} /></mesh>
      <mesh position={[0, 0.9, -0.3]} rotation={[0.5, 0, 0]} material={mats.dish}><coneGeometry args={[0.7, 0.35, 16, 1, true]} /></mesh>
      <mesh position={[0.5, 0.65, 0.6]}><sphereGeometry args={[0.1, 8, 8]} /><meshBasicMaterial ref={lamp} color="#2a0c08" /></mesh>
    </group>
  );
}

function tailTex() {
  const c = mkCanvas(256, 32), g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, 'rgba(190,225,255,0.9)'); gr.addColorStop(0.15, 'rgba(150,200,255,0.4)'); gr.addColorStop(1, 'rgba(120,170,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 32);
  const vg = g.createLinearGradient(0, 0, 0, 32);
  vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = vg; g.fillRect(0, 0, 256, 32);
  return tex(c);
}
function glowTex() {
  const c = mkCanvas(64, 64), g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(210,235,255,0.6)'); gr.addColorStop(1, 'rgba(150,200,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return tex(c);
}
/** A faint comet in the far north-west. It barely moves. */
function Comet() {
  const grp = useRef<THREE.Group>(null!);
  const tail = useMemo(() => tailTex(), []);
  const glow = useMemo(() => glowTex(), []);
  useEffect(() => () => { tail.dispose(); glow.dispose(); }, [tail, glow]);
  useFrame(({ clock }) => { if (grp.current) grp.current.position.x = -170 + clock.elapsedTime * 0.04; });
  // the tail points away from the Sun (the Sun is in the east, so the tail points west)
  return (
    <group ref={grp} position={[-170, 105, -300]}>
      <sprite scale={[7, 7, 1]}><spriteMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} /></sprite>
      <mesh position={[-38, 3, 0]} rotation={[0, 0, 0.07]}>
        <planeGeometry args={[76, 5]} />
        <meshBasicMaterial map={tail} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} fog={false} />
      </mesh>
    </group>
  );
}

/** Three small pieces of debris drifting slowly near the south (Command) window. */
function Debris() {
  const refs = useRef<THREE.Mesh[]>([]);
  const mat = useMemo(() => sunLit(new THREE.MeshBasicMaterial({ color: '#9a9ea3' }), new THREE.Vector3(30, 10, 60), 0.06), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const base: [number, number, number][] = [[28, 9, 52], [-36, 14, 66], [12, 17, 82]];
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.position.set(base[i][0] + Math.sin(t * 0.021 + i * 2) * 5, base[i][1] + Math.sin(t * 0.017 + i) * 1.5, base[i][2] + Math.cos(t * 0.019 + i * 3) * 4);
      m.rotation.x += dt * (0.3 + i * 0.1); m.rotation.z += dt * 0.2;
    });
  });
  const sizes: [number, number, number][] = [[0.5, 0.08, 0.35], [0.3, 0.3, 0.05], [0.6, 0.06, 0.2]];
  return (
    <>
      {sizes.map((s, i) => (
        <mesh key={i} ref={(el) => { if (el) refs.current[i] = el; }} position={base[i]} material={mat}><boxGeometry args={s} /></mesh>
      ))}
    </>
  );
}

// ============================================================ everything
export function DeepSpace() {
  const quality = useSettings((s) => s.quality);
  const low = quality === 'low';
  return (
    <>
      <NebulaSky />
      <Starfield count={low ? 3500 : 7000} />
      {!low && <Galaxies />}
      <DistantPlanets />
      <Rocks />
      <Satellite />
      {!low && <Comet />}
      <Debris />
    </>
  );
}
