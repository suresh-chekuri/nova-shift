// Touch input for phones and tablets. TouchControls.tsx writes here, Player.tsx reads it every frame.
import { useGame, useUI, openPanel } from './store';
import { INTERACTABLES } from './world/layout';

export const touch = {
  moveX: 0, // -1 left ... 1 right
  moveY: 0, // -1 back ... 1 forward
  lookX: 0, // finger movement in pixels since the last frame (Player.tsx sets it back to 0)
  lookY: 0,
};

/** Same as pressing E: open the console you are standing next to. */
export function interactNow() {
  const g = useGame.getState();
  const ui = useUI.getState();
  if (g.phase !== 'playing' || ui.screen !== 'game' || ui.panel) return;
  const it = ui.nearby && INTERACTABLES.find((i) => i.id === ui.nearby!.id);
  if (it) openPanel(it.panel, it.focus ?? null);
}
