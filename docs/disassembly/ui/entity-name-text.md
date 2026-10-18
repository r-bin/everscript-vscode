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

```assembly
; ==============================================================================
; func_8C89DF: Stream Target Actor Name into Window Buffer ($034D)
; ==============================================================================
$8C:89DF  AD AD 05     LDA $05AD        ; Targeting modal flags
$8C:89E2  89 01 00     BIT #$0001       ; Multi-target bit active?
$8C:89E5  F0 0C        BEQ $89F3        ; Branch if single target
$8C:89E7  A9 1C 8A     LDA #$8A1C       ; Pointer to string "Multiple\0"
$8C:89EA  85 22        STA $22
$8C:89EC  A9 8C 00     LDA #$008C
$8C:89EF  85 24        STA $24
$8C:89F1  80 16        BRA $8A09        ; Jump to stream dispatch

$8C:89F3  AC 71 0B     LDY $0B71        ; Target selection cursor
$8C:89F6  BE 00 00     LDX $0000,Y      ; Target entity pointer
$8C:89F9  BD 60 00     LDA $0060,X      ; Entity +$60: Character record in Bank $8E
$8C:89FC  AA           TAX
$8C:89FD  BF 00 00 8E  LDA $8E0000,X    ; Record +$00: 24-bit Name Pointer Low
$8C:8A01  85 22        STA $22
$8C:8A03  BF 01 00 8E  LDA $8E0001,X    ; Record +$01: 24-bit Name Pointer High
$8C:8A07  85 23        STA $23

$8C:8A09  8B           PHB
$8C:8A0A  F4 80 80     PEA $8080
$8C:8A0D  AB           PLB
$8C:8A0E  AB           PLB              ; Data Bank = $80
$8C:8A0F  A0 4D 03     LDY #$034D       ; Target name window text buffer offset
$8C:8A12  22 2B AF 8C  JSL $8CAF2B      ; Copy raw name into window buffer
$8C:8A16  22 03 9E 8C  JSL $8C9E03      ; Format and append text line
$8C:8A1A  AB           PLB
$8C:8A1B  60           RTS

$8C:8A1C  .byte "Multiple", $00

; ==============================================================================
; func_8C8A25: Render Target Life & Combat Stats Card into Buffer ($0379)
; ==============================================================================
$8C:8A25  AD AD 05     LDA $05AD        ; Targeting modal flags
$8C:8A28  89 01 00     BIT #$0001       ; Multi-target check
$8C:8A2B  F0 1D        BEQ $8A4A        ; Branch if single target
$8C:8A2D  A9 A3 8B     LDA #$8BA3       ; "I can only talk about one life at a time!\0"
$8C:8A30  85 22        STA $22
$8C:8A32  A9 8C 00     LDA #$008C
$8C:8A35  85 24        STA $24
$8C:8A37  8B           PHB
$8C:8A38  F4 80 80     PEA $8080
$8C:8A3B  AB           PLB
$8C:8A3C  AB           PLB              ; DB = $80
$8C:8A3D  A0 79 03     LDY #$0379       ; Status inspection window buffer offset
$8C:8A40  22 2B AF 8C  JSL $8CAF2B
$8C:8A44  22 03 9E 8C  JSL $8C9E03
$8C:8A48  AB           PLB
$8C:8A49  60           RTS

$8C:8A4A  AC 71 0B     LDY $0B71        ; Target selection cursor
$8C:8A4D  BE 00 00     LDX $0000,Y      ; Entity pointer
$8C:8A50  8B           PHB
$8C:8A51  F4 80 80     PEA $8080
$8C:8A54  AB           PLB
$8C:8A55  AB           PLB              ; DB = $80
$8C:8A56  DA           PHX              ; Preserve entity pointer on stack
$8C:8A57  A0 79 03     LDY #$0379
$8C:8A5A  22 2B AF 8C  JSL $8CAF2B      ; Stream entity name header
$8C:8A5E  A9 7A 8B     LDA #$8B7A       ; "HP: \0"
$8C:8A61  85 22        STA $22
$8C:8A63  A9 8C 00     LDA #$008C
$8C:8A66  85 24        STA $24
$8C:8A68  A0 79 03     LDY #$0379
$8C:8A6B  22 03 9E 8C  JSL $8C9E03      ; Append "HP: "
$8C:8A6F  A3 01        LDA $01,S        ; Reload entity pointer from stack
$8C:8A71  AA           TAX
$8C:8A72  BF 2A 00 7E  LDA $7E002A,X    ; Entity +$2A: Current HP
$8C:8A76  85 02        STA $02
$8C:8A78  64 04        STZ $04
$8C:8A7A  A9 F4 2F     LDA #$2FF4       ; Decimal ASCII string staging buffer
$8C:8A7D  85 22        STA $22
$8C:8A7F  A9 7E 00     LDA #$007E
$8C:8A82  85 24        STA $24
$8C:8A84  22 1F B2 80  JSL $80B21F      ; Convert int in $02 to decimal string
$8C:8A88  A0 79 03     LDY #$0379
$8C:8A8B  22 03 9E 8C  JSL $8C9E03      ; Append numeric HP
$8C:8A8F  A9 0A 00     LDA #$000A       ; Newline character '\n'
$8C:8A92  22 AF A3 8C  JSL $8CA3AF      ; Append newline code
; ... Repeats for Attack ($19), Defense ($1B), Hit % ($21), Evade % ($1F)
$8C:8B77  FA           PLX              ; Clean up stack
$8C:8B78  AB           PLB              ; Restore DB
$8C:8B79  60           RTS
```

---

## 3. Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

/* Target modal flags ($7E:05AD) */
#define TARGET_FLAG_MULTI_TARGET   0x0001
#define TARGET_FLAG_REDRAW_BANNER  0x0100

/* Staging text buffer offsets */
#define WINDOW_BUFFER_TARGET_NAME  0x034D
#define WINDOW_BUFFER_STATUS_CARD  0x0379
#define BUFFER_DECIMAL_CONVERT     0x2FF4

/* Character record field offsets in Bank $8E */
#define RECORD_NAME_PTR_OFFSET     0x00
#define RECORD_ATTACK_OFFSET       0x19
#define RECORD_DEFENSE_OFFSET      0x1B
#define RECORD_EVADE_OFFSET        0x1F
#define RECORD_HIT_RATE_OFFSET     0x21

/* String literals embedded in Bank $8C */
static const char STRING_MULTIPLE[] = "Multiple";
static const char STRING_ONE_LIFE_ONLY[] = "I can only talk about one life at a time!";
static const char STRING_LABEL_HP[] = "HP: ";
static const char STRING_LABEL_ATTACK[] = "Attack: ";
static const char STRING_LABEL_DEFEND[] = "Defend: ";
static const char STRING_LABEL_HIT_PCT[] = "Hit %: ";
static const char STRING_LABEL_EVADE_PCT[] = "Evade %: ";

/* External engine functions */
extern void dialogue_string_copy_raw_name(uint16_t buffer_offset, const char *source_str);
extern void dialogue_format_and_append_line(uint16_t buffer_offset, const char *line_str);
extern void dialogue_append_char(uint16_t buffer_offset, uint16_t character_code);
extern void int_to_dec_string(uint16_t value, char *out_buffer);
extern uint8_t *rom_bank_8e_ptr(uint16_t offset);

/**
 * Streams the active target actor's name into the dialogue window target banner.
 *
 * Address: $8C:89DF - $8C:8A1B
 *
 * @param modal_flags       Contents of $7E:05AD (targeting state)
 * @param cursor_entity_ptr Pointer to selected target entity in $7E:0000+
 */
void dialogue_stream_target_actor_name(uint16_t modal_flags, const uint8_t *target_entity) {
    const char *name_ptr = NULL;

    if (modal_flags & TARGET_FLAG_MULTI_TARGET) {
        /* Multi-target mode: display generic "Multiple" label */
        name_ptr = STRING_MULTIPLE;
    } else {
        if (target_entity != NULL) {
            /* Entity struct +0x60 holds 16-bit offset of character record in Bank $8E */
            uint16_t record_offset = *(const uint16_t *)(target_entity + 0x60);
            const uint8_t *record = rom_bank_8e_ptr(record_offset);

            /* Character record +0x00 holds 24-bit pointer to character name string */
            uint32_t name_addr = *(const uint32_t *)(record + RECORD_NAME_PTR_OFFSET) & 0x00FFFFFF;

            if ((name_addr >> 16) == 0x7E) {
                /* Boy / Dog mutable name buffer in WRAM ($7E:2400 / $7E:2420) */
                name_ptr = (const char *)(uintptr_t)name_addr;
            } else {
                /* NPC / Monster fixed name in ROM */
                name_ptr = (const char *)rom_bank_8e_ptr(name_addr & 0xFFFF);
            }
        }
    }

    if (name_ptr != NULL) {
        /* Set Bank $80 and stream into target name banner buffer */
        dialogue_string_copy_raw_name(WINDOW_BUFFER_TARGET_NAME, name_ptr);
        dialogue_format_and_append_line(WINDOW_BUFFER_TARGET_NAME, name_ptr);
    }
}

/**
 * Formats and renders a complete vital statistics card for an entity
 * into the inspection text window (used by Oracle / Fortune Teller NPCs).
 *
 * Address: $8C:8A25 - $8C:8B79
 *
 * @param modal_flags   Contents of $7E:05AD
 * @param target_entity Pointer to selected target entity in WRAM
 */
void oracle_render_target_stats_card(uint16_t modal_flags, const uint8_t *target_entity) {
    if (modal_flags & TARGET_FLAG_MULTI_TARGET) {
        /* Life inspector only evaluates one creature at a time */
        dialogue_string_copy_raw_name(WINDOW_BUFFER_STATUS_CARD, STRING_ONE_LIFE_ONLY);
        dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, STRING_ONE_LIFE_ONLY);
        return;
    }

    if (target_entity == NULL) {
        return;
    }

    char dec_buffer[16];

    /* 1. Header: Entity Name */
    uint16_t record_offset = *(const uint16_t *)(target_entity + 0x60);
    const uint8_t *record = rom_bank_8e_ptr(record_offset);
    uint32_t name_addr = *(const uint32_t *)(record + RECORD_NAME_PTR_OFFSET) & 0x00FFFFFF;
    const char *name_ptr = (const char *)(uintptr_t)name_addr;

    dialogue_string_copy_raw_name(WINDOW_BUFFER_STATUS_CARD, name_ptr);

    /* 2. Current HP ($7E:002A,X) */
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, STRING_LABEL_HP);
    uint16_t current_hp = *(const uint16_t *)(target_entity + 0x2A);
    int_to_dec_string(current_hp, dec_buffer);
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, dec_buffer);
    dialogue_append_char(WINDOW_BUFFER_STATUS_CARD, 0x000A); /* Newline */

    /* 3. Base Attack (Record +$19) */
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, STRING_LABEL_ATTACK);
    uint16_t attack = *(const uint16_t *)(record + RECORD_ATTACK_OFFSET);
    int_to_dec_string(attack, dec_buffer);
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, dec_buffer);
    dialogue_append_char(WINDOW_BUFFER_STATUS_CARD, 0x000A);

    /* 4. Base Defense (Record +$1B) */
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, STRING_LABEL_DEFEND);
    uint16_t defense = *(const uint16_t *)(record + RECORD_DEFENSE_OFFSET);
    int_to_dec_string(defense, dec_buffer);
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, dec_buffer);
    dialogue_append_char(WINDOW_BUFFER_STATUS_CARD, 0x000A);

    /* 5. Base Hit Rate (Record +$21) */
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, STRING_LABEL_HIT_PCT);
    uint16_t hit_pct = *(const uint16_t *)(record + RECORD_HIT_RATE_OFFSET);
    int_to_dec_string(hit_pct, dec_buffer);
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, dec_buffer);
    dialogue_append_char(WINDOW_BUFFER_STATUS_CARD, 0x000A);

    /* 6. Base Evade Rate (Record +$1F) */
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, STRING_LABEL_EVADE_PCT);
    uint16_t evade_pct = *(const uint16_t *)(record + RECORD_EVADE_OFFSET);
    int_to_dec_string(evade_pct, dec_buffer);
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, dec_buffer);
}
```

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
