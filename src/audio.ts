// =====================================================================
// NOVA SHIFT audio engine (V3)
// One place for ALL sound. Everything is made with the Web Audio API,
// so no sound files are needed and nothing has to be downloaded.
//
//   sources --> [master] --> compressor --> speakers
//   buses:   ambient | sfx | music   (each has its own volume)
//
// What it does:
//   * ambient layers (ship hum, vents, one extra layer per room) that
//     cross-fade smoothly when the player walks between rooms
//   * 3D sound (panning + distance + muffling through walls)
//   * sim-linked sounds (power, comms, equipment, alarms) in syncSim()
//   * cooldowns, so nothing repeats every frame or becomes noise
//   * menu / shipyard / in-game music pad
// =====================================================================
import { isEmergency } from './sim';
import type { GameState } from './sim';
import { INTERACTABLES, roomAt } from './world/layout';

export interface Levels { master: number; ambient: number; sfx: number; music: number; muted: boolean }
const lv: Levels = { master: 0.7, ambient: 0.7, sfx: 0.8, music: 0.5, muted: false };

type BusName = 'sfx' | 'ambient' | 'music';
interface Mix { master: GainNode; amb: GainNode; sfx: GainNode; mus: GainNode; ambDuck: GainNode }
export interface Spot { x: number; z: number }

let ctx: AudioContext | null = null;
let mix: Mix | null = null;
let white: AudioBuffer | null = null;
let brown: AudioBuffer | null = null;
let listenerRoom = '';

// ------------------------------------------------------------ levels
export function startAmbientSafe() { try { startAmbient(); } catch { /* audio is optional */ } }
const curve = (v: number) => v * v; // volume sliders feel more natural with a curve
function applyLevels() {
  if (!ctx || !mix) return;
  const t = ctx.currentTime;
  mix.master.gain.setTargetAtTime(lv.muted ? 0 : curve(lv.master), t, 0.04);
  mix.amb.gain.setTargetAtTime(curve(lv.ambient), t, 0.05);
  mix.sfx.gain.setTargetAtTime(curve(lv.sfx), t, 0.05);
  mix.mus.gain.setTargetAtTime(curve(lv.music), t, 0.05);
}
export function setLevels(p: Partial<Levels>) {
  Object.assign(lv, p);
  applyLevels();
}
export function setVolume(v: number) { setLevels({ master: Math.max(0, Math.min(1, v)) }); }

// ------------------------------------------------------------ context
function ac(): AudioContext | null {
  if (!ctx) {
    try {
      const C = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new C();
      build(ctx);
    } catch {
      ctx = null;
      mix = null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function makeNoise(c: AudioContext, kind: 'white' | 'brown') {
  const len = c.sampleRate * 3;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  }
  return buf;
}

function build(c: AudioContext) {
  const master = c.createGain();
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
  master.connect(comp).connect(c.destination);
  const amb = c.createGain(); const ambDuck = c.createGain(); const sfxG = c.createGain(); const mus = c.createGain();
  amb.connect(ambDuck).connect(master); sfxG.connect(master); mus.connect(master);
  mix = { master, amb, sfx: sfxG, mus, ambDuck };
  white = makeNoise(c, 'white');
  brown = makeNoise(c, 'brown');
  applyLevels();
}

// ------------------------------------------------------------ helpers
const lastT: Record<string, number> = {};
/** Cooldown: returns true at most once every `ms` milliseconds per key. */
function ready(key: string, ms: number) {
  const n = performance.now();
  if (n - (lastT[key] ?? -1e9) < ms) return false;
  lastT[key] = n;
  return true;
}

function busNode(bus: BusName): AudioNode | null {
  if (!mix) return null;
  return bus === 'sfx' ? mix.sfx : bus === 'ambient' ? mix.amb : mix.mus;
}

/** Output for a sound. With `at`, the sound is placed in 3D (and muffled if it is in another room). */
function out(bus: BusName, at?: Spot): AudioNode | null {
  const dest = busNode(bus);
  if (!dest || !ctx) return null;
  if (!at) return dest;
  const p = ctx.createPanner();
  p.panningModel = 'equalpower';
  p.distanceModel = 'inverse';
  p.refDistance = 3; p.rolloffFactor = 1.15; p.maxDistance = 70;
  if (p.positionX) { p.positionX.value = at.x; p.positionY.value = 1.4; p.positionZ.value = at.z; }
  else (p as any).setPosition(at.x, 1.4, at.z);
  let tail: AudioNode = p;
  if (listenerRoom && roomAt(at.x, at.z) !== listenerRoom) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0.6;
    p.connect(lp).connect(g).connect(dest);
    return p;
  }
  tail.connect(dest);
  return p;
}

interface ToneOpt { type?: OscillatorType; vol?: number; delay?: number; bus?: BusName; at?: Spot; slide?: number; attack?: number; lp?: number }
function tone(freq: number, dur: number, o: ToneOpt = {}) {
  const c = ac();
  if (!c || !mix) return;
  const dest = out(o.bus ?? 'sfx', o.at);
  if (!dest) return;
  const t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(10, o.slide), t + dur);
  const v = Math.max(0.0002, o.vol ?? 0.05);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + (o.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = osc;
  if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
  node.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

interface NoiseOpt { kind?: 'white' | 'brown'; filter?: BiquadFilterType; f?: number; f2?: number; q?: number; vol?: number; delay?: number; bus?: BusName; at?: Spot; attack?: number }
function noiseBurst(dur: number, o: NoiseOpt = {}) {
  const c = ac();
  if (!c || !mix) return;
  const dest = out(o.bus ?? 'sfx', o.at);
  if (!dest) return;
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = o.kind === 'brown' ? brown : white;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = o.filter ?? 'bandpass';
  f.frequency.setValueAtTime(o.f ?? 2000, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  f.Q.value = o.q ?? 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol ?? 0.05), t + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 2);
  src.stop(t + dur + 0.05);
}

/** Radio static: noise whose loudness jumps around. */
function staticBurst(dur = 0.6, vol = 0.05, at?: Spot) {
  const c = ac();
  if (!c || !mix) return;
  const dest = out('sfx', at);
  if (!dest) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = white; src.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 0.7;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  for (let k = 0; k < dur; k += 0.035) g.gain.setValueAtTime(vol * (0.25 + Math.random() * 0.75), t + k);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(dest);
  src.start(t, Math.random() * 2);
  src.stop(t + dur + 0.05);
}

// ------------------------------------------------------------ places (for 3D sound)
const spotOf = (id: string): Spot => { const i = INTERACTABLES.find((x) => x.id === id)!; return { x: i.x, z: i.z }; };
const SPOT = {
  comms: spotOf('comms'), dish: spotOf('dish'), power: spotOf('power'), engine: spotOf('engine'),
  spectrometer: spotOf('spectrometer'), seismic: spotOf('seismic'), analyzer: spotOf('analyzer'), camera: spotOf('camera'),
  generator: { x: -27, z: -2.8 }, battery: { x: -27, z: 3.2 }, airlock: { x: -25.5, z: 9 },
};

// ------------------------------------------------------------ sound effects
export const sfx = {
  // ---- user interface
  click() {
    if (!ready('click', 30)) return;
    tone(1250, 0.04, { type: 'square', vol: 0.022 });
    noiseBurst(0.02, { filter: 'highpass', f: 5000, vol: 0.02 });
  },
  hover() {
    if (!ready('hover', 60)) return;
    tone(1700, 0.025, { vol: 0.01 });
  },
  screen() {
    if (!ready('screen', 250)) return;
    noiseBurst(0.35, { filter: 'bandpass', f: 400, f2: 2200, q: 1.2, vol: 0.03, attack: 0.12 });
    tone(330, 0.2, { type: 'triangle', vol: 0.025, slide: 495 });
  },
  attach() {
    if (!ready('attach', 80)) return;
    noiseBurst(0.07, { f: 1800, q: 2, vol: 0.06 });
    tone(220, 0.1, { type: 'square', vol: 0.035, lp: 1200 });
    tone(440, 0.07, { type: 'triangle', vol: 0.03, delay: 0.04 });
  },
  launch() {
    if (!ready('launch', 1500)) return;
    [200, 300, 450, 700].forEach((f, i) => tone(f, 0.25, { type: 'sawtooth', vol: 0.03, delay: i * 0.09, lp: 2500 }));
    noiseBurst(1.6, { kind: 'brown', filter: 'lowpass', f: 150, f2: 900, vol: 0.12, attack: 0.5 });
  },

  // ---- controls in the ship
  button() {
    if (!ready('button', 60)) return;
    noiseBurst(0.03, { f: 2600, q: 1.5, vol: 0.05 });
    tone(320, 0.06, { type: 'square', vol: 0.03, lp: 1500 });
  },
  switch() {
    if (!ready('switch', 70)) return;
    tone(190, 0.08, { type: 'square', vol: 0.05, lp: 900 });
    tone(95, 0.12, { vol: 0.06, delay: 0.025 });
    noiseBurst(0.04, { f: 3200, q: 1, vol: 0.04, delay: 0.01 });
  },
  toggle() { sfx.switch(); },
  consoleOpen() {
    if (!ready('console', 200)) return;
    tone(440, 0.14, { type: 'triangle', vol: 0.035, slide: 880 });
    noiseBurst(0.4, { filter: 'highpass', f: 3500, vol: 0.02, attack: 0.15 });
    tone(1320, 0.1, { vol: 0.02, delay: 0.14 });
  },
  consoleClose() {
    if (!ready('console', 200)) return;
    tone(880, 0.14, { type: 'triangle', vol: 0.03, slide: 400 });
  },
  relay(at?: Spot) {
    if (!ready('relay', 150)) return;
    tone(140, 0.06, { type: 'square', vol: 0.05, lp: 700, at });
    noiseBurst(0.05, { f: 1500, vol: 0.05, at, delay: 0.04 });
  },

  // ---- doors
  doorOpen(at?: Spot) {
    if (!ready('door' + (at ? at.x + ',' + at.z : ''), 500)) return;
    noiseBurst(0.55, { f: 3500, f2: 900, q: 0.8, vol: 0.05, at, attack: 0.05 });
    tone(110, 0.55, { type: 'triangle', vol: 0.025, slide: 190, at, lp: 800 });
    tone(70, 0.12, { vol: 0.06, delay: 0.5, at });
  },
  doorClose(at?: Spot) {
    if (!ready('door' + (at ? at.x + ',' + at.z : ''), 500)) return;
    tone(190, 0.45, { type: 'triangle', vol: 0.025, slide: 100, at, lp: 800 });
    noiseBurst(0.3, { f: 2500, f2: 800, vol: 0.04, at });
    tone(60, 0.14, { vol: 0.08, delay: 0.42, at });
    noiseBurst(0.06, { f: 900, q: 2, vol: 0.05, delay: 0.43, at });
  },

  // ---- machines and power
  startup(at?: Spot) {
    if (!ready('startup' + (at ? at.x : ''), 800)) return;
    tone(80, 0.8, { type: 'sawtooth', vol: 0.025, slide: 420, at, lp: 1400 });
    tone(880, 0.07, { vol: 0.03, delay: 0.75, at });
    tone(1175, 0.09, { vol: 0.03, delay: 0.88, at });
  },
  shutdown(at?: Spot) {
    if (!ready('shutdown' + (at ? at.x : ''), 800)) return;
    tone(420, 0.9, { type: 'sawtooth', vol: 0.025, slide: 60, at, lp: 1200 });
    tone(440, 0.12, { vol: 0.03, delay: 0.85, at });
  },
  powerFail() {
    if (!ready('powerFail', 3000)) return;
    tone(130, 1.6, { type: 'sawtooth', vol: 0.07, slide: 32, lp: 700 });
    noiseBurst(1.2, { kind: 'brown', filter: 'lowpass', f: 300, f2: 60, vol: 0.2, attack: 0.05 });
    [700, 520, 380].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.04, delay: 0.5 + i * 0.22 }));
    ambientPower(false);
  },
  powerRestore() {
    if (!ready('powerRestore', 3000)) return;
    tone(40, 1.3, { type: 'sawtooth', vol: 0.06, slide: 230, lp: 800 });
    tone(80, 0.1, { vol: 0.08, delay: 0.7 });
    [523, 659, 880].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.04, delay: 1.0 + i * 0.12 }));
    ambientPower(true);
  },

  pressure(at?: Spot) {
    if (!ready('pressure', 8000)) return;
    noiseBurst(1.8, { f: 5000, f2: 700, q: 0.6, vol: 0.06, at, attack: 0.2 });
    tone(90, 1.4, { type: 'triangle', vol: 0.03, slide: 60, at, lp: 400 });
    tone(70, 0.1, { vol: 0.06, delay: 1.7, at });
  },

  // ---- communications
  staticBurst(at?: Spot) { if (ready('static', 700)) staticBurst(0.6, 0.05, at); },
  transmitStart() {
    if (!ready('tx', 800)) return;
    for (let i = 0; i < 8; i++) tone(i % 2 ? 1900 : 1400, 0.04, { type: 'square', vol: 0.022, delay: i * 0.055, at: SPOT.comms, lp: 3000 });
    staticBurst(0.55, 0.02, SPOT.comms);
  },
  transmitEnd() {
    if (!ready('tx', 800)) return;
    tone(1000, 0.1, { vol: 0.035, at: SPOT.comms });
    tone(1300, 0.14, { vol: 0.035, delay: 0.12, at: SPOT.comms });
  },
  linkUp() {
    if (!ready('link', 1000)) return;
    tone(900, 0.1, { vol: 0.035, at: SPOT.comms });
    tone(1200, 0.14, { vol: 0.035, delay: 0.12, at: SPOT.comms });
  },
  linkDown() {
    if (!ready('link', 1000)) return;
    staticBurst(0.5, 0.045, SPOT.comms);
    tone(800, 0.3, { type: 'triangle', vol: 0.03, slide: 450, delay: 0.1, at: SPOT.comms });
  },

  // ---- warnings (all have cooldowns so they never pile up)
  warn() {
    if (!ready('warn', 1200)) return;
    tone(520, 0.12, { type: 'triangle', vol: 0.045 });
    tone(390, 0.18, { type: 'triangle', vol: 0.045, delay: 0.13 });
  },
  /** one klaxon pulse. `strength` is 0..1 */
  alarm(strength = 1) {
    if (!ready('alarm', 2500)) return;
    const v = 0.045 * strength;
    tone(520, 0.5, { type: 'sawtooth', vol: v, slide: 900, lp: 2400 });
    tone(520, 0.5, { type: 'sawtooth', vol: v, slide: 900, delay: 0.62, lp: 2400 });
  },
  ding() {
    if (!ready('ding', 500)) return;
    tone(1320, 0.18, { vol: 0.035 });
    tone(1760, 0.28, { vol: 0.022, delay: 0.08 });
  },

  // ---- mission end
  success() {
    if (!ready('success', 400)) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.45, { type: 'triangle', vol: 0.045, delay: i * 0.11 }));
  },
  missionSuccess() {
    if (!ready('end', 3000)) return;
    [261.6, 329.6, 392, 523.3, 659.3, 784].forEach((f, i) => tone(f, 1.8 - i * 0.1, { type: 'triangle', vol: 0.045, delay: i * 0.16, attack: 0.03 }));
    tone(130.8, 2.6, { vol: 0.07, attack: 0.1 });
    noiseBurst(1.8, { filter: 'highpass', f: 5000, vol: 0.012, delay: 0.8, attack: 0.5 });
  },
  missionFail() {
    if (!ready('end', 3000)) return;
    [440, 349, 293.7, 220].forEach((f, i) => tone(f, 1.2, { type: 'sawtooth', vol: 0.04, delay: i * 0.35, lp: 900, attack: 0.04 }));
    tone(55, 2.4, { vol: 0.12, delay: 0.5, attack: 0.1 });
    noiseBurst(1.2, { kind: 'brown', filter: 'lowpass', f: 200, vol: 0.12, delay: 0.4 });
  },

  startAmbient,
};

// ------------------------------------------------------------ ambient layers
interface Layer { gain: GainNode }
const layers: Record<string, Layer> = {};
let started = false;
let baseGain: GainNode | null = null;
let humOsc: OscillatorNode[] = [];
let ventGain: GainNode | null = null;
let machGain: GainNode | null = null;   // engineering machinery loudness (follows the generator)
let commsGain: GainNode | null = null;  // radio hiss loudness (follows the link)
const ROOM_KEY: Record<string, string> = {
  'COMMAND DECK': 'command', ENGINEERING: 'engineering', 'SCIENCE LAB': 'science', COMMUNICATIONS: 'comms', AIRLOCK: 'airlock', CORRIDOR: 'corridor',
};
const ROOM_LEVEL: Record<string, number> = { command: 0.9, engineering: 1, science: 0.8, comms: 0.9, airlock: 1, menu: 1, hangar: 1 };
let roomKey = 'menu';

function loopSrc(buf: AudioBuffer) {
  const s = ctx!.createBufferSource();
  s.buffer = buf; s.loop = true;
  s.start(0, Math.random() * 2);
  return s;
}
function lfo(freq: number, depth: number, target: AudioParam) {
  const o = ctx!.createOscillator(); const g = ctx!.createGain();
  o.frequency.value = freq; g.gain.value = depth;
  o.connect(g).connect(target); o.start();
}
function filt(type: BiquadFilterType, f: number, q = 0.7) {
  const b = ctx!.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b;
}
function addLayer(name: string): GainNode {
  const g = ctx!.createGain();
  g.gain.value = 0;
  g.connect(mix!.amb);
  layers[name] = { gain: g };
  return g;
}

function startAmbient() {
  const c = ac();
  if (!c || !mix || started) return;
  started = true;

  // 1) continuous ship hum
  baseGain = c.createGain(); baseGain.gain.value = 0.06; baseGain.connect(mix.amb);
  const hlp = filt('lowpass', 520);
  hlp.connect(baseGain);
  humOsc = [50, 100.4, 151].map((f, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = i === 1 ? 'triangle' : 'sine'; o.frequency.value = f; g.gain.value = i === 2 ? 0.25 : 1;
    o.connect(g).connect(hlp); o.start();
    return o;
  });

  // 2) ventilation and airflow
  ventGain = c.createGain(); ventGain.gain.value = 0.07; ventGain.connect(mix.amb);
  loopSrc(brown!).connect(filt('bandpass', 420, 0.4)).connect(ventGain);
  lfo(0.07, 0.025, ventGain.gain);
  const hiss = c.createGain(); hiss.gain.value = 0.012; hiss.connect(mix.amb);
  loopSrc(white!).connect(filt('highpass', 2500)).connect(filt('lowpass', 6500)).connect(hiss);

  // 3) one layer per place
  {
    const g = addLayer('command'); // soft electronics and air
    const hi = c.createGain(); hi.gain.value = 0.01; hi.connect(g);
    loopSrc(white!).connect(filt('highpass', 3800)).connect(hi);
    const o = c.createOscillator(); o.frequency.value = 440; const og = c.createGain(); og.gain.value = 0.006; o.connect(og).connect(g); o.start();
    lfo(0.4, 0.004, og.gain);
  }
  {
    const g = addLayer('engineering'); // machinery: rumble + pump throb, loudness follows the generator
    machGain = c.createGain(); machGain.gain.value = 0.15; machGain.connect(g);
    const r = c.createGain(); r.gain.value = 0.16; r.connect(machGain);
    loopSrc(brown!).connect(filt('lowpass', 140)).connect(r);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 62;
    const og = c.createGain(); og.gain.value = 0.05; o.connect(og).connect(machGain); o.start();
    lfo(7.5, 0.04, og.gain);
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 118;
    const og2 = c.createGain(); og2.gain.value = 0.012; o2.connect(filt('lowpass', 400)).connect(og2).connect(machGain); o2.start();
  }
  {
    const g = addLayer('science'); // cooling fans and instrument whine
    const o = c.createOscillator(); o.frequency.value = 120; const og = c.createGain(); og.gain.value = 0.03; o.connect(og).connect(g); o.start();
    const w = c.createGain(); w.gain.value = 0.02; w.connect(g);
    loopSrc(white!).connect(filt('bandpass', 900, 1.5)).connect(w);
    const o2 = c.createOscillator(); o2.frequency.value = 2900; const og2 = c.createGain(); og2.gain.value = 0.0025; o2.connect(og2).connect(g); o2.start();
    lfo(0.2, 0.002, og2.gain);
  }
  {
    const g = addLayer('comms'); // radio hiss and a faint carrier tone
    commsGain = c.createGain(); commsGain.gain.value = 1; commsGain.connect(g);
    const s = c.createGain(); s.gain.value = 0.02; s.connect(commsGain);
    loopSrc(white!).connect(filt('bandpass', 2500, 2.5)).connect(s);
    lfo(1.3, 0.012, s.gain);
    const o = c.createOscillator(); o.frequency.value = 1010; const og = c.createGain(); og.gain.value = 0.004; o.connect(og).connect(g); o.start();
  }
  {
    const g = addLayer('airlock'); // hollow chamber drone
    const o = c.createOscillator(); o.frequency.value = 41; const og = c.createGain(); og.gain.value = 0.06; o.connect(og).connect(g); o.start();
    const n = c.createGain(); n.gain.value = 0.05; n.connect(g);
    loopSrc(white!).connect(filt('bandpass', 210, 9)).connect(n);
  }
  {
    const g = addLayer('menu'); // deep space drone for the menu screens
    [55, 55.45, 82.6].forEach((f) => { const o = c.createOscillator(); o.frequency.value = f; const og = c.createGain(); og.gain.value = 0.05; o.connect(og).connect(g); o.start(); });
    const n = c.createGain(); n.gain.value = 0.04; n.connect(g);
    loopSrc(brown!).connect(filt('lowpass', 260)).connect(n);
    lfo(0.05, 0.03, n.gain);
  }
  {
    const g = addLayer('hangar'); // big echoing shipyard
    const n = c.createGain(); n.gain.value = 0.12; n.connect(g);
    loopSrc(brown!).connect(filt('lowpass', 190)).connect(n);
    const o = c.createOscillator(); o.frequency.value = 88; const og = c.createGain(); og.gain.value = 0.02; o.connect(og).connect(g); o.start();
    lfo(0.11, 0.012, og.gain);
  }
  setRoom(roomKey, true);
  ambTimer = window.setInterval(ambTick, 1000);
}

function setRoom(key: string, force = false) {
  if (!ctx || !started) { roomKey = key; return; }
  if (key === roomKey && !force) return;
  roomKey = key;
  const t = ctx.currentTime;
  for (const [name, l] of Object.entries(layers)) {
    l.gain.gain.setTargetAtTime(name === key ? ROOM_LEVEL[name] ?? 1 : 0, t, 0.7); // ~2 s smooth cross-fade
  }
  // corridors have the strongest airflow; the menu is much quieter
  const menu = key === 'menu' || key === 'hangar';
  baseGain?.gain.setTargetAtTime(menu ? 0.025 : 0.06, t, 0.8);
  ventGain?.gain.setTargetAtTime(menu ? 0.02 : key === 'corridor' ? 0.1 : key === 'airlock' ? 0.03 : 0.07, t, 0.8);
}
/** Tell the audio which screen is showing. In the game, rooms are set from the player's position. */
export function setScreenAudio(screen: string) {
  if (screen === 'game') { if (roomKey === 'menu' || roomKey === 'hangar') setRoom('command'); setMusic('game'); return; }
  setRoom(screen === 'shipyard' ? 'hangar' : 'menu');
  setMusic('menu');
}

function ambientPower(on: boolean) {
  if (!ctx || !started) return;
  const t = ctx.currentTime;
  humOsc.forEach((o, i) => o.frequency.setTargetAtTime([50, 100.4, 151][i] * (on ? 1 : 0.7), t, on ? 0.6 : 1.2));
  baseGain?.gain.setTargetAtTime(on ? 0.06 : 0.035, t, 1);
}

// ---- small random sounds so the ship feels alive (checked once per second, not per frame)
let ambTimer = 0;
let nextBlip = 0;
function ambTick() {
  if (!ctx || ctx.state !== 'running') return;
  const n = performance.now();
  if (n < nextBlip) return;
  nextBlip = n + 7000 + Math.random() * 9000;
  const g = lastGame;
  if (roomKey === 'command') tone(1200 + Math.random() * 600, 0.07, { bus: 'ambient', vol: 0.012 });
  else if (roomKey === 'engineering' && g && g.genState === 'online') { tone(95, 0.1, { bus: 'ambient', vol: 0.05, type: 'square', lp: 500 }); noiseBurst(0.3, { bus: 'ambient', f: 3000, vol: 0.012, delay: 0.1 }); }
  else if (roomKey === 'science') tone(1760, 0.05, { bus: 'ambient', vol: 0.01 });
  else if (roomKey === 'airlock') tone(60, 0.5, { bus: 'ambient', vol: 0.04, slide: 45 });
  else if (roomKey === 'hangar') { tone(70, 0.2, { bus: 'ambient', vol: 0.06, type: 'square', lp: 400 }); noiseBurst(0.4, { bus: 'ambient', f: 1200, vol: 0.015, delay: 0.05 }); }
}

// ------------------------------------------------------------ music (soft pad)
const CHORDS = [
  [110, 164.81, 196, 246.94],
  [87.31, 130.81, 174.61, 220],
  [130.81, 196, 246.94, 293.66],
  [98, 146.83, 196, 246.94],
];
let musicBuilt = false;
let musGain: GainNode | null = null;
let padOsc: OscillatorNode[] = [];
let chordIdx = 0;
let musicMode: 'menu' | 'game' | 'off' = 'off';
let musicTimer = 0;
export function setMusic(mode: 'menu' | 'game' | 'off') {
  musicMode = mode;
  const c = ac();
  if (!c || !mix) return;
  if (!musicBuilt) {
    musicBuilt = true;
    musGain = c.createGain(); musGain.gain.value = 0; musGain.connect(mix.mus);
    const lp = filt('lowpass', 750, 0.5); lp.connect(musGain);
    lfo(0.05, 300, lp.frequency);
    padOsc = CHORDS[0].map((f, i) => {
      const o = c.createOscillator(); o.type = i % 2 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = (i - 1.5) * 4;
      const g = c.createGain(); g.gain.value = 0.18; o.connect(g).connect(lp); o.start();
      return o;
    });
    musicTimer = window.setInterval(() => {
      if (!ctx || musicMode === 'off') return;
      chordIdx = (chordIdx + 1) % CHORDS.length;
      padOsc.forEach((o, i) => o.frequency.setTargetAtTime(CHORDS[chordIdx][i], ctx!.currentTime, 2.5));
      if (musicMode === 'menu' && Math.random() < 0.7) tone([659, 784, 880, 988][Math.floor(Math.random() * 4)], 4, { bus: 'music', vol: 0.02, attack: 0.05 });
    }, 14000);
  }
  musGain!.gain.setTargetAtTime(mode === 'menu' ? 0.9 : mode === 'game' ? 0.35 : 0, c.currentTime, 1.5);
}

// ------------------------------------------------------------ 3D listener + room tracking
let lastL = 0;
/** Call often (it limits itself). Moves the "ears" to the player and picks the room ambience. */
export function updateListener(x: number, z: number, yaw: number) {
  const c = ctx;
  if (!c) return;
  const n = performance.now();
  if (n - lastL < 50) return;
  lastL = n;
  const l = c.listener;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  if (l.positionX) {
    l.positionX.value = x; l.positionY.value = 1.6; l.positionZ.value = z;
    l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = fz;
    l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
  } else {
    (l as any).setPosition(x, 1.6, z);
    (l as any).setOrientation(fx, 0, fz, 0, 1, 0);
  }
  const r = roomAt(x, z);
  if (r !== listenerRoom) {
    const was = listenerRoom;
    listenerRoom = r;
    if (r === 'AIRLOCK' && was) sfx.pressure(SPOT.airlock); // pressure equalising hiss when you step in
    setRoom(ROOM_KEY[r] ?? 'corridor');
  }
}

// ------------------------------------------------------------ simulation-linked sounds
interface Snap { gen: string; running: Record<string, boolean>; tx: boolean; linked: boolean; fault: boolean; em: boolean; j1: boolean; j2: boolean; phase: string }
let pv: Snap | null = null;
let lastGame: GameState | null = null;
let alarmTimer = 0;
let alarmCount = 0;

function stopAlarm() {
  if (alarmTimer) { clearTimeout(alarmTimer); alarmTimer = 0; }
  alarmCount = 0;
}
function startAlarm(strength: () => number) {
  if (alarmTimer) return;
  alarmCount = 0;
  const pulse = () => {
    alarmTimer = 0;
    const g = lastGame;
    if (!g || g.phase !== 'playing' || !isEmergency(g)) { alarmCount = 0; return; }
    // the first few pulses are clear, later ones are quieter and further apart
    sfx.alarm(strength() * (alarmCount < 3 ? 1 : 0.5));
    alarmCount++;
    alarmTimer = window.setTimeout(pulse, alarmCount < 3 ? 5000 : 12000);
  };
  alarmTimer = window.setTimeout(pulse, 2500);
}

function snap(g: GameState): Snap {
  return { gen: g.genState, running: { ...g.running }, tx: g.transmitting, linked: g.commsLinked, fault: g.antennaFault, em: isEmergency(g), j1: g.j1, j2: g.j2, phase: g.phase };
}
const INSTR_SPOT: Record<string, Spot> = { spectrometer: SPOT.spectrometer, seismic: SPOT.seismic, analyzer: SPOT.analyzer, camera: SPOT.camera };

/** Call whenever the game state changes. It only reacts to CHANGES, never to every frame. */
export function syncSim(g: GameState) {
  lastGame = g;
  if (g.phase === 'title') { pv = null; stopAlarm(); if (mix && ctx) mix.ambDuck.gain.setTargetAtTime(1, ctx.currentTime, 0.3); return; }
  const now = snap(g);
  const p = pv;
  pv = now;
  // the very first state of a mission: set up machinery levels and stay quiet
  machineryLevel(g);
  if (!p) { if (mix && ctx) mix.ambDuck.gain.setTargetAtTime(1, ctx.currentTime, 0.3); return; }

  if (now.phase !== p.phase) {
    if (now.phase === 'won') { stopAlarm(); sfx.missionSuccess(); duck(0.3); }
    else if (now.phase === 'lost') { stopAlarm(); sfx.missionFail(); duck(0.3); }
    else if (now.phase === 'playing') duck(1);
    return;
  }
  if (now.phase !== 'playing') return;

  // power
  if (now.gen !== p.gen) {
    if (now.gen === 'starting') sfx.startup(SPOT.generator);
    else if (now.gen === 'online') sfx.powerRestore();
    else if (p.gen === 'online') { sfx.powerFail(); sfx.shutdown(SPOT.generator); }
  }
  if ((p.j1 && !now.j1) || (p.j2 && !now.j2)) sfx.relay(SPOT.power);

  // equipment
  for (const id of Object.keys(now.running)) {
    if (now.running[id] && !p.running[id]) sfx.startup(INSTR_SPOT[id]);
    else if (!now.running[id] && p.running[id]) sfx.shutdown(INSTR_SPOT[id]);
  }

  // communications
  if (now.tx && !p.tx) sfx.transmitStart();
  else if (!now.tx && p.tx) sfx.transmitEnd();
  if (now.linked && !p.linked) sfx.linkUp();
  else if (!now.linked && p.linked) sfx.linkDown();
  if (now.fault && !p.fault) { sfx.staticBurst(SPOT.dish); sfx.warn(); }

  // emergency alarm: starts when an emergency starts, stops when it ends
  if (now.em && !p.em) startAlarm(() => { const x = lastGame; return x && (x.overloaded || x.surge !== null || !x.powered.life) ? 1 : 0.55; });
  else if (!now.em && p.em) { stopAlarm(); sfx.ding(); }
}

function machineryLevel(g: GameState) {
  if (!ctx || !started) return;
  const t = ctx.currentTime;
  machGain?.gain.setTargetAtTime(g.genState === 'online' ? 1 : g.genState === 'starting' ? 0.55 : 0.15, t, 0.8);
  commsGain?.gain.setTargetAtTime(g.commsLinked ? 0.45 : g.transmitting ? 1.4 : 1, t, 0.6);
}
function duck(v: number) { if (mix && ctx) mix.ambDuck.gain.setTargetAtTime(v, ctx.currentTime, 0.6); }

/** Log messages from the sim. Cooldowns inside each sound stop repeats. */
export function onLog(level: string) {
  if (level === 'danger') sfx.alarm(0.8);
  else if (level === 'warn') sfx.warn();
  else if (level === 'good') sfx.ding();
}

/** Stop timers (used when the page is closed or hot-reloaded). */
export function disposeAudio() {
  [ambTimer, musicTimer].forEach((t) => t && clearInterval(t));
  stopAlarm();
}
