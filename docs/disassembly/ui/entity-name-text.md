# Entity Name & Status Inspection Card Streamer ($8C:89DF – $8C:8B79)

> **Subsystem**: Dialogue Window, Targeting Modal & Life Inspection Engine  
> **ROM Addresses**: `$8C:89DF` (`dialogue_stream_target_actor_name`), `$8C:8A25` (`oracle_render_target_stats_card`)  
> **Clean C Module**: `ui/entity-name-text.c`  
> **Recomp Symbols**: `func_8C89DF`, `func_8C8A25`  
> **Confidence**: Confirmed  

---

## 1. Architectural Role

During targeting modes (spellcasting, item consumption, weapon aiming) and NPC life inspection (Oracle / Status checks), the Secret of Evermore engine resolves entity identities and formats live diagnostic stats cards into text window streamer buffers:

1. **Target Actor Name Resolution (`$8C:89DF` – `$8C:8A1B`)**:
   - Examines targeting modal flags in `$7E:05AD`.
   - **Multi-Target Mode (`$05AD & 0x0001` != 0)**: Directs the string streamer to literal ASCII string `"Multiple\0"` located at `$8C:8A1C`.
   - **Single-Target Mode (`$05AD & 0x0001` == 0)**:
     - Obtains active target entity cursor pointer from `$7E:0B71`.
     - Follows entity struct field `+$60` to locate the character record in Bank `$8E` (`$8E:B678` stride 74 bytes).
     - Extracts the 24-bit character name pointer from record field `+$00` into Direct Page `$22`–`$24`.
     - For the Boy (`$7E:0A26`) and Dog (`$7E:0A70`), record `+$00` points to mutable WRAM buffers (`$7E:2400` / `$7E:2420`); for NPCs and monsters, it points to ROM name tables.
   - Sets Data Bank to `$80`, points destination window buffer offset to `Y = $034D`, and streams through `dialogue_string_copy_raw_name` (`$8C:AF2B`) and `dialogue_format_and_append_line` (`$8C:9E03`).

2. **Life & Combat Status Inspection Card (`$8C:8A25` – `$8C:8B79`)**:
   - Invoked when inspecting an entity's vital signs (e.g. Oracle / Fortune Teller NPC status dialogue).
   - If multi-target is selected (`$05AD & 0x0001`), rejects the inspection with the string `"I can only talk about one life at a time!\0"` (`$8C:8BA3`).
   - If single-target:
     - Unpacks entity pointer from `$7E:0B71` and streams the entity name into window buffer `$0379`.
     - Iteratively queries live entity WRAM and character record base stats, converts each 16-bit integer to decimal string into staging buffer `$7E:2FF4` via `int_to_dec_string` (`$80:B21F`), and appends formatted lines separated by newline control codes (`0x000A` via `$8C:A3AF`):
       1. `"HP: "` (`$8C:8B7A`) + Current HP from entity `+$2A` (`$7E:002A,X`).
       2. `"Attack: "` (`$8C:8B7F`) + Base Attack from character record `+$19` (`$8E:0019,X`).
       3. `"Defend: "` (`$8C:8B88`) + Base Defense from character record `+$1B` (`$8E:001B,X`).
       4. `"Hit %: "` (`$8C:8B91`) + Base Hit Rate from character record `+$21` (`$8E:0021,X`).
       5. `"Evade %: "` (`$8C:8B99`) + Base Evade Rate from character record `+$1F` (`$8E:001F,X`).

---

## 2. Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8C89DF](soe://rom/code/8C89DF?asm=1&c=0)


---

## 3. Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8C89DF_entity_name_text.c`](../../../reconstructed-c/8C/8C89DF_entity_name_text.c).
> [View in VFS: soe://rom/code/8C89DF](soe://rom/code/8C89DF?c=1&asm=0)


---

## 4. Verification & Behavioral Equivalence

| Test Condition | Assembly Logic | C Implementation | Status |
|---|---|---|---|
| Multi-target Name Stream | `$8C:89E2 BIT #$0001` branches to `$8A1C` `"Multiple"` | `modal_flags & TARGET_FLAG_MULTI_TARGET` selects `STRING_MULTIPLE` | Identical |
| Single-target Name Unpack | Entity `+$60` -> Record `+$00` 24-bit pointer | `record + RECORD_NAME_PTR_OFFSET` | Identical |
| Destination Buffer Routing | `LDY #$034D` for name, `LDY #$0379` for status card | `WINDOW_BUFFER_TARGET_NAME`, `WINDOW_BUFFER_STATUS_CARD` | Identical |
| Multi-target Inspection Rejection | `$8C:8A28 BIT #$0001` branches to `$8BA3` rejection text | `STRING_ONE_LIFE_ONLY` formatted and early return | Identical |
| Live HP Lookup | Reads `$7E:002A,X` from preserved entity pointer | `*(const uint16_t *)(target_entity + 0x2A)` | Identical |
| Record Stats Query | Reads `+$19` (Atk), `+$1B` (Def), `+$21` (Hit), `+$1F` (Evd) | `RECORD_ATTACK_OFFSET`, `RECORD_DEFENSE_OFFSET`, `RECORD_HIT_RATE_OFFSET`, `RECORD_EVADE_OFFSET` | Identical |
| Integer Formatting | Calls `$80:B21F` into `$7E:2FF4` | `int_to_dec_string` formatting | Identical |
| Line Delimiting | `$8C:A3AF` called with `#$000A` between stats | `dialogue_append_char(..., 0x000A)` | Identical |
