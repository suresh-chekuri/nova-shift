import { Zap } from 'lucide-react';
import { useGame } from '../store';
import { Frame } from './Frame';
import { SYSTEMS, INSTR_IDS, OVERLOAD_GRACE, type SwitchId, type SysId } from '../sim';

// Positions on the circuit board (SVG units)
const GEN = { x: 20, y: 100, w: 160, h: 100 };
const BAT = { x: 20, y: 290, w: 160, h: 100 };
const J1 = { x: 420, y: 130 };
const J2 = { x: 420, y: 320 };
const SYS_Y: Record<SysId, number> = { life: 20, comms: 120, sci: 230, eng: 340 };
const SYS_X = 700;
const SYS_W = 180;
const SYS_H = 80;

interface Edge { id: SwitchId; from: [number, number]; to: [number, number]; t: number; label: string }
const EDGES: Edge[] = [
  { id: 'gj1', from: [GEN.x + GEN.w, 135], to: [J1.x - 28, J1.y - 8], t: 0.5, label: 'GEN→A' },
  { id: 'gj2', from: [GEN.x + GEN.w, 175], to: [J2.x - 26, J2.y - 14], t: 0.3, label: 'GEN→B' },
  { id: 'bj1', from: [BAT.x + BAT.w, 315], to: [J1.x - 20, J1.y + 20], t: 0.3, label: 'BAT→A' },
  { id: 'bj2', from: [BAT.x + BAT.w, 360], to: [J2.x - 28, J2.y + 8], t: 0.5, label: 'BAT→B' },
  { id: 'life', from: [J1.x + 28, J1.y - 8], to: [SYS_X, SYS_Y.life + SYS_H / 2], t: 0.55, label: 'LIFE' },
  { id: 'comms', from: [J1.x + 28, J1.y + 8], to: [SYS_X, SYS_Y.comms + SYS_H / 2], t: 0.55, label: 'COMMS' },
  { id: 'sci', from: [J2.x + 28, J2.y - 8], to: [SYS_X, SYS_Y.sci + SYS_H / 2], t: 0.55, label: 'LAB' },
  { id: 'eng', from: [J2.x + 28, J2.y + 8], to: [SYS_X, SYS_Y.eng + SYS_H / 2], t: 0.55, label: 'ENGINE' },
];

export function PowerPanel() {
  const g = useGame();
  const toggle = g.toggleSwitch;
  const genOn = g.genState === 'online';

  const energized = (id: SwitchId) => {
    if (!g.sw[id]) return false;
    if (id === 'gj1' || id === 'gj2') return genOn;
    if (id === 'bj1' || id === 'bj2') return g.battery > 0;
    const sys = id as SysId;
    return g[SYSTEMS[sys].junction] && g.surge !== sys;
  };
  const edgeClass = (id: SwitchId) => {
    if (!g.sw[id]) return 'wire off';
    if (!energized(id)) return 'wire idle';
    return g.overloaded ? 'wire over' : 'wire on';
  };

  const batteryLink = g.sw.bj1 || g.sw.bj2;
  const maxSupply = g.genOutput + (batteryLink && g.battery > 0 ? g.stats.battOutput : 0);
  const flash = g.elapsed - g.flashAt < 2.5;

  return (
    <Frame title="POWER DISTRIBUTION — ENGINEERING" icon={<Zap size={18} />}>
      <p className="help">
        Click the round <b>switches</b> to connect or cut power. The generator makes {g.genOutput || g.stats.genCapacity} units{g.flare > 0 ? ' (solar flare: −30%)' : ''}.
        The battery can add up to {g.stats.battOutput} units when one of its switches is ON. If the load is too high, breakers trip.
      </p>

      <div className="board-wrap">
        {flash && <div className="success-banner">POWER ROUTED</div>}
        <svg viewBox="0 0 900 420" className="board">
          {/* wires */}
          {EDGES.map((e) => (
            <path key={e.id} className={edgeClass(e.id)} d={`M ${e.from[0]} ${e.from[1]} L ${e.to[0]} ${e.to[1]}`} fill="none" />
          ))}

          {/* generator */}
          <g>
            <rect x={GEN.x} y={GEN.y} width={GEN.w} height={GEN.h} rx={8} className={'node ' + (genOn ? 'ok' : g.genState === 'starting' ? 'warn' : 'bad')} />
            <text x={GEN.x + 12} y={GEN.y + 24} className="n-title">GENERATOR</text>
            <text x={GEN.x + 12} y={GEN.y + 52} className="n-big">{g.genOutput} PU</text>
            <text x={GEN.x + 12} y={GEN.y + 76} className="n-small">{genOn ? (g.flare > 0 ? 'SOLAR FLARE −30%' : 'ONLINE') : g.genState === 'starting' ? 'STARTING...' : 'OFFLINE'}</text>
          </g>
          {/* battery */}
          <g>
            <rect x={BAT.x} y={BAT.y} width={BAT.w} height={BAT.h} rx={8} className={'node ' + (g.battery > 20 ? 'ok' : 'bad')} />
            <text x={BAT.x + 12} y={BAT.y + 24} className="n-title">BATTERY</text>
            <text x={BAT.x + 12} y={BAT.y + 52} className="n-big">{Math.round(g.battery)}%</text>
            <rect x={BAT.x + 12} y={BAT.y + 68} width={BAT.w - 24} height={10} rx={3} fill="#0b1626" />
            <rect x={BAT.x + 12} y={BAT.y + 68} width={(BAT.w - 24) * g.battery / 100} height={10} rx={3} fill={g.battery < 20 ? '#ef4444' : '#22c55e'} />
            <text x={BAT.x + 12} y={BAT.y + 94} className="n-small">{g.batteryDraw > 0 ? `DRAINING −${g.batteryDraw} PU` : batteryLink && g.surplus > 0 && g.battery < 100 ? 'CHARGING' : 'IDLE'}</text>
          </g>
          {/* junctions */}
          {[['BUS A', J1, g.j1], ['BUS B', J2, g.j2]].map(([name, p, on]: any) => (
            <g key={name}>
              <circle cx={p.x} cy={p.y} r={30} className={'node ' + (on ? (g.overloaded ? 'bad' : 'ok') : 'off')} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" className="n-title">{name}</text>
            </g>
          ))}
          {/* systems */}
          {(Object.keys(SYSTEMS) as SysId[]).map((s) => {
            const def = SYSTEMS[s];
            const on = g.powered[s];
            const locked = g.surge === s;
            const cls = locked ? 'bad' : on ? (g.overloaded ? 'bad' : 'ok') : 'off';
            return (
              <g key={s}>
                <rect x={SYS_X} y={SYS_Y[s]} width={SYS_W} height={SYS_H} rx={8} className={'node ' + cls} />
                <text x={SYS_X + 12} y={SYS_Y[s] + 24} className="n-title">{def.name}</text>
                <text x={SYS_X + 12} y={SYS_Y[s] + 50} className="n-big">{g.stats.loads[s]} PU</text>
                <text x={SYS_X + 12} y={SYS_Y[s] + 70} className="n-small">
                  {locked ? 'SURGE — RESET NEEDED' : on ? 'POWERED' : g.sw[s] ? 'NO POWER AT BUS' : 'OFF'}
                </text>
                {s === 'sci' && g.powered.sci && (
                  <text x={SYS_X + SYS_W - 8} y={SYS_Y[s] + 50} textAnchor="end" className="n-small">
                    +{INSTR_IDS.reduce((a, i) => a + (g.running[i] ? g.stats.instrLoad[i] : 0), 0)} instr.
                  </text>
                )}
              </g>
            );
          })}
          {/* switches (drawn last so they are on top) */}
          {EDGES.map((e) => {
            const x = e.from[0] + (e.to[0] - e.from[0]) * e.t;
            const y = e.from[1] + (e.to[1] - e.from[1]) * e.t;
            const on = g.sw[e.id];
            const locked = g.surge === e.id;
            return (
              <g key={e.id} className="switch" onClick={() => toggle(e.id)} transform={`translate(${x},${y})`}>
                <circle r={17} className={'sw-body ' + (on ? 'on' : 'offc') + (locked ? ' locked' : '')} />
                <text y={4} textAnchor="middle" className="sw-text">{on ? 'ON' : 'OFF'}</text>
                <text y={-24} textAnchor="middle" className="sw-label">{e.label}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="row">
        <div className="stat"><span>LOAD</span><b className={g.overloaded ? 'red' : ''}>{g.demand} PU</b></div>
        <div className="stat"><span>AVAILABLE</span><b>{maxSupply} PU</b></div>
        <div className="stat"><span>BATTERY</span><b>{Math.round(g.battery)}%</b></div>
        <div className="stat"><span>OVERLOADS</span><b>{g.overloads}</b></div>
      </div>

      {g.overloaded && (
        <div className="callout danger">
          OVERLOAD! Turn off a system within {Math.max(0, OVERLOAD_GRACE - g.overloadTimer).toFixed(1)} s or the breakers will trip.
        </div>
      )}
      {g.surge && (
        <div className="callout danger">
          POWER SURGE: {SYSTEMS[g.surge].name} is unstable and locked. Press RESET DISTRIBUTION.
        </div>
      )}

      <div className="row buttons">
        <button className="btn primary" disabled={g.genState !== 'offline'} onClick={g.restartGenerator}>
          {g.genState === 'offline' ? 'RESTART GENERATOR' : g.genState === 'starting' ? 'STARTING...' : 'GENERATOR ONLINE'}
        </button>
        <button className={'btn ' + (g.surge ? 'danger pulse' : '')} onClick={g.resetDistribution}>RESET DISTRIBUTION</button>
      </div>

      <div className="tip">
        <b>How it works:</b> Power goes <i>Generator or Battery → Bus A or Bus B → system</i>. A system only gets power if its own switch is ON and its bus is
        connected to a source. Life Support ({g.stats.loads.life}) and Communications ({g.stats.loads.comms}) are on Bus A. Science Lab ({g.stats.loads.sci}) and Engine ({g.stats.loads.eng}) are on Bus B.
        Each science instrument adds more load. Your spacecraft design sets these numbers. Choose what to run!
      </div>
    </Frame>
  );
}
