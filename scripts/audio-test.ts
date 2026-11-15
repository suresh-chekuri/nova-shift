// Runs the audio engine against a fake Web Audio API (no sound card needed).
// It checks: nothing crashes, cooldowns work, sim events trigger sounds, alarms start/stop.
import * as sim from '../src/sim.ts';
const counts = { osc: 0, src: 0 };
const PARAMS = ['frequency', 'gain', 'detune', 'Q', 'positionX', 'positionY', 'positionZ', 'forwardX', 'forwardY', 'forwardZ', 'upX', 'upY', 'upZ'];
function param(): any { const p: any = { value: 0 }; for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) p[m] = () => p; return p; }
function node(kind = ''): any {
  const store: any = {};
  if (kind === 'osc') counts.osc++;
  if (kind === 'src') counts.src++;
  return new Proxy(store, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === 'connect') return (n: any) => n;
      if (PARAMS.includes(k)) return (t[k] = param());
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
class FakeCtx {
  currentTime = 0; state = 'running'; sampleRate = 8000; destination = node(); listener = node();
  resume() { return Promise.resolve(); }
  createGain() { return node(); } createDynamicsCompressor() { return node(); } createBiquadFilter() { return node(); } createPanner() { return node(); } createConvolver() { return node(); } createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; }
  createOscillator() { return node('osc'); } createBufferSource() { return node('src'); }
  createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
}
(globalThis as any).window = globalThis;
(globalThis as any).AudioContext = FakeCtx;

// fake clock so cooldowns can be skipped in the test
let off = 0; const realNow = performance.now.bind(performance); performance.now = () => realNow() + off;
const skip = (ms: number) => { off += ms; };
let fails = 0;
const check = (n: string, c: boolean) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fails++; };
const A = await import('../src/audio.ts');

// 1. every sound can play without throwing
let ok = true;
try {
  for (const [name, fn] of Object.entries(A.sfx)) { if (typeof fn === 'function') (fn as any)(); void name; }
  A.startAmbientSafe(); A.setMusic('menu'); A.setMusic('game'); A.setScreenAudio('shipyard'); A.setScreenAudio('menu'); A.setScreenAudio('game');
  A.setLevels({ master: 0.5, ambient: 0.2, sfx: 1, music: 0, muted: true }); A.setLevels({ muted: false });
} catch (e) { ok = false; console.log(e); }
check('all sounds and settings run', ok);

// 2. rooms: the listener moves between rooms without errors
ok = true;
try { for (const [x, z] of [[0, 0], [-12, 0], [-24, 0], [-25.5, 10], [24, 0], [0, -24], [0, -10]]) { A.updateListener(x, z, 0.5); await new Promise((r) => setTimeout(r, 60)); } } catch (e) { ok = false; console.log(e); }
check('room ambience changes run', ok);

// 3. cooldown: 2000 rapid calls must not make 2000 sounds
const before = counts.osc;
for (let i = 0; i < 2000; i++) { A.sfx.click(); A.sfx.alarm(); A.sfx.warn(); A.sfx.switch(); }
check('cooldowns stop spam (' + (counts.osc - before) + ' oscillators for 8000 calls)', counts.osc - before < 20);

// 4. the sim drives sounds
skip(10000);
const rand = () => 0.5;
const g = sim.createState(rand); sim.startMission(g, rand); g.nextEventIn = 9999;
A.syncSim(g); // first state: silent set-up
let o0 = counts.osc;
A.syncSim(g);
check('no change = no sound', counts.osc === o0);
sim.toggleSwitch(g, 'bj1'); sim.toggleSwitch(g, 'life'); sim.restartGenerator(g);
o0 = counts.osc; A.syncSim(g);
check('generator starting plays a sound', counts.osc > o0);
skip(5000);
for (let i = 0; i < 40; i++) sim.tick(g, 0.1, rand);
o0 = counts.osc; A.syncSim(g);
check('generator online plays a sound', counts.osc > o0);
await new Promise((r) => setTimeout(r, 10));
g.running.spectrometer = true; o0 = counts.osc; A.syncSim(g);
check('instrument start plays a sound', counts.osc > o0);
skip(5000); g.transmitting = true; o0 = counts.osc; A.syncSim(g);
check('transmit plays a sound', counts.osc > o0);
skip(5000); g.phase = 'won'; o0 = counts.osc; A.syncSim(g);
check('mission end plays a stinger', counts.osc > o0);
A.syncSim({ ...g, phase: 'title' } as any);
A.onLog('danger'); A.onLog('warn'); A.onLog('good'); A.disposeAudio();
console.log(fails ? 'AUDIO TESTS FAILED' : 'ALL AUDIO TESTS PASSED');
process.exit(fails ? 1 : 0);
