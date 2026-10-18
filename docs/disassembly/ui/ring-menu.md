# Ring Menu Engine & Item Descriptor Subsystem

- **ROM Locations**:
  - `ring_menu_icon_table`: `$8E:8000` – `$8E:8143` (array of 16-bit pointers)
  - `ring_menu_item_descriptors`: `$8E:8144` – `$8E:83FF` (8-byte item structs)
  - `ring_menu_select_and_cost_check`: `$8E:8D80` – `$8E:8DC5`
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$8E`
- **WRAM Core Addresses**:
  - DP `$95`: Pointer to active ring menu state structure.
  - `$7E:2348`: Player currency / ingredient inventory base.
  - `$7E:0AC6`: Current inventory quantity of selected item.
  - `$7E:0AC8`: High word / maximum allowance for selected item.
  - `$7E:0BC5`: Base item price / ingredient consumption cost.
  - `$7E:05A9`: System interaction status flags (bit 4: rejection error buzz).

---

## 1. Architectural Architecture & Ring Menu Structure

Secret of Evermore adopts the circular "Ring Menu" system from Secret of Mana. When pressing SELECT or opening a submenu:
1. Active gameplay pauses while the ring icons rotate into position around the player or companion.
2. The icons are indexed by the 16-bit pointer table at `$8E:8000`.
3. Each item is defined by an 8-byte descriptor in ROM bank `$8E`.

### The 8-Byte Item Descriptor Format
```
Offset  Bytes  Field         Description
+0x00     2    name_ptr      16-bit pointer to name/description string in Bank $8E
+0x02     2    tile_id       16-bit VRAM icon tile pattern and palette selector
+0x04     2    item_flags    Category, target usability (boy/dog), and equip flags
+0x06     2    sub_index     Sub-item ID (Alchemy formula index, item index, weapon index)
```

---

## 2. Disassembly & Annotations

### Part 1: Selection & Cost Validation (`$8E:8D80`)
```assembly
; ==============================================================================
; ring_menu_select_and_cost_check ($8E:8D80)
; Evaluates selected ring menu icon, checks inventory limits and costs.
; ==============================================================================
$8E8D80  A8          TAY               ; Y = selected icon cursor index
$8E8D81  B1 95       LDA ($95),Y       ; Read icon index from ring menu state
$8E8D83  AA          TAX
$8E8D84  BF 00 80 8E LDA $8E8000,X     ; Read descriptor pointer from $8E:8000
$8E8D88  AA          TAX               ; X = ROM address of 8-byte item descriptor
$8E8D89  BF 06 00 8E LDA $8E0006,X     ; Read descriptor field +0x06 (sub-item ID)
$8E8D8D  85 12       STA $12           ; DP $12 = item sub-index (e.g. formula ID)

; Cost / Inventory Lookup:
$8E8D8F  A4 95       LDY $95
$8E8D91  B9 02 00    LDA $0002,Y       ; Read transaction type
$8E8D94  0A          ASL A
$8E8D95  AA          TAX
$8E8D96  BF C5 0B 00 LDA $000BC5,X     ; Load purchase price / required cost
$8E8D9A  85 02       STA $02           ; DP $02 = cost amount

; Verify Player Can Afford Transaction:
$8E8D9C  AD 48 23    LDA $2348         ; Read player inventory / currency balance
$8E8D9F  29 FF 00    AND #$00FF
$8E8DA2  AA          TAX
$8E8DA3  BF C8 0A 00 LDA $000AC8,X     ; Read upper limit / maximum capacity
$8E8DA7  29 FF 00    AND #$00FF
$8E8DAA  85 0C       STA $0C
$8E8DAC  BF C6 0A 00 LDA $000AC6,X     ; Read current quantity
$8E8DB0  38          SEC
$8E8DB1  E5 02       SBC $02           ; Deduct cost
$8E8DB3  85 0A       STA $0A
$8E8DB5  B0 0E       BCS $8E8DC5       ; If balance >= cost, transaction valid!

; Insufficient Funds / Rejection:
$8E8DB7  C6 0C       DEC $0C
$8E8DB9  10 0A       BPL $8E8DC5
$8E8DBB  A9 10 00    LDA #$0010        ; Bit 4: transaction failed flag
$8E8DBE  0C A9 05    TSB $05A9         ; Set failure bit in $7E:05A9
$8E8DC1  AB          PLB               ; Restore Data Bank
$8E8DC2  4C 67 AD    JMP $AD67         ; Play error buzz sound and return
```

---

## 3. Reconstructed Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#pragma pack(push, 1)
typedef struct {
    uint16_t name_ptr;    // +0x00: Pointer to localized item string in Bank $8E
    uint16_t tile_id;     // +0x02: VRAM icon pattern and palette selector
    uint16_t item_flags;  // +0x04: Type flags (alchemy, usable, weapon, armor)
    uint16_t sub_index;   // +0x06: Sub-item ID (e.g. formula index or item ID)
} MenuItemDescriptor;
#pragma pack(pop)

typedef struct {
    uint16_t icon_indices[16];   // Active ring slots
    uint16_t transaction_type;   // +0x02: Buy, Sell, Cast, Equip
} RingMenuState;

extern const uint16_t g_ring_icon_table[256];          // $8E:8000
extern const uint8_t  g_rom[0x400000];
extern uint16_t       g_player_currency;               // $7E:2348
extern uint16_t       g_system_status;                 // $7E:05A9

extern void play_error_buzz_sfx(void);

/**
 * Validates cost and inventory limits for a selected ring menu icon.
 * Corresponds to $8E:8D80.
 */
bool ring_menu_check_selection(const RingMenuState *menu, uint8_t cursor_idx, uint16_t *out_sub_index) {
    uint16_t icon_idx = menu->icon_indices[cursor_idx];
    
    // Resolve item descriptor pointer from table $8E:8000
    uint16_t desc_addr = g_ring_icon_table[icon_idx];
    const MenuItemDescriptor *desc = (const MenuItemDescriptor *)&g_rom[0x0E0000 | desc_addr];
    *out_sub_index = desc->sub_index;

    // Look up transaction price / cost
    uint16_t cost = *(const uint16_t *)&g_rom[0x0E0000 + 0x0BC5 + (menu->transaction_type * 2)];

    // Check player currency or inventory
    if (g_player_currency < cost) {
        // Insufficient funds: trigger failure bit and buzz SFX
        g_system_status |= 0x0010;
        play_error_buzz_sfx();
        return false;
    }

    return true;
}
```
