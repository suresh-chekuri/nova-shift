# NOVA SHIFT: THE LAST SIGNAL (V2)

Design a spacecraft. Engineer its power. Survive the mission. Up to 4 players can play together.

## Run it
1. Install Node.js 18 or newer.
2. In this folder run: `npm install`
3. Then run: `npm run dev`
4. Open http://localhost:5173 in Chrome or Edge.

`npm run dev` starts two things: the game (Vite, port 5173) and the multiplayer server (Socket.IO, port 3001).

## Play with friends (same Wi-Fi)
1. The host runs `npm run dev`.
2. The host finds their computer's IP address (for example 192.168.1.20).
3. Friends open `http://HOST-IP:5173`.
4. Host: MULTIPLAYER > HOST GAME. Share the 4-letter code.
5. Friends: MULTIPLAYER > JOIN GAME. Pick a role and press READY.
6. Host: design the ship in the Shipyard, then START MISSION.

## Main menu
- NEW MISSION: unlocks after the tutorial. Opens the Shipyard, then the briefing.
- DESIGN SPACECRAFT: build and save your ship.
- MULTIPLAYER: host or join a crew.
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

## Other players
In multiplayer, the other players have a ring on the floor in their role color and a name tag. They wear the real Advanced Crew Escape Suit model (`public/models/crew-suit.glb`) is ON by default. You can turn it off in Settings (**Real crew suit for other players**). If it faces backwards, use **FLIP DIRECTION** in Settings. Model detail LOW always uses the simple astronaut.

## Controls
W A S D move, mouse look, Shift sprint, E interact, Esc close a panel / free the mouse.

## Roles (multiplayer)
- COMMANDER: objectives, orders, engine.
- ENGINEER: generator, power routing, repairs.
- SCIENCE OFFICER: instruments.
- COMMUNICATIONS OFFICER: antenna and transmit.
If a role is empty, anyone can do that job. The host runs the mission; other players send actions to the host.

## Tests
- `npm run test:sim` — mission, power, design rules
- `npm run test:rooms` — multiplayer rooms
- `npm run test:layout` — every room and console can be reached
- audio test: `npx tsx scripts/audio-test.ts` (uses a fake sound card; no speakers needed)

## Multiplayer notes
- The host runs the mission. If the host's browser tab is hidden, a timer keeps the mission running for the other players.
- If the host leaves, the room closes for everyone. There is no reconnect: if your internet drops, join a new room.
- The server ignores bad messages instead of crashing, and it waits up to 60 seconds for a slow tab to answer.
