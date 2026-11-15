import { isTouch } from './device';
import { create } from 'zustand';
import * as sim from './sim';
import { useUI, useDesign, mutate, launch, resetToMenu, markTutorialDone, type Screen } from './store';
import { sumData } from './sim';

export const useTut = create<{
  active: boolean;
  step: number;
  used: { move: boolean; look: boolean; sprint: boolean };
  designAtEnter: string;
  enteredAt: number;
  note: (k: 'move' | 'look' | 'sprint') => void;
}>()((set, get) => ({
  active: false,
  step: 0,
  used: { move: false, look: false, sprint: false },
  designAtEnter: '',
  enteredAt: 0,
  note: (k) => {
    if (!get().active || get().used[k]) return;
    set({ used: { ...get().used, [k]: true } });
  },
}));

export interface TutStep {
  title: string;
  goal: string;
  text: string;
  target: string | null;
  done: (g: sim.GameState, ui: { panel: sim.PanelId; screen: Screen }) => boolean;
  checks?: (g: sim.GameState) => { label: string; ok: boolean }[];
  needsShipyard?: boolean;
  minSeconds?: number;
  onEnter?: () => void;
}

export const STEPS: TutStep[] = [
  {
    title: 'MOVEMENT',
    goal: isTouch ? 'Walk to the glowing console and tap USE.' : 'Walk to the glowing console and press E.',
    text: isTouch ? 'Move with your left thumb. Drag the right side of the screen to look. Push the stick all the way to sprint. When you are close to a console, tap USE. Follow the blue marker.' : 'Move with W A S D. Look with the mouse. Hold Shift to sprint. When you are close to a console, press E to use it. Follow the blue marker.',
    target: 'command',
    done: (g, ui) => ui.panel === 'command' && useTut.getState().used.move && useTut.getState().used.look && useTut.getState().used.sprint,
    checks: () => {
      const u = useTut.getState().used;
      return [
        { label: isTouch ? 'Walk (left thumb)' : 'Walk (W A S D)', ok: u.move },
        { label: isTouch ? 'Look around (drag right side)' : 'Look around (mouse)', ok: u.look },
        { label: isTouch ? 'Sprint (push the stick all the way)' : 'Sprint (hold Shift while walking)', ok: u.sprint },
      ];
    },
  },
  {
    title: 'SPACECRAFT DESIGN',
    goal: 'Open the Shipyard and pick a different part.',
    text: 'Every part has MASS (kg, the rocket can only lift so much), POWER (what it makes or uses), COST (your budget) and a SCIENCE job. A bigger power system makes more power but weighs more and costs more. Pick any part to change your ship.',
    target: null,
    needsShipyard: true,
    done: () => JSON.stringify(useDesign.getState().design) !== useTut.getState().designAtEnter,
    onEnter: () => useTut.setState({ designAtEnter: JSON.stringify(useDesign.getState().design) }),
  },
  {
    title: 'POWER SYSTEMS',
    goal: 'Go to Engineering. Start the generator and power Life Support, Communications and the Science Lab.',
    text: 'At the Power Panel: press RESTART GENERATOR, then click the round switches to build a path: Generator → Bus → System. Watch LOAD. If load is higher than what you have, the lines turn red and breakers trip. Use the battery switch to add more.',
    target: 'power',
    done: (g) => g.genState === 'online' && g.powered.life && g.powered.comms && g.powered.sci && !g.overloaded,
    checks: (g) => [
      { label: 'Generator online', ok: g.genState === 'online' },
      { label: 'Life Support powered', ok: g.powered.life },
      { label: 'Communications powered', ok: g.powered.comms },
      { label: 'Science Lab powered', ok: g.powered.sci },
      { label: 'No overload', ok: !g.overloaded },
    ],
  },
  {
    title: 'COMMUNICATIONS',
    goal: 'Go to the Communications room. Repair the antenna, then align it to 100%.',
    text: 'The antenna just broke! At the antenna console press REPAIR (keep the panel open). Then move AZIMUTH and ELEVATION until the signal is 100%. That locks the link to Earth.',
    target: 'comms',
    onEnter: () => mutate((g) => sim.forceEvent(g, 'antenna')),
    done: (g) => !g.antennaFault && g.commsLinked,
    checks: (g) => [
      { label: 'Antenna repaired', ok: !g.antennaFault },
      { label: 'Signal locked (100%)', ok: g.commsLinked },
    ],
  },
  {
    title: 'SCIENCE',
    goal: 'Go to the Science Lab. Turn on the Signal Analyzer and collect 10 units of data.',
    text: 'Each instrument uses power (PU) and makes data while it runs. The Signal Analyzer is needed for the main mission. If power runs low, shut an instrument down.',
    target: 'analyzer',
    done: (g) => g.running.analyzer && sumData(g) >= 10,
    checks: (g) => [
      { label: 'Signal Analyzer running', ok: g.running.analyzer },
      { label: 'Data collected: ' + Math.floor(sumData(g)) + ' / 10', ok: sumData(g) >= 10 },
    ],
  },
  {
    title: 'MISSION OBJECTIVES',
    goal: 'Read this, then press CONTINUE.',
    text: 'TIMER: the real mission lasts 10 minutes. OBJECTIVES: six goals, tracked on the right. CRISES: solar flares, broken antennas and power surges happen at random — a solar flare is starting now. SCORE: points for objectives, data, time left, hull health and budget saved. Overloads cost points.',
    target: null,
    minSeconds: 5,
    onEnter: () => mutate((g) => sim.forceEvent(g, 'flare')),
    done: () => true,
  },
  {
    title: 'TRAINING COMPLETE',
    goal: 'You are ready.',
    text: 'The main mission is now unlocked. Design your spacecraft in the Shipyard, then launch.',
    target: null,
    done: () => false,
  },
];

export function startTutorial() {
  useTut.setState({ active: true, step: 0, used: { move: false, look: false, sprint: false }, designAtEnter: '', enteredAt: Date.now() });
  launch('tutorial');
  useUI.setState({ markerTarget: STEPS[0].target });
}

export function gotoStep(n: number) {
  const step = STEPS[n];
  useTut.setState({ step: n, enteredAt: Date.now() });
  useUI.setState({ markerTarget: step.target });
  step.onEnter?.();
}

export function endTutorial(completed: boolean) {
  useTut.setState({ active: false, step: 0 });
  if (completed) markTutorialDone();
  resetToMenu();
}

export function skipTutorial() {
  markTutorialDone();
  endTutorial(true);
}
