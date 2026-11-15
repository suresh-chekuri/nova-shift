// NOVA SHIFT web server. It only serves the built game (the "dist" folder).
// Run with: npm start   (after npm run build). For daily work use: npm run dev
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = process.env.PORT || 3001;
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.txt': 'text/plain',
};

createServer((req, res) => {
  if (!existsSync(DIST)) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('NOVA SHIFT server is running, but the game is not built yet. Run: npm run build');
    return;
  }
  let rel = '/';
  try { rel = decodeURIComponent((req.url || '/').split('?')[0]); } catch { /* bad address: show the game page */ }
  if (rel === '/') rel = '/index.html';
  let file = path.join(DIST, rel);
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
    // a missing file (like a .glb) is a real 404; only page links get index.html
    if (path.extname(rel)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    file = path.join(DIST, 'index.html');
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}).listen(PORT, '0.0.0.0', () => console.log('NOVA SHIFT server listening on port ' + PORT));
