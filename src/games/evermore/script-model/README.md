# script-model

What the editor shows about a room's scripts, built on [script-vm](../script-vm/README.md).

| File | What |
|---|---|
| `room-model.ts` | `buildRoomScriptModel(rom, room)`: the enter script and each trigger as a listing (every instruction control reaches, in byte order, in the compiler's notation), with loot, doors and spawns; `scriptModel` for one script |
| `merged.ts` | `mergedEnterScript(rom, room)` / `mergedScript`: one listing with every call's body after its call line and every started thread after the line that ends its starter's turn (rom/8ccffd.md), each a fold (short-operand callees start folded); recursion and a line cap stop it |
| `paths.ts` | Every path through a script; calls to local scripts run inline, calls by global id are steps |
| `loot.ts` | What a pickup gives, per path, from the loot mailbox it stages; `_loot` / `_loot_chest` text where it compiles back exactly |
| `doors.ts` | Where `change_map` sends the player, with the globals, music and writes on the way |
| `arrivals.ts` | Every door in the ROM, indexed by the room it leads into |
| `names.ts`, `names.json` | Names for cells, flags, scripts, rooms, enemies, rewards; `printNames()` hands them to script-vm's printer as identifiers |

Rooms on the US layout only (script-vm's `ScriptRom` refuses others).
