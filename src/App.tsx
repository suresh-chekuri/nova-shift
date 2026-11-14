import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { Ship } from './world/Ship';
import { Player, GameLoop, RemotePlayers } from './world/Player';
import { MenuScene } from './world/MenuScene';
import { ShipyardScene } from './world/ShipyardScene';
import { HUD } from './ui/HUD';
import { PowerPanel } from './ui/PowerPanel';
import { CommsPanel } from './ui/CommsPanel';
import { SciencePanel } from './ui/SciencePanel';
import { CommandPanel, EnginePanel } from './ui/CommandPanel';
import { BriefingScreen, DebriefScreen } from './ui/Screens';
import { MainMenu } from './ui/MainMenu';
import { SettingsScreen } from './ui/Settings';
import { ShipyardUI } from './ui/Shipyard';
import { LobbyScreen } from './ui/Lobby';
import { TutorialCard } from './ui/TutorialCard';
import { Toast } from './ui/Toast';
import { useGame, useUI, useSettings, setScreen, showToast } from './store';
import { syncSim, onLog, setScreenAudio, startAmbientSafe } from './audio';
import { loadAssetManifest } from './world/parts';

function Panels() {
  const panel = useUI((s) => s.panel);
  const phase = useGame((s) => s.phase);
  const screen = useUI((s) => s.screen);
  if (screen !== 'game' || phase !== 'playing' || !panel) return null;
  if (panel === 'power') return <PowerPanel />;
  if (panel === 'comms') return <CommsPanel />;
  if (panel === 'science') return <SciencePanel />;
  if (panel === 'command') return <CommandPanel />;
  if (panel === 'engine') return <EnginePanel />;
  return null;
}

function GameTutorial() {
  const screen = useUI((s) => s.screen);
  return screen === 'game' ? <TutorialCard /> : null;
}

function World() {
  const screen = useUI((s) => s.screen);
  const st = useSettings();
  return (
    <>
      <GameLoop />
      {screen === 'game' && (
        <>
          <Ship />
          <Player />
          <RemotePlayers />
        </>
      )}
      {screen === 'shipyard' && <ShipyardScene />}
      {screen !== 'game' && screen !== 'shipyard' && <MenuScene />}
      {st.bloom && (
        <EffectComposer>
          <Bloom intensity={0.3} luminanceThreshold={0.92} luminanceSmoothing={0.25} mipmapBlur />
          <ToneMapping />
        </EffectComposer>
      )}
    </>
  );
}

export default function App() {
  const st = useSettings();
  const screen = useUI((s) => s.screen);

  // the browser only allows sound after a click or key press: start the audio then
  useEffect(() => {
    const go = () => { startAmbientSafe(); setScreenAudio(useUI.getState().screen); };
    window.addEventListener('pointerdown', go, { once: true });
    window.addEventListener('keydown', go, { once: true });
    return () => { window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); };
  }, []);
  useEffect(() => { setScreenAudio(screen); }, [screen]);
  useEffect(() => { loadAssetManifest(); }, []);

  useEffect(() => {
    return useGame.subscribe((s, prev) => {
      if ((s.phase === 'won' || s.phase === 'lost') && s.phase !== prev.phase) document.exitPointerLock();
      syncSim(s); // power, comms, equipment, alarms: reacts to changes only
      if (s.logId === prev.logId || s.phase === 'title') return;
      const e = s.log[s.log.length - 1];
      if (e) onLog(e.level);
    });
  }, []);

  // Esc on a menu screen goes back to the main menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const sc = useUI.getState().screen;
      if (e.code === 'Escape' && (sc === 'settings')) setScreen('menu');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Canvas
        key={st.shadows ? 'sh' : 'nosh'}
        shadows={st.shadows}
        dpr={[1, 1.5]}
        camera={{ fov: screen === 'game' ? 72 : 50, near: 0.05, far: 900, position: [0, 1.65, -2] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); showToast('3D graphics were lost. Reload the page (Cmd+R).'); });
        }}
      >
        <color attach="background" args={['#02040a']} />
        <World />
      </Canvas>
      {screen === 'game' && <HUD />}
      <Panels />
      <GameTutorial />
      <MainMenu />
      <SettingsScreen />
      <LobbyScreen />
      <ShipyardUI />
      <BriefingScreen />
      <DebriefScreen />
      <Toast />
    </div>
  );
}
