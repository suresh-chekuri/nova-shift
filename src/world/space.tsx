// Moon, Earth and sun used by the main menu and the shipyard windows.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function moonCanvases() {
  const W = 1024, Hh = 512;
  const color = document.createElement('canvas'); color.width = W; color.height = Hh;
  const bump = document.createElement('canvas'); bump.width = W; bump.height = Hh;
  const c = color.getContext('2d')!, b = bump.getContext('2d')!;
  c.fillStyle = '#a8a69f'; c.fillRect(0, 0, W, Hh);
  b.fillStyle = '#808080'; b.fillRect(0, 0, W, Hh);
  // dark seas
  for (let i = 0; i < 9; i++) {
    const x = Math.random() * W, y = 60 + Math.random() * 380, rx = 40 + Math.random() * 110, ry = 30 + Math.random() * 70;
    const g = c.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, 'rgba(60,62,70,0.55)'); g.addColorStop(1, 'rgba(60,62,70,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rx, ry, Math.random(), 0, 7); c.fill();
  }
  // craters
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * W, y = Math.random() * Hh, r = 2 + Math.pow(Math.random(), 3) * 38;
    const g = c.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(50,50,55,0.35)'); g.addColorStop(0.8, 'rgba(50,50,55,0.1)'); g.addColorStop(1, 'rgba(235,235,230,0.3)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    const gb = b.createRadialGradient(x, y, 0, x, y, r);
    gb.addColorStop(0, 'rgba(20,20,20,0.9)'); gb.addColorStop(0.7, 'rgba(70,70,70,0.6)'); gb.addColorStop(0.9, 'rgba(230,230,230,0.9)'); gb.addColorStop(1, 'rgba(128,128,128,0)');
    b.fillStyle = gb; b.beginPath(); b.arc(x, y, r, 0, 7); b.fill();
  }
  for (let i = 0; i < 6000; i++) {
    c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`;
    c.fillRect(Math.random() * W, Math.random() * Hh, 2, 2);
    b.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.08})`;
    b.fillRect(Math.random() * W, Math.random() * Hh, 2, 2);
  }
  return { color, bump };
}

export function Moon({ radius, position }: { radius: number; position: [number, number, number] }) {
  const { map, bump } = useMemo(() => {
    const { color, bump } = moonCanvases();
    const m = new THREE.CanvasTexture(color); m.colorSpace = THREE.SRGBColorSpace;
    return { map: m, bump: new THREE.CanvasTexture(bump) };
  }, []);
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 96, 64]} />
      <meshStandardMaterial map={map} bumpMap={bump} bumpScale={radius * 0.05} roughness={1} metalness={0} />
    </mesh>
  );
}

export function Earth({ radius, position }: { radius: number; position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null!);
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d')!;
    g.fillStyle = '#1d4ed8'; g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 22; i++) {
      g.fillStyle = `rgba(${30 + Math.random() * 30},${110 + Math.random() * 50},${50 + Math.random() * 30},0.95)`;
      g.beginPath(); g.ellipse(Math.random() * 1024, 80 + Math.random() * 350, 30 + Math.random() * 90, 18 + Math.random() * 50, Math.random() * 3, 0, 7); g.fill();
    }
    for (let i = 0; i < 90; i++) {
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.beginPath(); g.ellipse(Math.random() * 1024, Math.random() * 512, 25 + Math.random() * 70, 4 + Math.random() * 12, Math.random() * 0.6, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(0, 0, 1024, 22); g.fillRect(0, 490, 1024, 22);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.02; });
  return (
    <group position={position}>
      <mesh ref={ref}><sphereGeometry args={[radius, 64, 48]} /><meshStandardMaterial map={tex} roughness={0.8} /></mesh>
      <mesh><sphereGeometry args={[radius * 1.05, 48, 32]} /><meshBasicMaterial color="#60a5fa" transparent opacity={0.16} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
    </group>
  );
}
