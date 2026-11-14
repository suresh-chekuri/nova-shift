import { Radio, Send, Wrench } from 'lucide-react';
import { useGame } from '../store';
import { Frame } from './Frame';
import { sumData, DATA_GOAL } from '../sim';

export function CommsPanel() {
  const g = useGame();
  const { az, el } = g.antenna;
  const strength = Math.floor(g.commsStrength);
  const total = sumData(g);
  const txPct = Math.min(100, (g.transmitted / DATA_GOAL) * 100);
  const online = g.powered.comms && !g.antennaFault;

  // pointing grid: x = azimuth (-90..90), y = elevation (0..90)
  const px = ((az + 90) / 180) * 360;
  const py = 220 - (el / 90) * 220;
  const glow = strength / 100;

  let hint = '';
  if (online && !g.commsLinked) {
    const daz = Math.abs(az - g.target.az), dEl = Math.abs(el - g.target.el);
    hint = strength === 0 ? 'Signal is too weak. Keep moving the antenna.' : daz > dEl ? 'Hint: adjust AZIMUTH (left / right).' : 'Hint: adjust ELEVATION (up / down).';
  }

  const bars = Array.from({ length: 28 }, (_, i) => {
    const noise = 0.25 + 0.2 * Math.sin(i * 1.7 + g.elapsed * 9) + 0.15 * Math.sin(i * 0.6 - g.elapsed * 5);
    const peak = Math.exp(-Math.pow((i - 14) / 3.2, 2));
    const h = online ? Math.max(0.05, noise * (1 - glow * 0.8) + peak * glow) : 0.04;
    return h;
  });

  return (
    <Frame title="COMMUNICATIONS — ANTENNA CONTROL" icon={<Radio size={18} />}>
      <p className="help">
        Point the antenna at Earth. Move <b>azimuth</b> (left / right) and <b>elevation</b> (up / down) until the signal reaches <b>100%</b>.
        You need power on Communications (at the Power Panel).
      </p>

      {g.antennaFault && (
        <div className="callout danger">
          <b>ANTENNA MALFUNCTION.</b> The motor is jammed. Press REPAIR and keep this panel open until the bar is full.
          <div className="bar big"><div className="bar-fill" style={{ width: g.repairProgress * 100 + '%', background: '#f59e0b' }} /></div>
          <button className="btn danger" disabled={g.repairing} onClick={g.repairAntenna}><Wrench size={14} /> {g.repairing ? 'REPAIRING...' : 'REPAIR ANTENNA'}</button>
        </div>
      )}
      {!g.powered.comms && !g.antennaFault && <div className="callout warn">Communications have no power. Go to the Power Panel in Engineering.</div>}

      <div className="comms-grid">
        <div>
          <div className="subhead">ANTENNA POINTING</div>
          <svg viewBox="0 0 360 220" className="pointing">
            <rect x="0" y="0" width="360" height="220" fill="#06101c" />
            {[1, 2, 3].map((i) => <line key={'h' + i} x1="0" x2="360" y1={i * 55} y2={i * 55} className="grid" />)}
            {[1, 2, 3, 4, 5].map((i) => <line key={'v' + i} y1="0" y2="220" x1={i * 60} x2={i * 60} className="grid" />)}
            {online && <circle cx={px} cy={py} r={14 + glow * 40} fill={g.commsLinked ? '#22c55e' : '#38bdf8'} opacity={0.12 + glow * 0.3} />}
            <line x1={px} x2={px} y1="0" y2="220" className="cross" />
            <line y1={py} y2={py} x1="0" x2="360" className="cross" />
            <circle cx={px} cy={py} r="7" fill="none" stroke={g.commsLinked ? '#22c55e' : '#e2e8f0'} strokeWidth="2" />
            <text x="6" y="14" className="axis">EL 90°</text>
            <text x="6" y="216" className="axis">EL 0°</text>
            <text x="300" y="214" className="axis">AZ +90°</text>
            <text x="150" y="14" className="axis">AZ 0°</text>
          </svg>

          <div className="slider-row">
            <label>AZIMUTH <b>{az}°</b></label>
            <button className="btn small" onClick={() => g.setAntenna(az - 1, el)}>−</button>
            <input type="range" min={-90} max={90} value={az} disabled={g.antennaFault} onChange={(e) => g.setAntenna(+e.target.value, el)} />
            <button className="btn small" onClick={() => g.setAntenna(az + 1, el)}>+</button>
          </div>
          <div className="slider-row">
            <label>ELEVATION <b>{el}°</b></label>
            <button className="btn small" onClick={() => g.setAntenna(az, el - 1)}>−</button>
            <input type="range" min={0} max={90} value={el} disabled={g.antennaFault} onChange={(e) => g.setAntenna(az, +e.target.value)} />
            <button className="btn small" onClick={() => g.setAntenna(az, el + 1)}>+</button>
          </div>
        </div>

        <div>
          <div className="subhead">SIGNAL STRENGTH</div>
          <div className={'big-num ' + (g.commsLinked ? 'green' : strength > 0 ? 'amber' : 'dim')}>{strength}%</div>
          <div className="bar big"><div className="bar-fill" style={{ width: strength + '%', background: g.commsLinked ? '#22c55e' : '#f59e0b' }} /></div>
          <div className="status-line">
            LINK: <b className={g.commsLinked ? 'green' : 'amber'}>{g.antennaFault ? 'ANTENNA FAULT' : !g.powered.comms ? 'NO POWER' : g.commsLinked ? 'LOCKED TO EARTH' : 'SEARCHING'}</b>
          </div>
          {hint && <div className="hint-line">{hint}</div>}
          <div className="spectrum">{bars.map((h, i) => <div key={i} className="spec-bar" style={{ height: h * 100 + '%', background: g.commsLinked ? '#22c55e' : '#38bdf8' }} />)}</div>

          <div className="subhead">DATA TRANSMISSION</div>
          <div className="status-line">Stored data: <b>{Math.floor(total)}</b> units · Sent: <b>{Math.floor(g.transmitted)} / {DATA_GOAL}</b></div>
          <div className="bar big"><div className="bar-fill" style={{ width: txPct + '%', background: '#a78bfa' }} /></div>
          <div className="status-line">
            STATUS: <b>{g.objectives[4] ? 'COMPLETE' : g.transmitting ? (g.commsLinked ? (g.transmitted >= total - 0.01 ? 'WAITING FOR MORE DATA' : 'TRANSMITTING...') : 'WAITING FOR LINK') : 'IDLE'}</b>
          </div>
          <button className={'btn ' + (g.transmitting ? 'danger' : 'primary')} onClick={g.toggleTransmit}>
            <Send size={14} /> {g.transmitting ? 'STOP TRANSMISSION' : 'TRANSMIT DATA TO EARTH'}
          </button>
          <div className="tiny">Your {g.stats.txRate} units/s antenna locks when within {g.stats.lockError}° of Earth. Without engine power the orbit drifts and the target moves slowly.</div>
        </div>
      </div>
    </Frame>
  );
}
