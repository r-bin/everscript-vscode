# script-model

What the editor shows about a room's scripts, built on [script-vm](../script-vm/README.md).

| File | What |
|---|---|
| `room-model.ts` | `buildRoomScriptModel(rom, room)`: the enter script and each trigger as a listing (every instruction control reaches, in byte order, in the compiler's notation), with loot, doors and spawns; `scriptModel` for one script |
| `merged.ts` | `mergedEnterScript(rom, room)` / `mergedScript`: one listing with every call's body after its call line and every started thread after the line that ends its starter's turn (rom/8ccffd.md), each a fold (short-operand callees start folded); recursion and a line cap stop it; each line's `indent` counts the ifs and loops around it in its script (an else-if chain stays on one level) — a called body sits at its call line's indent, a thread one deeper; `flat` is the indent without the structure (viewers can switch it off: `raw`, no braces); `mergedEnterScript` prints with `displayNames`: the knowledge entries' names where the compiler's have none (for reading; may not compile). `mergedRoomScript` does the same for a trigger's script. A short call (global id, trigger offset) prints by its global's or its script's name. Each block has a `role` (`roleOf`: exit, sniff, loot, cutscene, from facts); `arg[]` / `temp[]` print as their slices, a reused one warned |
| `icons.ts` | `iconRefs`: which in-game icon a printed line can show and after which token — an enemy it spawns, a reward, prize item, weapon or dog form it writes or compares with (from facts); rows and merged lines carry them as `icons` |
| `slices.ts` | `slicesOf`: the slot's local bytes per thread and the room's temp area cut into the cells a listing uses, each typed by its uses (`entity`, `flags`, `byte`, `word`) and named generically (`arg.entity_1`); two widths, bits and a value, or an overlap make it `reused` |
| `structure.ts` | one script's instructions as structured code: `if (…) { } else if (…) { } else { }` and `while (…) { }` from its branches and jumps (in byte order); what does not nest stays a `goto`. The merged listing prints with it (`raw` keeps the instruction as printed) |
| `paths.ts` | Every path through a script; calls to local scripts run inline, calls by global id are steps |
| `loot.ts` | What a pickup gives, per path, from the loot mailbox it stages; `_loot` / `_loot_chest` text where it compiles back exactly |
| `doors.ts` | Where `change_map` sends the player, with the globals, music and writes on the way |
| `arrivals.ts` | Every door in the ROM, indexed by the room it leads into |
| (spawns) | a spawn's `character` comes from the ROM's enemy index (`ScriptRom.enemyCharacter`, rom/8eb55a), not `names.json`, which has 10 ids wrong |
| `names.ts`, `names.json` | Names for cells, flags, scripts, rooms, enemies, rewards; `printNames()` hands them to script-vm's printer as identifiers. Constants (`MUSIC`, `SOUND`, `ADDRESS_ID`, `DOG`, `SCRIPT_TRIGGER`, `ANIMATION_MODE`), entity fields (`ATTRIBUTE`) and cells names.json lacks (`MEMORY`, not in the temp area) come from the compiler's enums (`language/data/index.json`); which operand takes which enum is script-vm's `parameters.json`, which cell holds which (`CELL_TYPES`) ours, from the knowledge entries; `inEnum` lets the printer warn about a value the enum lacks |

Rooms on the US layout only (script-vm's `ScriptRom` refuses others).
