# Save Game NVRAM Serialization & Checksum Verification

> **ROM Bank**: `$8D` (Save/Load Engine), `$80` (Boot Validation `$80:8B6C`)  
> **Source Routines**: `$8D:C905` (`sram_verify_all_save_slots`), `$8D:B478` (`sram_compute_checksum`)  
> **Related Routines**: `$80:8B66` (Main loop entry), `$8E:A091` (Save slot selection screen)  
> **Hardware Memory**: SNES Battery-Backed SRAM (Bank `$30`, `$30:6000`–`$30:7FFF`)  
> **Memory Map**: `$7E:0B33` (Active slot mask bit), `$7E:0B37` (Slot SRAM base pointer), `$7E:0B39` (Valid slot bitfield mask, bits 0..3), `$7E:0B3B` (SRAM present flag)

---

## 1. Architectural Overview

*Secret of Evermore* utilizes battery-backed cartridge SRAM mapped into the SNES upper memory map at **Bank `$30`** (`$30:6000`–`$30:7FFF`). The engine supports **four discrete save files**, each storing the complete state of the campaign.

### Save Slot Memory Layout:
Each save slot occupies exactly **817 bytes** (`0x0331`), structured as a 2-byte 16-bit checksum header followed by an 815-byte (`0x032F`) game state payload:

| Save Slot | Base Address in Bank `$30` | Checksum Header | Payload Range | Length |
|---|---|---|---|---|
| **Header**| `$30:6000` | — | Global NVRAM initialization flag | 2 bytes |
| **Slot 1** | `$30:6002` | `$30:6002` | `$30:6004` – `$30:6332` | 817 bytes (`0x0331`) |
| **Slot 2** | `$30:6333` | `$30:6333` | `$30:6335` – `$30:6663` | 817 bytes (`0x0331`) |
| **Slot 3** | `$30:6664` | `$30:6664` | `$30:6666` – `$30:6994` | 817 bytes (`0x0331`) |
| **Slot 4** | `$30:6995` | `$30:6995` | `$30:6997` – `$30:6CC5` | 817 bytes (`0x0331`) |

### Key Subsystems:
1. **Boot-Time SRAM Validation (`$80:8B6C` & `$8D:C905`)**:
   - Immediately following CPU reset, the engine verifies whether battery SRAM hardware is connected by probing `$30:6001`.
   - The result is stored into `$7E:0B3B`.
   - Calls `$8D:C905` to scan all 4 save slots and verify their integrity.
2. **Rotational Checksum Algorithm (`$8D:B478`)**:
   - The checksum algorithm is an alternating 16-bit rotate-and-accumulate function.
   - **Seed**: Initialized to `0x043F`.
   - Over all 815 bytes of payload data, the accumulator rotates left by 1 bit (`ASL A`) between consecutive byte additions (`ADC $0000,x`).
   - The final 16-bit word is compared against the header word at the beginning of the slot.
3. **Slot Validity Bitfield (`$7E:0B39`)**:
   - As each slot passes verification, the engine asserts its corresponding bit in `$0B39`:
     - Bit 0 (`0x01`): Slot 1 valid
     - Bit 1 (`0x02`): Slot 2 valid
     - Bit 2 (`0x04`): Slot 3 valid
     - Bit 3 (`0x08`): Slot 4 valid
   - If a checksum fails, that slot's bit remains 0, prompting the UI to display the file as empty or corrupted.
4. **WRAM-to-SRAM State Serialization**:
   - During save point interactions (Inns, Save Monuments), the engine packs player stats into the slot:
     - Boy / Dog names and levels (`$7E:0A50`, `$7E:0A35`)
     - Equipped weapons, armor, and weapon skill experience
     - Active alchemy formula bitfield (`$7E:2258`) and ingredient counts (`$7E:22FF`–`$7E:2314`)
     - Story progression and treasure chest flags (`$7E:2280`–`$7E:237F`)

---

## 2. 65816 Assembly Implementation

```assembly
; ==============================================================================
; $8D:C905 - Verify All Save Slots in Battery SRAM
; Outputs: $0B39 = Bitmask of valid save slots (bits 0..3)
; ==============================================================================
sram_verify_all_save_slots:
    LDA #$6002                  ; Slot 1 base address in bank $30
    STA $0B37
    STZ $0B39                   ; Clear valid slot bitmask
    LDA #$0001                  ; Slot 1 bitmask
    STA $0B33

.slot_loop:
    LDX $0B37
    INX
    INX                         ; Point X to payload start (+2)
    LDY #$032F                  ; Payload length = 815 bytes
    PHB
    PEA $3030
    PLB
    PLB                         ; Data Bank = $30 (SRAM)
    JSL $8DB478                 ; Compute 16-bit rotational checksum
    PLB

    LDX $0B37
    CMP $300000,X               ; Compare with stored checksum in slot header
    BNE .slot_invalid           ; Mismatch: skip bit assertion

    LDA $0B33
    TSB $0B39                   ; Mark slot as valid in bitmask

.slot_invalid:
    LDA $0B33
    ASL A                       ; Advance to next slot bitmask (1 -> 2 -> 4 -> 8)
    CMP #$0010                  ; Evaluated all 4 slots?
    BEQ .done
    STA $0B33

    LDA $0B37
    CLC
    ADC #$0331                  ; Advance pointer to next save slot (+817 bytes)
    STA $0B37
    JMP .slot_loop

.done:
    RTL

; ==============================================================================
; $8D:B478 - Compute Rotational 16-Bit Checksum
; Inputs: X = Payload buffer pointer, Y = Byte count ($032F)
; Output: A = Computed checksum word
; ==============================================================================
sram_compute_checksum:
    LDA #$043F                  ; Initial seed = 0x043F

.sum_loop:
    SEP #$20                    ; 8-bit accumulator
    CLC
    ADC $0000,X                 ; Add payload byte
    DEY
    BEQ .checksum_finished      ; Exit when byte count exhausted
    INX
    REP #$20                    ; 16-bit accumulator
    ASL A                       ; Rotate left 1 bit
    SEP #$20                    ; 8-bit accumulator
    CLC
    ADC $0000,X                 ; Add alternating byte
    BRA .sum_loop

.checksum_finished:
    REP #$20                    ; Restore 16-bit accumulator
    RTL
```

---

## 3. Clean C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

#define NUM_SAVE_SLOTS          4
#define SRAM_BASE_OFFSET        0x6002
#define SAVE_SLOT_TOTAL_SIZE    0x0331  /* 817 bytes per slot */
#define SAVE_SLOT_PAYLOAD_SIZE  0x032F  /* 815 bytes payload */
#define CHECKSUM_SEED           0x043F

typedef struct {
    uint16_t checksum;          /* Stored 16-bit header checksum */
    uint8_t  payload[SAVE_SLOT_PAYLOAD_SIZE];
} SramSaveSlot;

typedef struct {
    uint16_t global_init_flag;  /* $30:6000 */
    SramSaveSlot slots[NUM_SAVE_SLOTS];
} SramLayout;

typedef struct {
    uint8_t  valid_slots_mask;  /* $7E:0B39 (bits 0..3) */
    bool     sram_present;      /* $7E:0B3B */
} SaveSystemState;

/**
 * Computes the authentic Secret of Evermore rotational 16-bit checksum.
 * Corresponds to native routine $8D:B478.
 */
uint16_t sram_compute_checksum(const uint8_t *payload, uint16_t length) {
    uint16_t acc = CHECKSUM_SEED;
    uint16_t index = 0;

    while (index < length) {
        /* Add low byte */
        acc = (acc & 0xFF00) | ((acc + payload[index++]) & 0x00FF);
        if (index >= length) {
            break;
        }

        /* 16-bit rotate left by 1 bit */
        acc = (uint16_t)(acc << 1);

        /* Add next byte */
        acc = (acc & 0xFF00) | ((acc + payload[index++]) & 0x00FF);
    }

    return acc;
}

/**
 * Scans all four battery-backed SRAM save slots and builds the valid slot bitmask.
 * Corresponds to native routine $8D:C905.
 */
uint8_t sram_verify_all_save_slots(const SramLayout *sram) {
    uint8_t valid_mask = 0;

    for (int i = 0; i < NUM_SAVE_SLOTS; i++) {
        const SramSaveSlot *slot = &sram->slots[i];

        /* Calculate checksum across 815 bytes of game state data */
        uint16_t computed = sram_compute_checksum(slot->payload, SAVE_SLOT_PAYLOAD_SIZE);

        /* Validate against stored header checksum */
        if (computed == slot->checksum) {
            valid_mask |= (1 << i); /* Assert slot valid bit */
        }
    }

    return valid_mask;
}

/**
 * Serializes active game state into a specified SRAM slot and calculates its checksum.
 */
void sram_save_slot(SramLayout *sram, int slot_index, const uint8_t *wram_state) {
    if (slot_index < 0 || slot_index >= NUM_SAVE_SLOTS) {
        return;
    }

    SramSaveSlot *slot = &sram->slots[slot_index];

    /* Copy 815 bytes of active WRAM state to SRAM payload */
    for (int i = 0; i < SAVE_SLOT_PAYLOAD_SIZE; i++) {
        slot->payload[i] = wram_state[i];
    }

    /* Compute and store header checksum */
    slot->checksum = sram_compute_checksum(slot->payload, SAVE_SLOT_PAYLOAD_SIZE);
}
```
