import { useState } from 'react';
import { Users, Crown, Check, Copy, LogOut, Wrench } from 'lucide-react';
import { useUI, useNet, useDesign, setScreen, ROLE_NAME, showToast, type Role } from '../store';
import { createRoom, joinRoom, pickRole, setReady, startGame, leaveRoom } from '../net';
import { isValid } from '../design';
import { sfx } from '../sfx';

const ROLES: { id: Role; desc: string }[] = [
  { id: 'commander', desc: 'Mission objectives, strategy, orders, navigation (engine).' },
  { id: 'engineer', desc: 'Generator, power routing, repairs and resets.' },
  { id: 'science', desc: 'Science instruments and data collection.' },
  { id: 'comms', desc: 'Antenna alignment, signal and data transmission.' },
];

export function LobbyScreen() {
  const screen = useUI((s) => s.screen);
  const net = useNet();
  const design = useDesign((s) => s.design);
  const [name, setName] = useState(() => localStorage.getItem('nova-name') || '');
  const [code, setCode] = useState('');
  if (screen !== 'lobby') return null;
  const room = net.room;
  const me = room?.players.find((p) => p.id === net.myId);
  const isHost = !!room && room.hostId === net.myId;
  const nm = () => { const n = name.trim() || 'Astronaut'; try { localStorage.setItem('nova-name', n); } catch { /* */ } return n; };
  const back = () => { sfx.click(); leaveRoom(); setScreen('menu'); };
  const allReady = !!room && room.players.every((p) => p.ready || p.host);
  const host = window.location.hostname;

  return (
    <div className="screen sidepanel">
      <div className="side-box wide">
        <div className="eyebrow">MULTIPLAYER · CO-OP CREW</div>
        <h2><Users size={20} /> {room ? 'CREW LOBBY' : 'JOIN OR HOST A MISSION'}</h2>

        {!room && (
          <>
            <div className="set-row"><label>Your name</label><input className="text" maxLength={14} placeholder="Astronaut" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="lobby-cols">
              <div className="lobby-card">
                <h3>HOST GAME</h3>
                <p>Create a room. Share the 4-letter code with up to 3 friends.</p>
                <button className="btn primary" onClick={() => { sfx.click(); createRoom(nm()); }}>HOST GAME</button>
              </div>
              <div className="lobby-card">
                <h3>JOIN GAME</h3>
                <p>Type the room code from your host.</p>
                <input className="text code" maxLength={4} placeholder="ABCD" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
                <button className="btn primary" disabled={code.length !== 4} onClick={() => { sfx.click(); joinRoom(code, nm()); }}>JOIN</button>
              </div>
            </div>
            {net.error && <div className="callout danger">{net.error}</div>}
            <div className="tip">
              <b>Playing on different computers?</b> The host starts the game with <code>npm run dev</code>. Friends on the same Wi-Fi open
              <code> http://HOST-IP:5173</code> (the host's IP address) in their browser.
            </div>
          </>
        )}

        {room && (
          <>
            <div className="room-code">
              <span>ROOM CODE</span><b>{room.code}</b>
              <button className="btn small" onClick={() => { navigator.clipboard?.writeText(room.code); showToast('Code copied'); }}><Copy size={12} /> COPY</button>
              <em>{room.players.length} / 4 players</em>
            </div>
            <div className="players">
              {room.players.map((p) => (
                <div key={p.id} className={'player' + (p.id === net.myId ? ' me' : '')}>
                  <div className="p-name">{p.host && <Crown size={14} />} {p.name}{p.id === net.myId && ' (you)'}</div>
                  <div className="p-role">{p.role ? ROLE_NAME[p.role] : 'NO ROLE'}</div>
                  <div className={'p-ready ' + (p.ready || p.host ? 'yes' : '')}>{p.host ? 'HOST' : p.ready ? <><Check size={12} /> READY</> : 'NOT READY'}</div>
                </div>
              ))}
              {Array.from({ length: 4 - room.players.length }, (_, i) => <div key={'e' + i} className="player empty">Waiting for player...</div>)}
            </div>

            <div className="subhead">CHOOSE YOUR ROLE</div>
            <div className="roles">
              {ROLES.map((r) => {
                const taken = room.players.find((p) => p.role === r.id && p.id !== net.myId);
                return (
                  <button key={r.id} disabled={!!taken} className={'role' + (me?.role === r.id ? ' on' : '')} onClick={() => { sfx.click(); pickRole(r.id); }}>
                    <b>{ROLE_NAME[r.id]}</b><small>{taken ? 'Taken by ' + taken.name : r.desc}</small>
                  </button>
                );
              })}
            </div>

            {isHost && (
              <div className="design-sum">
                <span>Spacecraft: <b className={isValid(design) ? 'green' : 'red'}>{isValid(design) ? 'READY TO LAUNCH' : 'INVALID DESIGN'}</b></span>
                <button className="btn small" onClick={() => useUI.setState({ shipyardFor: 'lobby', screen: 'shipyard' })}><Wrench size={13} /> OPEN SHIPYARD</button>
              </div>
            )}
            {net.error && <div className="callout danger">{net.error}</div>}
            <div className="row buttons">
              {!isHost && <button className={'btn ' + (me?.ready ? 'danger' : 'primary')} onClick={() => { sfx.click(); setReady(!me?.ready); }}>{me?.ready ? 'NOT READY' : 'READY'}</button>}
              {isHost && <button className="btn primary huge" disabled={!allReady || !isValid(design)} onClick={() => { sfx.launch(); startGame(); }}>START MISSION {!allReady ? '(waiting for ready)' : ''}</button>}
              <button className="btn" onClick={back}><LogOut size={14} /> LEAVE</button>
            </div>
            <div className="tiny">Roles are unique. If a role is empty, anyone can do that job. Friends on the same Wi-Fi can join at http://{host}:5173</div>
          </>
        )}
        {!room && <button className="btn huge" onClick={back}>BACK</button>}
      </div>
    </div>
  );
}
