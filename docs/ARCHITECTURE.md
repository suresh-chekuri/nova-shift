# NOVA SHIFT — Architecture Overview

NOVA SHIFT is a single-player browser game. One TypeScript/React app (Vite, React Three Fiber, zustand) plus a tiny Node file server for hosting.
Multiplayer and the other-player character models were removed.

## Parts
| Part | What it does | Where |
|---|---|---|
| Game rules | Pure functions on a `GameState`: power, antenna, instruments, events, objectives, scoring. No React. | `src/sim.ts`, `src/design.ts` |
| Ship layout | Rooms, walls, colliders, consoles. Shared by drawing, movement and tests. | `src/world/layout.ts` |
| State | zustand stores for UI, settings, design, shipyard, saves and the game. `act()` plays a sound and calls `mutate()`. | `src/store.ts` |
| World | First-person movement, collisions, the 0.1 s game loop (`GameLoop`, pauses when the mouse is free), the ship and interior. | `src/world/` |
| UI | Menu, shipyard, HUD, console panels, briefing, debrief, settings. | `src/ui/` |
| Audio | All sound is made with WebAudio. | `src/audio.ts` |
| Tutorial | 7 guided steps. | `src/tutorial.ts` |
| Crash screen | Shows an error message instead of a blank page. | `src/CrashGuard.tsx` |
| Server | Serves the built `dist/` folder. Missing files with an extension return 404. | `server/index.js` |

## Data
- Settings: `nova-settings` in localStorage. Tutorial done: `nova-tutorial`. Saved designs: in localStorage (`design.ts`).
- Optional ship part models: `public/models/manifest.json` (currently `{}`).
- Nothing is sent over the network. The server keeps no data.

## Tests
`npm run test:sim`, `npm run test:layout`, and `npx tsx scripts/audio-test.ts`.

## Deploy
Build command: `npm install --include=dev && npm run build`. Start command: `npm start`. See `render.yaml`.
