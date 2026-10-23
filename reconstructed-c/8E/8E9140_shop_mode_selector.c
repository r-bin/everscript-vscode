/*
 * Routine: $8E9140 (shop_mode_selector)
 * Bank: $8E (ROM Offset: $0E9140)
 * Source: docs/disassembly/ui/shop-mode-selector.md
 */

#include <stdint.h>
#include <stdbool.h>

extern uint8_t  g_alchemy_satchel[8];      // $7E:2315,x
extern uint16_t g_shop_mode_flags;         // $7E:0E6C
extern uint16_t g_window_width;            // $7E:03E1
extern uint16_t g_window_height;           // $7E:03E3
extern uint16_t g_window_tile_offset;      // $7E:03F1
extern uint16_t g_window_cursor_stride;    // $7E:03F9
extern uint16_t g_window_options_count;    // $7E:03FB
extern uint16_t g_window_strings_ptr;      // $7E:0403
extern uint16_t g_system_flags;            // $7E:05A9

extern void shop_ingredient_catalog_populator(void);
extern void ring_menu_close_immediate(void);
extern void shop_load_catalog(void);
extern void shop_load_alchemy_catalog(void);
extern void shop_load_special_catalog(void);
extern void setup_carousel_orbit(uint16_t radius, uint16_t arc_angle);
extern void spawn_cursor_actors(uint16_t actor1, uint16_t actor2);
extern void activate_window(uint16_t window_id);
extern void focus_window(uint16_t window_id);

/**
 * Decrements ingredient satchel slot and refreshes the vendor buy list on depletion.
 * Corresponds to $8E:9140.
 */
bool alchemy_ingredient_satchel_deduct(uint8_t ingredient_slot) {
    if (ingredient_slot >= 8 || g_alchemy_satchel[ingredient_slot] == 0) {
        return false;
    }

    g_alchemy_satchel[ingredient_slot]--;

    // Dynamic rebuild if this was the last unit:
    if (g_alchemy_satchel[ingredient_slot] == 0) {
        shop_ingredient_catalog_populator();
    }

    return true;
}

/**
 * Initializes the sub-window layout, dimensions, cursor actors, and string pointers.
 * Corresponds to $8E:9EF0.
 */
void ring_menu_action_screen_init(void) {
    // 1. Configure 4x1 submenu grid
    g_window_width         = 4;
    g_window_height        = 1;
    g_window_tile_offset   = 0x0014;
    g_window_cursor_stride = 8;
    g_window_options_count = 2;
    g_window_strings_ptr   = 0x1924;

    // 2. Spawn rotating cursor sprite actors
    spawn_cursor_actors(0x56EA, 0x56E6);

    // 3. Activate and focus window $03DD
    activate_window(0x03DD);
    focus_window(0x03DD);
}

/**
 * Routes shop view modes (standard, alchemy, or special) and positions carousel icons.
 * Corresponds to $8E:9FA8.
 */
void shop_mode_catalog_loader(void) {
    // 1. Dispatch catalog loader by mode bitmask
    if (g_shop_mode_flags & 0x0004) {
        shop_load_catalog();
    } else if (g_shop_mode_flags & 0x0008) {
        shop_load_alchemy_catalog();
    } else {
        shop_load_special_catalog();
    }

    // 2. Establish circular layout geometry (16px radius, 224 degree arc)
    setup_carousel_orbit(0x0010, 0x00E0);

    // 3. Clear interaction flags
    g_system_flags &= ~0x0030;
}
