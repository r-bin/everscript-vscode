# Secret of Evermore — Complete Variant Table Port & Memory Map

This document records the exact ROM locations, SNES addresses, entry counts, and reader instructions for **all 15 essential tables** across every Secret of Evermore retail release (USA, Europe, Germany, France, Spain Rev 1, and Spain Rev 2).

Categories covered:
1. **Translations & Dialogue** (`string_keys`)
2. **Maps** (`map_table`, `map_palettes`, `map_tile_graphics`)
3. **Scripts** (`room_enter_scripts`, `script_pointers`, `script_opcode_table`)
4. **Animations & Sprites** (`animate_ids`, `animation_records`, `animation_vm_dispatch`, `character_records`, `enemy_index`, `sprite_blocks_16`, `sprite_blocks_8`)
5. **Music & Sounds** (`song_packages`)

Machine-readable JSON definitions: [`src/games/evermore/variants.json`](../src/games/evermore/variants.json).  
Discovery & verification script: [`tools/variants/analyze-variant.js`](../tools/variants/analyze-variant.js).

---

## 1. Master Table Inventory Across All Variants

| Table Category | Table Name | Entry Stride | US Base (NTSC) | Europe / Germany (PAL Family A) | France / Spain 1 & 2 (PAL Family B) |
|---|---|---|---|---|---|
| **Translations** | `string_keys` | 3 B | `$91:D000` (`0x11D000`)<br>3,002 keys | `$92:8000` (`0x128000`)<br>3,085–3,087 keys | `$92:8000` (`0x128000`)<br>3,082–3,083 keys |
| **Maps** | `map_table` | 4 B | `$9F:FDE7` (`0x1FFDE7`)<br>127 rooms | `$A0:FDE5` (`0x20FDE5`)<br>127 rooms | `$A0:FDE5` (`0x20FDE5`)<br>127 rooms |
| **Maps** | `map_palettes` | 32 B | `$9C:C322` (`0x1CC322`)<br>365 families | `$9D:C323` (`0x1DC323`)<br>365 families | `$9D:C323` (`0x1DC323`)<br>365 families |
| **Maps** | `map_tile_graphics` | 3 B | `$EE:0000` (`0x2E0000`)<br>6,688 tiles | `$EF:0000` (`0x2F0000`)<br>6,688 tiles | `$EE:0000` (`0x2E0000`)<br>6,688 tiles |
| **Scripts** | `room_enter_scripts` | 5 B | `$92:801B` (`0x12801B`)<br>127 entries | `$93:801B` (`0x13801B`)<br>127 entries | `$93:801B` (`0x13801B`)<br>127 entries |
| **Scripts** | `script_pointers` | 3 B | `$92:8294` (`0x128294`)<br>1,917 entries | `$93:8294` (`0x138294`)<br>2,344 entries | `$93:8294` (`0x138294`)<br>2,344 entries |
| **Scripts** | `script_opcode_table` | 2 B | `$8C:E8BD` (`0x0CE8BD`)<br>176 handlers | `$8C:ECBE` (`0x0CECBE`)<br>176 handlers | `$8C:ECBE` (`0x0CECBE`)<br>176 handlers |
| **Animations** | `animate_ids` | 2 B | `$C4:3C92` (`0x043C92`)<br>212 words | `$C4:42D2` (`0x0442D2`)<br>212 words | `$C3:42D2` (`0x0342D2`)<br>212 words |
| **Animations** | `animation_records` | 4 B | `$C4:3E3A` (`0x043E3A`)<br>783 records | `$C4:447A` (`0x04447A`)<br>783 records | `$C3:447A` (`0x03447A`)<br>783 records |
| **Animations** | `animation_vm_dispatch`| 2 B | `$90:8000` (`0x108000`)<br>103 handlers | `$90:8000` (`0x108000`)<br>103 handlers | `$90:8000` (`0x108000`)<br>103 handlers |
| **Sprites / Chars**| `character_records` | 74 B | `$8E:B678` (`0x0EB678`)<br>141 records | `$8E:B678` (`0x0EB678`)<br>141 records | `$8E:B678` (`0x0EB678`)<br>141 records |
| **Sprites / Chars**| `enemy_index` | 2 B | `$8E:B55A` (`0x0EB55A`)<br>143 entries | `$8E:B55A` (`0x0EB55A`)<br>143 entries | `$8E:B55A` (`0x0EB55A`)<br>143 entries |
| **Sprites / Chars**| `sprite_blocks_16` | 3 B | `$EC:0000` (`0x2C0000`)<br>4,854 blocks | `$EE:0000` (`0x2E0000`)<br>4,854 blocks | `$ED:0000` (`0x2D0000`)<br>4,854 blocks |
| **Sprites / Chars**| `sprite_blocks_8` | 3 B | `$D8:0000` (`0x180000`)<br>6,265 blocks | `$D9:0000` (`0x190000`)<br>6,265 blocks | `$D8:0000` (`0x180000`)<br>6,265 blocks |
| **Music / Audio** | `song_packages` | 3 B | `$81:9903` (`0x019903`)<br>71 packages | `$81:9903` (`0x019903`)<br>71 packages | `$81:9903` (`0x019903`)<br>71 packages |

---

## 2. Structural Findings & Layout Rules

### 2.1 What Never Moves Across Any Release
Several fundamental engine tables sit at the **exact same ROM offset** in every single release (USA, Europe, Germany, France, Spain Rev 1 & 2):
1. **`character_records`** (`$8E:B678` / `0x0EB678`): All 141 records have identical stats across all retail builds.
2. **`enemy_index`** (`$8E:B55A` / `0x0EB55A`): Spawning index for all 143 enemy types.
3. **`animation_vm_dispatch`** (`$90:8000` / `0x108000`): Jump table for the 103 animation bytecode commands.
4. **`song_packages`** (`$81:9903` / `0x019903`): 71 song packages; last index byte `0x46` at `$81:9900`.

### 2.2 What Moves Universally in All PAL Releases
Because the European localizations required larger string tables (~3,085 keys vs 3,002 in US):
1. **`string_keys`** took `$92:8000` (file `0x128000`), pushing the script bank out of bank `$92`.
2. **`room_enter_scripts`** and **`script_pointers`** shifted from bank `$92` to bank `$93`:
   - `room_enter_scripts`: `$93:801B` (`0x13801B`)
   - `script_pointers`: `$93:8294` (`0x138294`), header at `$93:8000` (word offset `0x0294`)
3. **`script_opcode_table`** shifted by `0x401` bytes from `$8C:E8BD` to `$8C:ECBE` (`0x0CECBE`). Reader at `$CC:D493` (`jsr ($ECBE,x)`).
4. **`map_table`** shifted by 2 bytes from `$9F:FDE7` to `$A0:FDE5` (`0x20FDE5`), crossing into bank `$A0`. Reader at `$D0:8F6E`.
5. **`map_palettes`** shifted by 1 byte from `$9C:C322` to `$9D:C323` (`0x1DC323`), crossing into bank `$9D`. Reader at `$90:D073` / `$90:D083` (`adc #$C323`, `lda #$9D`).

### 2.3 The Family A vs Family B Graphics Split
Graphics banks differ between **Family A** (Europe, Germany) and **Family B** (France, Spain):
- **Family A** shifted graphics further down:
  - `sprite_blocks_8` moved to `$D9:0000`
  - `sprite_blocks_16` moved to `$EE:0000`
  - `map_tile_graphics` moved to `$EF:0000`
  - `animate_ids` and records sit in bank `$C4` (`$C4:42D2` and `$C4:447A`)
- **Family B** kept more of the US graphics layout:
  - `sprite_blocks_8` stayed in `$D8:0000` (same bank as US)
  - `map_tile_graphics` stayed in `$EE:0000` (same bank as US)
  - `sprite_blocks_16` moved to `$ED:0000`
  - `animate_ids` and records sit in bank `$C3` (`$C3:42D2` and `$C3:447A`)
