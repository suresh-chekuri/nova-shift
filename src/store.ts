import { create } from 'zustand';
import * as sim from './sim';
import { sfx } from './sfx';
import { setLevels } from './audio';
import { DEFAULT_DESIGN, MAX_PAYLOAD, isValid, loadDesign, saveDesign, listSaves, writeSaves, part, getMission, type Cat, type Design, type MissionId } from './design';

// ---------------------------------------------------------------- screen / UI state
export type Screen = 'menu' | 'shipyard' | 'lobby' | 'settings' | 'briefing' | 'game';
export type Role = 'commander' | 'engineer' | 'science' | 'comms';

export const useUI = create<{
  screen: Screen;
  shipyardFor: 'menu' | 'mission' | 'tutorial' | 'lobby';
  panel: sim.PanelId;
  focus: sim.InstrId | null;
  locked: boolean;
  nearby: { id: string; label: string } | null;
  room: string;
  markerTarget: string | null | undefined; // tutorial can override the floating marker
  toast: { text: string; at: number } | null;
}>()(() => ({
  screen: 'menu', shipyardFor: 'menu', panel: null, focus: null, locked: false,
  nearby: null, room: 'COMMAND DECK', markerTarget: undefined, toast: null,
}));

export function showToast(text: string) {
  useUI.setState({ toast: { text, at: Date.now() } });
}
export function setScreen(screen: Screen) {
  sfx.screen();
  useUI.setState({ screen });
}
export function openPanel(p: sim.PanelId, focus: sim.InstrId | null = null) {
  sfx.consoleOpen();
  useUI.setState({ panel: p, focus });
}
export function closePanel() {
  if (useUI.getState().panel) sfx.consoleClose();
  useUI.setState({ panel: null, focus: null });
}

// ---------------------------------------------------------------- settings
export type Quality = 'low' | 'medium' | 'high';
// `volume` is the MASTER volume (kept under the old name so old saves still work)
interface Settings { suitDefault: number; crewSuit: boolean; suitFlip: boolean; perf: number; volume: number; ambientVol: number; sfxVol: number; musicVol: number; muted: boolean; sensitivity: number; bloom: boolean; shadows: boolean; quality: Quality }
function loadSettings(): Settings {
  const d: Settings = { suitDefault: 1, crewSuit: true, suitFlip: false, perf: 31, volume: 0.7, ambientVol: 0.7, sfxVol: 0.8, musicVol: 0.5, muted: false, sensitivity: 1, bloom: false, shadows: false, quality: 'medium' };
  try {
    const saved = JSON.parse(localStorage.getItem('nova-settings') || '{}');
    // V3.1 speed-up: shadows and glow start OFF once (they cost the most). You can turn them on again in Settings.
    if (saved.perf !== 31) { saved.shadows = false; saved.bloom = false; saved.perf = 31; }
    // the real crew suit starts ON once (an earlier version saved it as OFF). You can still turn it off in Settings.
    if (saved.suitDefault !== 1) { saved.crewSuit = true; saved.suitDefault = 1; }
    return { ...d, ...saved };
  } catch { return d; }
}
export const useSettings = create<Settings>()(() => loadSettings());
function pushAudio() {
  const t = useSettings.getState();
  setLevels({ master: t.volume, ambient: t.ambientVol, sfx: t.sfxVol, music: t.musicVol, muted: t.muted });
}
pushAudio();
export function updateSettings(p: Partial<Settings>) {
  useSettings.setState(p);
  try { localStorage.setItem('nova-settings', JSON.stringify(useSettings.getState())); } catch { /* ignore */ }
  pushAudio();
}

// ---------------------------------------------------------------- spacecraft design (saved on this computer)
export const useDesign = create<{ design: Design }>()(() => ({ design: loadDesign() }));
function putDesign(d: Design) {
  saveDesign(d);
  useDesign.setState({ design: d });
  useYard.setState({ validated: false });
  // while a tutorial is running the live ship follows the design
  if (useGame.getState().mode === 'tutorial' && useGame.getState().phase === 'playing') mutate((g) => sim.setDesign(g, { ...d, mission: 'echo' }));
}
export function setPart(cat: Exclude<Cat, 'payload'>, id: string | null) {
  sfx.toggle();
  putDesign({ ...useDesign.getState().design, [cat]: id });
}
export function togglePayload(id: string) {
  const d = useDesign.getState().design;
  const has = d.payload.includes(id);
  if (!has && d.payload.length >= MAX_PAYLOAD) { showToast('Only ' + MAX_PAYLOAD + ' payload slots. Remove one first.'); sfx.warn(); return; }
  sfx.attach();
  putDesign({ ...d, payload: has ? d.payload.filter((p) => p !== id) : [...d.payload, id] });
}
export function resetDesign() {
  const mission = useDesign.getState().design.mission;
  useYard.setState({ pending: null });
  putDesign({ ...DEFAULT_DESIGN, payload: [...DEFAULT_DESIGN.payload], mission });
  showToast('Design reset to the standard ship.');
}

// ---------------------------------------------------------------- shipyard interaction (select, attach, remove)
export const useYard = create<{
  cat: Cat;
  pending: string | null; // the part the player has selected in the catalog
  autoRotate: boolean;
  validated: boolean; // the player pressed VALIDATE: failing parts glow red
  removed: { cat: Cat; id: string; at: number; slot: number } | null;
  attachedAt: number;
}>()(() => ({ cat: 'structure', pending: null, autoRotate: true, validated: false, removed: null, attachedAt: 0 }));

export function yardCategory(cat: Cat) {
  sfx.click();
  useYard.setState({ cat, pending: null });
}
export function yardSelect(cat: Cat, id: string) {
  sfx.hover();
  useYard.setState({ cat, pending: id });
}

// The player clicked a hardpoint on the ship.
export function pickHardpoint(cat: Cat, slot?: number) {
  const { pending, cat: cur } = useYard.getState();
  const d = useDesign.getState().design;
  if (pending && cur !== cat) {
    const p = part(cur, pending);
    showToast((p?.name ?? 'This part') + ' does not fit there. Glowing yellow points fit it.');
    sfx.warn();
    return;
  }
  if (pending) {
    if (cat === 'payload' ? d.payload[slot ?? 0] === pending : (d as any)[cat] === pending) {
      removePart(cat, pending); // click the part that is already there: take it off
      useYard.setState({ pending: null });
      return;
    }
    attachPart(cat, pending, slot);
    return;
  }
  sfx.hover();
  useYard.setState({ cat, pending: installedId(d, cat, slot ?? 0) });
}

export function installedId(d: Design, cat: Cat, slot = 0): string | null {
  return cat === 'payload' ? d.payload[slot] ?? null : ((d as any)[cat] as string | null);
}

// Attach a part to its hardpoint. For payload, `slot` is the hardpoint (0..2).
export function attachPart(cat: Cat, id: string, slot?: number) {
  const d = useDesign.getState().design;
  const p = part(cat, id);
  if (!p) return;
  if (cat !== 'payload') {
    if ((d as any)[cat] === id) { showToast(p.name + ' is already attached.'); return; }
    const old = (d as any)[cat] as string | null;
    if (old) useYard.setState({ removed: { cat, id: old, at: Date.now(), slot: 0 } });
    sfx.success();
    putDesign({ ...d, [cat]: id });
    useYard.setState({ attachedAt: Date.now() });
    return;
  }
  const without = d.payload.filter((x) => x !== id);
  const target = Math.min(slot ?? without.length, without.length);
  if (slot === undefined && d.payload.includes(id)) { showToast(p.name + ' is already attached.'); return; }
  const replaced = without[target];
  let next = [...without];
  if (replaced && slot !== undefined) next.splice(target, 1, id); // replace what sits on that hardpoint
  else next.splice(target, 0, id);
  if (next.length > MAX_PAYLOAD) { showToast('All ' + MAX_PAYLOAD + ' payload hardpoints are full. Choose one to replace, or remove an instrument.'); sfx.warn(); return; }
  if (replaced && slot !== undefined) useYard.setState({ removed: { cat, id: replaced, at: Date.now(), slot: target } });
  sfx.attach();
  putDesign({ ...d, payload: next });
  useYard.setState({ attachedAt: Date.now() });
}

// Remove an installed part.
export function removePart(cat: Cat, id?: string | null) {
  const d = useDesign.getState().design;
  if (cat === 'payload') {
    const target = id && d.payload.includes(id) ? id : d.payload[d.payload.length - 1];
    if (!target) { showToast('No instrument is attached.'); return; }
    useYard.setState({ removed: { cat, id: target, at: Date.now(), slot: d.payload.indexOf(target) } });
    sfx.toggle();
    putDesign({ ...d, payload: d.payload.filter((x) => x !== target) });
    return;
  }
  const old = (d as any)[cat] as string | null;
  if (!old) { showToast('Nothing is attached there.'); return; }
  useYard.setState({ removed: { cat, id: old, at: Date.now(), slot: 0 } });
  sfx.toggle();
  putDesign({ ...d, [cat]: null });
}

export function setMission(id: MissionId) {
  sfx.click();
  putDesign({ ...useDesign.getState().design, mission: id });
  showToast(getMission(id).name + ': budget $' + getMission(id).budget + 'M, launch capacity ' + getMission(id).capacity + ' kg.');
}

// ---------------------------------------------------------------- saved designs
export const useSaves = create<{ list: ReturnType<typeof listSaves> }>()(() => ({ list: listSaves() }));
export function saveCurrentDesign() {
  const d = useDesign.getState().design;
  const list = listSaves();
  const name = getMission(d.mission).name + ' #' + (list.length + 1);
  const next = [{ name, at: Date.now(), design: structuredClone(d) }, ...list].slice(0, 8);
  writeSaves(next);
  useSaves.setState({ list: next });
  sfx.success();
  showToast('Saved as "' + name + '".');
}
export function loadSavedDesign(i: number) {
  const item = useSaves.getState().list[i];
  if (!item) return;
  useYard.setState({ pending: null });
  putDesign({ ...DEFAULT_DESIGN, ...structuredClone(item.design) });
  sfx.success();
  showToast('Loaded "' + item.name + '".');
}
export function deleteSavedDesign(i: number) {
  const next = useSaves.getState().list.filter((_, k) => k !== i);
  writeSaves(next);
  useSaves.setState({ list: next });
  sfx.click();
}

// ---------------------------------------------------------------- network state (filled in by net.ts)
export interface PlayerInfo { id: string; name: string; role: Role | null; ready: boolean; host: boolean }
export interface RoomInfo { code: string; phase: string; hostId: string; players: PlayerInfo[] }
export const useNet = create<{
  mode: 'solo' | 'host' | 'client';
  connected: boolean;
  myId: string;
  room: RoomInfo | null;
  error: string;
  remote: Record<string, { x: number; z: number; yaw: number; panel: string | null; t: number }>;
}>()(() => ({ mode: 'solo', connected: false, myId: '', room: null, error: '', remote: {} }));

// hooks the network layer fills in (kept here so the store has no import cycle)
export const netHooks: { sendAction: (name: string, args: any[]) => void; sendState: (s: any) => void; sendPos: (p: any) => void } = {
  sendAction: () => {},
  sendState: () => {},
  sendPos: () => {},
};

// ---------------------------------------------------------------- who may do what
export const ACTION_ROLES: Record<string, Role[]> = {
  restartGenerator: ['engineer'],
  resetDistribution: ['engineer'],
  toggleInstrument: ['science'],
  setAntenna: ['comms'],
  repairAntenna: ['comms'],
  toggleTransmit: ['comms'],
  order: ['commander'],
};
export const ROLE_NAME: Record<Role, string> = { commander: 'COMMANDER', engineer: 'ENGINEER', science: 'SCIENCE OFFICER', comms: 'COMMUNICATIONS OFFICER' };

// Which roles may do an action. Used by allowed() AND by the "Only the ..." message, so they always agree.
export function rolesFor(name: string, args: any[]): Role[] | undefined {
  if (name === 'toggleSwitch') return args[0] === 'eng' ? ['engineer', 'commander'] : ['engineer'];
  return ACTION_ROLES[name];
}

export function allowed(name: string, args: any[], actor: Role | null, players: PlayerInfo[]): boolean {
  const roles = rolesFor(name, args);
  if (!roles || players.length === 0) return true;
  if (actor && roles.includes(actor)) return true;
  // if nobody holds any of the needed roles, anyone may act
  return !players.some((p) => p.role && roles.includes(p.role));
}

export function myRole(): Role | null {
  const n = useNet.getState();
  return n.room?.players.find((p) => p.id === n.myId)?.role ?? null;
}

// ---------------------------------------------------------------- game state
type Actions = {
  toggleSwitch: (id: sim.SwitchId) => void;
  restartGenerator: () => void;
  resetDistribution: () => void;
  toggleInstrument: (id: sim.InstrId) => void;
  setAntenna: (az: number, el: number) => void;
  repairAntenna: () => void;
  toggleTransmit: () => void;
  order: (text: string) => void;
  step: (dt: number, broadcast?: boolean) => void;
};
export type Store = sim.GameState & Actions;

const SOUND: Record<string, () => void> = {
  toggleSwitch: sfx.switch, toggleInstrument: sfx.button, restartGenerator: sfx.button, resetDistribution: sfx.switch,
  repairAntenna: sfx.button, toggleTransmit: sfx.button, order: sfx.click,
};

const LOCAL: Record<string, (g: sim.GameState, ...a: any[]) => void> = {
  toggleSwitch: sim.toggleSwitch,
  restartGenerator: sim.restartGenerator,
  resetDistribution: sim.resetDistribution,
  toggleInstrument: sim.toggleInstrument,
  setAntenna: sim.setAntenna,
  repairAntenna: sim.repairAntenna,
  toggleTransmit: sim.toggleTransmit,
  order: sim.order,
};

export function mutate(fn: (g: sim.GameState) => void) {
  const g = sim.cloneData(useGame.getState()) as sim.GameState;
  fn(g);
  useGame.setState(g as any);
}

// Every player action goes through here. Solo/host: apply now. Client: ask the host.
function act(name: string, args: any[]) {
  const net = useNet.getState();
  const players = net.room?.players ?? [];
  const role = myRole();
  if (!allowed(name, args, role, players)) {
    sfx.warn();
    const need = (rolesFor(name, args) ?? []).map((r) => ROLE_NAME[r]).join(' / ');
    showToast('Only the ' + need + ' can do this.');
    return;
  }
  SOUND[name]?.();
  if (net.mode === 'client') netHooks.sendAction(name, args);
  else mutate((g) => LOCAL[name](g, ...args));
}

// The host applies actions that other players send.
export function applyRemoteAction(name: string, args: any[], fromId: string) {
  const net = useNet.getState();
  const players = net.room?.players ?? [];
  const from = players.find((p) => p.id === fromId);
  if (!LOCAL[name] || !allowed(name, args, from?.role ?? null, players)) {
    console.warn('[NOVA SHIFT] host rejected action', name, 'from', from?.name ?? fromId, '(role:', from?.role ?? 'none', ')');
    return;
  }
  mutate((g) => LOCAL[name](g, ...args));
}

export const useGame = create<Store>()(() => ({
  ...sim.createState(),
  toggleSwitch: (id) => act('toggleSwitch', [id]),
  restartGenerator: () => act('restartGenerator', []),
  resetDistribution: () => act('resetDistribution', []),
  toggleInstrument: (id) => act('toggleInstrument', [id]),
  setAntenna: (az, el) => act('setAntenna', [az, el]),
  repairAntenna: () => act('repairAntenna', []),
  toggleTransmit: () => act('toggleTransmit', []),
  order: (text) => act('order', [text]),
  step: (dt, broadcast = true) => {
    const ui = useUI.getState();
    const net = useNet.getState();
    const remoteComms = (Object.values(net.remote) as { panel: string | null; t: number }[]).some((r) => r.panel === 'comms' && Date.now() - r.t < 2000);
    const ctx = { commsOpen: ui.panel === 'comms' || remoteComms };
    mutate((g) => sim.tick(g, dt, Math.random, ctx));
    if (net.mode === 'host' && broadcast) netHooks.sendState(sim.cloneData(useGame.getState()));
  },
}));

// A browser tab in the background stops drawing frames, so the game loop would freeze for everyone.
// The host calls this from a timer to catch up, so friends keep playing while the host looks at another window.
export function hostCatchUp(seconds: number) {
  const steps = Math.floor(Math.min(seconds, 30) / 0.1);
  for (let i = 0; i < steps; i++) {
    if (useGame.getState().phase !== 'playing') break;
    useGame.getState().step(0.1, false);
  }
  if (steps > 0 && useNet.getState().mode === 'host') netHooks.sendState(sim.cloneData(useGame.getState()));
}

// ---------------------------------------------------------------- flow
export function launch(mode: 'mission' | 'tutorial' = 'mission', design?: Design) {
  let d = design ?? useDesign.getState().design;
  if (mode === 'tutorial') { d = { ...d, mission: 'echo' }; if (!isValid(d)) d = DEFAULT_DESIGN; }
  mutate((g) => sim.startMission(g, Math.random, d, mode));
  useUI.setState({ screen: 'game', panel: null, focus: null, nearby: null, markerTarget: undefined });
}

export function resetToMenu() {
  mutate((g) => Object.assign(g, sim.createState(Math.random, useDesign.getState().design)));
  useUI.setState({ screen: 'menu', panel: null, focus: null, markerTarget: undefined });
}

export const tutorialDone = () => {
  try { return localStorage.getItem('nova-tutorial') === '1'; } catch { return false; }
};
export const markTutorialDone = () => {
  try { localStorage.setItem('nova-tutorial', '1'); } catch { /* ignore */ }
};
