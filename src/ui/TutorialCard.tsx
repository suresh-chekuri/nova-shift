import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ChevronRight, SkipForward, Wrench } from 'lucide-react';
import { useGame, useUI, closePanel } from '../store';
import { useTut, STEPS, gotoStep, endTutorial, skipTutorial } from '../tutorial';
import { lockPointer } from '../controls';
import { sfx } from '../sfx';

export function TutorialCard() {
  const tut = useTut();
  const g = useGame();
  const ui = useUI();
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);
  const inYard = ui.screen === 'shipyard';
  if (!tut.active || (ui.screen !== 'game' && !inYard) || g.mode !== 'tutorial') return null;
  const step = STEPS[tut.step];
  const last = tut.step === STEPS.length - 1;
  const done = !last && step.done(g, { panel: ui.panel, screen: ui.screen });
  const waited = (Date.now() - tut.enteredAt) / 1000 >= (step.minSeconds ?? 0);
  const checks = step.checks?.(g);
  const next = () => {
    sfx.success();
    closePanel();
    gotoStep(tut.step + 1);
    if (ui.screen === 'game') lockPointer();
  };

  return (
    <div className="tut">
      <div className="tut-top">
        <span>TRAINING · STEP {tut.step + 1} / {STEPS.length}</span>
        {!last && <button className="tut-skip" onClick={skipTutorial}><SkipForward size={12} /> SKIP TUTORIAL</button>}
      </div>
      <div className="bar"><div className="bar-fill" style={{ width: ((tut.step + (done ? 1 : 0)) / STEPS.length) * 100 + '%', background: '#22d3ee' }} /></div>
      <h3>{step.title}</h3>
      <div className="tut-goal">{step.goal}</div>
      <p>{step.text}</p>
      {checks && (
        <div className="tut-checks">
          {checks.map((c) => (
            <div key={c.label} className={c.ok ? 'ok' : ''}>{c.ok ? <CheckCircle2 size={14} /> : <Circle size={14} />} {c.label}</div>
          ))}
        </div>
      )}
      {step.needsShipyard && !inYard && (
        <button className="btn primary" onClick={() => { document.exitPointerLock(); useUI.setState({ shipyardFor: 'tutorial', screen: 'shipyard' }); }}><Wrench size={14} /> OPEN SHIPYARD</button>
      )}
      {step.needsShipyard && inYard && !done && <div className="tut-hint">Pick a part on the left, then press ATTACH. Watch the ship change and the numbers move.</div>}
      {step.needsShipyard && inYard && done && <div className="tut-hint ok">Nice! Mass, cost and power all changed. Press RETURN TO SHIP (top left), then CONTINUE.</div>}
      {!last && done && waited && !(step.needsShipyard && inYard) && (
        <button className="btn primary pulse" onClick={next}>CONTINUE <ChevronRight size={14} /></button>
      )}
      {last && (
        <div className="row buttons">
          <button className="btn primary" onClick={() => { sfx.success(); endTutorial(true); }}>MISSION UNLOCKED — BACK TO MENU</button>
        </div>
      )}
    </div>
  );
}
