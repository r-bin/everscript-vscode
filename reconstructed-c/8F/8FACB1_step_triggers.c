/*
 * Routine: $8FACB1 (step_triggers)
 * Bank: $8F (ROM Offset: $0FACB1)
 * Source: docs/disassembly/maps/step-triggers.md
 */

#include <stdint.h>
#include <stdbool.h>

typedef struct {
    uint8_t  y1;        // Top coordinate (16px metatile cell)
    uint8_t  x1;        // Left coordinate
    uint8_t  y2;        // Bottom coordinate (exclusive)
    uint8_t  x2;        // Right coordinate (exclusive)
    uint16_t script_id; // 16-bit Script pointer ID
} TriggerBox;

extern uint16_t g_origin_tile_x;        // $7E:0F86
extern uint16_t g_origin_tile_y;        // $7E:0F88
extern uint16_t g_trigger_count;        // $7E:1067
extern const TriggerBox *g_trigger_tbl; // $7E:1069..$7E:106B
extern uint16_t g_current_latched_trig; // $7E:2429
extern uint16_t g_interaction_x;        // $7E:2421
extern uint16_t g_interaction_y;        // $7E:2423

extern void launch_trigger_script(uint16_t script_id); // $8C:CE5C

/**
 * Tests if cell coordinate falls inside the far-edge exclusive trigger bounding box.
 * Corresponds to $8F:ACEF.
 */
static inline bool trigger_box_contains(const TriggerBox *box, uint8_t cell_x, uint8_t cell_y) {
    return (cell_y >= box->y1 && cell_y < box->y2 &&
            cell_x >= box->x1 && cell_x < box->x2);
}

/**
 * Scans active room step-on triggers against actor cell coordinates.
 * Corresponds to $8F:ACB1.
 */
void step_on_trigger_search(uint16_t pixel_x, uint16_t pixel_y) {
    if (g_trigger_count == 0 || g_trigger_tbl == NULL) {
        return;
    }

    // Convert world pixels to 16px metatile cells with room origin offset
    uint8_t cell_x = (uint8_t)((pixel_x >> 4) + g_origin_tile_x);
    uint8_t cell_y = (uint8_t)((pixel_y >> 4) + g_origin_tile_y);

    for (uint16_t i = 0; i < g_trigger_count; i++) {
        const TriggerBox *box = &g_trigger_tbl[i];

        if (trigger_box_contains(box, cell_x, cell_y)) {
            // Check if already standing on this trigger from previous frame
            if (box->script_id == g_current_latched_trig) {
                return;
            }

            // Latch new trigger and launch script VM thread
            g_current_latched_trig = box->script_id;
            launch_trigger_script(box->script_id);
            return;
        }
    }

    // Stepped off any trigger -> clear latched trigger
    g_current_latched_trig = 0;
}

/**
 * Gate check: verifies bit 14 in entity status flags before performing trigger search.
 * Corresponds to $8F:B078.
 */
void bit_14_gate_before_step_on_search(uint16_t entity_flags, uint16_t pixel_x, uint16_t pixel_y) {
    // Bit 14 (0x4000): Inhibit step-on triggers
    if ((entity_flags & 0x4000) != 0) {
        return;
    }

    g_interaction_x = pixel_x;
    g_interaction_y = pixel_y;
    step_on_trigger_search(pixel_x, pixel_y);
}
