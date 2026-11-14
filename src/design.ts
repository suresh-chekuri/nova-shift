// Spacecraft design: part catalog, stats, and launch checks. No imports (testable with Node).

export type Cat = 'structure' | 'power' | 'propulsion' | 'comms' | 'battery' | 'payload';
export type InstrKey = 'spectrometer' | 'seismic' | 'analyzer' | 'camera';

export interface Part {
  id: string;
  name: string;
  desc: string;
  mass: number; // kg
  cost: number; // million $
  // optional numbers per category
  durability?: number;
  gen?: number; // power units made
  span?: number; // solar wing size (visual + dimension)
  load?: number; // power units used
  drift?: number; // orbit drift multiplier (lower = more stable)
  fuelUse?: number; // fuel burn rating (lower = better)
  lifetime?: number; // minutes
  tx?: number; // data units per second
  lock?: number; // antenna lock tolerance in degrees (bigger = easier)
  range?: number;
  capacity?: number; // battery energy
  out?: number; // battery max output (power units)
  rate?: number; // data per second
  value?: number; // science value
}

export const LAUNCH_CAPACITY = 800; // kg
export const BUDGET = 400; // million $
export const MAX_PAYLOAD = 3;
export const REQ_TX = 2; // units/s the mission needs
export const REQ_LIFETIME = 12; // minutes
export const REQ_SCIENCE = 8; // total science value

// ---------- Missions ----------
export type MissionId = 'echo' | 'survey' | 'relay';
export interface Mission {
  id: MissionId;
  name: string;
  tagline: string;
  objective: string;
  capacity: number; // launch vehicle capacity, kg
  budget: number; // $M
  required: InstrKey[]; // instruments that MUST be installed
  commsAnyOf?: string[]; // comms part must be one of these
  powerAnyOf?: string[]; // power part must be one of these
  minPayload: number; // at least this many instruments
  reqTx: number;
  reqScience: number;
  reqLifetime: number;
  keyData: number; // data units needed from EACH required instrument
  keyName: string; // how the game calls the key instrument(s)
  objectives: string[]; // 6 mission objectives
  scoring: string[]; // what the score rewards
}

export const MISSIONS: Record<MissionId, Mission> = {
  echo: {
    id: 'echo', name: 'LUNAR ECHO', tagline: 'The Last Signal',
    objective: 'Investigate a mysterious signal beneath the lunar surface.',
    capacity: 800, budget: 400, required: ['analyzer'], minPayload: 1, reqTx: REQ_TX, reqScience: REQ_SCIENCE, reqLifetime: REQ_LIFETIME,
    keyData: 30, keyName: 'Signal Analyzer',
    objectives: [
      'Restore spacecraft power', 'Restore communications', 'Activate the Signal Analyzer',
      'Collect 100 units of science data (30+ from the Signal Analyzer)', 'Transmit the data to Earth', 'Finish before the timer runs out',
    ],
    scoring: ['Signal Analyzer data', 'Total science value', 'Budget saved', 'Hull integrity'],
  },
  survey: {
    id: 'survey', name: 'LUNAR SURVEY', tagline: 'Rocks and Moonquakes',
    objective: 'Collect geological data about the Moon and send it home.',
    capacity: 750, budget: 350, required: ['spectrometer', 'seismic'], minPayload: 2, reqTx: REQ_TX, reqScience: 5, reqLifetime: REQ_LIFETIME,
    keyData: 15, keyName: 'Spectrometer and Seismic Sensor',
    objectives: [
      'Restore spacecraft power', 'Restore communications', 'Activate the Spectrometer and the Seismic Sensor',
      'Collect 100 units of science data (15+ from each of the two instruments)', 'Transmit the data to Earth', 'Finish before the timer runs out',
    ],
    scoring: ['Spectrometer and Seismic data', 'Total science value', 'Budget saved (smaller budget!)', 'Hull integrity'],
  },
  relay: {
    id: 'relay', name: 'DEEP SPACE RELAY', tagline: 'Link to the Dark',
    objective: 'Set up a deep-space communications relay and push test data through it.',
    capacity: 850, budget: 480, required: [], commsAnyOf: ['deep'], powerAnyOf: ['advanced', 'highcap'], minPayload: 1, reqTx: 6, reqScience: 0, reqLifetime: REQ_LIFETIME,
    keyData: 0, keyName: 'any instrument (it makes the test data)',
    objectives: [
      'Restore spacecraft power', 'Restore communications', 'Start an instrument to make relay test data',
      'Collect 100 units of test data', 'Transmit the data to Earth through the relay', 'Finish before the timer runs out',
    ],
    scoring: ['Relay data rate', 'Budget saved', 'Hull integrity', 'Crises handled'],
  },
};
export const MISSION_IDS: MissionId[] = ['echo', 'survey', 'relay'];
export const getMission = (id?: string | null): Mission => MISSIONS[(id as MissionId) ?? 'echo'] ?? MISSIONS.echo;

export const CATALOG: Record<Cat, Part[]> = {
  structure: [
    { id: 'light', name: 'Lightweight Frame', desc: 'Thin and cheap. Breaks easily when things go wrong.', mass: 120, cost: 40, durability: 70 },
    { id: 'standard', name: 'Standard Frame', desc: 'A balanced frame for most missions.', mass: 200, cost: 60, durability: 100 },
    { id: 'reinforced', name: 'Reinforced Frame', desc: 'Very strong, but heavy and costly.', mass: 320, cost: 95, durability: 150 },
  ],
  power: [
    { id: 'compact', name: 'Compact Solar Array', desc: 'Small panels. Light, but makes less power.', mass: 60, cost: 40, gen: 80, span: 1.0 },
    { id: 'advanced', name: 'Advanced Solar Array', desc: 'Larger panels with better cells.', mass: 110, cost: 75, gen: 100, span: 1.4 },
    { id: 'highcap', name: 'High-Capacity Power System', desc: 'Huge wings. Lots of power, lots of mass.', mass: 180, cost: 120, gen: 135, span: 1.9 },
  ],
  propulsion: [
    { id: 'chemical', name: 'Chemical Engine', desc: 'Strong and simple. Burns a lot of fuel.', mass: 150, cost: 45, load: 40, drift: 1.0, fuelUse: 100, lifetime: 14 },
    { id: 'ion', name: 'Efficient Ion Engine', desc: 'Very fuel efficient and stable. Costs more.', mass: 110, cost: 85, load: 30, drift: 0.7, fuelUse: 35, lifetime: 40 },
    { id: 'advprop', name: 'Advanced Propulsion System', desc: 'Best control of the orbit. Heavy and expensive.', mass: 190, cost: 130, load: 36, drift: 0.4, fuelUse: 55, lifetime: 28 },
  ],
  comms: [
    { id: 'basic', name: 'Basic Antenna', desc: 'Small dish. Low power use, but hard to aim and slow.', mass: 25, cost: 20, load: 15, tx: 2.5, lock: 1.8, range: 60 },
    { id: 'highgain', name: 'High-Gain Antenna', desc: 'Focused beam. Good speed and easier to lock.', mass: 45, cost: 45, load: 25, tx: 4, lock: 2.5, range: 120 },
    { id: 'deep', name: 'Deep Space Communication Array', desc: 'Large array. Fast data, very easy to lock, but heavy.', mass: 90, cost: 90, load: 35, tx: 6.5, lock: 3.5, range: 240 },
  ],
  battery: [
    { id: 'compact', name: 'Compact Battery', desc: 'Small reserve. Cheap and light.', mass: 30, cost: 15, capacity: 60, out: 20 },
    { id: 'standard', name: 'Standard Battery', desc: 'A solid reserve for emergencies.', mass: 60, cost: 30, capacity: 100, out: 30 },
    { id: 'advanced', name: 'Advanced Battery', desc: 'Big reserve and strong output. Helps in solar flares.', mass: 110, cost: 60, capacity: 160, out: 40 },
  ],
  payload: [
    { id: 'spectrometer', name: 'Lunar Spectrometer', desc: 'Reads minerals on the Moon.', mass: 40, cost: 35, load: 20, rate: 0.9, value: 3 },
    { id: 'seismic', name: 'Seismic Sensor', desc: 'Feels moonquakes.', mass: 30, cost: 25, load: 15, rate: 0.7, value: 2 },
    { id: 'analyzer', name: 'Signal Analyzer', desc: 'Studies the mystery signal. Required for the mission.', mass: 55, cost: 60, load: 25, rate: 1.2, value: 5 },
    { id: 'camera', name: 'High-Resolution Camera', desc: 'Takes detailed pictures of the surface.', mass: 45, cost: 50, load: 18, rate: 0.8, value: 4 },
  ],
};

export const CAT_LABEL: Record<Cat, string> = {
  structure: 'STRUCTURE',
  power: 'POWER SYSTEM',
  propulsion: 'PROPULSION',
  comms: 'COMMUNICATIONS',
  battery: 'BATTERY',
  payload: 'SCIENCE PAYLOAD',
};

export interface Design {
  structure: string | null;
  power: string | null;
  propulsion: string | null;
  comms: string | null;
  battery: string | null;
  payload: string[]; // payload[i] sits on hardpoint PAYLOAD i+1
  mission?: MissionId;
}

export const DEFAULT_DESIGN: Design = {
  structure: 'standard',
  power: 'advanced',
  propulsion: 'chemical',
  comms: 'highgain',
  battery: 'standard',
  payload: ['spectrometer', 'seismic', 'analyzer'],
  mission: 'echo',
};

export function part(cat: Cat, id: string | null | undefined): Part | null {
  if (!id) return null;
  return CATALOG[cat].find((p) => p.id === id) ?? null;
}

export const INSTR_KEYS: InstrKey[] = ['spectrometer', 'seismic', 'analyzer', 'camera'];

export interface Stats {
  mass: number;
  cost: number;
  budget: number;
  launchCapacity: number;
  massRatio: number;
  genCapacity: number;
  battCapacity: number;
  battOutput: number;
  loads: { life: number; comms: number; sci: number; eng: number };
  instrLoad: Record<InstrKey, number>;
  instrRate: Record<InstrKey, number>;
  instrValue: Record<InstrKey, number>;
  installed: Record<InstrKey, boolean>;
  lockError: number;
  txRate: number;
  commRange: number;
  driftMult: number;
  damageMult: number;
  fuelUse: number;
  lifetime: number;
  scienceValue: number;
  durability: number;
  span: number;
}

export function computeStats(d: Design): Stats {
  const st = part('structure', d.structure);
  const pw = part('power', d.power);
  const pr = part('propulsion', d.propulsion);
  const cm = part('comms', d.comms);
  const bt = part('battery', d.battery);
  const pls = d.payload.map((id) => part('payload', id)).filter(Boolean) as Part[];
  const all = [st, pw, pr, cm, bt, ...pls].filter(Boolean) as Part[];
  const mass = all.reduce((a, p) => a + p.mass, 0);
  const cost = all.reduce((a, p) => a + p.cost, 0);
  const m = getMission(d.mission);
  const massRatio = mass / m.capacity;
  const installed = { spectrometer: false, seismic: false, analyzer: false, camera: false } as Record<InstrKey, boolean>;
  const instrLoad = { spectrometer: 0, seismic: 0, analyzer: 0, camera: 0 } as Record<InstrKey, number>;
  const instrRate = { ...instrLoad };
  const instrValue = { ...instrLoad };
  for (const p of pls) {
    const k = p.id as InstrKey;
    installed[k] = true;
    instrLoad[k] = p.load ?? 0;
    instrRate[k] = p.rate ?? 0;
    instrValue[k] = p.value ?? 0;
  }
  const heavyPenalty = 1 + Math.max(0, massRatio - 0.8) * 3; // a heavy ship is harder to hold steady
  const durability = st?.durability ?? 40;
  return {
    mass,
    cost,
    budget: m.budget,
    launchCapacity: m.capacity,
    massRatio,
    genCapacity: pw?.gen ?? 0,
    battCapacity: bt?.capacity ?? 0,
    battOutput: bt?.out ?? 0,
    loads: { life: 30, comms: cm?.load ?? 0, sci: 35, eng: pr?.load ?? 0 },
    instrLoad,
    instrRate,
    instrValue,
    installed,
    lockError: cm?.lock ?? 1,
    txRate: cm?.tx ?? 0,
    commRange: cm?.range ?? 0,
    driftMult: (pr?.drift ?? 1.6) * heavyPenalty,
    damageMult: 100 / durability,
    fuelUse: pr?.fuelUse ?? 100,
    lifetime: Math.round((pr?.lifetime ?? 5) * (1.15 - massRatio * 0.3) * 10) / 10,
    scienceValue: pls.reduce((a, p) => a + (p.value ?? 0), 0),
    durability,
    span: pw?.span ?? 0.6,
  };
}

export interface Check { id: string; label: string; ok: boolean; detail: string; fix: string; cats: Cat[] }

const SLOT_CATS: Cat[] = ['structure', 'power', 'propulsion', 'comms', 'battery'];

export function validate(d: Design): Check[] {
  const s = computeStats(d);
  const m = getMission(d.mission);
  const essential = s.loads.life + s.loads.comms + s.loads.eng;
  const reqLoad = m.required.length ? m.required.reduce((a, k) => a + s.instrLoad[k], 0) : Math.min(...INSTR_KEYS.filter((k) => s.installed[k]).map((k) => s.instrLoad[k]), 99);
  const science = s.loads.life + s.loads.comms + s.loads.sci + (reqLoad === 99 ? 0 : reqLoad);
  const missing: string[] = [];
  const missingCats: Cat[] = [];
  const names: Record<string, string> = { structure: 'Structure', power: 'Power System', propulsion: 'Propulsion', comms: 'Communications', battery: 'Battery' };
  for (const c of SLOT_CATS) if (!(d as any)[c]) { missing.push(names[c]); missingCats.push(c); }

  // mission requirements
  const need: string[] = [];
  const needCats: Cat[] = [];
  for (const k of m.required) if (!d.payload.includes(k)) { need.push(part('payload', k)!.name); needCats.push('payload'); }
  if (m.commsAnyOf && !m.commsAnyOf.includes(d.comms ?? '')) { need.push(m.commsAnyOf.map((id) => part('comms', id)!.name).join(' or ')); needCats.push('comms'); }
  if (m.powerAnyOf && !m.powerAnyOf.includes(d.power ?? '')) { need.push(m.powerAnyOf.map((id) => part('power', id)!.name).join(' or ')); needCats.push('power'); }
  if (d.payload.length < m.minPayload) { need.push(`at least ${m.minPayload} instrument${m.minPayload > 1 ? 's' : ''}`); needCats.push('payload'); }

  // which part is the heaviest / most expensive (to point the player at it)
  const parts: [Cat, Part | null][] = [['structure', part('structure', d.structure)], ['power', part('power', d.power)], ['propulsion', part('propulsion', d.propulsion)], ['comms', part('comms', d.comms)], ['battery', part('battery', d.battery)]];
  if (d.payload.length) parts.push(['payload', { id: 'pl', name: 'payload', desc: '', mass: d.payload.reduce((a, id) => a + (part('payload', id)?.mass ?? 0), 0), cost: d.payload.reduce((a, id) => a + (part('payload', id)?.cost ?? 0), 0) }]);
  const top = (key: 'mass' | 'cost'): Cat[] => {
    const sorted = parts.filter((p) => p[1]).sort((a, b) => (b[1]![key] as number) - (a[1]![key] as number));
    return sorted.slice(0, 2).map((p) => p[0]);
  };

  return [
    {
      id: 'parts', label: 'Required systems', cats: missingCats,
      ok: missing.length === 0,
      detail: missing.length ? 'Missing: ' + missing.join(', ') : 'Structure, power, propulsion, comms and battery are installed.',
      fix: 'Select a part for each missing system, then press ATTACH.',
    },
    {
      id: 'mission', label: m.name + ' needs', cats: needCats,
      ok: need.length === 0,
      detail: need.length ? 'Missing: ' + need.join('; ') : 'All parts this mission needs are installed.',
      fix: 'Install: ' + need.join('; ') + '.',
    },
    {
      id: 'mass', label: 'Launch mass', cats: top('mass'),
      ok: s.mass <= s.launchCapacity,
      detail: `${s.mass} kg of ${s.launchCapacity} kg`,
      fix: `Remove ${s.mass - s.launchCapacity} kg. Choose lighter parts (the highlighted parts are the heaviest).`,
    },
    {
      id: 'cost', label: 'Budget', cats: top('cost'),
      ok: s.cost <= s.budget,
      detail: `$${s.cost}M of $${s.budget}M`,
      fix: `Cut $${s.cost - s.budget}M. Choose cheaper parts or remove an instrument (highlighted parts cost the most).`,
    },
    {
      id: 'power', label: 'Essential power', cats: ['power', 'propulsion', 'comms'],
      ok: essential <= s.genCapacity,
      detail: `Life support + comms + engine need ${essential} PU. Power system makes ${s.genCapacity} PU.`,
      fix: 'Choose a stronger power system, or a lower-power engine or antenna.',
    },
    {
      id: 'science', label: 'Science operations', cats: ['power', 'battery', 'comms'],
      ok: science <= s.genCapacity + s.battOutput,
      detail: `Running the key instrument${m.required.length > 1 ? 's' : ''} needs ${science} PU. Power + battery give ${s.genCapacity + s.battOutput} PU.`,
      fix: 'Add more power or a stronger battery, or use a lower-power antenna.',
    },
    {
      id: 'payload', label: 'Science payload', cats: ['payload'],
      ok: s.scienceValue >= m.reqScience,
      detail: `Science value ${s.scienceValue} (need ${m.reqScience}).`,
      fix: 'Add instruments (up to ' + MAX_PAYLOAD + ') until the science value is high enough.',
    },
    {
      id: 'comms', label: 'Data capacity', cats: ['comms'],
      ok: s.txRate >= m.reqTx,
      detail: `${s.txRate} units/s (need ${m.reqTx}).`,
      fix: m.reqTx > 4 ? 'Install the Deep Space Communication Array.' : 'Install a better antenna.',
    },
    {
      id: 'life', label: 'Mission lifetime', cats: ['propulsion', 'structure'],
      ok: s.lifetime >= m.reqLifetime,
      detail: `${s.lifetime} min (need ${m.reqLifetime}).`,
      fix: 'Choose a more efficient engine or reduce the mass.',
    },
  ];
}

export function isValid(d: Design) {
  return validate(d).every((c) => c.ok);
}

export function loadDesign(): Design {
  try {
    const raw = localStorage.getItem('nova-design');
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.payload)) return { ...DEFAULT_DESIGN, ...d };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_DESIGN, payload: [...DEFAULT_DESIGN.payload] };
}
export function saveDesign(d: Design) {
  try { localStorage.setItem('nova-design', JSON.stringify(d)); } catch { /* ignore */ }
}

// ---------- Saved designs (named slots, kept on this computer only) ----------
export interface SavedDesign { name: string; at: number; design: Design }
export function listSaves(): SavedDesign[] {
  try {
    const raw = JSON.parse(localStorage.getItem('nova-saves') || '[]');
    return Array.isArray(raw) ? raw.filter((x) => x && x.design && Array.isArray(x.design.payload)) : [];
  } catch { return []; }
}
export function writeSaves(list: SavedDesign[]) {
  try { localStorage.setItem('nova-saves', JSON.stringify(list.slice(0, 8))); } catch { /* ignore */ }
}
