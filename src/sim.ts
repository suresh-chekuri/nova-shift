// NOVA SHIFT: THE LAST SIGNAL — game rules.
// Pure game logic (no React). Tested with Node and used by the React store.
import { DEFAULT_DESIGN, computeStats, getMission, type Design, type Stats } from './design.ts';

export type SwitchId = 'gj1' | 'gj2' | 'bj1' | 'bj2' | 'life' | 'comms' | 'sci' | 'eng';
export type SysId = 'life' | 'comms' | 'sci' | 'eng';
export type InstrId = 'spectrometer' | 'seismic' | 'analyzer' | 'camera';
export type Phase = 'title' | 'briefing' | 'playing' | 'won' | 'lost';
export type PanelId = 'power' | 'comms' | 'science' | 'command' | 'engine' | null;
export type LogLevel = 'info' | 'warn' | 'danger' | 'good';

// ---------- Constants ----------
export const MISSION_SECONDS = 600;
export const GEN_CAPACITY = 100;
export const FLARE_FACTOR = 0.7;
export const FLARE_SECONDS = 40;
export const BATTERY_MAX_OUTPUT = 30;
export const OVERLOAD_GRACE = 3;
export const DATA_GOAL = 100;
export const ANALYZER_MIN = 30;
export const TX_RATE = 10;
export const LOCK_ERROR = 2.5;
export const LIFE_GRACE = 40;

export const SWITCH_IDS: SwitchId[] = ['gj1', 'gj2', 'bj1', 'bj2', 'life', 'comms', 'sci', 'eng'];
export const SYS_IDS: SysId[] = ['life', 'comms', 'sci', 'eng'];
export const INSTR_IDS: InstrId[] = ['spectrometer', 'seismic', 'analyzer', 'camera'];

export const SYSTEMS: Record<SysId, { name: string; load: number; junction: 'j1' | 'j2' }> = {
  life: { name: 'LIFE SUPPORT', load: 30, junction: 'j1' },
  comms: { name: 'COMMUNICATIONS', load: 25, junction: 'j1' },
  sci: { name: 'SCIENCE LAB', load: 35, junction: 'j2' },
  eng: { name: 'ENGINE SYSTEMS', load: 40, junction: 'j2' },
};

export const INSTR: Record<InstrId, { name: string; power: number; rate: number }> = {
  spectrometer: { name: 'LUNAR SPECTROMETER', power: 20, rate: 0.9 },
  seismic: { name: 'SEISMIC SENSOR', power: 15, rate: 0.7 },
  analyzer: { name: 'SIGNAL ANALYZER', power: 25, rate: 1.2 },
  camera: { name: 'HI-RES CAMERA', power: 18, rate: 0.8 },
};

export const objectiveTexts = (missionId?: string | null) => getMission(missionId).objectives;

export const OBJECTIVE_TEXT = [
  'Restore spacecraft power',
  'Restore communications',
  'Activate the Signal Analyzer',
  'Collect 100 units of science data (30+ from the Signal Analyzer)',
  'Transmit the data to Earth',
  'Finish before the timer runs out',
];

// ---------- State ----------
export interface LogEntry {
  id: number;
  t: number;
  level: LogLevel;
  text: string;
}

export interface ScoreResult {
  won: boolean;
  reason: string;
  rows: { label: string; value: number }[];
  score: number;
  grade: string;
}

export interface GameState {
  phase: Phase;
  mode: 'mission' | 'tutorial';
  design: Design;
  stats: Stats;
  elapsed: number;
  timeLeft: number;

  genState: 'offline' | 'starting' | 'online';
  genTimer: number;
  sw: Record<SwitchId, boolean>;
  surge: SysId | null;
  flare: number;
  antennaFault: boolean;
  repairing: boolean;
  repairProgress: number;

  antenna: { az: number; el: number };
  target: { az: number; el: number };
  drift: number;

  instruments: Record<InstrId, boolean>;
  data: Record<InstrId, number>;
  transmitted: number;
  transmitting: boolean;

  battery: number;
  integrity: number;

  overloadTimer: number;
  overloaded: boolean;
  overloadWarned: boolean;
  overloads: number;

  nextEventIn: number;
  eventsTriggered: number;
  eventsResolved: number;

  // derived each tick
  genOutput: number;
  supply: number;
  demand: number;
  batteryDraw: number;
  surplus: number;
  j1: boolean;
  j2: boolean;
  powered: Record<SysId, boolean>;
  running: Record<InstrId, boolean>;
  commsStrength: number;
  commsLinked: boolean;
  signalError: number;

  objectives: boolean[];
  lifeWarned: boolean;
  analyzerWarned: boolean;
  batteryWarned: boolean;
  flashAt: number;

  log: LogEntry[];
  logId: number;
  result: ScoreResult | null;
}

type Rand = () => number;

const zeroInstr = <T,>(v: T) => ({ spectrometer: v, seismic: v, analyzer: v, camera: v }) as Record<InstrId, T>;

export function createState(rand: Rand = Math.random, design: Design = DEFAULT_DESIGN, mode: 'mission' | 'tutorial' = 'mission'): GameState {
  const antenna = { az: 0, el: 45 };
  return {
    phase: 'title',
    mode,
    design: structuredClone(design),
    stats: computeStats(design),
    elapsed: 0,
    timeLeft: MISSION_SECONDS,
    genState: 'offline',
    genTimer: 0,
    sw: { gj1: false, gj2: false, bj1: false, bj2: false, life: false, comms: false, sci: false, eng: false },
    surge: null,
    flare: 0,
    antennaFault: false,
    repairing: false,
    repairProgress: 0,
    antenna,
    target: randomTarget(rand, antenna),
    drift: 0,
    instruments: zeroInstr(false),
    data: zeroInstr(0),
    transmitted: 0,
    transmitting: false,
    battery: 50,
    integrity: 100,
    overloadTimer: 0,
    overloaded: false,
    overloadWarned: false,
    overloads: 0,
    nextEventIn: 75 + rand() * 15,
    eventsTriggered: 0,
    eventsResolved: 0,
    genOutput: 0,
    supply: 0,
    demand: 0,
    batteryDraw: 0,
    surplus: 0,
    j1: false,
    j2: false,
    powered: { life: false, comms: false, sci: false, eng: false },
    running: zeroInstr(false),
    commsStrength: 0,
    commsLinked: false,
    signalError: 99,
    objectives: [false, false, false, false, false, false],
    lifeWarned: false,
    analyzerWarned: false,
    batteryWarned: false,
    flashAt: -100,
    log: [],
    logId: 0,
    result: null,
  };
}

export function cloneData<T>(s: T): T {
  const out: any = {};
  for (const k of Object.keys(s as any)) {
    const v = (s as any)[k];
    if (typeof v !== 'function') out[k] = structuredClone(v);
  }
  return out;
}

function randomTarget(rand: Rand, from: { az: number; el: number }) {
  for (let i = 0; i < 50; i++) {
    const az = Math.round(-65 + rand() * 130);
    const el = Math.round(20 + rand() * 50);
    if (Math.hypot(az - from.az, el - from.el) >= 30) return { az, el };
  }
  return { az: 50, el: 60 };
}

export function sumData(g: GameState) {
  return INSTR_IDS.reduce((a, i) => a + g.data[i], 0);
}

export function addLog(g: GameState, level: LogLevel, text: string) {
  g.logId += 1;
  g.log.push({ id: g.logId, t: g.elapsed, level, text });
  if (g.log.length > 40) g.log.splice(0, g.log.length - 40);
}

export function isEmergency(g: GameState) {
  return g.genState !== 'online' || !g.powered.life || g.overloaded || g.surge !== null;
}

// ---------- Power and signal calculation ----------
export function derive(g: GameState) {
  const genOn = g.genState === 'online';
  g.genOutput = genOn ? Math.round(g.stats.genCapacity * (g.flare > 0 ? FLARE_FACTOR : 1)) : 0;
  const genLinked = genOn && (g.sw.gj1 || g.sw.gj2);
  const batLinked = g.sw.bj1 || g.sw.bj2;
  const batAvail = batLinked && g.battery > 0;

  g.j1 = (genOn && g.sw.gj1) || (g.sw.bj1 && g.battery > 0);
  g.j2 = (genOn && g.sw.gj2) || (g.sw.bj2 && g.battery > 0);

  let demand = 0;
  for (const s of SYS_IDS) {
    const def = SYSTEMS[s];
    g.powered[s] = g.sw[s] && g[def.junction] && g.surge !== s;
    if (g.powered[s]) demand += g.stats.loads[s];
  }
  for (const i of INSTR_IDS) {
    g.running[i] = g.instruments[i] && g.powered.sci;
    if (g.running[i]) demand += g.stats.instrLoad[i];
  }
  g.demand = demand;

  const supplyGen = genLinked ? g.genOutput : 0;
  const batOut = batAvail ? g.stats.battOutput : 0;
  g.supply = supplyGen;
  g.overloaded = demand > supplyGen + batOut;
  g.batteryDraw = Math.min(Math.max(0, demand - supplyGen), batOut);
  g.surplus = Math.max(0, supplyGen - demand);

  // communications
  const err = Math.hypot(g.antenna.az - g.target.az, g.antenna.el - g.target.el);
  g.signalError = err;
  if (g.powered.comms && !g.antennaFault) {
    g.commsLinked = err <= g.stats.lockError;
    g.commsStrength = g.commsLinked ? 100 : Math.max(0, 100 - (err - g.stats.lockError) * 2.2);
  } else {
    g.commsLinked = false;
    g.commsStrength = 0;
  }
}

// ---------- Actions ----------
export function startMission(g: GameState, rand: Rand = Math.random, design: Design = DEFAULT_DESIGN, mode: 'mission' | 'tutorial' = 'mission') {
  const fresh = createState(rand, design, mode);
  Object.assign(g, fresh);
  g.phase = 'playing';
  derive(g);
  if (mode === 'tutorial') {
    addLog(g, 'info', 'TRAINING MODE. Follow the guide on screen. Nothing here can end the mission.');
  } else {
    addLog(g, 'danger', 'ORBITAL INSERTION FAILURE. Main power is down.');
    addLog(g, 'info', 'Emergency battery is online. Go to ENGINEERING (west) and restart the generator.');
  }
}

// Change the spacecraft design while playing (used by the tutorial).
export function setDesign(g: GameState, design: Design) {
  g.design = structuredClone(design);
  g.stats = computeStats(design);
  for (const i of INSTR_IDS) if (!g.stats.installed[i]) g.instruments[i] = false;
  derive(g);
}

// Used by the tutorial to teach a crisis on purpose.
export function forceEvent(g: GameState, kind: 'flare' | 'antenna' | 'surge', rand: Rand = Math.random) {
  fireEvent(g, rand, kind);
}

// Orders from the commander
export function order(g: GameState, text: string) {
  addLog(g, 'info', 'COMMANDER: ' + text);
}

export function toggleSwitch(g: GameState, id: SwitchId) {
  if (g.phase !== 'playing') return;
  if (!g.sw[id] && (id === 'life' || id === 'comms' || id === 'sci' || id === 'eng') && g.surge === id) {
    addLog(g, 'warn', SYSTEMS[id].name + ' is locked by the power surge. Reset the distribution panel first.');
    return;
  }
  g.sw[id] = !g.sw[id];
  derive(g);
}

export function restartGenerator(g: GameState) {
  if (g.phase !== 'playing' || g.genState !== 'offline') return;
  g.genState = 'starting';
  g.genTimer = 3;
  addLog(g, 'info', 'Generator ignition sequence started...');
}

export function resetDistribution(g: GameState) {
  if (g.phase !== 'playing') return;
  if (g.surge) {
    addLog(g, 'good', 'Power distribution reset. ' + SYSTEMS[g.surge].name + ' is stable again.');
    g.surge = null;
    g.eventsResolved += 1;
    g.flashAt = g.elapsed;
    derive(g);
  } else {
    addLog(g, 'info', 'Power distribution is already stable.');
  }
}

export function toggleInstrument(g: GameState, id: InstrId) {
  if (g.phase !== 'playing') return;
  if (!g.stats.installed[id]) {
    addLog(g, 'warn', INSTR[id].name + ' is not installed on this spacecraft.');
    return;
  }
  if (!g.instruments[id]) {
    if (!g.powered.sci) {
      addLog(g, 'warn', 'Science Lab has no power. Route power to it at the Power Panel.');
      return;
    }
    g.instruments[id] = true;
  } else {
    g.instruments[id] = false;
  }
  derive(g);
}

export function setAntenna(g: GameState, az: number, el: number) {
  if (g.phase !== 'playing' || g.antennaFault) return;
  g.antenna.az = Math.max(-90, Math.min(90, Math.round(az)));
  g.antenna.el = Math.max(0, Math.min(90, Math.round(el)));
  derive(g);
}

export function repairAntenna(g: GameState) {
  if (g.phase !== 'playing' || !g.antennaFault) return;
  g.repairing = true;
}

export function toggleTransmit(g: GameState) {
  if (g.phase !== 'playing') return;
  g.transmitting = !g.transmitting;
  if (g.transmitting && !g.commsLinked) {
    addLog(g, 'warn', 'No link to Earth yet. Transmission will start when the antenna is locked.');
  }
}

// ---------- Events ----------
function fireEvent(g: GameState, rand: Rand, forced?: string) {
  const options: string[] = [];
  if (g.flare <= 0) options.push('flare');
  if (!g.antennaFault) options.push('antenna');
  if (!g.surge) options.push('surge');
  if (options.length === 0) return;
  const pick = forced && options.includes(forced) ? forced : options[Math.floor(rand() * options.length)];
  g.eventsTriggered += 1;
  if (pick === 'flare') {
    g.flare = FLARE_SECONDS;
    addLog(g, 'danger', 'SOLAR FLARE! Generator output is down 30% for ' + FLARE_SECONDS + ' s. Cut load or use the battery.');
  } else if (pick === 'antenna') {
    g.antennaFault = true;
    g.repairing = false;
    g.repairProgress = 0;
    addLog(g, 'danger', 'ANTENNA MALFUNCTION! Communications are down. Go to the COMMUNICATIONS room and repair it.');
  } else {
    const powered = SYS_IDS.filter((s) => g.powered[s]);
    const list = powered.length ? powered : SYS_IDS;
    const sys = list[Math.floor(rand() * list.length)];
    g.surge = sys;
    g.sw[sys] = false;
    g.integrity = Math.max(0, g.integrity - 3 * g.stats.damageMult);
    addLog(g, 'danger', 'POWER SURGE! ' + SYSTEMS[sys].name + ' is unstable. Go to ENGINEERING and reset the power distribution.');
  }
  derive(g);
}

function tripBreakers(g: GameState) {
  for (const s of SYS_IDS) g.sw[s] = false;
  for (const i of INSTR_IDS) g.instruments[i] = false;
  g.integrity = Math.max(0, g.integrity - 8 * g.stats.damageMult);
  g.overloads += 1;
  g.overloadTimer = 0;
  g.overloadWarned = false;
  addLog(g, 'danger', 'BREAKERS TRIPPED! All systems shut down. Hull damage taken. Route power again with a smaller load.');
  derive(g);
}

// ---------- Main time step ----------
export function tick(g: GameState, dt: number, rand: Rand = Math.random, ctx: { commsOpen: boolean } = { commsOpen: true }) {
  if (g.phase !== 'playing') return;
  const training = g.mode === 'tutorial';
  g.elapsed += dt;
  if (!training) g.timeLeft -= dt;

  if (g.genState === 'starting') {
    g.genTimer -= dt;
    if (g.genTimer <= 0) {
      g.genState = 'online';
      g.flashAt = g.elapsed;
      addLog(g, 'good', 'Main generator is ONLINE (' + g.stats.genCapacity + ' power units). Now route power at the Power Panel.');
    }
  }

  if (g.flare > 0) {
    g.flare -= dt;
    if (g.flare <= 0) {
      g.flare = 0;
      g.eventsResolved += 1;
      addLog(g, 'good', 'Solar flare has passed. Generator output is back to normal.');
    }
  }

  if (g.repairing && g.antennaFault && ctx.commsOpen) {
    g.repairProgress += dt / 4;
    if (g.repairProgress >= 1) {
      g.antennaFault = false;
      g.repairing = false;
      g.repairProgress = 0;
      g.antenna = { az: 0, el: 45 };
      g.target = randomTarget(rand, g.antenna);
      g.eventsResolved += 1;
      addLog(g, 'good', 'Antenna actuator repaired. Align the antenna again to find Earth.');
    }
  }

  // Engine stabilizers keep the orbit steady. Without them the target drifts.
  if (!g.powered.eng) {
    g.target.az = Math.min(90, g.target.az + 0.06 * g.stats.driftMult * dt);
    g.drift += 0.06 * g.stats.driftMult * dt;
  }

  derive(g);

  // overload handling
  if (g.overloaded) {
    if (!g.overloadWarned) {
      g.overloadWarned = true;
      addLog(g, 'danger', 'POWER OVERLOAD! Turn something off within ' + OVERLOAD_GRACE + ' seconds.');
    }
    g.overloadTimer += dt;
    if (g.overloadTimer >= OVERLOAD_GRACE) tripBreakers(g);
  } else {
    g.overloadTimer = Math.max(0, g.overloadTimer - dt * 2);
    g.overloadWarned = false;
  }

  // battery
  const before = g.battery;
  if (g.batteryDraw > 0) {
    g.battery -= g.batteryDraw * 0.04 * (100 / Math.max(20, g.stats.battCapacity)) * dt;
  } else if ((g.sw.bj1 || g.sw.bj2) && g.surplus > 0 && g.battery < 100) {
    g.battery += Math.min(g.surplus, 20) * 0.06 * dt;
  }
  g.battery = Math.max(0, Math.min(100, g.battery));
  if (before > 0 && g.battery <= 0) {
    addLog(g, 'warn', 'Battery is empty. Systems that depended on it have lost power.');
  }

  // life support and hull
  if (!g.powered.life && g.elapsed > LIFE_GRACE) {
    g.integrity -= 0.25 * g.stats.damageMult * dt;
    if (!g.lifeWarned) {
      g.lifeWarned = true;
      addLog(g, 'danger', 'Life support is offline! Hull integrity is dropping.');
    }
  } else if (g.powered.life) {
    g.lifeWarned = false;
  }
  g.integrity = Math.max(0, g.integrity);

  // science
  for (const i of INSTR_IDS) {
    if (g.running[i]) g.data[i] += g.stats.instrRate[i] * dt;
  }

  // transmission
  if (g.transmitting && g.commsLinked) {
    const room = sumData(g) - g.transmitted;
    if (room > 0) g.transmitted += Math.min(room, g.stats.txRate * dt);
  }

  updateObjectives(g);

  // events
  if (!training) g.nextEventIn -= dt;
  if (!training && g.nextEventIn <= 0) {
    const active = (g.flare > 0 ? 1 : 0) + (g.surge ? 1 : 0) + (g.antennaFault ? 1 : 0);
    if (active >= 2 || g.timeLeft < 45) {
      g.nextEventIn = 15;
    } else {
      fireEvent(g, rand);
      g.nextEventIn = 55 + rand() * 35;
    }
  }

  // end conditions (training never ends)
  if (training) {
    g.integrity = Math.max(g.integrity, 30);
  } else if (g.objectives[4]) {
    finish(g, true, 'All data was received by Earth. The signal is real.');
  } else if (g.integrity <= 0) {
    finish(g, false, 'The spacecraft hull failed. Integrity reached 0%.');
  } else if (g.timeLeft <= 0) {
    g.timeLeft = 0;
    finish(g, false, 'The mission timer ran out.');
  }
}

function mark(g: GameState, i: number, text: string) {
  if (!g.objectives[i]) {
    g.objectives[i] = true;
    addLog(g, 'good', 'OBJECTIVE COMPLETE: ' + text);
    g.flashAt = g.elapsed;
  }
}

function updateObjectives(g: GameState) {
  const m = getMission(g.design.mission);
  const req = m.required as InstrId[];
  if (g.genState === 'online' && g.powered.life) mark(g, 0, 'Spacecraft power restored');
  if (g.commsLinked) mark(g, 1, 'Communications restored');
  const started = req.length ? req.every((i) => g.running[i] || g.data[i] > 0) : INSTR_IDS.some((i) => g.running[i] || g.data[i] > 0);
  if (started) mark(g, 2, m.keyName + ' running');
  const keyOk = req.every((i) => g.data[i] >= m.keyData);
  if (sumData(g) >= DATA_GOAL && keyOk) mark(g, 3, 'Science data goal reached');
  if (g.objectives[3] && g.transmitted >= DATA_GOAL - 0.001) mark(g, 4, 'Data transmitted to Earth');
  if (g.transmitted >= DATA_GOAL - 0.001 && !g.objectives[3] && !g.analyzerWarned) {
    g.analyzerWarned = true;
    addLog(g, 'warn', 'Earth needs at least ' + m.keyData + ' units from: ' + m.keyName + '. Keep it running.');
  }
}

export function finish(g: GameState, won: boolean, reason: string) {
  if (g.phase !== 'playing') return;
  g.phase = won ? 'won' : 'lost';
  g.transmitting = false;
  if (won) g.objectives[5] = true;
  const done = g.objectives.filter(Boolean).length;
  const total = sumData(g);
  const rows = [
    { label: 'Objectives completed (' + done + '/6)', value: done * 300 },
    { label: 'Mission success bonus', value: won ? 1500 : 0 },
    { label: 'Time remaining (' + Math.floor(Math.max(0, g.timeLeft)) + ' s)', value: won ? Math.floor(Math.max(0, g.timeLeft)) * 4 : 0 },
    { label: 'Science data collected (' + Math.floor(total) + ')', value: Math.floor(INSTR_IDS.reduce((a, i) => a + g.data[i] * (g.stats.instrValue[i] / 3), 0)) * 8 },
    g.design.mission === 'relay'
      ? { label: 'Relay data rate (' + g.stats.txRate + ' units/s)', value: won ? Math.floor(g.stats.txRate * 60) : 0 }
      : { label: 'Key instrument data (' + Math.floor((getMission(g.design.mission).required as InstrId[]).reduce((a, i) => a + g.data[i], 0)) + ')', value: Math.floor((getMission(g.design.mission).required as InstrId[]).reduce((a, i) => a + g.data[i], 0)) * 6 },
    { label: 'Budget saved ($' + Math.max(0, g.stats.budget - g.stats.cost) + 'M)', value: won ? Math.max(0, g.stats.budget - g.stats.cost) * 3 : 0 },
    { label: 'Hull integrity (' + Math.floor(g.integrity) + '%)', value: won ? Math.floor(g.integrity) * 12 : 0 },
    { label: 'Crises handled (' + g.eventsResolved + '/' + g.eventsTriggered + ')', value: g.eventsResolved * 200 },
    { label: 'Power overloads (' + g.overloads + ')', value: -g.overloads * 250 },
  ];
  const score = Math.max(0, rows.reduce((a, r) => a + r.value, 0));
  let grade = 'F';
  if (won) grade = score >= 8000 ? 'S' : score >= 6500 ? 'A' : score >= 5000 ? 'B' : score >= 3500 ? 'C' : 'D';
  g.result = { won, reason, rows, score, grade };
  addLog(g, won ? 'good' : 'danger', won ? 'MISSION COMPLETE' : 'MISSION FAILED');
}

// ---------- Guidance for the player ----------
export function nextGoal(g: GameState): { text: string; target: string | null } {
  if (g.surge) return { text: 'Power surge! Go to ENGINEERING and press RESET DISTRIBUTION.', target: 'power' };
  if (g.antennaFault) return { text: 'Antenna broken! Go to COMMUNICATIONS and repair it.', target: 'comms' };
  if (!g.objectives[0]) {
    if (g.genState !== 'online') return { text: 'Go to ENGINEERING (west). Restart the generator.', target: 'power' };
    return { text: 'At the Power Panel, route power to LIFE SUPPORT.', target: 'power' };
  }
  if (!g.objectives[1]) {
    if (!g.powered.comms) return { text: 'At the Power Panel, route power to COMMUNICATIONS.', target: 'power' };
    return { text: 'Go to COMMUNICATIONS (north). Align the antenna.', target: 'comms' };
  }
  if (!g.objectives[2]) {
    if (!g.powered.sci) return { text: 'At the Power Panel, route power to the SCIENCE LAB.', target: 'power' };
    const m = getMission(g.design.mission);
    const todo = (m.required as InstrId[]).find((i) => !g.running[i] && g.data[i] <= 0) ?? INSTR_IDS.find((i) => g.stats.installed[i]) ?? 'analyzer';
    return { text: 'Go to the SCIENCE LAB (east). Start the ' + INSTR[todo].name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) + '.', target: todo };
  }
  if (!g.objectives[3]) {
    if (!g.powered.sci) return { text: 'The Science Lab lost power. Route it again.', target: 'power' };
    return { text: 'Keep instruments running to collect data. Watch your power.', target: 'sciconsole' };
  }
  if (!g.objectives[4]) {
    if (!g.powered.comms) return { text: 'Route power to COMMUNICATIONS to send the data.', target: 'power' };
    return { text: 'Go to COMMUNICATIONS. Keep the link locked and press TRANSMIT.', target: 'comms' };
  }
  return { text: 'Mission complete.', target: null };
}
