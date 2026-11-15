import { useEffect, useState, type ReactNode } from 'react';
import { Zap, Battery, Database, Radio, Clock, ShieldCheck, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { useGame, useUI } from '../store';
import { INTERACTABLES } from '../world/layout';
import { objectiveTexts, nextGoal, isEmergency, sumData, DATA_GOAL } from '../sim';
import { lockPointer, pose } from '../controls';

function Meter({ icon, label, value, frac, color }: { icon: ReactNode; label: string; value: string; frac: number; color: string }) {
  return (
    <div className="meter">
      <div className="meter-top">
        <span className="meter-label">{icon}{label}</span>
        <span className="meter-value">{value}</span>
      </div>
      <div className="bar"><div className="bar-fill" style={{ width: Math.max(0, Math.min(100, frac * 100)) + '%', background: color }} /></div>
    </div>
  );
}

export function fmtTime(s: number) {
  const t = Math.max(0, Math.ceil(s));
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}

function Waypoint({ targetId }: { targetId: string | null }) {
  const [w, setW] = useState({ ang: 0, dist: 0 });
  useEffect(() => {
    const t = setInterval(() => {
      const it = INTERACTABLES.find((i) => i.id === targetId);
      if (!it) return setW({ ang: 0, dist: 0 });
      const dx = it.x - pose.x, dz = it.z - pose.z;
      let rel = Math.atan2(-dx, -dz) - pose.yaw;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      setW({ ang: -rel, dist: Math.hypot(dx, dz) });
    }, 60);
    return () => clearInterval(t);
  }, [targetId]);
  if (!targetId || w.dist < 3.5) return null;
  return (
    <div className="waypoint">
      <div className="wp-arrow" style={{ transform: `rotate(${w.ang}rad)` }}>▲</div>
      <div className="wp-dist">{Math.round(w.dist)} m</div>
    </div>
  );
}

export function HUD() {
  const g = useGame();
  const ui = useUI();
  if (g.phase !== 'playing' || ui.screen !== 'game') return null;
  const targetId = ui.markerTarget !== undefined ? ui.markerTarget : nextGoal(g).target;
  const goal = nextGoal(g);
  const total = sumData(g);
  const emergency = isEmergency(g);
  const recent = g.log.filter((l) => g.elapsed - l.t < 7 && l.level !== 'info').slice(-3);
  const infoRecent = g.log.filter((l) => g.elapsed - l.t < 9 && l.level === 'info').slice(-1);
  // No mouse capture = no movement or E. The game pauses until the player clicks.
  const paused = !ui.locked && !ui.panel;
  const flash = g.elapsed - g.flashAt < 2.5;
  const cap = g.genOutput + ((g.sw.bj1 || g.sw.bj2) && g.battery > 0 ? g.stats.battOutput : 0);

  return (
    <div className="hud">
      {emergency && <div className="vignette" />}
      {flash && <div className="flash" />}

      <div className="hud-left">
        <div className="hud-title">SHIP STATUS</div>
        <Meter icon={<Zap size={13} />} label="POWER" value={`${g.demand} / ${cap} PU`} frac={cap ? g.demand / cap : 0} color={g.overloaded ? '#ef4444' : '#38bdf8'} />
        <Meter icon={<Battery size={13} />} label="BATTERY" value={`${Math.round(g.battery)}%`} frac={g.battery / 100} color={g.battery < 20 ? '#ef4444' : '#22c55e'} />
        <Meter icon={<Database size={13} />} label="DATA" value={`${Math.floor(total)} / ${DATA_GOAL}`} frac={total / DATA_GOAL} color="#a78bfa" />
        <Meter icon={<Radio size={13} />} label="COMMS" value={`${Math.floor(g.commsStrength)}%`} frac={g.commsStrength / 100} color={g.commsLinked ? '#22c55e' : '#f59e0b'} />
        <Meter icon={<ShieldCheck size={13} />} label="INTEGRITY" value={`${Math.floor(g.integrity)}%`} frac={g.integrity / 100} color={g.integrity < 35 ? '#ef4444' : '#f472b6'} />
        <div className={'timer' + (g.timeLeft < 60 && g.mode === 'mission' ? ' low' : '')}><Clock size={16} /> {g.mode === 'tutorial' ? 'TRAINING' : fmtTime(g.timeLeft)}</div>
      </div>

      <div className="hud-right">
        <div className="hud-title">OBJECTIVES</div>
        {objectiveTexts(g.design.mission).map((t, i) => (
          <div key={i} className={'obj' + (g.objectives[i] ? ' done' : '')}>
            {g.objectives[i] ? <CheckCircle2 size={14} /> : <Circle size={14} />}
            <span>{t}</span>
          </div>
        ))}
        <div className="goal"><b>NEXT:</b> {goal.text}</div>
      </div>

      <div className="alerts">
        {recent.map((l) => (
          <div key={l.id} className={'alert ' + l.level}>
            {l.level === 'danger' || l.level === 'warn' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {l.text}
          </div>
        ))}
        {recent.length === 0 && infoRecent.map((l) => <div key={l.id} className="alert info">{l.text}</div>)}
      </div>

      {g.overloaded && <div className="overload">POWER OVERLOAD — breakers trip in {Math.max(0, 3 - g.overloadTimer).toFixed(1)} s</div>}

      <div className="hud-bottom-left">
        <div className="room">{ui.room}</div>
        {g.elapsed < 25 && <div className="hint">W A S D move · Mouse look · Shift sprint · E interact · Esc close panel</div>}
      </div>

      <div className="crosshair" />
      <Waypoint targetId={ui.panel ? null : targetId} />
      {ui.nearby && !ui.panel && <div className="prompt">PRESS <b>E</b> TO {ui.nearby.label}</div>}

      {paused && (
        <div className="pause" onClick={lockPointer}>
          <div className="pause-box">
            <h2>PAUSED</h2>
            <p>Click anywhere to return to the ship.</p>
            <p className="dim">The mission clock stops while paused.</p>
          </div>
        </div>
      )}
    </div>
  );
}
