// Building blocks for the V3 interiors: materials, textures drawn with code,
// instanced detail, live screens, sim-linked lights and sliding doors.
// Everything is procedural (no image files).
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, useUI } from '../../store';
import { sfx } from '../../audio';
import { pose } from '../../controls';
import { isEmergency, type GameState } from '../../sim';

export type V3 = [number, number, number];

/** True if this object and all its parents are visible (used to skip work in rooms that are far away). */
export function shown(o: THREE.Object3D | null | undefined) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}
/** Draws its children only while the player is within `r` metres (hides again beyond r + 3). Saves a lot of GPU work. */
export function Gate({ cx, cz, r, children }: { cx: number; cz: number; r: number; children?: ReactNode }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const d = Math.hypot(pose.x - cx, pose.z - cz);
    if (g.visible && d > r + 3) g.visible = false;
    else if (!g.visible && d < r) g.visible = true;
  });
  return <group ref={ref}>{children}</group>;
}

// ------------------------------------------------------------------ materials
// A restrained NASA look: painted aluminium, brushed steel, dark composite,
// rubber, thermal foil and glass. Colour comes from small lights and screens only.
const mk = (color: string, roughness = 0.5, metalness = 0.5, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
export const MAT = {
  steel: mk('#9aa1a9', 0.34, 0.85),          // brushed stainless / aluminium
  darkSteel: mk('#4b5058', 0.45, 0.8),
  paint: mk('#c4c7cb', 0.6, 0.25),           // painted aluminium (off-white)
  paintGrey: mk('#7b8189', 0.6, 0.3),
  paintDark: mk('#3a3f46', 0.65, 0.3),
  comp: mk('#1c2025', 0.5, 0.4),             // carbon composite
  rubber: mk('#15171a', 0.95, 0),
  foil: mk('#b8923f', 0.32, 0.92),           // gold thermal insulation (MLI)
  foilSilver: mk('#b5bac0', 0.3, 0.92),
  white: mk('#ffffff', 0.6, 0.2),            // base for instanced colours
  suit: mk('#e6e6e2', 0.75, 0.05),           // EVA suit fabric
  visor: mk('#c79a35', 0.12, 1),             // gold visor
  cable: mk('#1f2226', 0.8, 0.1),
  cableRed: mk('#7a2323', 0.8, 0.1),
  cableBlue: mk('#23406f', 0.8, 0.1),
  cableYellow: mk('#8c7421', 0.8, 0.1),
  pipeSteel: mk('#8f9aa6', 0.38, 0.75),
  pipeBlue: mk('#3f6ea8', 0.45, 0.55),       // coolant (cold)
  pipeOrange: mk('#b3652a', 0.45, 0.55),     // coolant (warm)
  glass: new THREE.MeshStandardMaterial({ color: '#a9c2d4', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.2, depthWrite: false }),
  black: mk('#0b0d10', 0.8, 0.2),
};

export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 18);
export const SPH = new THREE.SphereGeometry(1, 12, 9);
export const TOR = new THREE.TorusGeometry(1, 0.08, 8, 28);

// ------------------------------------------------------------------ small mesh helpers
export function Bx({ p, s, m = MAT.paint, r, cast }: { p: V3; s: V3; m?: THREE.Material; r?: V3; cast?: boolean }) {
  return <mesh geometry={BOX} material={m} position={p} scale={s} rotation={r} castShadow={cast} />;
}
/** Cylinder standing on Y (rotate with `r` for pipes lying down). radius, height */
export function Cy({ p, rad, h, m = MAT.steel, r, seg }: { p: V3; rad: number; h: number; m?: THREE.Material; r?: V3; seg?: number }) {
  void seg;
  return <mesh geometry={CYL} material={m} position={p} scale={[rad, h, rad]} rotation={r} />;
}
/** A pipe or cable between two points. */
export function Run({ a, b, rad = 0.05, m = MAT.pipeSteel }: { a: V3; b: V3; rad?: number; m?: THREE.Material }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    const l = d.length();
    return { pos: va.clone().add(vb).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), len: l };
  }, [a, b]);
  return <mesh geometry={CYL} material={m} position={pos} quaternion={quat} scale={[rad, len, rad]} />;
}

// ------------------------------------------------------------------ instanced detail
export interface Item { p: V3; s: V3; r?: number; c?: string }
export function Inst({ items, mat = MAT.white, geo = BOX }: { items: Item[]; mat?: THREE.Material; geo?: THREE.BufferGeometry }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    items.forEach((it, i) => {
      d.position.set(...it.p); d.scale.set(...it.s); d.rotation.set(0, it.r ?? 0, 0); d.updateMatrix();
      ref.current.setMatrixAt(i, d.matrix);
      if (it.c) { col.set(it.c); ref.current.setColorAt(i, col); }
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [items]);
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} frustumCulled={false} />;
}

// ------------------------------------------------------------------ textures drawn with code
const texCache: Record<string, THREE.CanvasTexture> = {};
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache[key] = t;
  return t;
}
export type Kind = 'info' | 'warn' | 'danger' | 'safe';
const KIND: Record<Kind, [string, string]> = { info: ['#d9dcdf', '#1d2329'], warn: ['#d9a521', '#15130c'], danger: ['#b3261e', '#f5f5f5'], safe: ['#2f7d4f', '#f2f2f2'] };
export function labelTex(text: string, kind: Kind = 'info') {
  return canvasTex('label:' + kind + ':' + text, 256, 64, (g, w, h) => {
    const [bg, fg] = KIND[kind];
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = fg; g.font = 'bold 30px "Arial Narrow", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2, w - 16);
  });
}
function hazardTex(len: number, wid: number) {
  const W = Math.max(16, Math.round(len * 64)), Hh = Math.max(16, Math.round(wid * 64));
  return canvasTex('hz:' + W + 'x' + Hh, W, Hh, (g, w, h) => {
    g.fillStyle = '#d1a21c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#17150e';
    for (let x = -h; x < w + h; x += 34) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 17, h); g.lineTo(x + 17 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  });
}
function grateTex(w: number, d: number) {
  const W = Math.max(32, Math.round(w * 64)), D = Math.max(32, Math.round(d * 64));
  return canvasTex('gr:' + W + 'x' + D, W, D, (g, cw, ch) => {
    g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#6a7078';
    for (let x = 4; x < cw; x += 10) g.fillRect(x, 0, 3, ch);
    g.fillStyle = '#8b9199';
    for (let y = 0; y < ch; y += 32) g.fillRect(0, y, cw, 4);
    g.strokeStyle = '#a3a9b0'; g.lineWidth = 5; g.strokeRect(2, 2, cw - 4, ch - 4);
  });
}
function ventTex() {
  return canvasTex('vent', 128, 64, (g, w, h) => {
    g.fillStyle = '#1a1d21'; g.fillRect(0, 0, w, h);
    for (let y = 5; y < h - 4; y += 9) { g.fillStyle = '#8f959c'; g.fillRect(6, y, w - 12, 4); g.fillStyle = '#050607'; g.fillRect(6, y + 4, w - 12, 3); }
    g.strokeStyle = '#a0a6ad'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
  });
}

/** Flat decal. `rot` is the full Euler rotation, so it can sit on floors or walls. */
function Decal({ tex, p, rot, size, rough = 0.7 }: { tex: THREE.Texture; p: V3; rot: V3; size: [number, number]; rough?: number }) {
  return (
    <mesh position={p} rotation={rot}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={tex} roughness={rough} metalness={0.2} />
    </mesh>
  );
}
/** A printed label on a wall or panel. rotY: 0 faces +Z, PI faces -Z, PI/2 faces +X, -PI/2 faces -X. */
export function Plate({ text, p, rotY = 0, w = 0.5, kind = 'info' }: { text: string; p: V3; rotY?: number; w?: number; kind?: Kind }) {
  return <Decal tex={labelTex(text, kind)} p={p} rot={[0, rotY, 0]} size={[w, w / 4]} />;
}
/** Yellow/black warning stripes lying on the floor (x, z = centre). */
export function FloorHazard({ x, z, w, d, rotY = 0 }: { x: number; z: number; w: number; d: number; rotY?: number }) {
  return <Decal tex={hazardTex(w, d)} p={[x, 0.024, z]} rot={[-Math.PI / 2, 0, rotY]} size={[w, d]} />;
}
export function HazardStripe({ p, w, h, rotY = 0 }: { p: V3; w: number; h: number; rotY?: number }) {
  return <Decal tex={hazardTex(w, h)} p={p} rot={[0, rotY, 0]} size={[w, h]} />;
}
/** Floor grate (a drain / cable-way cover). */
export function Grate({ x, z, w, d, rotY = 0 }: { x: number; z: number; w: number; d: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <Bx p={[0, 0.012, 0]} s={[w + 0.12, 0.03, d + 0.12]} m={MAT.darkSteel} />
      <Decal tex={grateTex(w, d)} p={[0, 0.03, 0]} rot={[-Math.PI / 2, 0, 0]} size={[w, d]} rough={0.5} />
    </group>
  );
}
/** Square maintenance hatch in the floor: frame, hinge, handle, bolts. */
export function Hatch({ x, z, s = 1.1, rotY = 0 }: { x: number; z: number; s?: number; rotY?: number }) {
  const bolts = useMemo<Item[]>(() => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ p: [a * (s / 2 - 0.08), 0.036, b * (s / 2 - 0.08)] as V3, s: [0.045, 0.012, 0.045] as V3 })), [s]);
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <Bx p={[0, 0.014, 0]} s={[s + 0.14, 0.03, s + 0.14]} m={MAT.darkSteel} />
      <Bx p={[0, 0.03, 0]} s={[s, 0.02, s]} m={MAT.paintGrey} />
      <Bx p={[0, 0.042, 0]} s={[s - 0.3, 0.008, s - 0.3]} m={MAT.paintDark} />
      <Bx p={[0, 0.05, s / 2 + 0.02]} s={[0.22, 0.03, 0.05]} m={MAT.steel} />{/* hinge */}
      <Bx p={[0, 0.056, -s * 0.28]} s={[0.3, 0.02, 0.06]} m={MAT.steel} />{/* flush handle */}
      <Inst items={bolts} mat={MAT.steel} geo={CYL} />
    </group>
  );
}
/** Wall vent grille. rotY faces like Plate. */
export function Vent({ p, rotY = 0, w = 0.9, h = 0.45 }: { p: V3; rotY?: number; w?: number; h?: number }) {
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Bx p={[0, 0, -0.01]} s={[w + 0.1, h + 0.1, 0.05]} m={MAT.darkSteel} />
      <Decal tex={ventTex()} p={[0, 0, 0.02]} rot={[0, 0, 0]} size={[w, h]} rough={0.5} />
    </group>
  );
}

// ------------------------------------------------------------------ lights tied to the simulation
const SW = { green: '#3fbf6a', amber: '#e0a020', red: '#e0392d', off: '#25292f', blue: '#4aa3d8', white: '#e8edf2' };
export const LED = SW;
/** Small indicator light. `get` returns a colour from the sim state. */
export function Led({ p, size = 0.035, get }: { p: V3; size?: number; get: (g: GameState, t: number) => string }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const me = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!mat.current || !shown(me.current)) return;
    const c = get(useGame.getState(), clock.elapsedTime);
    mat.current.color.set(c); mat.current.emissive.set(c);
  });
  return (
    <mesh ref={me} geometry={SPH} position={p} scale={size}>
      <meshStandardMaterial ref={mat} color="#222" emissive="#222" emissiveIntensity={1.8} />
    </mesh>
  );
}
// Shared glowing materials for rows of indicator lights (one material = many lights, cheap).
const ledMat = (c: string) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.1, roughness: 0.4 });
export const LM = { power: ledMat(SW.green), comms: ledMat(SW.blue), sci: ledMat('#9ad06a'), amber: ledMat(SW.amber), alert: ledMat(SW.red) };
/** Mount once. Drives the shared indicator materials from the simulation (never from per-light code). */
export function LedDriver() {
  useFrame(({ clock }) => {
    const g = useGame.getState();
    const t = clock.elapsedTime;
    LM.power.emissiveIntensity = g.powered.life ? 1.8 : 0.06;
    LM.comms.emissiveIntensity = g.powered.comms ? (g.transmitting ? (blink(t, 6) ? 2.2 : 0.4) : blink(t, 1.3, 0.7) ? 1.8 : 0.7) : 0.05;
    LM.sci.emissiveIntensity = g.powered.sci ? (g.running.spectrometer || g.running.seismic || g.running.analyzer || g.running.camera ? (blink(t, 3) ? 2 : 0.8) : 1.2) : 0.05;
    LM.amber.emissiveIntensity = g.surge || g.overloaded ? (blink(t, 4) ? 2.4 : 0.1) : g.genState === 'starting' ? (blink(t, 1.5) ? 2 : 0.2) : 0.06;
    LM.alert.emissiveIntensity = isEmergency(g) && g.phase === 'playing' ? (blink(t, 1.6, 0.4) ? 2.4 : 0.1) : 0.05;
  });
  return null;
}
/** Blink helper: on for `duty` of each period. */
export const blink = (t: number, hz: number, duty = 0.5) => (t * hz) % 1 < duty;
/** Rotating or pulsing warning beacon. Only lights when `on(g)` is true. */
export function Beacon({ p, color = SW.amber, on, rotate = true }: { p: V3; color?: string; on: (g: GameState) => boolean; rotate?: boolean }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const grp = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (!mat.current || !shown(grp.current)) return;
    const lit = on(useGame.getState());
    const k = lit ? 0.35 + 0.65 * Math.max(0, Math.sin(clock.elapsedTime * 7)) : 0.05;
    mat.current.emissiveIntensity = 0.1 + k * 2.4;
    if (rotate && grp.current && lit) grp.current.rotation.y = clock.elapsedTime * 6;
  });
  return (
    <group position={p}>
      <Cy p={[0, 0.03, 0]} rad={0.09} h={0.06} m={MAT.darkSteel} />
      <group ref={grp}>
        <mesh geometry={SPH} position={[0, 0.12, 0]} scale={[0.08, 0.1, 0.08]}>
          <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.2} transparent opacity={0.92} />
        </mesh>
        {rotate && <Bx p={[0.04, 0.12, 0]} s={[0.05, 0.02, 0.1]} m={MAT.black} />}
      </group>
    </group>
  );
}
/** Ceiling light panel that follows the room's emergency state (white -> dim red). */
export function TaskLight({ p, s, warm = false }: { p: V3; s: V3; warm?: boolean }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const norm = useMemo(() => new THREE.Color(warm ? '#fff1d6' : '#f2f6fb'), [warm]);
  const red = useMemo(() => new THREE.Color('#ff3b30'), []);
  const mix = useRef(0);
  const me = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    if (!shown(me.current)) return;
    const g = useGame.getState();
    const em = g.phase === 'won' ? false : g.phase === 'lost' ? true : isEmergency(g);
    mix.current += ((em ? 1 : 0) - mix.current) * Math.min(1, dt * 3);
    if (!mat.current) return;
    mat.current.emissive.copy(norm).lerp(red, mix.current);
    mat.current.emissiveIntensity = 2.1 - mix.current * 1.5;
  });
  return (
    <group ref={me} position={p}>
      <Bx p={[0, 0.02, 0]} s={[s[0] + 0.12, 0.05, s[2] + 0.12]} m={MAT.paintDark} />
      <mesh geometry={BOX} scale={s}>
        <meshStandardMaterial ref={mat} color="#e8ecf0" emissive="#f2f6fb" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ live screens (canvas redrawn a few times a second)
export type Draw = (c: CanvasRenderingContext2D, W: number, H: number, g: GameState, t: number) => void;
export function LiveScreen({ p, rotY = 0, w, h, draw, fps = 5 }: { p: V3; rotY?: number; w: number; h: number; draw: Draw; fps?: number }) {
  const { canvas, tex } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = Math.max(64, Math.round((512 * h) / w));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { canvas: c, tex: t };
  }, [w, h]);
  const acc = useRef(10);
  const me = useRef<THREE.Group>(null!);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(({ clock }, dt) => {
    if (!shown(me.current)) return; // far away: do not redraw the canvas
    acc.current += dt;
    if (acc.current < 1 / fps) return;
    acc.current = 0;
    const c = canvas.getContext('2d');
    if (!c) return;
    draw(c, canvas.width, canvas.height, useGame.getState(), clock.elapsedTime);
    tex.needsUpdate = true;
  });
  return (
    <group ref={me} position={p} rotation={[0, rotY, 0]}>
      <Bx p={[0, 0, 0]} s={[w + 0.14, h + 0.14, 0.08]} m={MAT.comp} />
      <Bx p={[0, 0, -0.005]} s={[w + 0.2, h + 0.2, 0.05]} m={MAT.darkSteel} />
      <mesh position={[0, 0, 0.042]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#000" emissive="#fff" emissiveMap={tex} emissiveIntensity={0.85} roughness={0.25} metalness={0.1} />
      </mesh>
    </group>
  );
}
// drawing helpers for screens
export const SCR = { bg: '#07110f', line: '#1f3a35', text: '#b9d8cf', dim: '#5f8279', amber: '#e0a020', red: '#e0392d', green: '#3fbf6a', cyan: '#5fb7d6' };
export function screenFrame(c: CanvasRenderingContext2D, W: number, H: number, title: string, sub = '') {
  c.fillStyle = SCR.bg; c.fillRect(0, 0, W, H);
  c.strokeStyle = SCR.line; c.lineWidth = 1;
  for (let x = 0; x < W; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y < H; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.fillStyle = '#0f2723'; c.fillRect(0, 0, W, 38);
  c.fillStyle = SCR.text; c.font = 'bold 22px monospace'; c.textBaseline = 'middle'; c.textAlign = 'left';
  c.fillText(title, 14, 20);
  c.fillStyle = SCR.dim; c.textAlign = 'right'; c.font = '16px monospace'; c.fillText(sub, W - 14, 20);
  c.textAlign = 'left';
}
export function meter(c: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, v: number, col: string) {
  const f = Math.max(0, Math.min(1, v));
  c.fillStyle = SCR.dim; c.font = '15px monospace'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(label, x, y - 6);
  c.fillStyle = '#12201d'; c.fillRect(x, y, w, 14);
  c.fillStyle = col; c.fillRect(x, y, w * f, 14);
  c.strokeStyle = SCR.line; c.strokeRect(x, y, w, 14);
}
export const mmss = (s: number) => { const v = Math.max(0, Math.floor(s)); return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0'); };

// ------------------------------------------------------------------ sliding pressure doors
/** One-piece blast door. It lifts straight UP into the header and ceiling space when the player is near.
 *  (It does not slide sideways, so it can never show through walls.) Visual + sound only; walking is not blocked. */
export function SlidingDoor({ x, z, alongX, w = 3, name = 'BULKHEAD', airlock = false, children }: { x: number; z: number; alongX: boolean; w?: number; name?: string; airlock?: boolean; children?: ReactNode }) {
  const L = useRef<THREE.Group>(null!);
  const lamp = useRef<THREE.MeshStandardMaterial>(null!);
  const pins = useRef<THREE.Group>(null!);
  const st = useRef({ open: 0, want: false });
  const at = useMemo(() => ({ x, z }), [x, z]);
  useFrame((_, dt) => {
    const s = st.current;
    const d = Math.hypot(pose.x - x, pose.z - z);
    const was = s.want;
    if (!s.want && d < 4.6) s.want = true;
    else if (s.want && d > 6) s.want = false; // gap between the two limits: no flicker
    if (s.want !== was && useUI.getState().screen === 'game') (s.want ? sfx.doorOpen : sfx.doorClose)(at);
    const target = s.want ? 1 : 0;
    s.open += Math.sign(target - s.open) * Math.min(Math.abs(target - s.open), dt / 0.6);
    const e = s.open * s.open * (3 - 2 * s.open);
    if (L.current) {
      L.current.position.y = Math.max(0, (e - 0.12) / 0.88) * 3.2; // locking pins release first, then the door lifts
      L.current.visible = L.current.position.y < 3.15;
    }
    if (pins.current) pins.current.visible = s.open < 0.06;
    if (lamp.current) {
      const moving = s.open > 0.02 && s.open < 0.98;
      const c = moving ? SW.amber : s.open >= 0.98 ? SW.green : SW.red;
      lamp.current.color.set(c); lamp.current.emissive.set(c);
    }
  });
  return (
    <group position={[x, 0, z]} rotation={[0, alongX ? 0 : Math.PI / 2, 0]}>
      <group ref={L}>
        <Bx p={[0, 1.55, 0]} s={[w - 0.1, 3.1, 0.14]} m={MAT.paintGrey} />
        <Bx p={[0, 1.6, 0.08]} s={[w - 0.4, 2.5, 0.02]} m={MAT.paint} />
        <Bx p={[0, 1.6, -0.08]} s={[w - 0.4, 2.5, 0.02]} m={MAT.paint} />
        <Bx p={[0, 2.35, 0.088]} s={[0.6, 0.14, 0.02]} m={MAT.black} />
        <Bx p={[0, 2.35, -0.088]} s={[0.6, 0.14, 0.02]} m={MAT.black} />
        <Bx p={[0, 0.03, 0]} s={[w - 0.1, 0.06, 0.18]} m={MAT.rubber} />
        <HazardStripe p={[0, 0.2, 0.075]} w={w - 0.4} h={0.22} />
        <HazardStripe p={[0, 0.2, -0.075]} w={w - 0.4} h={0.22} rotY={Math.PI} />
      </group>
      {/* frame: full-height posts and a header that carries the name and the status lamp */}
      <Bx p={[0, 3.55, 0]} s={[w + 0.3, 0.9, 0.3]} m={MAT.paintGrey} />
      <Bx p={[0, 3.09, 0]} s={[w + 0.3, 0.06, 0.37]} m={MAT.steel} />
      <Plate text={name} p={[0, 3.55, 0.155]} w={1.3} kind={airlock ? 'warn' : 'info'} />
      <Plate text={name} p={[0, 3.55, -0.155]} rotY={Math.PI} w={1.3} kind={airlock ? 'warn' : 'info'} />
      <Bx p={[w / 2 - 0.2, 3.55, 0.158]} s={[0.22, 0.22, 0.01]} m={MAT.black} />
      <mesh geometry={SPH} position={[w / 2 - 0.2, 3.55, 0.17]} scale={0.06}>
        <meshStandardMaterial ref={lamp} color={SW.red} emissive={SW.red} emissiveIntensity={2} />
      </mesh>
      <Bx p={[-(w / 2 + 0.08), 1.55, 0]} s={[0.24, 3.1, 0.34]} m={MAT.steel} />
      <Bx p={[w / 2 + 0.08, 1.55, 0]} s={[0.24, 3.1, 0.34]} m={MAT.steel} />
      {/* locking pins (visible only while the door is shut) */}
      <group ref={pins}>
        {[0.5, 1.6, 2.7].flatMap((y) => [-1, 1].map((sg) => (
          <Bx key={y + ':' + sg} p={[sg * (w / 2 - 0.1), y, 0]} s={[0.08, 0.1, 0.2]} m={MAT.darkSteel} />
        )))}
      </group>
      {children}
    </group>
  );
}
