import * as sim from '../src/sim.ts';
import * as D from '../src/design.ts';

let fails = 0;
function check(name: string, cond: boolean) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name);
  if (!cond) fails++;
}
// fixed random so the test is repeatable
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const run = (g: sim.GameState, secs: number) => { for (let i = 0; i < secs * 10; i++) sim.tick(g, 0.1, rand); };

const g = sim.createState(rand);
sim.startMission(g, rand);
g.nextEventIn = 9999;

// 1. battery powers life support before generator
sim.toggleSwitch(g, 'bj1'); sim.toggleSwitch(g, 'life');
check('battery powers life support', g.powered.life && g.demand === 30);
// 2. restart generator
sim.restartGenerator(g); run(g, 3.5);
check('generator online', g.genState === 'online' && g.genOutput === 100);
sim.toggleSwitch(g, 'gj1');
run(g, 1);
check('objective 1 done', g.objectives[0]);
// 3. overload: power everything
sim.toggleSwitch(g, 'gj2'); sim.toggleSwitch(g, 'comms'); sim.toggleSwitch(g, 'sci'); sim.toggleSwitch(g, 'eng');
sim.toggleSwitch(g, 'bj2');
sim.tick(g, 0.1, rand);
check('130 units fits gen 100 + battery 30', g.demand === 130 && !g.overloaded);
sim.toggleInstrument(g, 'analyzer');
sim.tick(g, 0.1, rand);
check('155 units overloads', g.demand === 155 && g.overloaded);
run(g, 4);
check('breakers trip after grace', g.overloads >= 1 && !g.sw.life && !g.instruments.analyzer);
// 4. comms alignment: life + comms only
g.battery = 80;
sim.toggleSwitch(g, 'life'); sim.toggleSwitch(g, 'comms');
sim.setAntenna(g, g.target.az, g.target.el);
check('antenna lock = 100%', g.commsLinked && g.commsStrength === 100);
sim.setAntenna(g, g.target.az + 20, g.target.el);
check('misaligned < 100%', !g.commsLinked && g.commsStrength < 100 && g.commsStrength > 0);
sim.setAntenna(g, g.target.az, g.target.el);
// 5. science
sim.toggleSwitch(g, 'sci');
sim.toggleInstrument(g, 'analyzer');
run(g, 1);
check('analyzer running', g.running.analyzer && g.objectives[2]);
run(g, 90);
check('data collected', sim.sumData(g) > 100 && g.data.analyzer >= 30);
// 6. flare reduces generator
g.flare = 40; sim.derive(g);
check('flare = 70 output', g.genOutput === 70);
g.flare = 0;
// 7. surge locks a system
g.nextEventIn = 0;
const rr = () => 0.99; // picks last option = surge
sim.tick(g, 0.1, rr);
// 8. transmit
g.surge = null; sim.derive(g);
if (!g.sw.comms) sim.toggleSwitch(g, 'comms');
sim.setAntenna(g, g.target.az, g.target.el);
sim.toggleTransmit(g);
g.nextEventIn = 9999;
run(g, 30);
check('transmission wins', g.phase === 'won' && g.result!.score > 0);
console.log('grade', g.result!.grade, 'score', g.result!.score, g.result!.rows.map(r => r.label + ':' + r.value).join(' | '));

// time out
const t = sim.createState(rand); sim.startMission(t, rand); t.nextEventIn = 9999;
for (let i = 0; i < 6100; i++) sim.tick(t, 0.1, rand);
check('timeout loses', t.phase === 'lost');

// events fire by themselves
const e = sim.createState(rand); sim.startMission(e, rand);
let fired = 0; for (let i = 0; i < 3000; i++) { sim.tick(e, 0.1, rand); fired = e.eventsTriggered; }
check('random events fire', fired >= 1);

// ---- spacecraft design ----
check('default design is valid', D.isValid(D.DEFAULT_DESIGN));
const heavy: D.Design = { structure: 'reinforced', power: 'highcap', propulsion: 'advprop', comms: 'deep', battery: 'advanced', payload: ['spectrometer', 'seismic', 'analyzer'] };
const hv = D.validate(heavy);
check('overweight/overbudget design is rejected', !D.isValid(heavy) && hv.some(c => c.id === 'mass' && !c.ok) && hv.some(c => c.id === 'cost' && !c.ok));
const weak: D.Design = { ...D.DEFAULT_DESIGN, power: 'compact' };
check('weak power system fails essential power', !D.validate(weak).find(c => c.id === 'power')!.ok);
const noAnalyzer: D.Design = { ...D.DEFAULT_DESIGN, payload: ['spectrometer', 'seismic'] };
check('no analyzer fails', !D.isValid(noAnalyzer));
check('empty slot fails parts check', !D.validate({ ...D.DEFAULT_DESIGN, comms: null }).find(c => c.id === 'parts')!.ok);
// design changes the mission
const big: D.Design = { ...D.DEFAULT_DESIGN, power: 'highcap', battery: 'advanced', structure: 'light', comms: 'deep' };
const gb = sim.createState(rand, big); sim.startMission(gb, rand, big);
check('design feeds power: highcap 135', (() => { gb.genState = 'online'; sim.derive(gb); return gb.genOutput === 135 && gb.stats.battOutput === 40; })());
check('light frame takes more damage', gb.stats.damageMult > 1.3);
const gd = sim.createState(rand, D.DEFAULT_DESIGN); sim.startMission(gd, rand, noAnalyzer);
sim.toggleSwitch(gd, 'bj2'); sim.toggleSwitch(gd, 'sci'); sim.toggleInstrument(gd, 'analyzer');
check('uninstalled instrument cannot run', !gd.instruments.analyzer);
// tutorial mode cannot end
const tt = sim.createState(rand); sim.startMission(tt, rand, D.DEFAULT_DESIGN, 'tutorial');
for (let i = 0; i < 7000; i++) sim.tick(tt, 0.1, rand);
check('tutorial never ends and time stays', tt.phase === 'playing' && tt.timeLeft === 600 && tt.eventsTriggered === 0);
sim.forceEvent(tt, 'antenna', rand);
check('forced tutorial event works', tt.antennaFault);

// ---------- Shipyard: missions and validation ----------
const ok = (d: D.Design) => D.validate(d).filter((c) => !c.ok).map((c) => c.id);
check('echo default design is valid', ok(D.DEFAULT_DESIGN).length === 0);
const survey: D.Design = { ...D.DEFAULT_DESIGN, mission: 'survey', payload: ['spectrometer', 'seismic'] };
check('survey budget/capacity differ', D.computeStats(survey).budget === 350 && D.computeStats(survey).launchCapacity === 750);
check('survey design with both instruments is valid', ok(survey).length === 0);
check('survey needs spectrometer + seismic', ok({ ...survey, payload: ['analyzer', 'camera'] }).includes('mission'));
const relayBad: D.Design = { ...D.DEFAULT_DESIGN, mission: 'relay' };
check('relay rejects a normal antenna', ok(relayBad).includes('mission') && ok(relayBad).includes('comms'));
const relay: D.Design = { structure: 'standard', power: 'advanced', propulsion: 'ion', comms: 'deep', battery: 'standard', payload: ['seismic'], mission: 'relay' };
check('relay with deep array + ion engine is valid', ok(relay).length === 0);
check('relay with chemical engine has too little power', ok({ ...relay, propulsion: 'chemical' }).includes('power'));
check('no battery is invalid', ok({ ...D.DEFAULT_DESIGN, battery: null }).includes('parts'));
check('over budget fails', ok({ ...D.DEFAULT_DESIGN, structure: 'reinforced', power: 'highcap', propulsion: 'advprop', comms: 'deep', battery: 'advanced' }).includes('cost'));
check('over mass fails and points at parts', (() => { const c = D.validate({ ...survey, structure: 'reinforced', power: 'highcap', propulsion: 'advprop', battery: 'advanced', payload: ['spectrometer', 'seismic', 'analyzer'] }).find((x) => x.id === 'mass')!; return !c.ok && c.cats.length > 0; })());
check('payload value counts', D.computeStats(D.DEFAULT_DESIGN).scienceValue === 10);

// a survey mission plays and ends with a win using the survey objectives
const sv = sim.createState(rand, survey, 'mission'); sim.startMission(sv, rand, survey, 'mission'); sv.nextEventIn = 9999;
sim.toggleSwitch(sv, 'bj1'); sim.toggleSwitch(sv, 'life'); sim.restartGenerator(sv); run(sv, 3.5);
sim.toggleSwitch(sv, 'gj1'); sim.toggleSwitch(sv, 'gj2'); sim.toggleSwitch(sv, 'bj2'); sim.toggleSwitch(sv, 'comms'); sim.toggleSwitch(sv, 'sci');
sim.setAntenna(sv, sv.target.az, sv.target.el); run(sv, 1);
sim.toggleSwitch(sv, 'comms'); // comms off while collecting: life 30 + sci 35 + 2 instruments 35 = 100
sim.toggleInstrument(sv, 'spectrometer'); run(sv, 1);
check('survey objective 3 needs BOTH instruments', !sv.objectives[2]);
sim.toggleInstrument(sv, 'seismic'); run(sv, 1);
check('survey: both running completes objective 3', sv.objectives[2]);
check('survey next goal does not talk about analyzer', !sim.nextGoal(sv).text.includes('Analyzer'));
run(sv, 90);
check('survey data goal reached', sv.objectives[3]);
sim.toggleInstrument(sv, 'spectrometer'); sim.toggleInstrument(sv, 'seismic'); sim.toggleSwitch(sv, 'sci'); sim.toggleSwitch(sv, 'comms');
sim.setAntenna(sv, sv.target.az, sv.target.el); sim.toggleTransmit(sv); run(sv, 90);
check('survey mission is won', sv.phase === 'won' && sv.result!.score > 0);
const rl = sim.createState(rand, relay, 'mission'); sim.startMission(rl, rand, relay, 'mission');
check('relay objective text is its own', sim.objectiveTexts('relay')[4].includes('relay') && rl.stats.txRate === 6.5);

console.log(fails === 0 ? 'ALL TESTS PASSED' : fails + ' TEST(S) FAILED');
process.exit(fails ? 1 : 0);
