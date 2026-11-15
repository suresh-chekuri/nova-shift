import { useState, type ReactNode } from 'react';
import { Rocket, Wrench, GraduationCap, Settings as Cog, Lock } from 'lucide-react';
import { useUI, setScreen, tutorialDone } from '../store';
import { startTutorial } from '../tutorial';
import { sfx } from '../sfx';

function MenuButton({ icon, label, sub, onClick, locked }: { icon: ReactNode; label: string; sub: string; onClick: () => void; locked?: boolean }) {
  return (
    <button className={'menu-btn' + (locked ? ' locked' : '')} onMouseEnter={() => sfx.hover()} onClick={() => { sfx.click(); onClick(); }}>
      <span className="mb-icon">{icon}</span>
      <span className="mb-text"><b>{label}</b><small>{sub}</small></span>
      <span className="mb-arrow">{locked ? <Lock size={16} /> : '›'}</span>
    </button>
  );
}

export function MainMenu() {
  const screen = useUI((s) => s.screen);
  const [ask, setAsk] = useState(false);
  if (screen !== 'menu') return null;
  const done = tutorialDone();
  const newMission = () => {
    if (!done) return setAsk(true);
    useUI.setState({ shipyardFor: 'mission', screen: 'shipyard' });
  };
  return (
    <div className="menu">
      <div className="menu-frame tl" /><div className="menu-frame tr" /><div className="menu-frame bl" /><div className="menu-frame br" />
      <div className="menu-left">
        <div className="menu-eyebrow">LUNAR ECHO PROGRAM · MISSION 07</div>
        <h1 className="menu-title">NOVA<span> SHIFT</span></h1>
        <div className="menu-sub">THE LAST SIGNAL</div>
        <div className="menu-tag">DESIGN. ENGINEER. SURVIVE.</div>
        <div className="menu-list">
          <MenuButton icon={<Rocket size={20} />} label="NEW MISSION" sub={done ? 'Design your ship and launch' : 'Locked until training is complete'} locked={!done} onClick={newMission} />
          <MenuButton icon={<Wrench size={20} />} label="DESIGN SPACECRAFT" sub="Open the Shipyard" onClick={() => useUI.setState({ shipyardFor: 'menu', screen: 'shipyard' })} />
          <MenuButton icon={<GraduationCap size={20} />} label="TUTORIAL" sub={done ? 'Replay the training' : 'Recommended first'} onClick={startTutorial} />
          <MenuButton icon={<Cog size={20} />} label="SETTINGS" sub="Sound, mouse, graphics" onClick={() => setScreen('settings')} />
        </div>
      </div>
      <div className="menu-foot">v2.0 · Press a button to begin</div>
      {ask && (
        <div className="modal">
          <div className="modal-box">
            <h3><Lock size={16} /> MISSION LOCKED</h3>
            <p>Finish the tutorial to unlock the main mission. It takes about 5 minutes and teaches everything you need.</p>
            <div className="row buttons">
              <button className="btn primary" onClick={() => { setAsk(false); startTutorial(); }}>START TUTORIAL</button>
              <button className="btn" onClick={() => { try { localStorage.setItem('nova-tutorial', '1'); } catch { /* */ } setAsk(false); useUI.setState({ shipyardFor: 'mission', screen: 'shipyard' }); }}>SKIP AND UNLOCK</button>
              <button className="btn small" onClick={() => setAsk(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
