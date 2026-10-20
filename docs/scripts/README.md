# Event scripts

Everything about Evermore's event scripts: the bytecode the game runs for rooms, NPCs, cutscenes and
pickups. Written from the game's own interpreter and checked against the running game.

## Where to read what

| You want | Read |
|---|---|
| what one opcode does, why, its name, how scripts use it | `soe://rom/assets/scripts/opcodes/<xx>.md` (the one description per opcode: `src/games/evermore/localizations/knowledge/opcodes/<xx>.md`) |
| all 256 opcodes in one table | `soe://rom/assets/scripts/opcodes/index.md` |
| opcodes by topic | `soe://tags/opcode.<group>` (flow, call, movement, text, money, ...) |
| a room's scripts, decoded | `soe://rom/assets/scripts/rooms/<room>/` |
| the overview of the opcode space: kinds, groups, duplicates, garbage operands, naming rules | [opcodes.md](opcodes.md) |
| how the interpreter works: threads, packed pointers, operand tokens, expressions | [vm.md](vm.md) |
| the handlers' 65816 code as C | `soe://rom/<handler>.c` (from [../disassembly/script-vm/](../disassembly/script-vm/)) |

## What scripts do

| Page | Topic |
|---|---|
| [loot.md](loot.md) | What a pickup gives, and writing it back as Everscript |
| [map_transitions.md](map_transitions.md) | Doors: where a trigger sends the player |
| [arrivals.md](arrivals.md) | The doors that lead *into* a room |
| [enemy_spawns.md](enemy_spawns.md) | Which NPCs a script places, and where |
| [trigger-modernization.md](trigger-modernization.md) | Trigger exit detection, companion/enemy triggers (a design spec) |
| [room-simulation.md](room-simulation.md) | Deciding which branch an enter script takes (not built) |
| [debugging.md](debugging.md) | Debugging scripts in the emulator: `.evs` breakpoints, byte-script state |

## Related

- [../entities/](../entities/README.md): the characters scripts spawn and move (records, sprites, boxes,
  the animation bytecode, which is a separate VM).
- `src/games/evermore/script-vm/`: the decoder and the script viewer's names (`spec.ts`, `print.ts`).
- The Everscript compiler (sibling repo `everscript`) writes these bytes; its wrapper names are listed in
  each opcode entry's `everscript:`.
