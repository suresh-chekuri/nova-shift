import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, useUI, useSettings, openPanel, closePanel } from '../store';
import { useTut } from '../tutorial';
import { updateListener } from '../audio';
import { COLLIDERS, INTERACTABLES, roomAt } from './layout';
import { lockPointer, pose } from '../controls';
import { isTouch } from '../device';
import { touch } from '../touch';

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
    if (isTouch) useUI.setState({ locked: true });
    return () => { if (isTouch) useUI.setState({ locked: false }); };
  }, []);

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
      // keyboard (digital) + touch stick (analog)
      let f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) + touch.moveY;
      let r = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + touch.moveX;
      const raw = Math.hypot(f, r);
      const len = raw || 1;
      const power = Math.min(1, raw);       // a small stick push = a slow walk
      f = (f / len) * power; r = (r / len) * power;
      const stickFull = Math.hypot(touch.moveX, touch.moveY) > 0.92; // push the stick all the way to sprint
      const sprint = !!(k.ShiftLeft || k.ShiftRight) || stickFull;
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
      if (touch.lookX || touch.lookY) {
        const kt = 0.005 * useSettings.getState().sensitivity;
        s.yaw -= touch.lookX * kt;
        s.pitch = Math.max(-1.3, Math.min(1.3, s.pitch - touch.lookY * kt));
        touch.lookX = 0; touch.lookY = 0;
        useTut.getState().note('look');
      }
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
      touch.lookX = 0; touch.lookY = 0;
      if (ui.nearby) useUI.setState({ nearby: null });
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

// Runs the game rules 10 times per second. It pauses when the mouse is free.
export function GameLoop() {
  const acc = useRef(0);
  useFrame((_, delta) => {
    const g = useGame.getState();
    const ui = useUI.getState();
    if (g.phase !== 'playing') return;
    if (!ui.locked && !ui.panel) return; // paused
    acc.current += Math.min(delta, 0.1);
    if (acc.current >= 0.1) {
      g.step(acc.current);
      acc.current = 0;
    }
  });
  return null;
}
