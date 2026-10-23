/*
 * Routine: $8E9DF9 (ring_menu_builder)
 * Bank: $8E (ROM Offset: $0E9DF9)
 * Source: docs/disassembly/ui/ring-menu-builder.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_RING_SLOTS          16
#define INVENTORY_CONSUMABLES   8

typedef struct {
    uint16_t item_count;               // $7E:0C23
    uint16_t cursor_idx;               // $7E:0C25
    uint16_t item_ids[MAX_RING_SLOTS]; // $7E:0C27..$7E:0C45
} RingCategoryRecord;

typedef struct {
    RingCategoryRecord weapons;      // $7E:0BFF
    RingCategoryRecord consumables;  // $7E:0C23
    RingCategoryRecord formulas;     // $7E:0C47
    RingCategoryRecord rare_items;   // $7E:0C6B
} RingMenuState;

extern RingMenuState g_ring_menu;
extern uint8_t  g_inventory_quantities[32]; // $7E:231D,x
extern uint16_t g_equipped_item_id;        // $7E:0AC2

// Master tables (Bank $C4)
extern const uint16_t g_ring_item_table[];   // $C4:5ABE
extern const uint16_t g_item_master_table[]; // $C4:3894

extern void compute_circular_slot_coordinates(uint16_t radius, uint16_t arc_span);
extern void spawn_ring_item_icons(uint16_t entity_ptr, uint16_t sprite_group_id);

/**
 * Scans player inventory and builds the active consumable ring menu slots.
 * Corresponds to $8E:9DF9.
 */
void ring_menu_build_consumables(void) {
    g_ring_menu.consumables.item_count = 0;
    g_ring_menu.consumables.cursor_idx = 0;

    uint16_t slot_idx = 0;

    for (int i = 0; i < INVENTORY_CONSUMABLES; i++) {
        uint8_t count = g_inventory_quantities[i];
        if (count == 0) {
            continue; // Not owned, do not add to wheel
        }

        uint16_t ring_id = g_ring_item_table[i];
        g_ring_menu.consumables.item_ids[slot_idx] = ring_id;

        // Check if this item is currently selected/equipped
        if (g_item_master_table[i] == g_equipped_item_id) {
            g_ring_menu.consumables.cursor_idx = slot_idx;
        }

        slot_idx++;
        if (slot_idx >= MAX_RING_SLOTS) {
            break;
        }
    }

    g_ring_menu.consumables.item_count = slot_idx;
}

/**
 * Computes circular geometry and spawns floating 16x16 ring menu sprites.
 * Corresponds to $8E:9EE2.
 */
void ring_menu_circular_layout_spawn(uint16_t boy_entity_ptr, uint16_t dog_entity_ptr) {
    // 1. Calculate circular geometry: radius 16px, 224-degree arc
    compute_circular_slot_coordinates(16, 0x00E0);

    // 2. Spawn orbiting item icon sprites for boy
    spawn_ring_item_icons(boy_entity_ptr, 0x56EA);

    // 3. Spawn orbiting item icon sprites for dog
    spawn_ring_item_icons(dog_entity_ptr, 0x56E6);
}
