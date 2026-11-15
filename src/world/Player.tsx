import { Suspense, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGame, useUI, useNet, useSettings, openPanel, closePanel, netHooks, hostCatchUp } from '../store';
import { useTut } from '../tutorial';
import { updateListener } from '../audio';
import { COLLIDERS, INTERACTABLES, roomAt } from './layout';
import { lockPointer, pose } from '../controls';
import { SuitModel } from './SuitModel';
import { Safe } from './parts/kit';

const RADIUS = 0.38;
const EYE = 1.65;
const START = { x: 0, z: -2, yaw: Math.PI };

function blocked(x: number, z: number) {
  for (const c of COLLIDERS) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx, dz = z - nz;
    if (dx * dx + dz * dz < RADIUS * RADIUS) return true;
  }
  return false;
}

export function Player() {
  const { camera } = useThree();
  const st = useRef({ x: START.x, z: START.z, yaw: START.yaw, pitch: 0, vx: 0, vz: 0, bob: 0, started: false, posT: 0 });
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      const g = useGame.getState();
      const ui = useUI.getState();
      if (g.phase !== 'playing' || ui.screen !== 'game') return;
      if (e.code === 'Escape' && ui.panel) {
        closePanel();
        lockPointer();
      } else if (e.code === 'KeyE' && !ui.panel && ui.locked) {
        const it = ui.nearby && INTERACTABLES.find((i) => i.id === ui.nearby!.id);
        if (it) {
          openPanel(it.panel, it.focus ?? null);
          document.exitPointerLock();
        }
      }
    };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const move = (e: MouseEvent) => {
      const ui = useUI.getState();
      if (!document.pointerLockElement || ui.panel || useGame.getState().phase !== 'playing') return;
      const k = 0.0022 * useSettings.getState().sensitivity;
      st.current.yaw -= e.movementX * k;
      st.current.pitch = Math.max(-1.3, Math.min(1.3, st.current.pitch - e.movementY * k));
      useTut.getState().note('look');
    };
    const lockChange = () => useUI.setState({ locked: document.pointerLockElement !== null });
    const blur = () => { keys.current = {}; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('mousemove', move);
    document.addEventListener('pointerlockchange', lockChange);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('pointerlockchange', lockChange);
    };
  }, []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = useGame.getState();
    const ui = useUI.getState();
    const s = st.current;
    camera.rotation.order = 'YXZ';

    if (g.phase === 'playing' && !s.started) {
      s.started = true;
      s.x = START.x; s.z = START.z; s.yaw = START.yaw; s.pitch = 0; s.vx = 0; s.vz = 0;
    }

    const active = g.phase === 'playing' && ui.locked && !ui.panel;
    const sinY = Math.sin(s.yaw), cosY = Math.cos(s.yaw);

    if (active) {
      const k = keys.current;
      let f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
      let r = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
      const len = Math.hypot(f, r) || 1;
      f /= len; r /= len;
      const sprint = !!(k.ShiftLeft || k.ShiftRight);
      const speed = sprint ? 5.4 : 3.2;
      const tx = (-sinY * f + cosY * r) * speed;
      const tz = (-cosY * f - sinY * r) * speed;
      const a = Math.min(1, dt * 10);
      s.vx += (tx - s.vx) * a;
      s.vz += (tz - s.vz) * a;
      const nx = s.x + s.vx * dt;
      if (!blocked(nx, s.z)) s.x = nx; else s.vx = 0;
      const nz = s.z + s.vz * dt;
      if (!blocked(s.x, nz)) s.z = nz; else s.vz = 0;
      s.bob += dt * Math.hypot(s.vx, s.vz) * 2.4;
      if (f !== 0 || r !== 0) {
        useTut.getState().note('move');
        if (sprint) useTut.getState().note('sprint');
      }

      let best: (typeof INTERACTABLES)[number] | null = null;
      let bd = 1e9;
      for (const it of INTERACTABLES) {
        const dx = it.x - s.x, dz = it.z - s.z;
        const d = Math.hypot(dx, dz);
        if (d > it.range) continue;
        const dot = (dx * -sinY + dz * -cosY) / (d || 1);
        if (dot < 0.3) continue;
        if (d < bd) { bd = d; best = it; }
      }
      if ((best?.id ?? null) !== (ui.nearby?.id ?? null)) {
        useUI.setState({ nearby: best ? { id: best.id, label: best.label } : null });
      }
      const room = roomAt(s.x, s.z);
      if (room !== ui.room) useUI.setState({ room });
    } else {
      s.vx = 0; s.vz = 0;
      if (ui.nearby) useUI.setState({ nearby: null });
    }

    // tell other players where we are
    const net = useNet.getState();
    if (net.mode !== 'solo' && g.phase === 'playing') {
      s.posT += dt;
      if (s.posT > 0.1) {
        s.posT = 0;
        netHooks.sendPos({ x: s.x, z: s.z, yaw: s.yaw, panel: ui.panel });
      }
    }

    let shake = 0;
    if (g.phase === 'playing' && !ui.panel && (g.overloaded || g.surge)) shake = 0.012;
    const moving = Math.hypot(s.vx, s.vz) > 0.2;
    camera.position.set(
      s.x + (Math.random() - 0.5) * shake,
      EYE + (moving ? Math.sin(s.bob) * 0.03 : 0) + (Math.random() - 0.5) * shake,
      s.z + (Math.random() - 0.5) * shake,
    );
    camera.rotation.set(s.pitch, s.yaw, 0);
    pose.x = s.x; pose.z = s.z; pose.yaw = s.yaw;
    updateListener(s.x, s.z, s.yaw);
    void clock;
  });
  return null;
}

// Runs the game rules 10 times per second.
// Solo: pauses when the mouse is free. Multiplayer: the host never pauses. Clients only listen.
export function GameLoop() {
  const acc = useRef(0);
  const lastRun = useRef(performance.now());
  // Host only: if this browser tab is hidden, frames stop. A timer keeps the mission running for the other players.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) return;
      const net = useNet.getState();
      if (net.mode !== 'host' || useGame.getState().phase !== 'playing') { lastRun.current = performance.now(); return; }
      const now = performance.now();
      const seconds = (now - lastRun.current) / 1000;
      if (seconds < 0.1) return;
      lastRun.current = now - ((seconds * 1000) % 100); // keep the leftover part of a step
      hostCatchUp(seconds);
    }, 250);
    return () => window.clearInterval(id);
  }, []);
  useFrame((_, delta) => {
    lastRun.current = performance.now();
    const g = useGame.getState();
    const ui = useUI.getState();
    const net = useNet.getState();
    if (g.phase !== 'playing' || net.mode === 'client') return;
    if (net.mode === 'solo' && !ui.locked && !ui.panel) return; // paused
    acc.current += Math.min(delta, 0.1);
    if (acc.current >= 0.1) {
      g.step(acc.current);
      acc.current = 0;
    }
  });
  return null;
}

const ROLE_COLOR: Record<string, string> = { commander: '#38bdf8', engineer: '#fb923c', science: '#34d399', comms: '#a78bfa' };

function Astronaut({ id }: { id: string }) {
  const grp = useRef<THREE.Group>(null!);
  const suitOn = useRef(true);
  const cur = useRef({ x: 0, z: 0, yaw: 0, init: false });
  useFrame((_, dt) => {
    const r = useNet.getState().remote[id];
    if (!r || !grp.current) return;
    const c = cur.current;
    if (!c.init) { c.x = r.x; c.z = r.z; c.yaw = r.yaw; c.init = true; }
    const k = Math.min(1, dt * 10);
    c.x += (r.x - c.x) * k; c.z += (r.z - c.z) * k; c.yaw += (r.yaw - c.yaw) * k;
    grp.current.position.set(c.x, 0, c.z);
    // the camera looks down -Z at yaw 0. The simple astronaut's front is -Z; a glTF model's front is normally +Z.
    grp.current.rotation.y = suitOn.current ? c.yaw + Math.PI : c.yaw;
    grp.current.visible = Date.now() - r.t < 3000;
  });
  const p = useNet.getState().room?.players.find((q) => q.id === id);
  const color = ROLE_COLOR[p?.role ?? ''] ?? '#e2e8f0';
  const quality = useSettings((q) => q.quality);
  const flip = useSettings((q) => q.suitFlip);
  const crewSuit = useSettings((q) => q.crewSuit);
  const useSuit = quality !== 'low' && crewSuit;
  suitOn.current = useSuit;
  const simple = (
    <group>
      <mesh position={[0, 0.5, 0]}><capsuleGeometry args={[0.24, 0.55, 6, 12]} /><meshStandardMaterial color="#e5e7eb" roughness={0.5} /></mesh>
      <mesh position={[0, 0.55, 0]}><capsuleGeometry args={[0.26, 0.15, 4, 12]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} /></mesh>
      <mesh position={[0, 1.2, 0]}><sphereGeometry args={[0.22, 16, 16]} /><meshStandardMaterial color="#f1f5f9" roughness={0.4} /></mesh>
      <mesh position={[0, 1.2, -0.1]}><sphereGeometry args={[0.17, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.8]} /><meshStandardMaterial color="#0b1120" metalness={0.9} roughness={0.1} emissive={color} emissiveIntensity={0.3} /></mesh>
      <mesh position={[0, 0.75, 0.24]}><boxGeometry args={[0.3, 0.4, 0.14]} /><meshStandardMaterial color="#94a3b8" metalness={0.6} /></mesh>
    </group>
  );
  return (
    <group ref={grp}>
      {/* the real crew suit model; the simple astronaut below is the backup (and is used when Model detail is LOW) */}
      {useSuit ? (
        <Safe fallback={simple}><Suspense fallback={simple}><SuitModel flip={flip} /></Suspense></Safe>
      ) : simple}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.38, 0.46, 32]} /><meshBasicMaterial color={color} transparent opacity={0.85} /></mesh>
      <Html position={[0, 2.05, 0]} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(8,18,32,0.85)', color, border: `1px solid ${color}`, padding: '2px 8px', borderRadius: 4, fontSize: 12, whiteSpace: 'nowrap', fontFamily: 'ui-monospace, Menlo, monospace' }}>
          {p?.name ?? 'Crew'}
        </div>
      </Html>
    </group>
  );
}

export function RemotePlayers() {
  const room = useNet((s) => s.room);
  const myId = useNet((s) => s.myId);
  if (!room) return null;
  return (
    <Safe fallback={null}>
      {room.players.filter((p) => p.id !== myId).map((p) => <Astronaut key={p.id} id={p.id} />)}
    </Safe>
  );
}
