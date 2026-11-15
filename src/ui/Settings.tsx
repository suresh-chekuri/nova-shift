import { useUI, useSettings, updateSettings, setScreen } from '../store';
import { sfx } from '../sfx';

export function SettingsScreen() {
  const screen = useUI((s) => s.screen);
  const st = useSettings();
  if (screen !== 'settings') return null;
  return (
    <div className="screen sidepanel">
      <div className="side-box">
        <div className="eyebrow">SETTINGS</div>
        <h2>SHIP OPTIONS</h2>
        <div className="set-row"><label>Sound <b>{st.muted ? 'MUTED' : 'ON'}</b></label>
          <button className={'btn ' + (st.muted ? 'danger' : 'primary')} onClick={() => { updateSettings({ muted: !st.muted }); }}>{st.muted ? 'UNMUTE' : 'MUTE ALL'}</button></div>
        <div className="set-row"><label>Master volume <b>{Math.round(st.volume * 100)}%</b></label>
          <input type="range" min={0} max={1} step={0.05} value={st.volume} onChange={(e) => { updateSettings({ volume: +e.target.value }); sfx.click(); }} /></div>
        <div className="set-row"><label>Ambient volume (hum, vents) <b>{Math.round(st.ambientVol * 100)}%</b></label>
          <input type="range" min={0} max={1} step={0.05} value={st.ambientVol} onChange={(e) => { updateSettings({ ambientVol: +e.target.value });  }} /></div>
        <div className="set-row"><label>Sound effects volume <b>{Math.round(st.sfxVol * 100)}%</b></label>
          <input type="range" min={0} max={1} step={0.05} value={st.sfxVol} onChange={(e) => { updateSettings({ sfxVol: +e.target.value }); sfx.click(); }} /></div>
        <div className="set-row"><label>Music volume <b>{Math.round(st.musicVol * 100)}%</b></label>
          <input type="range" min={0} max={1} step={0.05} value={st.musicVol} onChange={(e) => { updateSettings({ musicVol: +e.target.value });  }} /></div>
        <div className="set-row"><label>Mouse sensitivity <b>{st.sensitivity.toFixed(1)}x</b></label>
          <input type="range" min={0.3} max={2.5} step={0.1} value={st.sensitivity} onChange={(e) => updateSettings({ sensitivity: +e.target.value })} /></div>
        <div className="set-row"><label>Glow effect (bloom) <b>{st.bloom ? 'ON' : 'OFF'}</b></label>
          <button className={'btn ' + (st.bloom ? 'primary' : '')} onClick={() => updateSettings({ bloom: !st.bloom })}>{st.bloom ? 'ON' : 'OFF'}</button></div>
        <div className="set-row"><label>Shadows <b>{st.shadows ? 'ON' : 'OFF'}</b></label>
          <button className={'btn ' + (st.shadows ? 'primary' : '')} onClick={() => updateSettings({ shadows: !st.shadows })}>{st.shadows ? 'ON' : 'OFF'}</button></div>
        <div className="set-row"><label>Model detail <b>{st.quality.toUpperCase()}</b></label>
          <div className="row" style={{ margin: 0 }}>
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button key={q} className={'btn small ' + (st.quality === q ? 'primary' : '')} onClick={() => { sfx.click(); updateSettings({ quality: q }); }}>{q.toUpperCase()}</button>
            ))}
          </div></div>
        <div className="tiny">If the game feels slow on your Mac, set Model detail to LOW, then turn off Shadows, then Glow.</div>
        <button className="btn huge" onClick={() => setScreen('menu')}>BACK</button>
      </div>
    </div>
  );
}
