# /simulation — design notes

Written for: whoever builds the simulation, including future agents in this
repo. Design only — **no code lives here yet**, and the plan is deliberately
md-first.

The Rooms tab currently answers *what a room contains*. This folder plans the
next question: *what happens in it*. One virtual WRAM, one script
interpreter, and a set of views that read and write it.

## The one rule that decides everything

The tab's whole value is that it never guesses. A simulation is where that
gets hard, because a simulation must produce **a** state, and the ROM does
not name a starting one. So:

> Every value on screen is either read from the ROM, computed by a routine
> ported from the ROM, or **labelled as an assumption the user chose**.

Anything that cannot meet that says "undecided" and counts itself. A branch
the model cannot evaluate is reported, not picked. This is the same
discipline the format docs follow, and the reason the spawn list is
presented as a superset today.

## The pieces, in build order

| | Page | Depends on |
|---|---|---|
| 0 | [virtual-wram.md](virtual-wram.md) — the state everything reads and writes | — |
| 1 | [damage.md](damage.md) — what one entity does to another | ROM tables (mostly done) |
| 2 | [spawn-scenarios.md](spawn-scenarios.md) — which enemies a room actually places | 0 |
| 3 | [entities.md](entities.md) — the scripts and flags a placed NPC carries | 0, 2 |
| 4 | [interaction.md](interaction.md) — walking the room: exits, loot, doors, fights, dialog | 0–3 |
| 5 | [cutscenes.md](cutscenes.md) — playing a scripted scene out | 0, 4 |
| 6 | [routes.md](routes.md) — saving a route and replaying its odds | 1, 4 |

0 and 1 are independent and can start together. Nothing after 2 is worth
starting before the interpreter can run an enter script end to end.

## What already exists

Real, tested, and reusable — this is not a green field:

- **Script decoding** — [`src/script/`](../src/script/README.md) walks every
  opcode, resolves operands, and names spawns, loot and transitions.
  [`expression.ts`](../src/script/expression.ts) renders the operand grammar
  as text; the simulation needs the same grammar *evaluated*.
- **Damage** — [`src/maps/alchemy-model.js`](../src/maps/alchemy-model.js)
  and [`tests/memory/damage.test.js`](../tests/memory/damage.test.js), from
  [docs/alchemy-damage.md](../docs/alchemy-damage.md).
- **The map model** — collision, planes, triggers, objects and their states,
  arrivals, hitboxes, attack boxes, sprite priority. See
  [docs/script-format/](../docs/script-format/README.md).
- **Prior notes to fold in, not duplicate** —
  [docs/room-simulation.md](../docs/room-simulation.md) (the enter-script
  problem and the two unknowns the encoder already settled) and
  [docs/route-planner.md](../docs/route-planner.md) (an earlier sketch of 6).

## Where the code will go

`src/simulation/`, as a pure domain with no VS Code API and no rendering, the
way `src/maps/` and `src/script/` are — so it stays testable in plain Node.
The tab that drives it belongs in `src/rooms/`. This folder stays prose.
