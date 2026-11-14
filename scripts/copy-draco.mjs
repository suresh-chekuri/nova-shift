// The crew suit model is Draco-compressed. This copies the decoder from the "three" package
// into public/draco so the game can decode it offline. Runs automatically after npm install.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'node_modules/three/examples/jsm/libs/draco/gltf');
const to = path.join(root, 'public/draco');
try {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) fs.copyFileSync(path.join(from, f), path.join(to, f));
  console.log('draco decoder copied to public/draco');
} catch (e) {
  console.log('could not copy the draco decoder (the game will try the internet copy instead):', e.message);
}
