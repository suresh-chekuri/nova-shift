// Room logic for co-op play. No network code here, so it can be tested.
export const ROLES = ['commander', 'engineer', 'science', 'comms'];
export const MAX_PLAYERS = 4;

function makeCode(existing) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let i = 0; i < 100; i++) {
    let c = '';
    for (let k = 0; k < 4; k++) c += letters[Math.floor(Math.random() * letters.length)];
    if (!existing.has(c)) return c;
  }
  return 'ZZZZ';
}

export class Rooms {
  constructor() {
    this.rooms = new Map(); // code -> room
    this.byPlayer = new Map(); // socket id -> code
  }

  cleanName(name) {
    return String(name || 'Astronaut').replace(/[^\w \-]/g, '').trim().slice(0, 14) || 'Astronaut';
  }

  freeRole(room) {
    const taken = new Set([...room.players.values()].map((p) => p.role));
    return ROLES.find((r) => !taken.has(r)) || null;
  }

  create(id, name) {
    this.leave(id);
    const code = makeCode(this.rooms);
    const room = { code, hostId: id, phase: 'lobby', players: new Map() };
    room.players.set(id, { id, name: this.cleanName(name), role: 'commander', ready: true });
    this.rooms.set(code, room);
    this.byPlayer.set(id, code);
    return { room };
  }

  join(code, id, name) {
    const room = this.rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return { error: 'Room not found. Check the code.' };
    if (room.phase !== 'lobby') return { error: 'That mission has already started.' };
    if (room.players.size >= MAX_PLAYERS) return { error: 'Room is full (4 players).' };
    this.leave(id);
    room.players.set(id, { id, name: this.cleanName(name), role: this.freeRole(room), ready: false });
    this.byPlayer.set(id, room.code);
    return { room };
  }

  roomOf(id) {
    return this.rooms.get(this.byPlayer.get(id));
  }

  setRole(id, role) {
    const room = this.roomOf(id);
    if (!room || room.phase !== 'lobby' || !ROLES.includes(role)) return null;
    for (const p of room.players.values()) if (p.role === role && p.id !== id) return null; // taken
    room.players.get(id).role = role;
    return room;
  }

  setReady(id, ready) {
    const room = this.roomOf(id);
    if (!room || room.phase !== 'lobby') return null;
    room.players.get(id).ready = !!ready;
    return room;
  }

  canStart(room) {
    return [...room.players.values()].every((p) => p.ready || p.id === room.hostId);
  }

  start(id) {
    const room = this.roomOf(id);
    if (!room || room.hostId !== id) return { error: 'Only the host can start.' };
    if (room.phase !== 'lobby') return { error: 'The mission has already started.' };
    if (!this.canStart(room)) return { error: 'Everyone must press READY first.' };
    room.phase = 'playing';
    return { room };
  }

  // Returns { room, closed } when someone leaves. If the host leaves, the room closes.
  leave(id) {
    const room = this.roomOf(id);
    this.byPlayer.delete(id);
    if (!room) return null;
    room.players.delete(id);
    if (id === room.hostId || room.players.size === 0) {
      for (const pid of room.players.keys()) this.byPlayer.delete(pid);
      this.rooms.delete(room.code);
      return { room, closed: true };
    }
    return { room, closed: false };
  }

  snapshot(room) {
    return {
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      players: [...room.players.values()].map((p) => ({ ...p, host: p.id === room.hostId })),
    };
  }
}
