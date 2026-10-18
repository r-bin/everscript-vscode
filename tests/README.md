# tests/

Every `*.test.js` is a plain node script (no framework) in one tier of
[tiers.json](tiers.json); `tools/test.mts` runs them and fails when a file is in no tier.

| Tier | Needs | Run |
|---|---|---|
| `unit` | nothing | `npm test` (with the grammar tests), ~7 s |
| `rom` | a ROM in the ROM library — found with `require('../../dist/games').romPath(game)`; skips without | `npm run test:rom` |
| `dom` | headless Chromium (Playwright): real pages, real stylesheets | `npm run test:dom` |
| `emulator` | the built snes9x cores | `npm run test:emulator` |

`npm run test:all` runs every tier after building the cores and the music engine; the release
ritual runs it. A test never holds ROM bytes or extracted assets (root AGENTS.md §0.1): it reads
the user's ROM and checks facts (offsets, counts, hashes).

The runner names a file still running after a minute, and kills one past `TEST_TIMEOUT` seconds (900)
as stuck. End a test with `process.exitCode = …`, not `process.exit(…)`: on Node 26 `exit()` can
deadlock (`tests/script-vm/units.test.js` hung in 9 of 15 runs).

Folders follow the code they test: `memory/` (radar, rooms, map editor, `soe://`), `debugger/`
(emulator, CDL, TAS, debugger), `simulation/`, `mana/`, `terra/`, `localizations/`.
