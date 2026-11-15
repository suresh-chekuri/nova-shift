// Cinematic main-menu background: the spacecraft in orbit around the Moon, Earth in the distance.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SpacecraftModel } from './ShipModel';
import { Earth } from './space';
import { Starfield } from './deepspace';
import { CustomMenuMoon } from './MoonModel';
import { EnvRig } from './EnvRig';
import { useDesign, useUI } from '../store';

const PRESET: Record<string, { r: number; h: number; speed: number }> = {
  menu: { r: 12, h: 2.2, speed: 0.07 },
  briefing: { r: 9, h: 1.2, speed: 0.05 },
  settings: { r: 15, h: 3, speed: 0.04 },
};

export function MenuScene() {
  const design = useDesign((s) => s.design);
  const ship = useRef<THREE.Group>(null!);
  const cam = useRef({ r: 12, h: 2.2, a: 0.6 });
  const sun = useRef<THREE.DirectionalLight>(null!);
  useFrame(({ camera, clock }, dt) => {
    const screen = useUI.getState().screen;
    const p = PRESET[screen] ?? PRESET.menu;
    const c = cam.current;
    const k = Math.min(1, dt * 1.2);
    c.r += (p.r - c.r) * k;
    c.h += (p.h - c.h) * k;
    c.a += dt * p.speed;
    camera.position.set(Math.cos(c.a) * c.r, c.h + Math.sin(clock.elapsedTime * 0.3) * 0.3, Math.sin(c.a) * c.r);
    camera.lookAt(0, 0, 0.5);
    if (ship.current) {
      ship.current.rotation.z = Math.sin(clock.elapsedTime * 0.2) * 0.04;
      ship.current.position.y = Math.sin(clock.elapsedTime * 0.4) * 0.08;
    }
    if (sun.current) sun.current.position.set(30, 18, 25);
  });
  return (
    <>
      <color attach="background" args={['#01030a']} />
      <EnvRig intensity={0.35} />
      <ambientLight intensity={0.2} color="#8aa4ff" />
      <directionalLight ref={sun} intensity={3.2} color="#fff4e0" />
      <pointLight position={[0, -3, -6]} intensity={30} color="#f97316" distance={14} />
      <Starfield count={6000} />
      <CustomMenuMoon radius={80} position={[0, -86, 10]} />
      <Earth radius={14} position={[-110, 45, -190]} />
      <group ref={ship}>
        <SpacecraftModel design={design} />
      </group>
    </>
  );
}
