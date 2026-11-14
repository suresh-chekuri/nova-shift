import { Microscope, Activity, Waves, Radar } from 'lucide-react';
import { useGame, useUI } from '../store';
import { Frame } from './Frame';
import { INSTR, INSTR_IDS, sumData, DATA_GOAL, type InstrId } from '../sim';
import { getMission } from '../design';
import { Camera } from 'lucide-react';

const INFO: Record<InstrId, { text: string; produces: string; icon: JSX.Element }> = {
  spectrometer: {
    produces: 'Mineral data',
    text: 'A spectrometer splits light into colors. Each mineral reflects light in its own pattern, so scientists can tell what the Moon is made of.',
    icon: <Microscope size={18} />,
  },
  seismic: {
    produces: 'Geological data',
    text: 'A seismic sensor feels tiny shakes called moonquakes. How the waves move shows what is under the surface.',
    icon: <Waves size={18} />,
  },
  analyzer: {
    produces: 'Signal data (required)',
    text: 'The signal analyzer listens to radio waves and looks for patterns. A pattern that repeats can mean the signal is not natural noise.',
    icon: <Radar size={18} />,
  },
  camera: {
    produces: 'Image data',
    text: 'A high-resolution camera takes sharp pictures of the surface. Scientists compare them over time to find changes.',
    icon: <Camera size={18} />,
  },
};

export function SciencePanel() {
  const g = useGame();
  const total = sumData(g);
  const focus = useUI((s) => s.focus);
  const m = getMission(g.design.mission);
  const req = m.required as InstrId[];
  const keyData = req.reduce((a, i) => a + Math.min(g.data[i], m.keyData), 0);
  const keyNeed = req.length * m.keyData;
  return (
    <Frame title="SCIENCE LABORATORY — DATA CONSOLE" icon={<Activity size={18} />}>
      <p className="help">
        Turn instruments ON to collect data. Each one uses power. The lab itself needs power from the Power Panel.
        You need <b>{DATA_GOAL}</b> units in total{keyNeed > 0 ? <>, with at least <b>{m.keyData}</b> from {req.length > 1 ? 'each of: ' : ''}{m.keyName}</> : ''}.
      </p>
      {!g.powered.sci && <div className="callout warn">The Science Lab has no power. Instruments cannot run. Route power at the Power Panel.</div>}

      <div className="row">
        <div className="stat"><span>TOTAL DATA</span><b>{Math.floor(total)} / {DATA_GOAL}</b></div>
        {keyNeed > 0 && <div className="stat"><span>KEY INSTRUMENTS</span><b className={keyData >= keyNeed ? 'green' : ''}>{Math.floor(keyData)} / {keyNeed}</b></div>}
        <div className="stat"><span>LOAD / SUPPLY</span><b className={g.overloaded ? 'red' : ''}>{g.demand} PU</b></div>
      </div>
      <div className="bar big"><div className="bar-fill" style={{ width: Math.min(100, total) + '%', background: '#a78bfa' }} /></div>

      <div className="cards">
        {INSTR_IDS.map((id) => {
          const def = INSTR[id];
          const info = INFO[id];
          const running = g.running[id];
          const wanted = g.instruments[id];
          return (
            <div key={id} className={'card' + (focus === id ? ' focus' : '') + (running ? ' active' : '')}>
              <div className="card-title">{info.icon} {def.name}</div>
              <div className="card-line"><span>Status</span><b className={running ? 'green' : wanted ? 'red' : 'dim'}>{!g.stats.installed[id] ? 'NOT INSTALLED' : running ? 'RUNNING' : wanted ? 'NO POWER' : 'OFF'}</b></div>
              <div className="card-line"><span>Power use</span><b>{g.stats.instrLoad[id]} PU</b></div>
              <div className="card-line"><span>Data rate</span><b>{running ? '+' + g.stats.instrRate[id].toFixed(1) : '0.0'} / s</b></div>
              <div className="card-line"><span>Collected</span><b>{Math.floor(g.data[id])}</b></div>
              <div className="card-line"><span>Produces</span><b>{info.produces}</b></div>
              <div className="bar"><div className="bar-fill" style={{ width: running ? '100%' : '0%', background: '#34d399', transition: 'width .4s' }} /></div>
              <p className="edu">{info.text}</p>
              <button className={'btn ' + (wanted ? 'danger' : 'primary')} disabled={!g.stats.installed[id]} onClick={() => g.toggleInstrument(id)}>
                {wanted ? 'SHUT DOWN' : 'ACTIVATE'}
              </button>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}
