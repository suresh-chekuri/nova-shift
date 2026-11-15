# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NOVA SHIFT: THE LAST SIGNAL is a single-player browser game. Players design a spacecraft in the Shipyard, then walk around inside it in first person and keep it running (power, comms, science) until the mission ends. It uses React 18, @react-three/fiber with drei and postprocessing, zustand, Vite, and a small Node server that serves the built game. Node 18 or newer is required.

## Commands

- `npm install` installs the packages.
- `npm run dev` starts Vite on port 5173 (`--host`, so other devices on the LAN can open it).
- `npm run build` writes `dist/`. `npm start` runs `server/index.js`, which serves `dist/` on `PORT` (default 3001). Render deploys this way (`render.yaml`).
- Type check: `npx tsc --noEmit`. There is no lint script, and `tsconfig` has `strict: false`.

Tests are plain Node scripts, not a test framework. Each prints PASS/FAIL lines.
- `npm run test:sim`: mission, power and design rules (`scripts/sim-test.ts`). It uses a seeded random function.
- `npm run test:layout`: a flood fill that checks every room and console can be reached past the colliders (`scripts/layout-test.ts`).
- `npx tsx scripts/audio-test.ts`: audio checks against a fake AudioContext.
- To run part of a test, run that one script directly. There is no way to filter by test name.

The sim and layout tests use `node --experimental-strip-types`. Because of this, `src/sim.ts`, `src/design.ts`, `src/world/layout.ts` and any files they import must:
- use explicit `.ts` extensions in imports (`allowImportingTsExtensions` is on)
- avoid syntax that type stripping can't handle, such as enums and parameter properties
- never import React, three, or browser-only modules

## Architecture

### Pure logic and the React layer
- `src/design.ts` holds the part catalog, the missions (`echo`, `survey`, `relay`) with their budgets and required parts, `computeStats`, the `validate` checks, and design save/load in localStorage.
- `src/sim.ts` holds all game rules as plain mutating functions on a `GameState`: `createState`, `startMission`, `tick(g, dt, rand, ctx)`, `toggleSwitch` and the other actions, and `finish`. It has no React. The design you fly sets the mission rules: `startMission` and `setDesign` derive power, battery, antenna and engine from `computeStats(design)`.
- `src/world/layout.ts` holds the ship interior geometry: rooms, corridors, wall segments, `COLLIDERS`, `INTERACTABLES` and `roomAt`. Rendering, movement and the layout test all share it.

### Store (`src/store.ts`)
Separate zustand stores: `useUI` (screen, open panel), `useSettings` (saved to localStorage as `nova-settings`), `useDesign`, `useYard` (Shipyard selection), `useSaves`, `useNet`, and `useGame` (the `GameState` plus action methods).
- State changes go through `mutate(fn)`, which clones the state, runs a sim function on the clone, then calls `setState`. Don't change `useGame` state in place.
- Every player action goes through `act(name, args)`: it plays the sound and then calls `mutate`. To add a new action, update `Actions`, `LOCAL`, `SOUND` and the `useGame` initializer together.

### Rendering (`src/App.tsx`)
There is one `<Canvas>`. `useUI.screen` picks the scene: `Ship` + `Player` for `game`, `ShipyardScene` for `shipyard`, and `MenuScene` for everything else. HTML overlays in `src/ui/` sit on top and decide for themselves whether to show, based on screen, phase and panel.
- Spacecraft parts in `src/world/parts/` are built procedurally in code. `parts/assets.tsx` can swap in optional `.glb` files listed in `public/models/manifest.json`, keyed `category.partId`; if a file is missing or fails to load, the built-in model is used. The ship points along +Z. Anchor positions are listed in `public/models/README.md`.
- The Model detail setting (`low`/`medium`/`high`) controls how much detail is drawn.

### Audio (`src/audio.ts`)
All sound is generated with WebAudio; there are no sound files. `App.tsx` subscribes to `useGame` and calls `syncSim(state)`, which reacts only to changes, and `onLog(level)` for log entries. Audio starts on the first pointer or key press. `src/sfx.ts` re-exports `sfx`.

### Tutorial
`src/tutorial.ts` defines 7 guided steps. During a tutorial, design edits are applied to the live ship (`putDesign` in the store). Finishing the tutorial sets the `nova-tutorial` key in localStorage, which unlocks NEW MISSION.

A longer architecture overview with flows, risks and open questions is in `docs/ARCHITECTURE.md`.
