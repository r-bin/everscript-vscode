# Which tables can move to the extension, and what each one buys

A table indexes content by id. In vanilla each table sits right in front of other data, so it
cannot grow. If a table moves to the 4 MB extension (file `0x300000–0x3FFFFF`), it can grow up to
the limit the *engine* puts on the id, and that limit is the resource we gain.

This page lists every id-indexed table we know of, with:

- **Used / limit:** how many entries vanilla uses, and the most the engine can address.
- **Status:** whether we can already move the table.

The plan for the first test hack, which moves tables one at a time, is in
[table-hack.md](table-hack.md). Enemies and palettes, from ROM through WRAM to CGRAM, are in
[enemies-and-palettes.md](enemies-and-palettes.md).

Status values:

- **proven ✓**: moved by the table hack (`tools/table-hack/`), and the game played exactly like the
  original over the attract-loop playback (sample-playbacks skill). That playback reaches the table's
  readers.
- **works, not identical**: added by a hook (new code). It works in game, but the extra CPU cycles
  change the game's random numbers, so a playback no longer matches the original frame for frame.
- **moved ✓**: moved in the Asar export, and the game ran the same headless.
- **movable**: the export already names the table as a label, but nobody has moved it yet.
- **needs readers**: the table can probably move, but not every piece of code that reads it is
  known yet.
- **bank-bound**: the engine finds it as a 16-bit offset inside one fixed bank, so moving it means
  new code. Moving the table alone gains nothing.

Sources: [asm-to-c-port.md §11](reverse-engineering/asm-to-c-port.md),
[cdl-export-build-recomp.md](reverse-engineering/cdl-export-build-recomp.md),
`src/emulator/cdl/known-regions.js`, `src/rom/model/*`, and our own measurements on a clean ROM.
*(to verify)* marks what has not been checked on the running game.

## Tables worth moving

| Table | Address | What more you get | Used / limit | What sets the limit | Status |
|---|---|---|---|---|---|
| Map table | `$9FFDE7`, 4 B/room | **more rooms** | **127 / 256** | Room enter-script lookup uses an 8×8 hardware multiply. In place, the table can only reach 134 slots before the end of bank `$9F`. | **proven ✓** (`$B1:8000`, v0.222.0) |
| Room enter scripts | `$92801B`, 5 B/room | an enter script per new room; grows with the map table | **127 / 256** | the same 8×8 multiply | **proven ✓** (`$B1:9000`) |
| String keys | `$91D000`, 3 B/key | **more strings** (dialogue, names, menu text) | **3,002 / ~10,900** | The table must stay inside one 32 KB bank half. Keys are 16-bit byte offsets, which would allow ~21,800. | **proven ✓** (`$B1:A000`). String #3003 added through everscript and shown in game. |
| Script pointer table: trigger/NPC entries | `$928294`, 3 B | **more trigger and NPC scripts**: step-on, B-button, talk, kill | **1,917 / ~21,800** | Ids are 16-bit byte offsets. Script bytecode follows the table directly, so in place it cannot grow at all. | **proven ✓** (`$B1:D000`). Four operands are rebased by `-word[$928000]`; the header words stay. A static scan of the whole ROM found no other `lda.l $928000/2,x`. |
| Script pointer table: globals | `$928294 + $1677` | **more global functions** (`call_id`, `0xa3` / `0xb0`) | **≤ 256 / 256** (33 named) | The operand is one byte. All 256 slots already exist, so moving the table gains nothing here. | as above |
| Enemy index | `$8EB55A`, 2 B/enemy | **more enemy types** to spawn (`add_enemy`, opcodes `0x3C`/`0xBA`/`0xA2`/`0xC2`) | **143 / 256** | `0xBA`/`0xC2` take a one-byte id. Each entry is a character record's 16-bit address; entries 0/1 are the Boy's and Dog's records in WRAM (`$0A26`/`$0A70`). | **proven ✓** (`$B8:8000`). Four `lda.l $8EB55A,x` in the spawn handlers. |
| Character records | `$8EB678`, 74 B/record | **the new enemies' stats, AI, animations and palette** | **141 / 254** | Readers take a record by its 16-bit address in X (`$8E00xx,X`), so the records keep their offsets in their new bank: from `$B678` to the end of the bank. | **proven ✓** (`$B8:B678`). 131 operands rebanked (`$8E`→`$B8`, `$CE`→`$F8`) and the Boy/Dog template copy `mvn $8E,$8E` at `$8F:8046`. Enemy `$8F` (a Mosquito copy) spawned in game. |
| Map palettes | `$9CC322`, 32 B/family | **more background palette families** | **365 / 1024** | `adc #$C322` and `lda #$9C` in the family loader `$90:D05C` (the only readers). In place: 486 at most. Up to 7 load per room. | **proven ✓** (`$B9:8000`). Brian's room on new family 365 in game. |
| Sprite palettes | `$90:xxxx`, 32 B each | **new colours for new enemies** | **0 new / 1016** | Bank `$90` is full, and both palette readers (`$90:CF3A` copy, `$90:CFB8` CGRAM upload) take bank `$90` from the code. A hook reads an address below `$8000` as bank `$FA`. | **works, not identical** (`$FA:0100+`, hook at `$BA:8000`). The new palette reaches CGRAM next to the vanilla one. From frame 374 the RNG drifts (the intro's lightning is drawn differently). |
| Map tile graphics | `$EE0000`, 3 B/tile | **more 16×16 map tile graphics** | **6,688 / ~21,800** *(to verify)* | id × 3 with a 16-bit index. How many tiles a room can use is a separate limit (the seven family slots, `map-editor-rules`). | **needs readers**: `8C:C88C` and `90:A23D` are known, and the CDL has seen only part of the code |
| Sprite blocks 16×16 | `$EC0000`, 3 B | **more sprite graphics** (characters, enemies, effects) | **4,854 / ~21,800** *(to verify)* | The table is full and other data follows it, so it can only grow by moving. | **needs readers**: `80:9751`, `80:A2E6` |
| Sprite blocks 8×8 | `$D80000`, 3 B | more small sprite pieces | **6,265 / ~21,800** *(to verify)* | as above | **needs readers**: `80:A50B`, `80:A800` |
| Song packages | `$819903`, 3 B | **more music and sound packages** | **71 / 256** *(to verify)* | The count is one byte: `$81:9900` is the last package index. The everscript repo reads `$9901` as 70 music ids and `$9902` as 90 sound effects; our `src/rom/model/audio.js` still calls `$9900` "song count". Sound-driver memory is a second limit. | **needs readers**: `8C:8252`, `8C:8257`; the export has it as a value-only table |

The gain on one line:

| What you get | Today | After the move |
|---|---|---|
| rooms | 127 | 256 |
| enemy types | 143 | 256 (records: 254) |
| background palette families | 365 | 1024 |
| sprite palettes | (bank `$90` full) | 1016 new (hook) |
| strings | 3,002 | ~10,900 |
| trigger / NPC scripts | 1,917 | ~21,800 |
| map tile graphics | 6,688 | ~21,800 |
| 16×16 sprite blocks | 4,854 | ~21,800 |
| 8×8 sprite blocks | 6,265 | ~21,800 |
| song packages | 71 | 256 |

The `~21,800` limits come from a 16-bit index over 3-byte entries and are not checked.

## Tables that do not gain anything by moving

| Table | Address | Used | Why not |
|---|---|---|---|
| Animation records | `$C43E3A` | 783 animations | A record id is a 16-bit offset inside bank `$C4`. |
| Global `animate()` ids | `$C43C92` | 212 | offsets into bank `$C4` |
| Alchemy formulas | `$C45DDF` → `$9180A6` | 35 | The blocks are bound to bank `$91`, and the code that reads them has not been traced. |
| Alchemy script pointers | `$C45802` | not measured | readers unknown |
| Ring-menu item icons | `$CE8000` | 162 | offsets inside bank `$CE` |
| Dog forms | `$CF945F` | 6 | offsets inside bank `$CF` |
| Script opcodes | `$8CE8BD` | 195 of 256 | handlers must sit in bank `$8C`; new opcodes are new code |

Room triggers are not on either list. A room's step-on and B-trigger lists are length-prefixed
inside the room blob, with no engine maximum. Vanilla's largest room has 65 step-on and
58 B-triggers. They grow with the blob (≤ 32 KB), not with a table.
