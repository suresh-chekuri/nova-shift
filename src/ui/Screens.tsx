import { Rocket, RotateCcw } from 'lucide-react';
import { isTouch } from '../device';
import { useGame, useUI, useDesign, launch, resetToMenu, setScreen } from '../store';
import { lockPointer } from '../controls';
import { objectiveTexts } from '../sim';
import { getMission } from '../design';
import { sfx } from '../sfx';

export function BriefingScreen() {
  const screen = useUI((s) => s.screen);
  const design = useDesign((s) => s.design);
  if (screen !== 'briefing') return null;
  const m = getMission(design.mission);
  return (
    <div className="screen briefing">
      <div className="brief-box">
        <div className="eyebrow">MISSION BRIEFING</div>
        <h2>{m.name}: {m.tagline.toUpperCase()}</h2>
        <p>{m.objective} Your spacecraft has lost main power during orbital insertion. Restore critical systems, collect data, and transmit it to Earth.</p>
        <div className="brief-cols">
          <div>
            <h3>OBJECTIVES</h3>
            <ol>{objectiveTexts(design.mission).map((t) => <li key={t}>{t}</li>)}</ol>
            <h3>HOW YOU ARE SCORED</h3>
            <p>{m.scoring.join(', ')}.</p>
            <h3>TIME LIMIT</h3>
            <p>10 minutes. Random crises will happen. Fix them fast.</p>
          </div>
          <div>
            <h3>CONTROLS</h3>
            {isTouch ? (
              <table className="keys">
                <tbody>
                  <tr><td><kbd>Left thumb</kbd></td><td>Move (push all the way to sprint)</td></tr>
                  <tr><td><kbd>Right thumb</kbd></td><td>Drag to look around</td></tr>
                  <tr><td><kbd>USE</kbd></td><td>Interact with a console</td></tr>
                  <tr><td><kbd>CLOSE</kbd></td><td>Close a panel</td></tr>
                </tbody>
              </table>
            ) : (
              <table className="keys">
                <tbody>
                  <tr><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></td><td>Move</td></tr>
                  <tr><td><kbd>Mouse</kbd></td><td>Look around</td></tr>
                  <tr><td><kbd>Shift</kbd></td><td>Sprint</td></tr>
                  <tr><td><kbd>E</kbd></td><td>Interact with a console</td></tr>
                  <tr><td><kbd>Esc</kbd></td><td>Close a panel / free the mouse</td></tr>
                </tbody>
              </table>
            )}
            <h3>YOUR SPACECRAFT</h3>
            <p>The ship you built in the Shipyard is the ship you fly. Its power, battery, antenna and instruments set the rules.</p>
          </div>
        </div>
        <div className="row buttons" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => setScreen('shipyard')}>BACK TO SHIPYARD</button>
          <button className="btn primary huge" style={{ margin: 0 }} onClick={() => { sfx.launch(); launch('mission'); lockPointer(); }}><Rocket size={20} /> BEGIN MISSION</button>
        </div>
      </div>
    </div>
  );
}

export function DebriefScreen() {
  const g = useGame();
  const screen = useUI((s) => s.screen);
  if (screen !== 'game' || (g.phase !== 'won' && g.phase !== 'lost') || !g.result) return null;
  const r = g.result;
  return (
    <div className={'screen debrief ' + (r.won ? 'won' : 'lost')}>
      <div className="brief-box">
        <div className="eyebrow">MISSION DEBRIEF</div>
        <h1>{r.won ? 'MISSION COMPLETE' : 'MISSION FAILED'}</h1>
        <p>{r.reason}</p>
        <div className="score-grid">
          <table className="score-table">
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.label}><td>{row.label}</td><td className={row.value < 0 ? 'red' : ''}>{row.value >= 0 ? '+' : ''}{row.value}</td></tr>
              ))}
              <tr className="total"><td>TOTAL SCORE</td><td>{r.score}</td></tr>
            </tbody>
          </table>
          <div className="grade"><span>GRADE</span><b>{r.grade}</b></div>
        </div>
        <div className="lesson">
          <b>What you practiced:</b> power budgets, battery backup, and how one engineering choice (like your spacecraft design) changes every other system.
        </div>
        <button className="btn primary huge" onClick={() => { document.exitPointerLock(); resetToMenu(); }}><RotateCcw size={20} /> BACK TO MENU</button>
      </div>
    </div>
  );
}
