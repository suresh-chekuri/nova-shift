import { Rocket, Cpu, CheckCircle2, Circle } from 'lucide-react';
import { useGame } from '../store';
import { Frame } from './Frame';
import { fmtTime } from './HUD';
import { getMission } from '../design';
import { MISSION_SECONDS, objectiveTexts, SYSTEMS, SYS_IDS, nextGoal, sumData, DATA_GOAL } from '../sim';

const ORDERS = ['Restart the generator!', 'Route power to Life Support first.', 'Align the antenna to Earth.', 'Start the Signal Analyzer.', 'Cut non-essential load!', 'Transmit the data now.'];

export function CommandPanel() {
  const g = useGame();
  const goal = nextGoal(g);
  const total = sumData(g);
  return (
    <Frame title="COMMAND DECK — MISSION CONSOLE" icon={<Rocket size={18} />}>
      <div className="cmd-grid">
        <div>
          <div className="subhead">MISSION: {getMission(g.design.mission).name} — {getMission(g.design.mission).tagline.toUpperCase()}</div>
          <div className="big-num">{fmtTime(g.timeLeft)}</div>
          <div className="objlist">
            {objectiveTexts(g.design.mission).map((t, i) => (
              <div key={i} className={'obj' + (g.objectives[i] ? ' done' : '')}>
                {g.objectives[i] ? <CheckCircle2 size={16} /> : <Circle size={16} />} <span>{i + 1}. {t}</span>
              </div>
            ))}
          </div>
          <div className="callout info"><b>NEXT:</b> {goal.text}</div>
          {(
            <div>
              <div className="subhead">COMMANDER ORDERS</div>
              <div className="row wrap">
                {ORDERS.map((o) => <button key={o} className="btn small" onClick={() => g.order(o)}>{o}</button>)}
              </div>
            </div>
          )}
        </div>
        <div>
          <div className="subhead">STATUS DASHBOARD</div>
          <div className="row wrap">
            <div className="stat"><span>POWER LOAD</span><b className={g.overloaded ? 'red' : ''}>{g.demand} PU</b></div>
            <div className="stat"><span>GENERATOR</span><b>{g.genState === 'online' ? g.genOutput + ' PU' : g.genState.toUpperCase()}</b></div>
            <div className="stat"><span>BATTERY</span><b>{Math.round(g.battery)}%</b></div>
            <div className="stat"><span>SCIENCE DATA</span><b>{Math.floor(total)} / {DATA_GOAL}</b></div>
            <div className="stat"><span>COMMS SIGNAL</span><b>{Math.floor(g.commsStrength)}%</b></div>
            <div className="stat"><span>INTEGRITY</span><b className={g.integrity < 35 ? 'red' : ''}>{Math.floor(g.integrity)}%</b></div>
          </div>
          <div className="subhead">SYSTEMS</div>
          {SYS_IDS.map((s) => (
            <div key={s} className="card-line"><span>{SYSTEMS[s].name}</span><b className={g.powered[s] ? 'green' : g.surge === s ? 'red' : 'dim'}>{g.powered[s] ? 'ONLINE' : g.surge === s ? 'SURGE' : 'OFFLINE'}</b></div>
          ))}
          <div className="card-line"><span>ANTENNA</span><b className={g.antennaFault ? 'red' : 'green'}>{g.antennaFault ? 'FAULT' : 'OK'}</b></div>
          <div className="card-line"><span>SOLAR ACTIVITY</span><b className={g.flare > 0 ? 'red' : 'green'}>{g.flare > 0 ? 'FLARE ' + Math.ceil(g.flare) + 's' : 'NORMAL'}</b></div>
        </div>
      </div>
      <div className="subhead"><Cpu size={14} /> SHIP LOG</div>
      <div className="log">
        {[...g.log].reverse().slice(0, 9).map((l) => (
          <div key={l.id} className={'log-line ' + l.level}>[{fmtTime(MISSION_SECONDS - l.t)}] {l.text}</div>
        ))}
      </div>
    </Frame>
  );
}

export function EnginePanel() {
  const g = useGame();
  return (
    <Frame title="ENGINEERING — ENGINE CONTROL" icon={<Cpu size={18} />}>
      <p className="help">
        The engines keep the spacecraft steady in orbit. When they have no power, the orbit slowly drifts. Your antenna target moves,
        and you must re-align the antenna to keep talking to Earth.
      </p>
      <div className="row">
        <div className="stat"><span>ENGINE</span><b className={g.powered.eng ? 'green' : 'red'}>{g.powered.eng ? 'ONLINE (' + g.stats.loads.eng + ' PU)' : 'OFFLINE'}</b></div>
        <div className="stat"><span>ORBIT</span><b className={g.powered.eng ? 'green' : 'amber'}>{g.powered.eng ? 'STABLE' : 'DRIFTING'}</b></div>
        <div className="stat"><span>TOTAL DRIFT</span><b>{g.drift.toFixed(1)}°</b></div>
      </div>
      <div className="row buttons">
        <button className={'btn ' + (g.sw.eng ? 'danger' : 'primary')} onClick={() => g.toggleSwitch('eng')}>
          {g.sw.eng ? 'SWITCH ENGINE OFF' : 'SWITCH ENGINE ON'}
        </button>
      </div>
      <div className="tip">
        The engine also needs <b>Bus B</b> to have power (Power Panel). Your engine uses {g.stats.loads.eng} units. Drift speed is x{g.stats.driftMult.toFixed(2)} with your design. Turning it off saves power for science,
        but you will need to fix antenna alignment more often.
      </div>
    </Frame>
  );
}
