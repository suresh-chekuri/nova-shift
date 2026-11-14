// NOVA SHIFT multiplayer server. Run with: npm run server  (also started by npm run dev)
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { Rooms } from './rooms.js';

const PORT = process.env.PORT || 3001;
// In production the server also serves the built game (the "dist" folder), so one port does everything.
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.txt': 'text/plain',
};
const http = createServer((req, res) => {
  if (!existsSync(DIST)) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('NOVA SHIFT server is running.');
    return;
  }
  let rel = decodeURIComponent((req.url || '/').split('?')[0]);
  if (rel === '/') rel = '/index.html';
  let file = path.join(DIST, rel);
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) file = path.join(DIST, 'index.html');
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
});
// Longer ping limits: a browser tab in the background answers late, and we do not want to drop that player.
const io = new Server(http, { cors: { origin: '*' }, pingInterval: 10000, pingTimeout: 60000 });
const rooms = new Rooms();

function broadcastRoom(room) {
  io.to(room.code).emit('room:update', rooms.snapshot(room));
}

// A bad message from one player must never crash the server for everyone.
process.on('uncaughtException', (e) => console.error('uncaught error:', e));
process.on('unhandledRejection', (e) => console.error('unhandled rejection:', e));

io.on('connection', (socket) => {
  const on = (event, fn) =>
    socket.on(event, (...args) => {
      try { fn(...args); } catch (e) { console.error('error in ' + event + ':', e); }
    });
  on('room:create', (name, ack) => {
    const { room } = rooms.create(socket.id, name);
    socket.join(room.code);
    ack?.({ ok: true, id: socket.id, room: rooms.snapshot(room) });
    broadcastRoom(room);
  });

  on('room:join', (msg, ack) => {
    const res = rooms.join(msg?.code, socket.id, msg?.name);
    if (res.error) return ack?.({ ok: false, error: res.error });
    socket.join(res.room.code);
    ack?.({ ok: true, id: socket.id, room: rooms.snapshot(res.room) });
    broadcastRoom(res.room);
  });

  on('player:role', (role) => {
    const room = rooms.setRole(socket.id, role);
    if (room) broadcastRoom(room);
  });

  on('player:ready', (ready) => {
    const room = rooms.setReady(socket.id, ready);
    if (room) broadcastRoom(room);
  });

  // host starts: send the design so every player flies the same ship
  on('room:start', (design, ack) => {
    const res = rooms.start(socket.id);
    if (res.error) return ack?.({ ok: false, error: res.error });
    ack?.({ ok: true });
    io.to(res.room.code).emit('game:start', { design, room: rooms.snapshot(res.room) });
    broadcastRoom(res.room);
  });

  // Host runs the simulation. Everyone else sends actions to the host.
  on('game:action', (msg) => {
    const room = rooms.roomOf(socket.id);
    if (!room || socket.id === room.hostId) return;
    io.to(room.hostId).emit('game:action', { ...msg, from: socket.id });
  });
  on('game:state', (state) => {
    const room = rooms.roomOf(socket.id);
    if (room && socket.id === room.hostId) socket.to(room.code).emit('game:state', state);
  });
  on('player:pos', (pos) => {
    const room = rooms.roomOf(socket.id);
    if (!room || !pos || typeof pos !== 'object') return;
    const num = (v) => (Number.isFinite(v) ? v : 0);
    socket.to(room.code).emit('player:pos', {
      x: num(pos.x), z: num(pos.z), yaw: num(pos.yaw),
      panel: typeof pos.panel === 'string' ? pos.panel.slice(0, 20) : null,
      id: socket.id, // set last, so nobody can pretend to be another player
    });
  });

  on('disconnect', () => {
    const res = rooms.leave(socket.id);
    if (!res) return;
    if (res.closed) {
      io.to(res.room.code).emit('room:closed');
      io.in(res.room.code).socketsLeave(res.room.code);
    } else {
      io.to(res.room.code).emit('player:left', socket.id);
      broadcastRoom(res.room);
    }
  });
  on('room:leave', () => {
    const res = rooms.leave(socket.id);
    socket.rooms.forEach((r) => r !== socket.id && socket.leave(r));
    if (!res) return;
    if (res.closed) {
      io.to(res.room.code).emit('room:closed');
      io.in(res.room.code).socketsLeave(res.room.code);
    } else {
      io.to(res.room.code).emit('player:left', socket.id);
      broadcastRoom(res.room);
    }
  });
});

http.listen(PORT, '0.0.0.0', () => console.log('NOVA SHIFT server listening on port ' + PORT));
