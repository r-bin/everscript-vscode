# Draft: Unnamed Memory in Room Scripts

## Scope and Method

This is a grouped audit of raw memory and unnamed flag operands in every room script exposed by `soe://rom/assets/scripts/rooms/`.

- Scanned room IDs `0x00`–`0x7e` (127 rooms), including enter, step-on, and B-trigger scripts.
- Decoded 2,397 script slots and 35,178 instructions. Room `0x15` has no enter script; every available script terminated normally.
- Found 4,603 raw `<0xADDR>` / `<0xADDR, mask>` occurrences at 192 distinct addresses, 896 numeric `object_state_by_flag` uses covering 878 distinct flag IDs, and 1,038 `temp_flag` uses.
- Grouped raw operands by address and reported counts, masks, and every room ID containing a use. Each room index in the inventory resolves to `soe://rom/assets/scripts/rooms/<id>/index.md`; its enter and trigger pages provide exact instruction addresses and surrounding control flow.
- Counted a write when the rendered instruction assigns to the raw operand; otherwise counted it as a read. A compound instruction can mention the same operand more than once, so counts are operand occurrences, not necessarily unique instructions.

The audit uses the configured vanilla ROM through the existing script model/VFS conventions. It adds no ROM bytes or decoded game text. This is a candidate inventory, not proof that a byte is unused elsewhere: engine assembly, indirect accesses, other script tables, and runtime paths can add users. “No name” means the script operand is rendered as a numeric address or flag ID, not that no broad region name exists.

## Findings

### Example: `$7E:22DF`

The broad WRAM map places `$22DF` inside the persistent story-flags block beginning at `$2258`, but no per-address entry explains these bits. The VFS shows four rooms using it:

| Room | Script use | What the local script flow demonstrates |
|---|---|---|
| `07` | `enter` and step-on triggers `0`, `1`, `7`, `8`; bit `0x04` | Enter chooses one of two placeholder/lift spawn positions and writes the bit. Step-on paths test it and set or clear it. The bit behaves as a persistent two-state room selector in this room; its wider purpose is not established. [Room 07 scripts](soe://rom/assets/scripts/rooms/07/index.md) |
| `0D` | `enter`; bit `0x40` | If the bit is clear, the enter script calls `$98:E45D`. [Room 0D enter](soe://rom/assets/scripts/rooms/0d/enter.md) |
| `11` | `enter`; bit `0x40` | The script checks the bit, moves the Queen, sets the bit, and calls a local scene routine. [Room 11 enter](soe://rom/assets/scripts/rooms/11/enter.md) |
| `1C` | `enter`; bit `0x08` | The bit gates spawning Tiny near the stone. [Room 1C enter](soe://rom/assets/scripts/rooms/1c/enter.md) |

This is not a system-only byte: room scripts read and write it. The shared `0x40` use in rooms `0D` and `11` may connect those scenes, but the available evidence does not establish that relationship. Different bits in the same byte already have different local roles.

The first example in the request can be inspected at [room 07 step-on 0](soe://rom/assets/scripts/rooms/07/step-on/0.md). That trigger compares `<0x22df, 0x04>` with zero, branches through a movement/cutscene sequence, then sets the bit. Its paired step-on scripts reverse or complete the same two-state selection.

### Shared Byte Examples

| Address | Script use found | Other known use / status |
|---|---|---|
| `$7E:22EA` | Rooms `31` and `61` write/test bits `0x08`, `0x10`, and `0x20`. | Engine routines also use bits `0x08`–`0x20` as room-load readiness, and opcode handlers use bit `0x80`; loot logic uses bit `0x01`. The local RAM entry currently calls this `LOOT_FLAGS`, while engine docs call it system/room-load state. Treat as a shared or overlapping byte whose field/lifetime description needs reconciliation, not as system-exclusive. [Room 31](soe://rom/assets/scripts/rooms/31/enter.md) · [Room 61](soe://rom/assets/scripts/rooms/61/enter.md) · [RAM entry](../../src/games/evermore/localizations/knowledge/ram/7e22ea.md) |
| `$7E:22EB` | Raw script uses occur in 17 rooms, with masks `0x01`, `0x10`, `0x40`, and `0x80`; most writes are room transitions or room-specific branches. | Existing knowledge names it `ROOM_TRANSITION_FLAGS`; engine routines read/write it. The script inventory disproves any claim that scripts do not touch the byte, but exact per-bit ownership remains open. |
| `$7E:22EC` | Raw script uses occur in 10 rooms, with masks `0x02`, `0x10`, and `0x40`. | Existing entry is `STORY_FLAGS_22EC`, but the engine map also describes a room-music transition role. Several bits are explicitly used by room scripts. The byte’s lifetime/meaning needs reconciliation. [RAM entry](../../src/games/evermore/localizations/knowledge/ram/7e22ec.md) |

So, for the “is the whole byte only used by the system?” question: no, not for these examples. Script and engine use overlap at least on `$22EA`; `$22EB` and `$22EC` also have direct room-script accesses. The access inventory alone cannot prove the remaining bits are unused.

## Scratch Memory Misallocated to Save RAM (Candidate `<0x2834>` Registers)

In the Secret of Evermore engine, `$7E:2258`–`$7E:2833` forms the persistent save RAM block copied to/from SRAM (`$70:0000`). In contrast, `$7E:2834`–`$7E:28FB` (200 bytes) forms `COMPILER_TEMP` (`temp[0]`..`temp[99]`), which is wiped on every room load and serves as volatile thread scratchpad memory.

During vanilla game development, script authors routinely placed temporary calculations, waypoint staging buffers, projectile/fall trajectory state, dialogue string parameter staging, and minigame loop counters into cells across `$7E:23xx`–`$7E:2551`. None of these cells carry any meaningful progression state across game saves or room changes. Writing them into persistent memory brings **no benefit**; it needlessly wastes space in the SRAM save area. In modern decompiled Everscript and room authoring, all of these should be allocated from `temp[]` (`<0x2834>`).

### Volatile Scratch Categories

1. **Script Target & Movement Waypoints:**
   - `$7E:23B9` / `$7E:23BB` (`TARGET_X`, `TARGET_Y`): Staging destination coordinates for `walk_to()` or `teleport()`.
   - `$7E:249D` / `$7E:249F` / `$7E:24A1` / `$7E:24A3` (`TRANSIT_ORIGIN_X/Y`, `TRANSIT_DEST_X/Y`): Lift and raft transit start and destination coordinates.
   - `$7E:24AB` / `$7E:24AF` / `$7E:24AD` / `$7E:24B1` (`ACTIVE_CHAR_X/Y`, `INACTIVE_CHAR_X/Y`): Staged active/inactive party coordinates.
   - `$7E:24CF`–`$7E:24D7`, `$7E:24D9`–`$7E:24DB`, `$7E:24EF`–`$7E:24F5`, `$7E:24F7`, `$7E:24FF`–`$7E:2505`: Cutscene and elevator waypoint scratchpads (e.g., Gomi's tower lift in R55).

2. **Ballistics and Physics Simulation (Volcano Pipes & Fall Chutes):**
   - `$7E:24A7` (`TRAJECTORY_VY`): In-flight vertical velocity in 12.4 fixed-point format.
   - `$7E:24B3` (`TRAJECTORY_INITIAL_VY`): Initial upward launch speed parameter.
   - `$7E:24B5` (`TRAJECTORY_MAX_VY`): Terminal downward fall speed threshold.
   - `$7E:24B7` (`TRAJECTORY_VX`): Horizontal drift velocity per frame.
   - Staged exclusively before invoking trajectory simulation routines (e.g. `$94:AC56`, R108/R122 fall loops) and completely discarded once landing completes.

3. **Dialogue & Menu Parameter Staging:**
   - `$7E:2365`–`$7E:2377` (`STRING_PARAMETER_1`–`3`): Number staging registers for text message interpolations.
   - `$7E:243B` (`SOUND_COMMAND_PARAM`): Transient sound parameter.
   - `$7E:243D` (`EQUIPMENT_GRANT_COMMAND`): Staged equipment grant ID.
   - `$7E:2463` (`MARKET_ITEM_ID`): Commodity item ID passed to market dialogue routines (`$92:CDB3`, `$92:CDBE`, `$92:CDCA`).
   - `$7E:2545` (`DIALOGUE_SELECTION`): Player selection index returned by `lookup_034d(0)`.
   - Read once by message boxes and never referenced afterwards.

4. **Transient Transit Identifiers:**
   - `$7E:24C3` (`PIPE_DESTINATION_ID`): Volcano pipe maze chute outlet index (1–10). Set immediately before `load_map(PIPEMAZE_ROOMS)` and read in R62 enter script to branch to destination pads.

5. **Volatile Loop Counters & Minigame Math:**
   - `$7E:244F`, `$7E:2451`: Market vendor transaction loop counters in R10.
   - `$7E:247B`–`$7E:2491`: Desert navigation minigame scratch registers in R59.
   - `$7E:2497`–`$7E:2499`: Async animation timing parameters in R16.
   - `$7E:244D` (`last_entity()`): Temporary entity struct pointer.
   - `$7E:2513`–`$7E:2515`, `$7E:254D`–`$7E:2551`: Single-room temporary scratch cells.

6. **Engine-Reset Camera Overrides:**
   - `$7E:240F`–`$7E:2415` (`CAMERA_DEADZONE_LEFT/RIGHT/TOP/BOTTOM`): Camera framing margins.
   - `$7E:2417`–`$7E:2419`: Camera pan step bounds.
   - `$7E:241F` (`CAMERA_SCROLL_MODE`): Camera tracking mode.
   - `$7E:2421`, `$7E:2423`, `$7E:2425` (`TRIGGER_INTERACTION_X/Y`): Trigger interaction entity context.
   - Engine routine `$90:8E90` resets camera deadzones on *every* room transition, proving persistent storage is pointless.

### Raw Address Inventory

Each row gives raw operand occurrences, masks observed (`plain` means no bit mask), all room IDs with at least one use, and persistence classification (`⚡ Scratch (candidate <0x2834>)` indicates volatile scratch memory with no persistence benefit).

| Address | Uses | Masks | Rooms | Persistence / Role |
|---|---:|---|---|---|
| `2269` | 16 | `01 02 04 08 10 20 40 80` | `25 38 69` | Save RAM (story / chest flags) |
| `226A` | 24 | `01 02 04 08 10 20 40 80` | `3E 69` | Save RAM (story / chest flags) |
| `226B` | 16 | `01 02 04 08 10 20 40 80` | `30 4F` | Save RAM (story / chest flags) |
| `226C` | 16 | `01 02 04 08 10 20 40 80` | `59 5A` | Save RAM (story / chest flags) |
| `226D` | 18 | `01 02 04 08 10 20 40 80` | `35 3B 5A` | Save RAM (story / chest flags) |
| `226E` | 16 | `01 02 04 08 10 20 40 80` | `3B 3C` | Save RAM (story / chest flags) |
| `226F` | 18 | `01 02 04 08 10 20 40 80` | `3C 67` | Save RAM (story / chest flags) |
| `2270` | 14 | `01 02 04 08 10 20 40` | `67` | Save RAM (story / chest flags) |
| `2271` | 13 | `01 02 04 08 10 20 40 80` | `1E` | Save RAM (story / chest flags) |
| `2272` | 11 | `01 02 04 08 10 20 40` | `05 13` | Save RAM (story / chest flags) |
| `2273` | 14 | `01 02 04 08 10 20 40 80` | `2E 34 37` | Save RAM (story / chest flags) |
| `2274` | 16 | `01 02 04 08 10 20 40 80` | `2D 37 65` | Save RAM (story / chest flags) |
| `2275` | 16 | `01 02 04 08 10 20 40 80` | `65 7D` | Save RAM (story / chest flags) |
| `2276` | 18 | `01 02 04 08 10 20 40 80` | `7D` | Save RAM (story / chest flags) |
| `2277` | 18 | `01 02 04 08 10 20 40 80` | `7D` | Save RAM (story / chest flags) |
| `2278` | 16 | `01 02 04 08 10 20 40 80` | `7D` | Save RAM (story / chest flags) |
| `2279` | 14 | `01 02 04 08 10 20 40 80` | `7D` | Save RAM (story / chest flags) |
| `227A` | 16 | `01 02 04 08 10 20 40 80` | `7D` | Save RAM (story / chest flags) |
| `227B` | 17 | `01 02 04 08 10 20 40 80` | `76 7D` | Save RAM (story / chest flags) |
| `227C` | 16 | `01 02 04 08 10 20 40 80` | `55 66 76` | Save RAM (story / chest flags) |
| `227D` | 16 | `01 02 04 08 10 20 40 80` | `55` | Save RAM (story / chest flags) |
| `227E` | 16 | `01 02 04 08 10 20 40 80` | `55 56` | Save RAM (story / chest flags) |
| `227F` | 16 | `01 02 04 08 10 20 40 80` | `56` | Save RAM (story / chest flags) |
| `2280` | 16 | `01 02 04 08 10 20 40 80` | `56` | Save RAM (story / chest flags) |
| `2281` | 12 | `01 02 04 08 10 20` | `56` | Save RAM (story / chest flags) |
| `2282` | 6 | `20 40 80` | `71` | Save RAM (story / chest flags) |
| `2283` | 16 | `01 02 04 08 10 20 40 80` | `23 29 71` | Save RAM (story / chest flags) |
| `2284` | 18 | `01 02 04 08 10 20 40 80` | `28 44 47` | Save RAM (`OMNITOPIA_CHESTS_A`) |
| `2285` | 16 | `01 02 04 08 10 20 40 80` | `24 47 79` | Save RAM (story / chest flags) |
| `2286` | 16 | `01 02 04 08 10 20 40 80` | `12 79` | Save RAM (story / chest flags) |
| `2287` | 14 | `01 02 04 08 10 40 80` | `0F 12 4B 60` | Save RAM (story / chest flags) |
| `2288` | 12 | `01 02 08 10 20 40 80` | `0E 0F 16` | Save RAM (story / chest flags) |
| `2289` | 18 | `01 02 04 08 10 20 40 80` | `16` | Save RAM (story / chest flags) |
| `228A` | 16 | `01 02 04 08 10 20 80` | `16 24 28 29` | Save RAM (story / chest flags) |
| `228B` | 13 | `02 04 08 10 20 40 80` | `0A` | Save RAM (story / chest flags) |
| `22AB` | 3 | `40` | `38` | Save RAM (story flag) |
| `22B1` | 2 | `80` | `3C` | Save RAM (story flag) |
| `22B2` | 14 | `01 02 04 08 10 20 40` | `3C 65` | Save RAM (story flag) |
| `22CF` | 2 | `10` | `0B` | Save RAM (story flag) |
| `22D7` | 4 | `40 80` | `72` | Save RAM (story flag) |
| `22D8` | 9 | `01 02 08 10 20` | `07 35 6F` | Save RAM (story flag) |
| `22D9` | 4 | `02 04` | `35` | Save RAM (story flag) |
| `22DC` | 2 | `02` | `71` | Save RAM (story flag) |
| `22DE` | 16 | `01 02 08 10 20 40` | `10 6E 6F 7C 7D` | Save RAM (story flag) |
| `22DF` | 19 | `04 08 40` | `07 0D 11 1C` | Save RAM (story flag) |
| `22E0` | 74 | `01 02 04 08 10 20 40 80` | `06 55 6C` | Save RAM (story / room state) |
| `22E1` | 23 | `01 02 04 08 10 20 40 80` | `55` | Save RAM (story flag) |
| `22E4` | 67 | `01 02 04 08 10 20 40 80` | `06 55 56` | Save RAM (story flag) |
| `22E6` | 33 | `04 08 10 40 80` | `00 42 43 44 45 47` | Save RAM (story flag) |
| `22E7` | 12 | `01 04 08 20 40` | `1A 24 29 7E` | Save RAM (story flag) |
| `22E8` | 16 | `08 10 40 80` | `18 1B 7C` | Save RAM (story flag) |
| `22E9` | 11 | `01 02 04 08` | `00 16 18 42` | Save RAM (story flag) |
| `22EA` | 12 | `08 10 20` | `31 61` | Save RAM (`LOOT_FLAGS` / room state) |
| `22EB` | 40 | `01 10 40 80` | `02 08 0A 0C 0D 25 26 28 59 5B 62 63 67 77 7B 7C 7D` | Save RAM (`ROOM_TRANSITION_FLAGS`) |
| `22EC` | 25 | `02 10 40` | `08 0A 0C 0D 11 35 52 69 7C 7D` | Save RAM (`STORY_FLAGS_22EC`) |
| `22ED` | 5 | `04 20` | `0C 51 5C` | Save RAM (story flag) |
| `22EE` | 10 | `02 04 40 80` | `3E 4F 54 6E 77 78` | Save RAM (story flag) |
| `22EF` | 10 | `08 20 40` | `14 19 1A 69 70` | Save RAM (story flag) |
| `22F1` | 1 | `80` | `46` | Save RAM (story flag) |
| `22F2` | 10 | `04 08 10 20` | `57 68` | Save RAM (story flag) |
| `22F3` | 25 | `10 40 80` | `1B 23 24 28 29` | Save RAM (story flag) |
| `22F4` | 21 | `01 02 04` | `4B 6B 70 71 72` | Save RAM (story flag) |
| `22F5` | 11 | `04 08 20 40` | `0D 0F 11 4E 62 7A` | Save RAM (story flag) |
| `22F8` | 50 | `02 04 08 10 20 40 80` | `00 42 43 44 45 47 48 49 54 7E` | Save RAM (story flag) |
| `22F9` | 12 | `01 02 04 08 40` | `43 45 49 7E` | Save RAM (story flag) |
| `22FA` | 3 | `plain` | `1D 31 6A` | Save RAM (story / room selector) |
| `22FB` | 3 | `plain` | `1D 31 6A` | Save RAM (story / room selector) |
| `22FE` | 6 | `plain` | `36 3A` | Save RAM (story / room state) |
| `2349` | 3 | `plain` | `44 47` | Save RAM (script state) |
| `234A` | 2 | `plain` | `38 4C` | Save RAM (script state) |
| `234C` | 11 | `plain` | `30 68` | Save RAM (script state) |
| `234D` | 24 | `plain` | `07 35 41 59 67 69` | Save RAM (script state) |
| `234E` | 13 | `plain` | `07 35 59 67 69` | Save RAM (script state) |
| `2350` | 46 | `plain` | `06 30 55 56 68` | Save RAM (script state) |
| `2351` | 15 | `plain` | `74` | Save RAM (script state) |
| `2354` | 3 | `plain` | `6E 78` | Save RAM (script state) |
| `2356` | 11 | `plain` | `14 39` | Save RAM (script state) |
| `2357` | 20 | `plain` | `06 55 56` | Save RAM (script state) |
| `2358` | 28 | `plain` | `06 55 56` | Save RAM (script state) |
| `2365` | 5 | `plain` | `0A` | ⚡ Scratch (candidate `<0x2834>`: dialogue number param) |
| `2369` | 16 | `plain` | `0A` | Save RAM (`MARKET_RELIC_PRICE_SURCHARGE`: escalating relic price markup) |
| `236B` | 9 | `plain` | `0A` | ⚡ Scratch (candidate `<0x2834>`: `MARKET_ENTRANCE_ENCOUNTER_TYPE` variant 0..3) |
| `236D` | 7 | `plain` | `43` | ⚡ Scratch (candidate `<0x2834>`: dialogue number param) |
| `236F` | 7 | `plain` | `43` | ⚡ Scratch (candidate `<0x2834>`: dialogue number param) |
| `2371` | 7 | `plain` | `43` | ⚡ Scratch (candidate `<0x2834>`: dialogue number param) |
| `2373` | 4 | `plain` | `43` | ⚡ Scratch (candidate `<0x2834>`: dialogue number param) |
| `2375` | 4 | `plain` | `43` | ⚡ Scratch (candidate `<0x2834>`: dialogue number param) |
| `2377` | 4 | `plain` | `43` | ⚡ Scratch (candidate `<0x2834>`: dialogue number param) |
| `2389` | 60 | `plain` | `0A` | ⚡ Scratch (candidate `<0x2834>`: `MARKET_CRITTER_INTERACTION_FLAGS` entrance critter interaction state) |
| `2397` | 4 | `plain` | `3E 7D` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |
| `2399` | 4 | `plain` | `3E 7D` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |
| `23B9` | 114 | `plain` | `00 0C 0D 1B 25 39 3A 42 43 44 45 47 49 4D 54 55 57 5D 5E 5F 62 68 7E` | ⚡ Scratch (candidate `<0x2834>`: `TARGET_X` waypoint) |
| `23BB` | 98 | `plain` | `00 0C 0D 1B 25 39 3A 42 43 44 45 47 49 4D 54 55 57 62 7E` | ⚡ Scratch (candidate `<0x2834>`: `TARGET_Y` waypoint) |
| `23C1` | 8 | `plain` | `17 3E 40 44 59 65 67 6B` | Save RAM (script state) |
| `23D3` | 2 | `plain` | `5C` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |
| `23D7` | 25 | `plain` | `42` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |
| `23DF` | 9 | `plain` | `05 27 2F` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `23E1` | 9 | `plain` | `05 27 2F` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `23E3` | 4 | `plain` | `18` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `23E5` | 1 | `plain` | `18` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `23E7` | 1 | `plain` | `18` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `23F1` | 16 | `plain` | `4B` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `23F3` | 16 | `plain` | `4B` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `23F5` | 16 | `plain` | `4B` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `23F7` | 16 | `plain` | `4B` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `23F9` | 32 | `plain` | `49 4B 57` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `23FB` | 32 | `plain` | `49 4B 57` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `23FD` | 31 | `plain` | `4B 57` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `23FF` | 31 | `plain` | `4B 57` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `240F` | 12 | `plain` | `1B 1D 24 28 2D 77` | ⚡ Scratch (candidate `<0x2834>`: `CAMERA_DEADZONE_LEFT`) |
| `2411` | 12 | `plain` | `1B 1D 24 28 2D 77` | ⚡ Scratch (candidate `<0x2834>`: `CAMERA_DEADZONE_RIGHT`) |
| `2413` | 39 | `plain` | `01 0A 18 1B 24 28 2D 4A 77 7B 7D` | ⚡ Scratch (candidate `<0x2834>`: `CAMERA_DEADZONE_TOP`) |
| `2415` | 22 | `plain` | `18 1B 1D 24 28 2D 7D` | ⚡ Scratch (candidate `<0x2834>`: `CAMERA_DEADZONE_BOTTOM`) |
| `2417` | 2 | `plain` | `1D 31` | ⚡ Scratch (candidate `<0x2834>`: camera pan bound) |
| `2419` | 2 | `plain` | `1D 31` | ⚡ Scratch (candidate `<0x2834>`: camera pan bound) |
| `241F` | 1 | `plain` | `1D` | ⚡ Scratch (candidate `<0x2834>`: `CAMERA_SCROLL_MODE`) |
| `2421` | 4 | `plain` | `16 52 7A` | ⚡ Scratch (candidate `<0x2834>`: `TRIGGER_INTERACTION_X`) |
| `2423` | 4 | `plain` | `16 52 7A` | ⚡ Scratch (candidate `<0x2834>`: `TRIGGER_INTERACTION_Y`) |
| `2425` | 9 | `plain` | `3B 59 65` | ⚡ Scratch (candidate `<0x2834>`: trigger interaction context) |
| `2429` | 42 | `plain` | `59` | ⚡ Scratch (candidate `<0x2834>`: `ACTIVE_STEP_TRIGGER_SCRIPT_ID`) |
| `243B` | 2 | `plain` | `4A 71` | ⚡ Scratch (candidate `<0x2834>`: sound command arg) |
| `243D` | 16 | `plain` | `0A 7B` | ⚡ Scratch (candidate `<0x2834>`: `EQUIPMENT_GRANT_COMMAND`) |
| `243F` | 10 | `plain` | `0A` | ⚡ Scratch (candidate `<0x2834>`: `EQUIPMENT_TAKE_COMMAND` one-shot equipment revoke ID) |
| `244D` | 4 | `plain` | `1D 4D` | ⚡ Scratch (candidate `<0x2834>`: temporary entity handle) |
| `244F` | 26 | `plain` | `0A` | ⚡ Scratch (candidate `<0x2834>`: `MARKET_PEDDLER_STAGE` peddler dialogue stage 0..19) |
| `2451` | 3 | `plain` | `0A` | ⚡ Scratch (candidate `<0x2834>`: `MARKET_PEDDLER_TALK_COUNT` peddler interaction count) |
| `245B` | 7 | `plain` | `01 51` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |
| `245D` | 16 | `plain` | `69` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |
| `245F` | 2 | `plain` | `25` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |
| `2463` | 62 | `plain` | `0A 7B` | ⚡ Scratch (candidate `<0x2834>`: `MARKET_ITEM_ID`) |
| `2469` | 8 | `plain` | `6C` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |
| `246B` | 2 | `plain` | `36 3A` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |
| `2477` | 48 | `plain` | `24` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |
| `2479` | 48 | `plain` | `24` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |
| `247B` | 40 | `plain` | `59` | ⚡ Scratch (candidate `<0x2834>`: desert minigame loop register) |
| `247D` | 38 | `plain` | `59` | ⚡ Scratch (candidate `<0x2834>`: desert minigame loop register) |
| `247F` | 30 | `plain` | `59` | ⚡ Scratch (candidate `<0x2834>`: desert minigame loop register) |
| `2481` | 18 | `plain` | `59` | ⚡ Scratch (candidate `<0x2834>`: desert minigame loop register) |
| `2483` | 20 | `plain` | `59` | ⚡ Scratch (candidate `<0x2834>`: desert minigame loop register) |
| `2485` | 10 | `plain` | `59` | ⚡ Scratch (candidate `<0x2834>`: desert minigame loop register) |
| `2489` | 12 | `plain` | `59` | ⚡ Scratch (candidate `<0x2834>`: desert minigame loop register) |
| `248B` | 12 | `plain` | `59` | ⚡ Scratch (candidate `<0x2834>`: desert minigame loop register) |
| `248D` | 10 | `plain` | `59` | ⚡ Scratch (candidate `<0x2834>`: desert minigame loop register) |
| `248F` | 10 | `plain` | `59` | ⚡ Scratch (candidate `<0x2834>`: desert minigame loop register) |
| `2491` | 37 | `plain` | `59` | ⚡ Scratch (candidate `<0x2834>`: desert minigame loop register) |
| `2493` | 8 | `plain` | `1B 55` | ⚡ Scratch (candidate `<0x2834>`: lift waypoint staging) |
| `2495` | 8 | `plain` | `1B 55` | ⚡ Scratch (candidate `<0x2834>`: lift waypoint staging) |
| `2497` | 65 | `plain` | `16` | ⚡ Scratch (candidate `<0x2834>`: `TARGET_WAYPOINT_X` waypoint destination X) |
| `2499` | 65 | `plain` | `16` | ⚡ Scratch (candidate `<0x2834>`: `TARGET_WAYPOINT_Y` waypoint destination Y) |
| `249B` | 7 | `plain` | `18` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |
| `249D` | 222 | `plain` | `05 06 12 13 39 3A 48 54 57 6B` | ⚡ Scratch (candidate `<0x2834>`: `TRANSIT_ORIGIN_X`) |
| `249F` | 369 | `plain` | `05 06 12 13 39 3A 48 54 57 6B` | ⚡ Scratch (candidate `<0x2834>`: `TRANSIT_ORIGIN_Y`) |
| `24A1` | 117 | `plain` | `06 36 3A 43 48 55 57 6B 7E` | ⚡ Scratch (candidate `<0x2834>`: `TRANSIT_DEST_X`) |
| `24A3` | 121 | `plain` | `06 36 3A 43 48 55 57 6B 7E` | ⚡ Scratch (candidate `<0x2834>`: `TRANSIT_DEST_Y`) |
| `24A5` | 4 | `plain` | `27` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |
| `24A7` | 10 | `plain` | `6C 7A` | ⚡ Scratch (candidate `<0x2834>`: `TRAJECTORY_VY` falling speed) |
| `24AB` | 212 | `plain` | `05 06 07 14 18 1D 1E 1F 21 31 37 46 4F 53 54 62 68 69 6C 7A` | ⚡ Scratch (candidate `<0x2834>`: `ACTIVE_CHAR_X`) |
| `24AD` | 21 | `plain` | `4F 53 69` | ⚡ Scratch (candidate `<0x2834>`: `INACTIVE_CHAR_X`) |
| `24AF` | 329 | `plain` | `05 06 07 14 18 1D 1E 1F 21 31 37 46 4F 53 54 62 68 69 6C 7A` | ⚡ Scratch (candidate `<0x2834>`: `ACTIVE_CHAR_Y`) |
| `24B1` | 44 | `plain` | `46 4F 53 69` | ⚡ Scratch (candidate `<0x2834>`: `INACTIVE_CHAR_Y`) |
| `24B3` | 90 | `plain` | `3D 3E 52 69 6C 71 72 73 74` | ⚡ Scratch (candidate `<0x2834>`: `TRAJECTORY_INITIAL_VY` launch speed) |
| `24B5` | 53 | `plain` | `3D 3E 52 69 6C 71 73 74` | ⚡ Scratch (candidate `<0x2834>`: `TRAJECTORY_MAX_VY` terminal speed) |
| `24B7` | 45 | `plain` | `3D 3E 52 69 6C` | ⚡ Scratch (candidate `<0x2834>`: `TRAJECTORY_VX` horizontal drift) |
| `24B9` | 3 | `plain` | `3E` | ⚡ Scratch (candidate `<0x2834>`: trajectory scratch) |
| `24C3` | 36 | `plain` | `3D 3E` | ⚡ Scratch (candidate `<0x2834>`: `PIPE_DESTINATION_ID` outlet index) |
| `24CF` | 8 | `plain` | `07 53 68` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `24D1` | 8 | `plain` | `07 53 68` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `24D3` | 4 | `plain` | `68` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `24D5` | 4 | `plain` | `68` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `24D7` | 4 | `plain` | `07` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `24D9` | 1 | `plain` | `01` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `24DB` | 1 | `plain` | `01` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `24E3` | 1 | `plain` | `01` | ⚡ Scratch (candidate `<0x2834>`: temporary entity handle) |
| `24E5` | 5 | `plain` | `01` | ⚡ Scratch (candidate `<0x2834>`: temporary entity handle) |
| `24EF` | 14 | `plain` | `37` | ⚡ Scratch (candidate `<0x2834>`: tower lift waypoint) |
| `24F1` | 20 | `plain` | `37` | ⚡ Scratch (candidate `<0x2834>`: tower lift waypoint) |
| `24F3` | 10 | `plain` | `37` | ⚡ Scratch (candidate `<0x2834>`: tower lift waypoint) |
| `24F5` | 12 | `plain` | `37` | ⚡ Scratch (candidate `<0x2834>`: tower lift waypoint) |
| `24F7` | 8 | `plain` | `1F 20 21 22` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `24F9` | 53 | `plain` | `48` | ⚡ Scratch (candidate `<0x2834>`: `DUCT_ENTRANCE_GRATE_OBJECT` Omnitopia grate ID) |
| `24FB` | 14 | `plain` | `48` | ⚡ Scratch (candidate `<0x2834>`: `DUCT_EXIT_GRATE_OBJECT` Omnitopia grate ID) |
| `24FD` | 15 | `plain` | `00 42 43 44 46 47 48 49 54 7E` | ⚡ Scratch (candidate `<0x2834>`: room transition scratch) |
| `24FF` | 6 | `plain` | `43` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `2501` | 6 | `plain` | `43` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `2503` | 6 | `plain` | `43` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `2505` | 6 | `plain` | `43` | ⚡ Scratch (candidate `<0x2834>`: cutscene waypoint) |
| `2513` | 4 | `plain` | `0A` | ⚡ Scratch (candidate `<0x2834>`: `MARKET_TIMER_START_FRAME` 15-min timer timestamp) |
| `2515` | 4 | `plain` | `08` | ⚡ Scratch (candidate `<0x2834>`: `MARKET_TIMER_MINUTES_REMAINING` countdown 15..1) |
| `2545` | 36 | `plain` | `04 36 39 3A 46 54` | ⚡ Scratch (candidate `<0x2834>`: `DIALOGUE_SELECTION`) |
| `254D` | 1 | `plain` | `0A` | ⚡ Scratch (candidate `<0x2834>`: `MARKET_PEDDLER_COOLDOWN_START_FRAME` peddler cooldown start) |
| `254F` | 4 | `plain` | `25` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |
| `2551` | 12 | `plain` | `0C 54 7D` | ⚡ Scratch (candidate `<0x2834>`: room scratch) |

### Numeric `object_state_by_flag` IDs

These are not direct WRAM addresses: the helper is named, but the flag IDs passed to it are numeric and lack semantic names in the script. The ranges below list every distinct ID used in each room. For full context, open that room’s `enter.md` at `soe://rom/assets/scripts/rooms/<id>/enter.md`.

| Room | Distinct IDs | Numeric IDs / ranges |
|---|---:|---|
| `01` | 1 | `0037` |
| `05` | 20 | `00D0-00D5`, `03CC-03D9` |
| `06` | 20 | `035C-036F` |
| `07` | 13 | `0344-034F`, `0405` |
| `08` | 1 | `040B` |
| `0B` | 10 | `03BD-03C6` |
| `0E` | 1 | `0181` |
| `0F` | 2 | `017F-0180` |
| `12` | 5 | `0175-0179` |
| `13` | 1 | `00D6` |
| `14` | 4 | `000C`, `0018`, `0417-0418` |
| `16` | 38 | `0184-018B`, `018D-0192`, `022A-0241` |
| `17` | 12 | `0242-024D` |
| `19` | 19 | `0390-03A2` |
| `1C` | 15 | `003D`, `02F3-0300` |
| `1E` | 4 | `00C8-00CB` |
| `23` | 3 | `015D-015F` |
| `24` | 5 | `0169-016C`, `0195` |
| `25` | 18 | `008C`, `01D5-01E4`, `04AE` |
| `26` | 3 | `0081-0083` |
| `27` | 31 | `003A`, `0263-0280` |
| `28` | 2 | `0160`, `0197` |
| `29` | 6 | `015B-015C`, `0194-0197` |
| `2B` | 16 | `0301-0310` |
| `2C` | 1 | `048E` |
| `2D` | 4 | `00E2-00E5` |
| `2E` | 2 | `00DB-00DC` |
| `2F` | 20 | `0311-0324` |
| `30` | 6 | `009A-009F` |
| `34` | 3 | `00D8-00DA` |
| `35` | 10 | `00A9-00AE`, `0403-0404`, `0409-040A` |
| `36` | 4 | `03DA-03DD` |
| `37` | 22 | `00DE-00E1`, `03EC-03FD` |
| `38` | 31 | `0086-008B`, `01BB-01D3` |
| `3B` | 33 | `00AF-00B6`, `029F-02B7` |
| `3C` | 24 | `00B7-00BE`, `02B8-02C5`, `02CF-02D0` |
| `3E` | 9 | `02C6-02CE` |
| `41` | 23 | `0084-0085`, `024E-0262` |
| `42` | 1 | `0489` |
| `44` | 1 | `0161` |
| `47` | 7 | `0162-0168` |
| `4B` | 32 | `017E`, `0325-0343` |
| `4C` | 5 | `03C7-03CB` |
| `4F` | 17 | `0038`, `0098-0099`, `02E5-02F2` |
| `51` | 25 | `0066-0073`, `0075-007E`, `0080` |
| `55` | 18 | `0125-0136` |
| `56` | 23 | `0137-014D` |
| `57` | 7 | `014E-0154` |
| `59` | 28 | `00A0-00A6`, `01F3-0207` |
| `5A` | 2 | `00A7-00A8` |
| `5B` | 14 | `01E5-01F2` |
| `5C` | 4 | `02E1-02E4` |
| `60` | 3 | `017A-017C` |
| `65` | 31 | `00E6-00EC`, `01A0-01AA`, `01AC-01B7`, `01B9` |
| `66` | 13 | `0123-0124`, `01BA`, `02D7-02E0` |
| `67` | 42 | `00BF-00C6`, `0208-0229` |
| `69` | 32 | `0062`, `008D-0090`, `0281-029B` |
| `6F` | 2 | `0400-0401` |
| `71` | 31 | `0155-015A`, `03A3-03BB` |
| `72` | 16 | `03DE-03EB`, `03FE-03FF` |
| `76` | 16 | `0371-0380` |
| `79` | 8 | `016D-0174` |
| `7D` | 48 | `00ED-010C`, `010E-011D` |
| `7E` | 12 | `0350-035B` |

### Temporary Flags

`temp_flag[index, mask]` exposes an indexed temporary flag area rather than an absolute address. These operands have generic syntax but no semantic name. Counts below are script operand occurrences; reads/writes may repeat when multiple script paths share code.

| Temporary byte | Mask | Uses | Reads | Writes | Rooms |
|---:|---:|---:|---:|---:|---|
| `0` | `01` | 211 | 147 | 64 | `00, 07, 0A, 0B, 16, 18, 1B, 23, 24, 28, 29, 2D, 37, 43, 44, 48, 49, 52, 54, 55, 58, 5C, 5D, 5E, 62, 69, 6C, 6D, 71, 72, 73, 74, 7D` |
| `0` | `02` | 172 | 84 | 88 | `00, 07, 0A, 16, 18, 1B, 23, 24, 28, 29, 2D, 46, 48, 49, 54, 55, 58, 5D, 68, 69, 71, 72, 74, 77` |
| `0` | `04` | 75 | 33 | 42 | `00, 07, 16, 18, 1B, 23, 24, 28, 29, 2D, 45, 46, 48, 49, 55, 58, 5D, 69, 6C, 71, 72, 77` |
| `0` | `08` | 29 | 16 | 13 | `00, 0A, 1B, 23, 24, 28, 2D, 48, 55, 58, 71, 72` |
| `0` | `10` | 64 | 30 | 34 | `00, 1B, 23, 24, 28, 2D, 48, 55, 58, 59, 71, 72, 7E` |
| `0` | `20` | 53 | 17 | 36 | `00, 23, 24, 27, 28, 48, 55, 58, 59, 5C, 71, 72, 7E` |
| `0` | `40` | 31 | 14 | 17 | `00, 23, 24, 28, 55, 58, 59, 71, 7E` |
| `0` | `80` | 29 | 14 | 15 | `23, 28, 48, 55, 58, 59` |
| `1` | `01` | 21 | 10 | 11 | `28, 48, 59, 71` |
| `1` | `02` | 20 | 10 | 10 | `00, 28, 48, 59, 71` |
| `1` | `04` | 20 | 10 | 10 | `00, 28, 48, 59, 71` |
| `1` | `08` | 15 | 7 | 8 | `00, 28, 59, 71` |
| `1` | `10` | 17 | 9 | 8 | `00, 28, 48, 59, 71` |
| `1` | `20` | 21 | 10 | 11 | `28, 48, 59, 71` |
| `1` | `40` | 7 | 4 | 3 | `28, 59, 71` |
| `1` | `80` | 10 | 5 | 5 | `28, 59, 71` |
| `2` | `01` | 7 | 4 | 3 | `28, 59, 71` |
| `2` | `02` | 10 | 5 | 5 | `28, 59, 71` |
| `2` | `04` | 10 | 5 | 5 | `28 59 71` |
| `2` | `08` | 12 | 5 | 7 | `28 59 71` |
| `2` | `10` | 12 | 5 | 7 | `28 48 59` |
| `2` | `20` | 12 | 5 | 7 | `28 48 59` |
| `2` | `40` | 12 | 5 | 7 | `28 48 59` |
| `2` | `80` | 26 | 8 | 18 | `28 48 59` |
| `3` | `01` | 24 | 8 | 16 | `28 59` |
| `3` | `02` | 20 | 7 | 13 | `28 48 59` |
| `3` | `04` | 20 | 8 | 12 | `28 48 59` |
| `3` | `08` | 18 | 7 | 11 | `28 48 59` |
| `3` | `10` | 12 | 5 | 7 | `28 48 59` |
| `3` | `20` | 2 | 1 | 1 | `28` |
| `3` | `40` | 10 | 4 | 6 | `28 59` |
| `3` | `80` | 10 | 4 | 6 | `28 59` |
| `4` | `01` | 8 | 3 | 5 | `28 59` |
| `4` | `02` | 6 | 2 | 4 | `59` |
| `4` | `04` | 8 | 4 | 4 | `28` |
| `4` | `10` | 4 | 2 | 2 | `28` |

## Existing Names and Exclusions

Only six raw-address hits have a matching per-address RAM knowledge file: `$2284` (`OMNITOPIA_CHESTS_A`), `$22EA` (`LOOT_FLAGS`), `$22EC` (`STORY_FLAGS_22EC`), `$241F` (`CAMERA_SCROLL_MODE`), `$2429` (`ACTIVE_STEP_TRIGGER_SCRIPT_ID`), and `$243D` (`EQUIPMENT_GRANT_COMMAND`). The first and last named fields still have raw script references and remain in the index. `$22EA` and `$22EC` have conflicting or incomplete descriptions noted above.

The following high-reuse plain operands have been verified, documented with RAM knowledge files, and mapped to compiler `MEMORY` enums:
- Camera deadzone margins:
  - `$7E:240F` (`CAMERA_DEADZONE_LEFT`): Horizontal deadzone left threshold margin.
  - `$7E:2411` (`CAMERA_DEADZONE_RIGHT`): Horizontal deadzone right threshold margin.
  - `$7E:2413` (`CAMERA_DEADZONE_TOP`): Vertical deadzone top threshold margin (used by 11 rooms to bias camera framing toward bosses or scenes).
  - `$7E:2415` (`CAMERA_DEADZONE_BOTTOM`): Vertical deadzone bottom threshold margin.
- Script target waypoints:
  - `$7E:23B9` (`TARGET_X`): Target waypoint X coordinate in world pixels (84 uses across 22 rooms, written in pairs via opcode 0x1B).
  - `$7E:23BB` (`TARGET_Y`): Target waypoint Y coordinate in world pixels (68 uses across 18 rooms).
- Party character staged coordinates:
  - `$7E:24AB` (`ACTIVE_CHAR_X`): Active character staged X coordinate (49 uses across 18 rooms).
  - `$7E:24AF` (`ACTIVE_CHAR_Y`): Active character staged Y coordinate (82 uses across 18 rooms).
  - `$7E:24AD` (`INACTIVE_CHAR_X`): Inactive companion character staged X coordinate.
  - `$7E:24B1` (`INACTIVE_CHAR_Y`): Inactive companion character staged Y coordinate.
- Lift and platform transit waypoints:
  - `$7E:249D` (`TRANSIT_ORIGIN_X`): Scripted transit/lift starting X coordinate (38 uses across 8 rooms).
  - `$7E:249F` (`TRANSIT_ORIGIN_Y`): Scripted transit/lift starting Y coordinate (111 uses across 10 rooms).
  - `$7E:24A1` (`TRANSIT_DEST_X`): Scripted transit/lift destination X coordinate (21 uses across 7 rooms).
  - `$7E:24A3` (`TRANSIT_DEST_Y`): Scripted transit/lift destination Y coordinate (23 uses across 7 rooms).
- Ballistics and trajectory physics (volcano pipe chutes and fall loops):
  - `$7E:24A7` (`TRAJECTORY_VY`): In-flight vertical velocity in 12.4 fixed-point format (simulated with 1 subpixel/frame² gravity acceleration).
  - `$7E:24B3` (`TRAJECTORY_INITIAL_VY`): Initial upward launch speed parameter (81 uses across 9 rooms).
  - `$7E:24B5` (`TRAJECTORY_MAX_VY`): Terminal downward velocity threshold (44 uses across 8 rooms).
  - `$7E:24B7` (`TRAJECTORY_VX`): Horizontal trajectory drift velocity per frame (38 uses across 5 rooms).
  - `$7E:24C3` (`PIPE_DESTINATION_ID`): Volcano pipe maze chute outlet index (1–10) branching to landing pads in Room 62 (36 uses).
- Dialogue, menu, and context operands:
  - `$7E:2463` (`MARKET_ITEM_ID`): Market trade commodity item ID passed to common dialogue routines (62 uses across R10 and R123).
  - `$7E:2545` (`DIALOGUE_SELECTION`): Player selection choice returned from `lookup_034d(0)` at Windwalker fire pits and Omnitopia terminals (36 uses across 6 rooms).
  - `$7E:2421` (`TRIGGER_INTERACTION_X`): Trigger interaction entity X pixel coordinate captured by engine trigger scanner.
  - `$7E:2423` (`TRIGGER_INTERACTION_Y`): Trigger interaction entity Y pixel coordinate captured by engine trigger scanner.
- Nobilia market timer registers:
  - `$7E:2513` (`MARKET_TIMER_START_FRAME`): Frame counter low word recording session entrance timestamp.
  - `$7E:2515` (`MARKET_TIMER_MINUTES_REMAINING`): Countdown indicator (15 down to 1 minute) evaluated by timer routines and market vendors.
- Antiqua character separation and exploration state:
  - `$7E:2350` (`DOG_SLEEP_SPOT`): Companion resting location index (0..4) in Crustacia and pyramid exploration (46 uses).
  - `$7E:2357` (`PYRAMID_CURRENT_LEVEL`): Active floor level in Great Pyramid (1 = bottom canine halls, 2 = top boy chambers; 20 uses).
  - `$7E:2358` (`PYRAMID_ENTRANCE_SECTOR`): Selected doorway/corridor sector index (0..2) in Great Pyramid transitions (26 uses).
  - `$7E:234D` (`CAVE_ENTRANCE_ID`): Shared Room 53 cave entrance sector index (1..6; 24 uses).
- Omnitopia ventilation shaft duct network:
  - `$7E:24F9` (`DUCT_ENTRANCE_GRATE_OBJECT`): Object index (0x2F..0x3E) of active entrance duct grate in Room 72 (46 uses).
  - `$7E:24FB` (`DUCT_EXIT_GRATE_OBJECT`): Object index of destination duct grate in Room 72 (14 uses).

The following shared scripts and routines have also been reverse-engineered, documented, and registered in compiler `ADDRESS` enums:
- `$92:DE75` (`ROOM_ENTER_EPILOGUE`): Default room enter script epilogue (attaches loot dust hook and fades in; 145 uses across 112 rooms).
- `$94:AC56` (`PIPE_FALL_TRAJECTORY`): Volcano pipe chute trajectory and gravity fall animation (21 uses).
- `$92:CDB3` (`MARKET_DIALOGUE_NOT_ENOUGH_ITEMS`): Market vendor dialogue for insufficient items (39 uses).
- `$92:CDBE` (`MARKET_DIALOGUE_RECEIVED_ITEM`): Market vendor dialogue for successful trade / item received (23 uses).
- `$92:CDCA` (`MARKET_DIALOGUE_PRINT_COMMODITY_NAME`): Market commodity name dispatcher.
- `$96:80AB` (`MARKET_VENDOR_RANDOM_CHATTER`): Nobilia Market vendor ambient banter / greeting chatter (59 uses).
- `$96:811A` (`MARKET_VENDOR_TIMER_WARNING`): Nobilia Market vendor timer warning dialogue (37 uses).
- `$92:CC6C` (`MARKET_TIMER_CALCULATE_MINUTES_REMAINING`): Computes remaining market minutes from frame counter.
- `$97:EDD8` (`IVOR_KITCHEN_DOOR_UNLOCK`): Ivor Tower banquet kitchen door unlocking sequence (35 uses).
- `$9A:E24F` (`OMNITOPIA_DUCT_CRAWL_TRANSITION`): Omnitopia duct crawl through shafts and room transition (14 uses).
- `$9A:E40D` (`OMNITOPIA_DUCT_ENTER_GRATE`): Omnitopia duct crawl enter animation and in-duct latch (16 uses).
- `$9A:E477` (`OMNITOPIA_DUCT_EXIT_GRATE`): Omnitopia duct crawl exit animation and latch clear (16 uses).

The following high-reuse transition flags have been verified and registered in compiler `FLAG` enums:
- `<0x22eb, 0x40>` (`DOORWAY_ARRIVAL`): Set by doorway exit triggers and consumed/cleared by exterior enter scripts to route character arrival (28 uses across 12 rooms).
- `<0x22f8, 0x04>` (`OMNITOPIA_DUCT_EXIT_ARRIVAL`): Set by Metroplex duct exit triggers and cleared by Omnitopia room enter scripts to trigger duct crawl arrival (28 uses across 8 rooms).

## Follow-up Queue

1. Reconcile `$22EA` and `$22EC` knowledge entries against the engine docs and script evidence; preserve the bit-specific/multi-purpose behavior rather than choosing a single title prematurely.
2. Resolve top remaining unmapped room scratch cells: `$24FD` (room transition scratch; 15 uses across 10 rooms), `$244F` / `$2451` (market vendor transaction loop counters in R10), and `$247B`–`$2491` (quicksand desert minigame loop registers in R89).
3. Trace the raw bit groups `$2269`–`$228B` to determine which are pickup/one-shot flags and whether any masks have engine readers beyond the matching scripts.
4. Cross-reference the numeric object flag IDs with the flag tag index and persistent save-flag storage; assign names only when the room context and flag behavior support them.
5. Confirm reset/lifetime rules for `temp_flag` and raw room-script scratch through its VM handler and a runtime trace. Do not equate repeated temporary indices across rooms with a shared persistent variable.

This draft deliberately records observed uses and evidence gaps; it does not claim that every address has been identified or that a byte’s unlisted bits are free.