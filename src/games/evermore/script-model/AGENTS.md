# src/games/evermore/script-model — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- A room's scripts as the editor shows them (`buildRoomScriptModel`): listings in the compiler's
  notation, loot, doors, spawns; the arrivals index; the names scripts touch (`names.json`, kept
  and frozen: docs/cleanup.md D4 — no new names, rewrite in our words over time).

## Dependencies
- `../script-vm` (decoding, facts, printing), `../localizations` (script and room names),
  `platform/snes/`. `.depcruise.js` rule `script-model-on-script-vm`. No VS Code API, no filesystem.
- JS consumers require `dist/games/evermore/script-model` (no JS facade); TS imports `src/` directly.

## Invariants
- Meaning comes from script-vm's facts and the knowledge entries (loot: `ram/7e2391`,
  `ram/7e2461`, `rom/92a482`), never from instruction text.
- Loot and doors are read per path (`paths.ts`): a value staged on one branch never reaches the
  other. A call by global id is a step, not inlined: those are the shared drivers.
- A name lookup that misses returns '' or null, never a placeholder.

## Tests
- ROM: `tests/script-model/rom.test.js`; the simulation's `tests/simulation/loot.test.js` checks
  every pickup against what the model reads.
