// Shared building blocks for the detailed spacecraft models:
// cached geometry, shared materials + small canvas textures, instanced bolts, tubes, an error boundary.
import { Component, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useSettings, type Quality } from '../../store';

export type Vec3 = [number, number, number];

// ---------------------------------------------------------------- quality
export const useQ = (): Quality => useSettings((s) => s.quality ?? 'medium');
/** scale a segment count with the quality setting */
export const seg = (q: Quality, n: number) => Math.max(6, Math.round(n * (q === 'low' ? 0.55 : q === 'high' ? 1.4 : 1)));

// ---------------------------------------------------------------- geometry cache (geometry is built once and reused)
const GEO = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = GEO.get(key);
  if (!g) { g = make(); GEO.set(key, g); }
  return g;
}
export const G = {
  box: (w: number, h: number, d: number) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (rt: number, rb: number, h: number, s = 16, open = false) => cached(`c${rt},${rb},${h},${s},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, open)),
  sph: (r: number, s = 16) => cached(`s${r},${s}`, () => new THREE.SphereGeometry(r, s, Math.max(6, Math.round(s * 0.7)))),
  tor: (r: number, t: number, rs = 8, ts = 24) => cached(`t${r},${t},${rs},${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts)),
  cone: (r: number, h: number, s = 16, open = false) => cached(`n${r},${h},${s},${open}`, () => new THREE.ConeGeometry(r, h, s, 1, open)),
  cap: (r: number, l: number, s = 12) => cached(`p${r},${l},${s}`, () => new THREE.CapsuleGeometry(r, l, 6, s)),
  arc: (r: number, h: number, t0: number, tl: number, s = 24) => cached(`a${r},${h},${t0},${tl},${s}`, () => new THREE.CylinderGeometry(r, r, h, s, 1, true, t0, tl)),
  plane: (w: number, h: number) => cached(`l${w},${h}`, () => new THREE.PlaneGeometry(w, h)),
  /** surface of revolution around the Y axis. points are [radius, y] */
  lathe: (pts: [number, number][], s = 24) => cached(`L${JSON.stringify(pts)},${s}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), s)),
  /** parabolic dish opening toward +Y */
  dish: (r: number, depth: number, s = 28) => cached(`D${r},${depth},${s}`, () => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) { const x = (i / 12) * r; pts.push(new THREE.Vector2(x, depth * (x / r) * (x / r))); }
    return new THREE.LatheGeometry(pts, s);
  }),
  /** pipe following a curve through the points */
  tube: (pts: Vec3[], r = 0.03, s = 6) => cached(`T${JSON.stringify(pts)},${r},${s}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), Math.max(8, pts.length * 6), r, s, false)),
};

// ---------------------------------------------------------------- textures (small canvases, made once)
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let rnd = 12345; const r01 = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);

// painted hull plates: seams, rivets, tiny labels
function hullTexture(base: string, seam: string) {
  return canvasTex(512, 512, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const v = Math.floor(r01() * 10) - 5;
      g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 90})`;
      g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124);
    }
    g.strokeStyle = seam; g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    g.fillStyle = seam;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) for (const [dx, dy] of [[8, 8], [120, 8], [8, 120], [120, 120]]) { g.beginPath(); g.arc(x * 128 + dx, y * 128 + dy, 1.8, 0, 7); g.fill(); }
    g.font = 'bold 9px monospace'; g.fillStyle = 'rgba(40,50,70,0.8)';
    g.fillText('NOVA-7', 22, 62); g.fillText('NO STEP', 150, 190); g.fillText('FUEL', 280, 320); g.fillText('REMOVE BEFORE FLIGHT', 14, 460);
    g.fillStyle = 'rgba(220,38,38,0.85)'; g.fillRect(150, 70, 40, 5);
    // panel vents
    g.fillStyle = 'rgba(30,41,59,0.5)'; for (let i = 0; i < 6; i++) g.fillRect(396, 36 + i * 6, 70, 2);
  });
}
// crinkled foil / blanket bump map
function foilBump() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const x = r01() * 256, y = r01() * 256, l = 6 + r01() * 22, a = r01() * 6.28;
      g.strokeStyle = r01() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'; g.lineWidth = 1 + r01() * 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }, false);
}
// one photovoltaic cell (busbars + fingers). Mapped onto every cell box.
function cellTexture() {
  return canvasTex(64, 64, (g) => {
    const gr = g.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, '#16307a'); gr.addColorStop(1, '#0a1c52');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(160,190,255,0.35)'; g.lineWidth = 1;
    for (let i = 6; i < 64; i += 8) { g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
    g.strokeStyle = 'rgba(210,220,240,0.8)'; g.lineWidth = 2;
    for (const x of [21, 43]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
  });
}

// ---------------------------------------------------------------- materials (shared by every part)
function build() {
  const hull = hullTexture('#eceff2', '#8d97a3');
  hull.repeat.set(3, 2);
  const dark = hullTexture('#39414d', '#1b2028');
  dark.repeat.set(3, 2);
  const foil = foilBump();
  foil.repeat.set(2, 2);
  const cell = cellTexture();
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
  const glowMat = (color: string, k = 1.4) => std({ color: '#0b0f14', emissive: color, emissiveIntensity: k, roughness: 0.5, metalness: 0.2 });
  return {
    paint: std({ color: '#ffffff', map: hull, roughness: 0.5, metalness: 0.15 }),
    armor: std({ color: '#ffffff', map: dark, roughness: 0.5, metalness: 0.55 }),
    alu: std({ color: '#b7c0cc', roughness: 0.32, metalness: 0.92 }),
    steel: std({ color: '#7d8794', roughness: 0.42, metalness: 0.9 }),
    dark: std({ color: '#222831', roughness: 0.45, metalness: 0.7 }),
    black: std({ color: '#0d1014', roughness: 0.6, metalness: 0.3 }),
    gold: std({ color: '#d4a21f', roughness: 0.3, metalness: 1, bumpMap: foil, bumpScale: 2.2 }),
    blanket: std({ color: '#16130f', roughness: 0.55, metalness: 0.35, bumpMap: foil, bumpScale: 1.6 }),
    silver: std({ color: '#d9dee5', roughness: 0.25, metalness: 1, bumpMap: foil, bumpScale: 0.8 }),
    copper: std({ color: '#b86b3a', roughness: 0.35, metalness: 0.95 }),
    orange: std({ color: '#e8651a', roughness: 0.5, metalness: 0.25 }),
    hazard: std({ color: '#e0a21a', roughness: 0.5, metalness: 0.3 }),
    cell: std({ color: '#ffffff', map: cell, roughness: 0.22, metalness: 0.75 }),
    panelBack: std({ color: '#cfd5dc', roughness: 0.5, metalness: 0.5 }),
    lens: std({ color: '#06090f', roughness: 0.05, metalness: 0.9 }),
    green: glowMat('#22c55e'),
    red: glowMat('#ef4444', 1.8),
    cyan: glowMat('#22d3ee'),
    amber: glowMat('#f59e0b'),
    violet: glowMat('#a78bfa', 1.8),
  };
}
let MATS: ReturnType<typeof build> | null = null;
export const M = () => (MATS ??= build());
/** a double-sided copy of a shared material (for open shells such as nozzle bells) */
const DS = new Map<THREE.Material, THREE.Material>();
export function ds(m: THREE.Material) {
  let c = DS.get(m);
  if (!c) { c = m.clone(); c.side = THREE.DoubleSide; DS.set(m, c); }
  return c;
}
export const mat = new Proxy({} as ReturnType<typeof build>, { get: (_t, k: string) => (M() as any)[k] });

// ---------------------------------------------------------------- mesh helpers
type PProps = { geo: THREE.BufferGeometry; m: THREE.Material; [k: string]: any };
/** a mesh from a cached geometry and a shared material */
export function P({ geo, m, ...rest }: PProps) {
  return <mesh geometry={geo} material={m} castShadow receiveShadow {...rest} />;
}

/** Many small bolts / rivets / screws in ONE draw call. pts = [x, y, z, nx, ny, nz] (n = direction the bolt faces). */
export function Bolts({ pts, r = 0.014, h = 0.014, m }: { pts: number[][]; r?: number; h?: number; m?: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const q = useQ();
  const list = q === 'low' ? [] : pts;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    list.forEach((p, i) => {
      o.position.set(p[0], p[1], p[2]);
      const n = new THREE.Vector3(p[3] ?? 0, p[4] ?? 1, p[5] ?? 0).normalize();
      o.quaternion.setFromUnitVectors(up, n);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [list]);
  if (!list.length) return null;
  return <instancedMesh key={list.length} ref={ref} args={[G.cyl(r, r, h, 6), m ?? M().steel, list.length]} frustumCulled={false} />;
}

/** a ring of N bolts around the Z axis */
export function boltRing(n: number, radius: number, z: number): number[][] {
  return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [Math.cos(a) * radius, Math.sin(a) * radius, z, Math.cos(a), Math.sin(a), 0]; });
}

/** a strut between two points */
export function Strut({ a, b, r = 0.025, m }: { a: Vec3; b: Vec3; r?: number; m?: THREE.Material }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    return { pos: va.clone().add(vb).multiplyScalar(0.5), len: d.length(), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()) };
  }, [a, b]);
  return <mesh geometry={G.cyl(r, r, len, 6)} material={m ?? M().alu} position={pos} quaternion={quat} castShadow />;
}

/** A pipe through points */
export function Pipe({ pts, r = 0.03, m }: { pts: Vec3[]; r?: number; m?: THREE.Material }) {
  return <mesh geometry={G.tube(pts, r)} material={m ?? M().copper} castShadow />;
}

// ---------------------------------------------------------------- error boundary: show the simple model if a detailed one fails
export class Safe extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.warn('[NOVA SHIFT] detailed model failed, using the simple one:', err); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
