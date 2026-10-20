# src/games/evermore/simulation — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- Running scripts symbolically: values, WRAM, paths, forks, merges (`sym`, `memory`,
  `operand`, `state`, `step`, `explore`, `cfg`).
- Reading meaning out of a run: loot, changes, cases, scenarios, parts, clusters
  (`understand`, `trigger`, `room`, `segments`), the reports and the Everscript round trip
  (`report`, `everscript`).

## Dependencies
- Library: no VS Code API, no filesystem, no rendering.
- The instruction decoder sits behind `machine.ts`'s `Decoder`; `decoder.ts` implements it on
  `../script-vm` (boundaries, control flow, placements, the text) and `../script-model` (names).
  Only that file imports outside this folder. Values and conditions are computed by `operand.ts`.
  Which opcodes touch text, sound or the screen is in `reach.ts` / `por.ts` as opcode sets, never
  read from the instruction text. `.depcruise.js` rule `simulation-is-a-library`.
- Consumers `require('../simulation')`, never `./dist`. `soe://` serves it
  (`src/games/evermore/resources/simulation-files.ts`).

## Invariants
- Never guess state. A WRAM read nobody wrote is `mem(addr)`; only `Pin`s change that, and
  every pin carries a `why` the report shows. `PINS_BETWEEN_PICKUPS` is the one default.
- Undecided is a result: an unknown condition forks, the path records it, and a later test
  of the same condition follows the first answer. Never pick a side.
- `operand.ts` must land on the decoder's instruction boundary. A mismatch goes to
  `Machine.layoutErrors` and the instruction runs as opaque — `room.test.js` requires the
  set to stay empty over every room.
- Do not read the legacy decoder's opcode cases while changing `operand.ts`/`step.ts`;
  their spec is the sibling compiler's operand table and our docs (`docs/scripts/`, clean room as in `docs/cleanup.md` D3).
- Merging: only paths at the same instruction, frame stack and operand stack merge; a merge
  keeps only conditions both sides assumed alike and lists the rest as `either`.
- Values stay bounded: memoise anything that walks a `Sym` (merged values are DAGs) and
  keep `bounded()` on every constructor that nests.
- `emitScript` output must compile to the ROM bytes; anything without an exact spelling is
  raw `code(...)`, never an approximation.
- The scheduler model is the game's (`knowledge/rom/8ccffd.md`); change it only with
  `scheduler.test.js` passing — it replays the real game instruction by instruction.
- Exact runs (trace/snapshot, oracles) never use `abstractVisual`; analysis runs say when they
  did, and every unknown timing order that matters is a recorded condition.
- Budgets (steps, ticks, paths) end runs as `capped`/`horizon`, never silently.

## Tests
- Unit: `tests/simulation/sim-units.test.js` (no ROM).
- ROM (skip without it; ROM library): `loot.test.js` (910/910 pickups agree with the
  decoded loot), `room.test.js` (Fire Eyes' Village; layout over every room).
- ROM + everscript checkout with `.venv` (`EVERSCRIPT_REPO`): `everscript.test.js` compiles
  every emitted room script and requires identical bytes.
- Debugger core + ROM: `scheduler.test.js` (records the game headless, replays exactly).
- `npm run test:simulation` runs all five; `tools/simulation/sweep-rooms.js` analyses every room; `tools/simulation/exit-cutoff.js` lists the scripts a room change cuts off.
