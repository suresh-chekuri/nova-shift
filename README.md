# NOVA SHIFT: THE LAST SIGNAL (V2)

Design a spacecraft. Engineer its power. Survive the mission. This is a single-player game.

## Run it
1. Install Node.js 18 or newer.
2. In this folder run: `npm install`
3. Then run: `npm run dev`
4. Open http://localhost:5173 in Chrome or Edge.

`npm run dev` starts the game (Vite, port 5173).

## Put it online (optional)
Run `npm run build`, then `npm start`. The server serves the built game on one port (`PORT`, default 3001). The file `render.yaml` has the settings for Render.

## Main menu
- NEW MISSION: unlocks after the tutorial. Opens the Shipyard, then the briefing.
- DESIGN SPACECRAFT: build and save your ship.
- TUTORIAL: 7 guided steps (movement, design, power, comms, science, objectives, complete).
- SETTINGS: volume, mouse speed, bloom glow, shadows.

## The Shipyard
Flow: SELECT a part > ATTACH it > INSPECT > OPTIMIZE > VALIDATE > LAUNCH.
1. Choose a mission at the top: LUNAR ECHO, LUNAR SURVEY or DEEP SPACE RELAY. Each has its own budget, launch capacity, required parts and scoring.
2. Pick a category tab on the left, then pick a part. A blue hologram of it shows on the ship. The points where it fits glow yellow.
3. Press ATTACH, double-click the card, or click a yellow point on the ship. Parts grow onto the ship. REMOVE COMPONENT takes them off.
4. Drag to rotate, scroll to zoom. ROTATE turns the slow spin on or off.
5. The dashboard (right) shows mass, cost, power, battery, data rate, science value and propulsion. Red checks say how to fix the problem.
6. VALIDATE makes the failing parts glow red on the ship. LAUNCH only works when every check passes.
7. SAVE DESIGN keeps the ship (parts, mission and which instrument sits on which hardpoint). LOAD brings it back. RESET DESIGN goes back to the standard ship.
The ship you build is the ship you fly: its power, battery, antenna, engine, frame and instruments set the mission rules.

### Missions
- LUNAR ECHO: needs the Signal Analyzer. Budget $400M, 800 kg.
- LUNAR SURVEY: needs the Lunar Spectrometer and the Seismic Sensor. Budget $350M, 750 kg.
- DEEP SPACE RELAY: needs the Deep Space Communication Array and an Advanced or High-Capacity power system, plus one instrument (it makes the test data). Budget $480M, 850 kg.

## 3D models
Every part has its own detailed model, built in code (no downloads needed): frames with panels, bolts and thermal foil, solar wings made of individual cells, engine bells with plumbing and animated exhaust, dish antennas with feed horns, battery packs and science instruments.
- SETTINGS > Model detail (LOW / MEDIUM / HIGH) changes how much detail is drawn. Use LOW on a slow laptop.
- Optional: you can add real `.glb` models. See `public/models/README.md`. If a file is missing or fails to load, the built-in model is used.

## Inside the ship (V3)
- Every room has real equipment: pilot seats with harnesses, big nav and mission screens, power cabinets, battery racks, coolant pipes, lab benches, sample storage, radio racks, an antenna control unit.
- NEW room: the AIRLOCK. Go through the door in the south wall of Engineering. It has an inner door, an outer hatch, EVA suits, oxygen bottles and a pressure screen.
- Doors slide open when you walk near them.
- The screens and small lights are LIVE. They show the real simulation (power, battery, link, instruments).
- Walls have panels, vents, cable trays, floor grates, maintenance hatches and warning labels.

## Sound (V3)
All sound is made in code (no sound files). One audio system (`src/audio.ts`) runs everything.
- A ship hum and air vents are always on. Each room adds its own sound, and it fades smoothly as you walk between rooms.
- Sounds come from where the machine is (left/right and distance). Sounds from another room are muffled.
- Real events make sounds: generator start and fail, power back, breakers, instruments on/off, transmit, link lost, alarms, mission win or loss.
- Alarms play in short pulses and get quieter. They stop when the problem is fixed.
- SETTINGS: Master, Ambient, Sound effects and Music volume, and a MUTE button.

## Controls
W A S D move, mouse look, Shift sprint, E interact, Esc close a panel / free the mouse.

## Tests
- `npm run test:sim` — mission, power, design rules
- `npm run test:layout` — every room and console can be reached
- audio test: `npx tsx scripts/audio-test.ts` (uses a fake sound card; no speakers needed)


## Play on a phone or tablet (Android and iOS)

The game runs in the phone browser. No app store is needed.

- Open the game link in Chrome (Android) or Safari (iPhone/iPad). Use landscape.
- Left thumb: move. Push the stick all the way to sprint.
- Drag on the right side: look around.
- USE button: same as pressing E. It lights up near a console.
- Install: Android Chrome menu > "Add to Home screen". iOS Safari Share > "Add to Home Screen". It then opens full screen.
- Phones start with "low" graphics. Change it in Settings if the phone is fast.

## Moon and Earth

Both planets are drawn by code (craters, continents, clouds, atmosphere glow).
To use real NASA pictures, see `public/textures/README.md`.

## Ship interior art (files)

- `src/world/interior/pbr.ts` – wall, floor and ceiling maps, plus grain maps, all drawn by code.
- `src/world/interior/kit.tsx` – shared materials (brushed steel, paint, composite, foil, rubber) and small parts.
- `src/world/interior/Shell.tsx` – walls, floor plates, ceiling, I-beams, wall ribs, light fixtures, blue accent strips.
- `src/world/interior/Hero.tsx` – generator, batteries, science instruments, dish, console screens, coolant pump, tool cart, airlock hatch hardware.
- `src/world/interior/Rooms.tsx` – per-room equipment (racks, benches, seats, suit lockers).
- Lighting is in `Lights()` in `src/world/Ship.tsx` (each room has its own tint; emergency lights turn warm red).

## Cinematic space and music
- **Moon:** drawn by code in `moonMaps` (`src/world/planets.ts`): real sea positions (Imbrium, Serenitatis, Crisium...), basin rings, thousands of craters, rayed craters like Tycho, and a nearly all-highland far side. The near side faces the ship windows.
- **Space (all made by code):** `src/world/deepspace.tsx` — 7,000 stars (one draw call, fixed to the camera), Milky Way, soft nebulae, galaxies, a ringed planet, a red planet, asteroids, a satellite, a comet, debris. Quality LOW draws fewer stars and skips galaxies and the comet.
- **Music:** `setMusic` in `src/audio.ts` — drone, pad, shimmer and sparse bells with reverb. No audio files. Volume sliders are in Settings.

## NASA data in the game
- `src/nasa.ts` loads real data from the NASA Open APIs when the game starts: solar flares (DONKI), near-Earth asteroids (NeoWs) and the Astronomy Picture of the Day title. Results are cached for 3 hours. If the network or the key fails, clearly marked sample data is used and the game still works.
- Where it shows: a ticker under the main display on the Command Deck, one data alert about 40 seconds into a mission, and a short "Did you know?" card the first time you enter each room (not in the tutorial). Nothing changes gameplay.
- Key: create a free key at api.nasa.gov and set `VITE_NASA_API_KEY` (in Render: Environment, then rebuild). Without it the shared `DEMO_KEY` is used, which has a small limit.
- Real Moon maps: see `public/textures/README.md`.
- Test: `npm run test:nasa`.
