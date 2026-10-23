/*
 * Routine: $8E99D2 (equipment_stats)
 * Bank: $8E (ROM Offset: $0E99D2)
 * Source: docs/disassembly/ui/equipment-stats.md
 */

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
