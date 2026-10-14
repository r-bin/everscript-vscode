# simulation/ — running scripts to see what they do

Rules for changing this folder: [AGENTS.md](AGENTS.md). Design history:
[/simulation](../../simulation/README.md).

The decoder (`src/script`) says what each instruction *is*. This folder runs them, from
an unknown save, and reports what happens and under which conditions:

- **A pickup** — "1 × CALL_BEADS when Thraxx dead [`$2260&0x10`], 1 × BISCUIT otherwise".
  Not read off the bytes: the simulation follows the trigger into the game's own loot
  scripts and watches which inventory byte goes up (`$231C += 1`).
- **A room** — its enter script as *scenarios* (credits / outro / windwalker arrival /
  default, …) arranged as a flag tree, each split into *prepare* (before the fade-in) and
  *execute*, with the NPCs it places, the RAM words their handles go to, and the flags that
  gate them; every trigger as cases; triggers clustered (pickups, exits, dialog) and pickups
  linked to the enter-script lines that hide them once taken.
- **Everscript** — any script as structured `if`/`else` Everscript that compiles back to
  the ROM's exact bytes.

```js
const sim = require('./src/simulation').createSimulator(rom);
sim.analyze(0x94e0ed);           // cases of one script
sim.room(0x25);                  // scenarios, flag tree, triggers, clusters
sim.emit(0x94e0ed, 'gourd');     // { tree, everscript, structured }
require('./src/simulation').roomReport(sim.room(0x25));   // Markdown
```

`soe://rom/assets/scripts/rooms/<id>/simulation.md`, `simulation.json` and `decompiled.evs`
serve the same for AI clients.

## How it works

| File | Does |
|---|---|
| `sym.ts` | Symbolic values: constants, unknown WRAM (`mem`), unknowns from outside (`atom`), entities, operators, merged values (`ite`). Simplifies on construction, so anything knowable is a constant. |
| `memory.ts` | WRAM as byte cells over an unknown start; `Pin`s; diffs; merging under a condition. |
| `operand.ts` | The postfix operand grammar, *evaluated*. Written from the everscript compiler's operand table, not from the legacy decoder. |
| `step.ts` | One instruction: flow, calls (globals resolved with the `$92:8008` term, see `knowledge/rom/8cd3a0.md`), writes, flags, objects, placements; the rest is an opaque event with its text. |
| `state.ts` | A path: pc, frames, WRAM, assumptions, trace, placed NPCs; merging two paths. |
| `explore.ts` | Runs a script to every end. *Paths* mode keeps every outcome apart; *rejoin* mode merges sides of a branch at its join (`cfg.ts`) — or, inside a call, at the return — so independent `if`s do not multiply. |
| `cfg.ts` | Control-flow graph and immediate post-dominators: where a branch's sides meet. |
| `understand.ts` | WRAM diff → changes (`+= n`, flag bits, stores) and loot outcomes. |
| `trigger.ts` | A small script as cases; falls back to merging when it is too branchy, and says so in `detail`. |
| `segments.ts` | A trace → parts (place NPC, objects, transition, dialog, …); prepare/execute split. |
| `room.ts` | Scenarios (endings + branches that leave or play a scene), flag tree, clusters. |
| `everscript.ts` | Neutral tree from the script's own flow; Everscript out. |
| `report.ts` | Markdown report, JSON summary, room Everscript. |

`sym.ts` is ~330 lines: the value algebra, its memoisation and size bound interlock (every
constructor uses them), so splitting it would only scatter one set of rules.

## What it found

- **The legacy decoder over-reports four Ebon Keep pickups** (`$98:CCCC` and three more):
  it carries a `$2461` bonus staged on one path into another. The simulation gives the
  game's amounts; `loot.test.js` pins one.
- **The whole inventory layout** falls out of simulating global `0x3e` once per item —
  [knowledge/ram/7e22ff.md](../localizations/knowledge/ram/7e22ff.md).

## Limits

- Opaque instructions (movement, text, sprites, …) are recorded, not modelled; if one
  writes WRAM the simulation does not know.
- Currency comparisons (`0x0a/0x0b/0x8e/0x8f`) fork on a named unknown rather than on money.
- Async calls are listed, not run alongside.
- ~18% of room scripts have a condition with no exact Everscript spelling yet; those are
  emitted as raw `code(...)` (still identical bytes).
