import { useState } from 'react';
import { Rocket, ArrowLeft, RotateCcw, CheckCircle2, XCircle, Trash2, Link2, RefreshCw, Save, FolderOpen, ShieldCheck, Box, Sun, Flame, Radio, Battery, Atom, Activity, Radar, Camera, X } from 'lucide-react';
import {
  useUI, useDesign, useYard, useSaves, yardCategory, yardSelect, attachPart, removePart, resetDesign, setMission,
  saveCurrentDesign, loadSavedDesign, deleteSavedDesign, showToast, installedId,
} from '../store';
import { CATALOG, CAT_LABEL, MAX_PAYLOAD, MISSIONS, MISSION_IDS, getMission, computeStats, validate, part, type Cat, type Part } from '../design';
import { sfx } from '../sfx';
import { TutorialCard } from './TutorialCard';

const CATS: Cat[] = ['structure', 'power', 'propulsion', 'comms', 'battery', 'payload'];
const CAT_ICON: Record<Cat, typeof Box> = { structure: Box, power: Sun, propulsion: Flame, comms: Radio, battery: Battery, payload: Atom };
const INSTR_ICON: Record<string, typeof Box> = { spectrometer: Atom, seismic: Activity, analyzer: Radar, camera: Camera };
const HARDPOINT_NAME: Record<Cat, string> = {
  structure: 'central bus', power: 'side wing mounts', propulsion: 'rear engine mount', comms: 'top antenna mast', battery: 'internal bay', payload: 'front instrument hardpoints',
};

function chips(c: Cat, p: Part): string[] {
  const out = [`${p.mass} kg`, `$${p.cost}M`];
  if (c === 'structure') out.push(`Durability ${p.durability}`);
  if (c === 'power') out.push(`+${p.gen} PU`);
  if (c === 'propulsion') out.push(`Uses ${p.load} PU`, `Orbit control x${(1 / (p.drift ?? 1)).toFixed(1)}`, `Fuel use ${p.fuelUse}`);
  if (c === 'comms') out.push(`Uses ${p.load} PU`, `${p.tx} data/s`, `Lock ±${p.lock}°`, `Range ${p.range}`);
  if (c === 'battery') out.push(`${p.capacity} energy`, `Output ${p.out} PU`);
  if (c === 'payload') out.push(`Uses ${p.load} PU`, `+${p.rate} data/s`, `Science ${p.value}`);
  return out;
}

function Gauge({ label, value, max, text, bad, warn, color = '#38bdf8' }: { label: string; value: number; max: number; text: string; bad?: boolean; warn?: boolean; color?: string }) {
  return (
    <div className="gauge">
      <div className="gauge-top"><span>{label}</span><b className={bad ? 'red' : warn ? 'amber' : ''}>{text}</b></div>
      <div className="bar"><div className="bar-fill" style={{ width: Math.max(0, Math.min(100, (value / max) * 100)) + '%', background: bad ? '#ef4444' : warn ? '#f59e0b' : color }} /></div>
    </div>
  );
}

function LoadModal({ onClose }: { onClose: () => void }) {
  const list = useSaves((s) => s.list);
  return (
    <div className="modal">
      <div className="modal-box">
        <h3><FolderOpen size={16} /> LOAD A SAVED DESIGN</h3>
        {list.length === 0 && <p>No saved designs yet. Press SAVE to keep your current ship.</p>}
        <div className="save-list">
          {list.map((s, i) => (
            <div key={s.at + '-' + i} className="save-row">
              <div><b>{s.name}</b><small>{new Date(s.at).toLocaleString()}</small></div>
              <button className="btn small primary" onClick={() => { loadSavedDesign(i); onClose(); }}>LOAD</button>
              <button className="btn small danger" onClick={() => deleteSavedDesign(i)} title="Delete"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
        <div className="row buttons"><button className="btn" onClick={onClose}><X size={14} /> CLOSE</button></div>
      </div>
    </div>
  );
}

export function ShipyardUI() {
  const screen = useUI((s) => s.screen);
  const mode = useUI((s) => s.shipyardFor);
  const design = useDesign((s) => s.design);
  const { cat, pending, autoRotate } = useYard();
  const [hover, setHover] = useState<Part | null>(null);
  const [loading, setLoading] = useState(false);
  if (screen !== 'shipyard') return null;

  const mission = getMission(design.mission);
  const stats = computeStats(design);
  const checks = validate(design);
  const failed = checks.filter((c) => !c.ok);
  const valid = failed.length === 0;
  const instrLoad = design.payload.reduce((a, id) => a + (part('payload', id)?.load ?? 0), 0);
  const consumption = stats.loads.life + stats.loads.comms + stats.loads.eng + (design.payload.length ? stats.loads.sci : 0) + instrLoad;
  const essential = stats.loads.life + stats.loads.comms + stats.loads.eng;
  const balance = stats.genCapacity - consumption;
  const maneuver = Math.round(100 / stats.driftMult);
  const fuelEff = Math.round(5000 / Math.max(1, stats.fuelUse));
  const tutorial = mode === 'tutorial';

  const selPart = pending ? part(cat, pending) : null;
  const installedHere = (c: Cat, id: string) => (c === 'payload' ? design.payload.includes(id) : installedId(design, c) === id);
  const selInstalled = !!selPart && installedHere(cat, selPart.id);
  const anyInstalledInCat = cat === 'payload' ? design.payload.length > 0 : !!installedId(design, cat);

  const back = () => {
    if (mode === 'tutorial') useUI.setState({ screen: 'game' });
    else if (mode === 'lobby') useUI.setState({ screen: 'lobby' });
    else useUI.setState({ screen: 'menu' });
  };
  const attach = () => { if (selPart) attachPart(cat, selPart.id); else { showToast('First choose a part in the list.'); sfx.warn(); } };
  const remove = () => removePart(cat, selPart?.id);
  const validateNow = () => {
    sfx.click();
    useYard.setState({ validated: true });
    if (valid) { sfx.success(); showToast('SPACECRAFT READY FOR LAUNCH'); }
    else { sfx.warn(); showToast(failed.length + ' check' + (failed.length > 1 ? 's' : '') + ' failed. The parts to fix glow red on the ship.'); }
  };
  const launchBtn = () => {
    if (!valid) { validateNow(); return; }
    sfx.launch();
    useUI.setState({ screen: 'briefing' });
  };

  return (
    <div className="yard">
      <div className="yard-top">
        <button className="btn" onClick={() => { sfx.click(); back(); }}><ArrowLeft size={14} /> {tutorial ? 'RETURN TO SHIP' : mode === 'lobby' ? 'SAVE & RETURN TO LOBBY' : 'SAVE & EXIT'}</button>
        <div className="yard-mid">
          <div className="yard-title">SHIPYARD <small>{mission.name}: {mission.objective}</small></div>
          {!tutorial && (
            <div className="mission-tabs">
              {MISSION_IDS.map((id) => (
                <button key={id} className={'mtab' + (design.mission === id || (!design.mission && id === 'echo') ? ' on' : '')} onClick={() => setMission(id)} title={MISSIONS[id].objective}>{MISSIONS[id].name}</button>
              ))}
            </div>
          )}
        </div>
        <div className="yard-nums">
          <span className={stats.cost > stats.budget ? 'red' : ''}>BUDGET ${stats.cost}M / ${stats.budget}M</span>
          <span className={stats.mass > stats.launchCapacity ? 'red' : ''}>MASS {stats.mass} / {stats.launchCapacity} kg</span>
        </div>
      </div>

      <div className="yard-left">
        <div className="tabs">
          {CATS.map((c) => {
            const Icon = CAT_ICON[c];
            return <button key={c} className={'tab' + (cat === c ? ' on' : '')} onClick={() => yardCategory(c)}><Icon size={12} /> {CAT_LABEL[c]}</button>;
          })}
        </div>
        <div className="tiny" style={{ marginTop: 0, marginBottom: 8 }}>
          {cat === 'payload' ? `Hardpoints used: ${design.payload.length} / ${MAX_PAYLOAD}. ` : ''}Pick a part. Then press ATTACH, or click a glowing yellow point on the ship.
        </div>
        <div className="parts">
          {CATALOG[cat].map((p) => {
            const inst = installedHere(cat, p.id);
            const sel = pending === p.id;
            const Icon = cat === 'payload' ? INSTR_ICON[p.id] ?? Atom : CAT_ICON[cat];
            const needed = cat === 'payload' && mission.required.includes(p.id as any);
            return (
              <button
                key={p.id}
                className={'part' + (inst ? ' sel' : '') + (sel ? ' picked' : '')}
                onMouseEnter={() => { setHover(p); sfx.hover(); }}
                onMouseLeave={() => setHover(null)}
                onClick={() => yardSelect(cat, p.id)}
                onDoubleClick={() => attachPart(cat, p.id)}
              >
                <div className="part-name"><span className="part-icon"><Icon size={16} /></span>{p.name}{needed && <em className="req">MISSION NEEDS</em>}{inst && <CheckCircle2 size={14} />}</div>
                <div className="part-desc">{p.desc}</div>
                <div className="chips">{chips(cat, p).map((c) => <span key={c} className="chip">{c}</span>)}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="yard-right">
        <div className="subhead">ENGINEERING DASHBOARD</div>
        <Gauge label="TOTAL MASS" value={stats.mass} max={stats.launchCapacity} text={`${stats.mass} / ${stats.launchCapacity} kg`} bad={stats.mass > stats.launchCapacity} warn={stats.mass > stats.launchCapacity * 0.9} />
        <Gauge label="TOTAL COST" value={stats.cost} max={stats.budget} text={`$${stats.cost}M / $${stats.budget}M`} bad={stats.cost > stats.budget} warn={stats.cost > stats.budget * 0.9} color="#facc15" />
        <Gauge label="POWER GENERATION" value={stats.genCapacity} max={140} text={`${stats.genCapacity} PU`} color="#34d399" />
        <Gauge label="POWER CONSUMPTION (all on)" value={consumption} max={Math.max(140, consumption)} text={`${consumption} PU`} warn={consumption > stats.genCapacity} color="#fb923c" />
        <div className="balance">
          <span>POWER BALANCE</span>
          <b className={balance < 0 ? 'amber' : 'green'}>{balance >= 0 ? '+' : ''}{balance} PU</b>
          <small>{essential <= stats.genCapacity ? `Essential systems use ${essential} PU. OK.` : `Essential systems use ${essential} PU. Too much!`}{balance < 0 ? ' Run fewer instruments at once. The battery fills the gap.' : ''}</small>
        </div>
        <Gauge label="BATTERY CAPACITY" value={stats.battCapacity} max={160} text={`${stats.battCapacity} energy`} color="#a78bfa" />
        <Gauge label="DATA RATE" value={stats.txRate} max={6.5} text={`${stats.txRate} data/s (need ${mission.reqTx})`} bad={stats.txRate < mission.reqTx} color="#22d3ee" />
        <Gauge label="SCIENCE VALUE" value={stats.scienceValue} max={14} text={`${stats.scienceValue} (need ${mission.reqScience})`} bad={stats.scienceValue < mission.reqScience} color="#c084fc" />
        <Gauge label="PROPULSION: ORBIT CONTROL" value={maneuver} max={250} text={`${maneuver}`} color="#f472b6" />
        <Gauge label="PROPULSION: FUEL EFFICIENCY" value={fuelEff} max={150} text={`${fuelEff}  (${stats.lifetime} min)`} bad={stats.lifetime < mission.reqLifetime} color="#f472b6" />

        <div className="subhead">MISSION COMPATIBILITY</div>
        <div className={'compat ' + (valid ? 'ok' : 'bad')}>{valid ? <ShieldCheck size={16} /> : <XCircle size={16} />} {valid ? 'SPACECRAFT READY FOR LAUNCH' : `${failed.length} PROBLEM${failed.length > 1 ? 'S' : ''} TO FIX`}</div>
        <div className="checks">
          {checks.map((c) => (
            <div key={c.id} className={'check ' + (c.ok ? 'ok' : 'bad')}>
              {c.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              <div><b>{c.label}</b> — {c.detail}{!c.ok && <small>FIX: {c.fix}</small>}</div>
            </div>
          ))}
        </div>
        <div className="tiny">Scoring for {mission.name}: {mission.scoring.join(', ')}.</div>
      </div>

      <div className="yard-bottom">
        <div className="sel-info">
          {selPart ? (
            <>
              <div className="sel-name">{(() => { const Icon = cat === 'payload' ? INSTR_ICON[selPart.id] ?? Atom : CAT_ICON[cat]; return <Icon size={16} />; })()} {selPart.name}
                <em className={selInstalled ? 'on' : ''}>{selInstalled ? 'ATTACHED' : 'READY TO ATTACH'}</em></div>
              <div className="chips">{chips(cat, selPart).map((c) => <span key={c} className="chip">{c}</span>)}</div>
              <div className="sel-hint">Fits the <b>{HARDPOINT_NAME[cat]}</b>. {!selInstalled ? 'Press ATTACH, or click a yellow point on the ship.' : 'Click its point on the ship, or REMOVE COMPONENT, to take it off.'}</div>
            </>
          ) : (
            <>
              <div className="sel-name">No part selected</div>
              <div className="sel-hint">{hover ? <><b>{hover.name}</b>: {hover.desc}</> : 'Choose a part in the list on the left. Or click a point on the ship to inspect what is attached there.'}</div>
            </>
          )}
        </div>
        <div className="yard-btns">
          <button className="btn primary" disabled={!selPart || selInstalled} onClick={attach} title="Attach the selected part to the ship"><Link2 size={14} /> ATTACH</button>
          <button className="btn danger" disabled={!anyInstalledInCat} onClick={remove} title="Remove the selected part (or the part in this category)"><Trash2 size={14} /> REMOVE COMPONENT</button>
          <button className={'btn' + (autoRotate ? ' primary' : '')} onClick={() => { sfx.click(); useYard.setState({ autoRotate: !autoRotate }); }} title="Turn the slow spin on or off. You can also drag with the mouse."><RefreshCw size={14} /> ROTATE: {autoRotate ? 'ON' : 'OFF'}</button>
          <button className="btn" onClick={() => { sfx.click(); resetDesign(); }} title="Go back to the standard ship"><RotateCcw size={14} /> RESET DESIGN</button>
          <button className="btn" onClick={saveCurrentDesign} title="Keep this design on this computer"><Save size={14} /> SAVE DESIGN</button>
          <button className="btn" onClick={() => { sfx.click(); setLoading(true); }} title="Load a saved design"><FolderOpen size={14} /> LOAD</button>
          <button className="btn" onClick={validateNow} title="Check all launch rules"><ShieldCheck size={14} /> VALIDATE</button>
          {!tutorial && (
            <button className={'btn launch' + (valid ? ' primary pulse' : '')} disabled={mode === 'lobby'} onClick={launchBtn} title={mode === 'lobby' ? 'Go back to the lobby. The host presses START MISSION there.' : valid ? 'Go to the mission briefing' : 'Shows what you must fix'}>
              <Rocket size={16} /> {mode === 'lobby' ? 'START IN LOBBY' : valid ? 'LAUNCH' : 'LAUNCH (FIX CHECKS)'}
            </button>
          )}
        </div>
      </div>
      {loading && <LoadModal onClose={() => setLoading(false)} />}
      <TutorialCard />
    </div>
  );
}
