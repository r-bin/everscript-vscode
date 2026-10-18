# Map Trigger Scanner & Script Launcher

- **ROM Locations**:
  - `scan_room_triggers`: `$8F:ACCE` – `$8F:AD4D`
  - `b_trigger_entry`: `$8F:AC84` – `$8F:ACCD`
  - `launch_trigger_script`: `$8C:CE5C` – `$8C:CE98`
- **CPU State**: 16-bit A/X (`REP #$30`), toggles to 8-bit A (`SEP #$20`) during coordinate comparisons.
- **WRAM Core Addresses**:
  - `$7E:0F86`: Room tile origin X offset.
  - `$7E:0F88`: Room tile origin Y offset.
  - `$7E:1067`: Trigger table length / count.
  - `$7E:1069`–`$7E:106B`: 24-bit pointer to active trigger bounding box table (`[$26]`).
  - `$7E:2421`: Interaction entity X position.
  - `$7E:2423`: Interaction entity Y position.
  - `$7E:2425`: Interaction entity direction / facing state.
  - `$7E:2429`: Last triggered script ID (dialog state).
  - `$7E:2F28,x`: Active thread run-list.

---

## 1. Architectural Architecture & Trigger Bounding Boxes

Secret of Evermore room event scripting relies on two classes of triggers stored in each room's decompressed map blob:
1. **Step-on Triggers**: Walkway transitions, doorway warps, hidden cutscene lines. Evaluated when an actor steps onto walkable floor tiles.
2. **B-Triggers**: Interactive objects (gourds, sniff spots, chests, switches, NPCs). Evaluated when the player presses the **B** button while facing an interactive tile.

### The 6-Byte Trigger Structure
Both trigger types share the identical 6-byte format:
```
Offset  Bytes  Field      Description
+0x00     1    y1         Top coordinate bound (in 16px metatile cells)
+0x01     1    x1         Left coordinate bound (in 16px metatile cells)
+0x02     1    y2         Bottom coordinate bound (exclusive)
+0x03     1    x2         Right coordinate bound (exclusive)
+0x04     2    scriptId   16-bit script pointer table index
```

---

## 2. Disassembly & Annotations

### Part 1: Coordinate Conversion & Bounding Box Loop (`$8F:ACCE`)
```assembly
; ==============================================================================
; scan_room_triggers ($8F:ACCE)
; Input: DP $46 = Pixel X, DP $48 = Pixel Y, [$26] = Pointer to triggers
; ==============================================================================
; Convert Pixels to 16-Pixel Metatile Cells:
$8FACCE  A5 46       LDA $46           ; Entity X pixel coordinate
$8FACD0  4A          LSR A
$8FACD1  4A          LSR A
$8FACD2  4A          LSR A
$8FACD3  4A          LSR A             ; X >> 4 (Divide by 16)
$8FACD4  18          CLC
$8FACD5  6D 86 0F    ADC $0F86         ; Add room origin X offset
$8FACD8  85 46       STA $46           ; DP $46 = Cell X coordinate

$8FACDA  A5 48       LDA $48           ; Entity Y pixel coordinate
$8FACDC  4A          LSR A
$8FACDD  4A          LSR A
$8FACDE  4A          LSR A
$8FACDF  4A          LSR A             ; Y >> 4 (Divide by 16)
$8FACE0  18          CLC
$8FACE1  6D 88 0F    ADC $0F88         ; Add room origin Y offset
$8FACE4  85 48       STA $48           ; DP $48 = Cell Y coordinate

$8FACE6  A0 00 00    LDY #$0000        ; Table byte index Y = 0
$8FACE9  E2 20       SEP #$20          ; 8-bit Accumulator

; Iteration Over Trigger Entries:
$8FACEB  C4 12       CPY $12           ; Compare Y with total table length
$8FACED  B0 5F       BCS $8FAD4E       ; If Y >= length, no trigger activated

; Check y1 <= Cell_Y < y2:
$8FACEF  A5 48       LDA $48           ; A = Cell Y
$8FACF1  D7 26       CMP [$26],Y       ; Compare with y1
$8FACF3  90 4F       BCC $8FAD44       ; If Cell_Y < y1: miss, skip entry
$8FACF5  C8          INY
$8FACF6  A5 46       LDA $46           ; A = Cell X
$8FACF8  D7 26       CMP [$26],Y       ; Compare with x1
$8FACFA  90 49       BCC $8FAD45       ; If Cell_X < x1: miss, skip entry
$8FACFC  C8          INY
$8FACFD  A5 48       LDA $48           ; A = Cell Y
$8FACFF  D7 26       CMP [$26],Y       ; Compare with y2
$8FAD01  B0 43       BCS $8FAD46       ; If Cell_Y >= y2: miss, skip entry
$8FAD03  C8          INY
$8FAD04  A5 46       LDA $46           ; A = Cell X
$8FAD06  D7 26       CMP [$26],Y       ; Compare with x2
$8FAD08  B0 3D       BCS $8FAD47       ; If Cell_X >= x2: miss, skip entry

; Bounding Box Matched! Extract Script ID:
$8FAD0A  C2 20       REP #$20          ; 16-bit Accumulator
$8FAD0C  C8          INY
$8FAD0D  B7 26       LDA [$26],Y       ; Load 16-bit scriptId from offset +4
$8FAD0F  AA          TAX               ; X = scriptId
$8FAD10  A4 4C       LDY $4C           ; Y = triggering entity pointer

; Update Interaction State:
$8FAD12  A5 14       LDA $14
$8FAD14  D0 08       BNE $8FAD1E
$8FAD16  EC 29 24    CPX $2429         ; Already triggered this script?
$8FAD19  F0 35       BEQ $8FAD50       ; Don't re-trigger same script continuously
$8FAD1B  8E 29 24    STX $2429         ; Save script ID to $2429

$8FAD1E  B9 1A 00    LDA $001A,Y
$8FAD21  8D 21 24    STA $2421         ; Save entity X
$8FAD24  B9 1C 00    LDA $001C,Y
$8FAD27  8D 23 24    STA $2423         ; Save entity Y
$8FAD2A  B9 18 00    LDA $0018,Y
$8FAD2D  29 30 00    AND #$0030
$8FAD30  4A          LSR A
$8FAD31  4A          LSR A
$8FAD32  4A          LSR A
$8FAD33  4A          LSR A
$8FAD34  8D 25 24    STA $2425         ; Save entity facing direction
$8FAD37  B9 18 00    LDA $0018,Y
$8FAD3A  29 40 00    AND #$0040
$8FAD3D  8D 27 24    STA $2427
$8FAD40  5C 5C CE 8C JML $8CCE5C       ; Launch script thread!
```

### Part 2: Script Thread Launcher (`$8C:CE5C`)
```assembly
; ==============================================================================
; launch_trigger_script ($8C:CE5C)
; Input: X = scriptId
; Allocates thread slot and appends to run list $7E:2F28.
; ==============================================================================
$8CCE5C  8A          TXA               ; A = scriptId (offset in pointer table)
$8CCE5D  18          CLC
$8CCE5E  6F 00 80 92 ADC $928000       ; Add Script Bank pointer table base
$8CCE62  AA          TAX               ; X = ROM address of script pointer
$8CCE63  BF 00 80 92 LDA $928000,X     ; Read 24-bit script pointer low word
$8CCE67  85 26       STA $26
$8CCE69  BF 02 80 92 LDA $928002,X     ; Read 24-bit script pointer bank byte
$8CCE6D  29 FF 00    AND #$00FF
$8CCE70  85 28       STA $28

$8CCE72  5A          PHY               ; Preserve triggering entity
$8CCE73  22 18 CF 8C JSL $8CCF18       ; Allocate free VM thread slot -> returns in X
$8CCE77  68          PLA               ; Restore entity
$8CCE78  9F 0D 00 7E STA $7E000D,X     ; slot->entity_slot = triggering actor
$8CCE7C  F0 08       BEQ $8CCE86
$8CCE7E  A8          TAY
$8CCE7F  B9 3E 00    LDA $003E,Y       ; Increment actor active script lock count
$8CCE82  1A          INC A
$8CCE83  99 3E 00    STA $003E,Y

; Append Thread Slot to Run List:
$8CCE86  9B          TXY
$8CCE87  8A          TXA               ; A = allocated slot address
$8CCE88  A6 86       LDX $86           ; X = run-list end index
$8CCE8A  9F 28 2F 7E STA $7E2F28,X     ; Append slot to $7E:2F28,X
$8CCE8E  E8          INX
$8CCE8F  E8          INX
$8CCE90  7B          TDC               ; A = 0
$8CCE91  9F 28 2F 7E STA $7E2F28,X     ; Write null terminator
$8CCE95  86 86       STX $86           ; Update run-list end index
$8CCE97  BB          TYX
$8CCE98  6B          RTL               ; Return to game loop
```

---

## 3. Reconstructed Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#pragma pack(push, 1)
typedef struct {
    uint8_t  y1;        // +0x00: Top cell coordinate bound
    uint8_t  x1;        // +0x01: Left cell coordinate bound
    uint8_t  y2;        // +0x02: Bottom cell coordinate bound (exclusive)
    uint8_t  x2;        // +0x03: Right cell coordinate bound (exclusive)
    uint16_t script_id; // +0x04: Index into script pointer table
} MapTriggerEntry;
#pragma pack(pop)

typedef struct {
    uint16_t origin_x;        // $7E:0F86
    uint16_t origin_y;        // $7E:0F88
    uint16_t last_trigger_id; // $7E:2429
    uint16_t entity_x;        // $7E:2421
    uint16_t entity_y;        // $7E:2423
    uint16_t entity_facing;   // $7E:2425
    uint16_t run_list_tail;   // DP $86
    uint16_t run_list[32];    // $7E:2F28
} TriggerSystemContext;

extern TriggerSystemContext g_triggers;
extern const uint8_t        g_rom[0x400000];

extern uint16_t script_vm_alloc_slot(uint32_t script_addr);

/**
 * Spawns a new script thread in the VM for a triggered event.
 * Corresponds to $8C:CE5C.
 */
void launch_trigger_script(uint16_t script_id, uint16_t entity_slot) {
    // Read script pointer table offset from bank header $92:8000
    uint16_t table_base = (uint16_t)(g_rom[0x128000] | (g_rom[0x128001] << 8));
    uint32_t entry_addr = 0x128000 + table_base + script_id;

    // Packed 24-bit pointer
    uint32_t script_addr = (uint32_t)g_rom[entry_addr] |
                          ((uint32_t)g_rom[entry_addr + 1] << 8) |
                          ((uint32_t)g_rom[entry_addr + 2] << 16);

    // Allocate a VM thread slot
    uint16_t slot_offset = script_vm_alloc_slot(script_addr);

    // Append to active run-list
    uint16_t idx = g_triggers.run_list_tail;
    g_triggers.run_list[idx >> 1] = slot_offset;
    g_triggers.run_list[(idx >> 1) + 1] = 0; // Null terminator
    g_triggers.run_list_tail += 2;
}

/**
 * Scans active room triggers against entity pixel coordinates.
 * Corresponds to $8F:ACCE.
 */
bool scan_room_triggers(uint16_t pixel_x, uint16_t pixel_y, 
                        const MapTriggerEntry *table, uint16_t entry_count, 
                        uint16_t entity_slot, uint8_t facing) {
    // Convert 16px metatile cell coordinates
    uint8_t cell_x = (uint8_t)((pixel_x >> 4) + g_triggers.origin_x);
    uint8_t cell_y = (uint8_t)((pixel_y >> 4) + g_triggers.origin_y);

    for (uint16_t i = 0; i < entry_count; i++) {
        const MapTriggerEntry *t = &table[i];

        // Bounding box test: y1 <= cell_y < y2 && x1 <= cell_x < x2
        if (cell_y >= t->y1 && cell_y < t->y2 &&
            cell_x >= t->x1 && cell_x < t->x2) {
            
            // Prevent immediate re-triggering of the same active trigger
            if (t->script_id == g_triggers.last_trigger_id) {
                return false;
            }
            g_triggers.last_trigger_id = t->script_id;

            // Record activation context
            g_triggers.entity_x      = pixel_x;
            g_triggers.entity_y      = pixel_y;
            g_triggers.entity_facing = (facing & 0x30) >> 4;

            // Launch script thread!
            launch_trigger_script(t->script_id, entity_slot);
            return true;
        }
    }

    return false;
}
```

