/*
 * Routine: $8E8000 (ring_menu)
 * Bank: $8E (ROM Offset: $0E8000)
 * Source: docs/disassembly/ui/ring-menu.md
 */

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
