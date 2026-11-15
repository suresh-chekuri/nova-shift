// Small learning cards and one NASA data alert during a mission. Nothing here changes gameplay.
// It shows a message through the normal toast, never on top of another recent message, and never in the tutorial.
import { useEffect } from 'react';
import { useGame, useUI, showToast } from '../store';
import { useNasa, missionAlert, ROOM_FACTS } from '../nasa';

export function NasaNotes() {
  useEffect(() => {
    let shownRooms = new Set<string>();
    let alerted = false;
    let timers: number[] = [];
    const clear = () => { timers.forEach((t) => clearTimeout(t)); timers = []; };
    const quiet = () => { const t = useUI.getState().toast; return !t || Date.now() - t.at > 4500; };
    const later = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, ms)); };

    const offerFact = (room: string) => {
      const g = useGame.getState();
      if (g.mode !== 'mission' || g.phase !== 'playing' || shownRooms.has(room) || !ROOM_FACTS[room]) return;
      later(3000, () => {
        const s = useUI.getState();
        if (s.screen !== 'game' || s.room !== room || shownRooms.has(room) || !quiet()) return;
        shownRooms.add(room);
        showToast(ROOM_FACTS[room]);
      });
    };

    const unsub = useUI.subscribe((s, prev) => {
      if (s.screen !== prev.screen) {
        clear();
        if (s.screen === 'game') {
          shownRooms = new Set(); alerted = false;
          // one real NASA data alert, about 40 s into a mission
          later(40000, () => {
            const g = useGame.getState();
            if (alerted || g.mode !== 'mission' || g.phase !== 'playing' || useUI.getState().screen !== 'game' || !quiet()) return;
            const text = missionAlert(useNasa.getState().data, Math.floor(Math.random() * 2));
            if (text) { alerted = true; showToast(text); }
          });
          offerFact(s.room);
        }
      } else if (s.room !== prev.room && s.screen === 'game') offerFact(s.room);
    });
    return () => { unsub(); clear(); };
  }, []);
  return null;
}
