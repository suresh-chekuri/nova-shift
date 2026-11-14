// Multiplayer client (Socket.IO). The HOST runs the mission; other players send actions to the host.
import { io, type Socket } from 'socket.io-client';
import { useNet, useGame, useUI, useDesign, netHooks, applyRemoteAction, launch, resetToMenu, showToast, type Role } from './store';

let socket: Socket | null = null;

function leaveLocal(msg: string) {
  useNet.setState({ mode: 'solo', room: null, remote: {} });
  resetToMenu();
  useUI.setState({ screen: 'menu' });
  showToast(msg);
}

function ensure(): Socket {
  if (socket) return socket;
  const s = io(`http://${window.location.hostname}:3001`, { transports: ['websocket', 'polling'], reconnection: false });
  socket = s;
  s.on('connect', () => useNet.setState({ connected: true, myId: s.id ?? '', error: '' }));
  s.on('disconnect', () => {
    useNet.setState({ connected: false });
    socket = null;
    if (useNet.getState().mode !== 'solo') leaveLocal('Connection to the server was lost.');
  });
  s.on('connect_error', () => {
    useNet.setState({ error: 'Cannot reach the game server. Start the game with "npm run dev" on the host computer.' });
    s.close();
    socket = null;
  });
  s.on('room:update', (room) => useNet.setState({ room, mode: room.hostId === s.id ? 'host' : 'client' }));
  s.on('game:start', ({ design }) => launch('mission', design));
  s.on('game:action', ({ name, args, from }) => applyRemoteAction(name, args, from));
  s.on('game:state', (state) => {
    if (useNet.getState().mode === 'client') useGame.setState(state);
  });
  s.on('player:pos', (p) => {
    useNet.getState().remote[p.id] = { x: p.x, z: p.z, yaw: p.yaw, panel: p.panel ?? null, t: Date.now() };
  });
  s.on('player:left', (id: string) => { delete useNet.getState().remote[id]; });
  s.on('room:closed', () => leaveLocal('The host left. The room was closed.'));

  netHooks.sendAction = (name, args) => s.emit('game:action', { name, args });
  netHooks.sendState = (state) => s.emit('game:state', state);
  netHooks.sendPos = (pos) => s.emit('player:pos', pos);
  return s;
}

function whenConnected(s: Socket, fn: () => void) {
  if (s.connected) fn();
  else s.once('connect', fn);
}

export function createRoom(name: string) {
  useNet.setState({ error: '' });
  const s = ensure();
  whenConnected(s, () =>
    s.emit('room:create', name, (res: any) => {
      if (res?.ok) useNet.setState({ room: res.room, mode: 'host', myId: res.id });
    }),
  );
}

export function joinRoom(code: string, name: string) {
  useNet.setState({ error: '' });
  const s = ensure();
  whenConnected(s, () =>
    s.emit('room:join', { code, name }, (res: any) => {
      if (res?.ok) useNet.setState({ room: res.room, mode: 'client', myId: res.id });
      else useNet.setState({ error: res?.error || 'Could not join.' });
    }),
  );
}

export const pickRole = (role: Role) => socket?.emit('player:role', role);
export const setReady = (ready: boolean) => socket?.emit('player:ready', ready);

export function startGame() {
  socket?.emit('room:start', useDesign.getState().design, (res: any) => {
    if (!res?.ok) useNet.setState({ error: res?.error || 'Could not start.' });
  });
}

export function leaveRoom() {
  socket?.emit('room:leave');
  socket?.close();
  socket = null;
  useNet.setState({ mode: 'solo', room: null, remote: {}, connected: false, error: '' });
}
