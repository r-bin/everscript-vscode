# Story chain: from a flag back to a new game

> Status: **not built** — researched and prototyped (2026-10-27, after v0.358.0), then parked.
> Related: [spawn-scenarios.md](../plans/simulation/spawn-scenarios.md) (room variants, built),
> [routes.md](../plans/simulation/routes.md) (Routes tab), the "Event-flag DAG" idea in
> [research-and-visualizations.md](research-and-visualizations.md).

## Goal

Pick a story flag — the outro, `INSIDE_OUTRO` (`$22f1` bit 6, names.json `8945:6`) — and get the
shortest chain of events that sets it, back to a new game, across rooms:

```
outro ← Carltron's ending scene ← final room gauntlet ← 8 dog buttons in 0x4a ← reach 0x4a ← … ← rocket ← energy core ← … ← new game
```

Each link: the room, what the player does there (enter, step on, press B, talk, kill), the
cutscene it plays, and the flags it needs. "Fastest" in the first version means **fewest
events**, not game time (travel and fight lengths come later, from Routes/combat).

## What is already known (evidence: this session's runs)

- **Writers of `INSIDE_OUTRO = 1`** (raw scan of `0x0C ce 04`, each decoded): `$93ACCF` (room 0x59
  enter), `$94CE10` (0x25), `$97C55C` (0x3a), `$97CB7C` (0x36), `$999386` (0x40), `$9ACFC1` (0x39) —
  all *outro scenes* that set it again while it is already set — and **`$9BB4E6`**, the first one.
  `$92D0DC` clears it (room 0x03 enter → `$92EDD8` → `$92D0D6`). `$A3BD26` decodes as `= 6`, reached
  by no room script (probably data).
- **The first setter** is reached from room 0x4a (final boss room) B-triggers: each of the 8
  (`$9BAC1C`…`$9BAC56`, boxes at x 51–67, y 37–38) calls `$9BABE4(<0x2847>-relative object, bit)`:
  only while the camera follows the Dog (`camera_entity_is_0f40`), it ORs its bit into `$2867` and
  sets its object to 2; when `$2867 == 0xff` it starts **`$9BA971`**: the gauntlet — two raptor waves,
  three Rimsalas, the dark Boy and dark Dog (each wave loops `hp_above_last_damage` + `sleep(60)`
  until dead) — then `WINDWALKER_UNLOCKED = 1`, heal, cure, and starts **`$9BB0B3`**: Carltron
  appears, a long dialogue (texts `0x21B1`…`0x21C0`), waits on `$285B`, then `INSIDE_OUTRO = 1` and
  `load_map(0x59, 9, 37)` (Quicksand Field, where the outro begins).
- Nothing above is in a knowledge entry yet: write `rom/9ba971.md`, `rom/9bb0b3.md`,
  `rom/9babe4.md` and a `ram/7e22f1.md` bit table when this is picked up.

## Why the existing simulation does not answer it

- `analyzeScript` on a 0x4a B-trigger caps (`all branches merged`, 1 path): the wave loops fork on
  an unknown every iteration and use the whole budget long before `$9BB4E6`.
- Talk / hit / death scripts are not in the room tables: they are hooked by `0x3D`/`0x3F`
  (trigger id → `Machine.triggerScript(id)`; mask `$40` talk, `$100` hit, `$200` death, `$400` run
  now). Boss "dead" flags come from death hooks. A room-by-room index must follow them.

## Design (prototyped in a scratch script, not in the repo)

1. **Static script graph** (prototype: ~2 min for the whole ROM). Every entry of
   `script-vm` `allEntries`, walked without calls; edges: call/start (`callee`) and hooks
   (`0x3D`/`0x3F`, ids read from the instruction's last words: `0x3D` id; `0x3F` mask, id). Roots: room
   enter/trigger scripts (`roomScripts`) and the header script `$92:800C`. Index: instruction →
   owning entries; flag bit → writer instructions; room → map-change instructions into it.
2. **Directed simulation** (engine change, `simulation/explore.ts`): `SimOptions.goal = { at }` — a
   path ends `goal` when a thread reaches `at`; paths where no thread (pc or a frame's return) can
   still reach `at` are dropped. Reach-sets come from a reverse walk (successors + calls + async
   starts). Needs `Instruction.successors` from the decoder (`decoder.ts`, script-vm `successors`).
   This is what makes wave loops end (the "keep waiting" side repeats its state → `loop`).
3. **Backward planner** (`simulation/story.ts`, AND-OR shortest path with memo):
   - `need(flag)` = cheapest writer `exec(X)`;
   - `exec(X)` = its root's prerequisite + the positive save-flag conditions the directed run from
     the root to `X` assumed (negative ones and temp/entity conditions listed, not chased);
   - room root ⇒ `reach(room)`; hook root ⇒ `exec(hooking instruction)` + "talk to / kill <entity>";
   - `reach(room)` = cheapest `exec(map change into room)`; base: the header script (new game).
   Then order the chosen events by dependency into one list.
4. **Output**: `node tools/simulation/story.mts --flag 8945:6`, then `soe://…/story/<flag>.md`, then
   the Routes tab (a chain is a route draft).

## Open questions

- Where exactly a new game starts (header script `$92:800C`, see `knowledge/rom/92de49.md`) and what
  the naming screen sets ("player name != empty").
- Doors with no script (exits in the room header) — the map-change index must include them, or
  `reach(room)` misses ordinary walking.
- Conditions on temp flags (`$2867`, in-room progress) are free in the plan; say so per step.
- Cost model beyond event count: travel (room graph distance), fights (`simulation/combat/`).

## Also parked: room-variant naming (from the v0.358.0 dump of all rooms)

- Rooms split on unnamed conditions make many identical "default" variants (0x08 Nobilia square
  19, 0x09 Aegis fight 23, 0x35 caves 12): split only on **named save flags**; fold the rest back
  into the default with "only if …".
- `$22ec` bit 5 also selects a Tinker variant in Ebon Keep (0x0d): relabel to the general
  "windwalker scene due" and widen `knowledge/ram/7e22ec.md`.
- Some townsfolk (Nobilia square) count as enemies in `maps.enemiesAt`: check their spawn flags.
