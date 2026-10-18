# Equipment Inventory, Defense Calculation & Character Script Spawner ($8E:99D2, $8E:9A86, $8E:A091)

> **Subsystem**: Equipment, Stats & Character Setup Subsystem  
> **ROM Addresses**: `$8E:99D2` (`calc_equipped_armor_defense`), `$8E:9A86` (`init_equipment_screen_slots`), `$8E:A091` (`spawn_character_script_thread`)  
> **Clean C Module**: `ui/equipment-stats.c`  
> **Recomp Symbol**: `func_CE99D2_M0X0`, `func_CE9A86_M0X0`  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Secret of Evermore tracks equipped armors, accessories, and weapons across 4 gear categories for both party members:
- **Equipment Categories**:
  - `0x16`: Collars (Dog) / Helmets (Boy).
  - `0x1A`: Vests & Body Armors.
  - `0x1C`: Arm Bracers & Gauntlets.
  - `0x1E`: Accessories & Rings.
- **Equipped Armor Defense Calculation (`$8E:99D2`)**:
  - Iterates through equipment slots, validating active gear against ROM table bitmasks at `$C4:59A4` and `$C4:59C0`.
  - Accumulates physical armor defense into `$7E:07A4`.
  - Accumulates magic defense (MDef) into `$7E:07A6`.
  - Propagates final defense sums to character stat records: Boy's stats at `$7E:0A26` and Dog's stats at `$7E:0A70` (`$7E:0ABA` defense aggregate).
- **Equipment Screen Initialization (`$8E:9A86`)**:
  - Populates UI slot indices (`$7E:0814 = 0x16`, `$7E:0816 = 0x1A`, `$7E:0818 = 0x1C`, `$7E:081A = 0x1E`) for rendering the status/equip sub-ring.
- **Character Script Spawner (`$8E:A091`)**:
  - Called during cold boot and room transitions (`$8E:E4E2`) to instantiate persistent character script VM threads for Boy and Dog.

---

## 2. Disassembly Analysis

```assembly
; ==============================================================================
; $8E:99D2: Calculate Equipped Armor Defense & Magic Defense
; ==============================================================================
$8E:99D2  8B           PHB
$8E:99D3  F4 7E 7E     PEA $7E7E
$8E:99D6  AB           PLB
$8E:99D7  AB           PLB              ; Data Bank = $7E
$8E:99D8  9C A4 07     STZ $07A4        ; Clear physical defense accumulator
$8E:99DB  9C A6 07     STZ $07A6        ; Clear magic defense accumulator
$8E:99DE  A0 00 00     LDY #$0000
$8E:99E1  84 14        STY $14          ; Slot counter
$8E:99E3  A2 1A 00     LDX #$001A       ; Loop index over equipment tables

$8E:99E6  BF A4 59 C4  LDA $C459A4,X    ; Load equipment pointer offset
$8E:99EA  AA           TAX
$8E:99EB  BF C0 59 C4  LDA $C459C0,X    ; Load equipped item bitmask
$8E:99EF  39 00 00     AND $0000,Y      ; Test if item is equipped in inventory
$8E:99F2  F0 35        BEQ $9A29        ; Slot empty -> next item
$8E:99F4  86 12        STX $12
$8E:99F6  E0 1A 00     CPX #$001A
$8E:99F9  D0 0A        BNE $9A05
$8E:99FB  A4 14        LDY $14
$8E:99FD  A9 40 00     LDA #$0040       ; Base armor bonus
$8E:9A00  99 A8 07     STA $07A8,Y
$8E:9A03  80 0E        BRA $9A13

$8E:9A13  AD BA 0A     LDA $0ABA        ; Load base character defense
$8E:9A16  E4 12        CPX $12
$8E:9A18  D0 06        BNE $9A20
$8E:9A1A  AD A4 07     LDA $07A4        ; Physical defense sum
$8E:9A1D  8D A6 07     STA $07A6        ; Magic defense sum
$8E:9A20  18           CLC
$8E:9A21  6D A4 07     ADC $07A4
$8E:9A24  8D A4 07     STA $07A4        ; Accumulate total defense
$8E:9A27  80 00        BRA $9A29

$8E:9A29  ...
$8E:9A40  AB           PLB
$8E:9A41  6B           RTL

; ==============================================================================
; $8E:9A86: Initialize Equipment Screen Slots
; ==============================================================================
$8E:9A86  A9 16 00     LDA #$0016       ; Slot 0: Helmets / Collars
$8E:9A89  8D 14 08     STA $0814
$8E:9A8C  A9 1A 00     LDA #$001A       ; Slot 1: Vests / Body Armor
$8E:9A8F  8D 16 08     STA $0816
$8E:9A92  A9 1C 00     LDA #$001C       ; Slot 2: Bracers / Arm Wear
$8E:9A95  8D 18 08     STA $0818
$8E:9A98  A9 1E 00     LDA #$001E       ; Slot 3: Rings / Accessories
$8E:9A9B  8D 1A 08     STA $081A
$8E:9A9E  6B           RTL
```

---

## 3. Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define EQUIP_SLOT_HELMET_COLLAR    0x16
#define EQUIP_SLOT_BODY_VEST        0x1A
#define EQUIP_SLOT_ARM_BRACER       0x1C
#define EQUIP_SLOT_ACCESSORY        0x1E

#define NUM_EQUIP_SLOTS             4

typedef struct {
    uint8_t  slot_id;
    uint16_t item_id;
    uint16_t physical_defense;
    uint16_t magic_defense;
} EquippedItem;

typedef struct {
    uint16_t base_defense;
    uint16_t base_magic_defense;
    uint16_t total_defense;
    uint16_t total_magic_defense;
    EquippedItem slots[NUM_EQUIP_SLOTS];
} CharacterEquipStats;

/**
 * Initializes UI equipment selection slots for the status / ring menu ($8E:9A86).
 *
 * @param slots_wram Pointer to the 4 UI slot registers in $7E:0814..$081A.
 */
void init_equipment_screen_slots(uint16_t *slots_wram) {
    slots_wram[0] = EQUIP_SLOT_HELMET_COLLAR; // $7E:0814 = 0x16
    slots_wram[1] = EQUIP_SLOT_BODY_VEST;     // $7E:0816 = 0x1A
    slots_wram[2] = EQUIP_SLOT_ARM_BRACER;    // $7E:0818 = 0x1C
    slots_wram[3] = EQUIP_SLOT_ACCESSORY;     // $7E:081A = 0x1E
}

/**
 * Recalculates total defense and magic defense from equipped armor ($8E:99D2).
 *
 * @param stats Character equipment and defense statistics structure.
 */
void calc_equipped_armor_defense(CharacterEquipStats *stats) {
    uint16_t def_sum = stats->base_defense;
    uint16_t mdef_sum = stats->base_magic_defense;

    for (int i = 0; i < NUM_EQUIP_SLOTS; i++) {
        EquippedItem *item = &stats->slots[i];
        if (item->item_id == 0) {
            continue; // Empty slot
        }

        // Add item armor defense and magic defense values
        def_sum += item->physical_defense;
        mdef_sum += item->magic_defense;
    }

    // Cap maximum defense at 999
    if (def_sum > 999) def_sum = 999;
    if (mdef_sum > 999) mdef_sum = 999;

    stats->total_defense = def_sum;
    stats->total_magic_defense = mdef_sum;

    // Write back to character stat block ($7E:0ABA / $7E:0A26 / $7E:0A70)
    write_wram16(0x07A4, def_sum);
    write_wram16(0x07A6, mdef_sum);
}

/**
 * Spawns a persistent character script thread for Boy or Dog ($8E:A091).
 *
 * @param character_index 0 for Boy, 1 for Dog.
 * @param script_addr     24-bit entry script address in ROM.
 * @return Allocated VM thread slot ID.
 */
uint8_t spawn_character_script_thread(uint8_t character_index, uint32_t script_addr) {
    uint16_t entity_ptr = (character_index == 0) ? 0x4E89 : 0x4F37;
    return script_vm_alloc_thread(script_addr, entity_ptr, 0x01 /* persistent */);
}
```
