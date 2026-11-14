// A soft studio reflection map made on the spot (no download). Gives metal and glass something to reflect.
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useSettings } from '../store';

export function EnvRig({ intensity = 0.55 }: { intensity?: number }) {
  const { gl, scene } = useThree();
  const quality = useSettings((s) => s.quality);
  useEffect(() => {
    if (quality === 'low') return;
    let pm: THREE.PMREMGenerator | null = null;
    let room: any = null;
    let tex: THREE.Texture | null = null;
    try {
      pm = new THREE.PMREMGenerator(gl);
      room = new RoomEnvironment();
      tex = pm.fromScene(room, 0.04).texture;
      scene.environment = tex;
      (scene as any).environmentIntensity = intensity;
    } catch (e) {
      console.warn('[NOVA SHIFT] reflection map not available:', e);
    }
    return () => {
      scene.environment = null;
      tex?.dispose();
      pm?.dispose();
      room?.dispose?.();
    };
  }, [gl, scene, quality, intensity]);
  return null;
}
