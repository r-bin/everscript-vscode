/*
 * Routine: $8E9298 (consumable_effects)
 * Bank: $8E (ROM Offset: $0E9298)
 * Source: docs/disassembly/combat/consumable-effects.md
 */

#include <stdint.h>
#include <stdbool.h>

#define PETAL_HEAL_AMOUNT 40
#define DOG_BISCUIT_HEAL_AMOUNT 40

enum ConsumableItemType {
    ITEM_PETAL      = 0,
    ITEM_NECTAR     = 1,
    ITEM_HONEY      = 2,
    ITEM_BISCUIT    = 3,
    ITEM_WINGS      = 4,
    ITEM_PIXIE_DUST = 5,
};

extern uint8_t  g_satchel_items[8];      // $7E:2315..$7E:231B
extern uint16_t g_max_hp;               // $7E:0A35
extern uint16_t g_boy_hp;               // $7E:4EB3
extern uint16_t g_dog_hp;               // $7E:4F93
extern uint16_t g_condition_flags;      // $7E:4E2B
extern uint16_t g_dungeon_escape_flag;  // $7E:0E5E

extern void consumable_item_satchel_deduct(uint8_t item_index); // $8E:9060
extern void play_sound_effect_direct(uint16_t sfx_id);          // $8C:82DC
extern void ring_menu_close_and_resume(void);                   // $8E:AD67

/**
 * Executes consumable satchel item effects from the ring menu.
 * Corresponds to $8E:9298.
 */
void ring_menu_consumable_item_execute(uint8_t item_index) {
    if (item_index > ITEM_PIXIE_DUST) {
        ring_menu_close_and_resume();
        return;
    }

    // Verify quantity available
    if (g_satchel_items[item_index] == 0) {
        ring_menu_close_and_resume();
        return;
    }

    // Deduct quantity and rebuild menu if depleted
    consumable_item_satchel_deduct(item_index);

    switch (item_index) {
        case ITEM_PETAL: { // Heals 40 HP to Boy
            uint16_t new_hp = g_boy_hp + PETAL_HEAL_AMOUNT;
            g_boy_hp = (new_hp > g_max_hp) ? g_max_hp : new_hp;
            play_sound_effect_direct(0x0012);
            break;
        }

        case ITEM_NECTAR: { // Clears Poison, Confusion, Blindness
            g_condition_flags &= ~0x0007;
            play_sound_effect_direct(0x0012);
            break;
        }

        case ITEM_HONEY: { // Full 100% HP restore
            g_boy_hp = g_max_hp;
            play_sound_effect_direct(0x0012);
            break;
        }

        case ITEM_BISCUIT: { // Heals 40 HP to Dog companion
            uint16_t new_hp = g_dog_hp + DOG_BISCUIT_HEAL_AMOUNT;
            g_dog_hp = (new_hp > g_max_hp) ? g_max_hp : new_hp;
            play_sound_effect_direct(0x0012);
            break;
        }

        case ITEM_WINGS: { // Escape from dungeon back to entrance
            g_dungeon_escape_flag = 1;
            play_sound_effect_direct(0x002A);
            break;
        }

        case ITEM_PIXIE_DUST: { // Revive with 50% Max HP
            g_boy_hp = g_max_hp >> 1;
            play_sound_effect_direct(0x0012);
            break;
        }
    }

    ring_menu_close_and_resume();
}
