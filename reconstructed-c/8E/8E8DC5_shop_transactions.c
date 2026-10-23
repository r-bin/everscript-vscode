/*
 * Routine: $8E8DC5 (shop_transactions)
 * Bank: $8E (ROM Offset: $0E8DC5)
 * Source: docs/disassembly/ui/shop-transactions.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_INGREDIENTS 100
#define SFX_PURCHASE_COIN 0x0043

extern uint8_t  g_ingredient_inventory[22];    // $7E:22FF,x
extern uint8_t  g_consumable_inventory[16];    // $7E:231C,x
extern uint16_t g_purse_low[4];                // $7E:0AC6,x
extern uint8_t  g_purse_high[4];               // $7E:0AC8,x
extern uint16_t g_currency_era;                // $7E:2348
extern uint16_t g_resale_value;                // $7E:0BF5
extern uint16_t g_system_interaction_flags;    // $7E:05A9
extern char     g_text_format_buffer[32];      // $7E:2FF4

extern void play_sound_effect_direct(uint16_t sfx_id);
extern void format_number_to_string(char *dest, uint32_t value);
extern void redraw_window_text(uint16_t window_id);
extern void ring_menu_rebuild_catalog(void);
extern void ring_menu_close_immediate(void);

/**
 * Commits purchase of 5 alchemy ingredients.
 * Corresponds to $8E:8DC5.
 */
bool shop_vendor_buy_commit(uint8_t ingredient_idx, uint32_t cost) {
    if (ingredient_idx >= 22) return false;

    // 1. Check max inventory cap (99 items)
    uint8_t current_qty = g_ingredient_inventory[ingredient_idx];
    if (current_qty + 5 >= MAX_INGREDIENTS) {
        g_system_interaction_flags |= 0x0020; // Rejection bit
        return false;
    }

    // 2. Commit inventory addition
    g_ingredient_inventory[ingredient_idx] = current_qty + 5;

    // 3. Play purchase chime audio
    play_sound_effect_direct(SFX_PURCHASE_COIN);

    // 4. Deduct cost from active currency wallet
    uint8_t era = (uint8_t)(g_currency_era & 0x00FF);
    uint32_t current_funds = (uint32_t)g_purse_low[era] | ((uint32_t)g_purse_high[era] << 16);
    current_funds -= cost;
    g_purse_low[era] = (uint16_t)(current_funds & 0xFFFF);
    g_purse_high[era] = (uint8_t)((current_funds >> 16) & 0xFF);

    // 5. Format and refresh currency display in window $03DD
    format_number_to_string(g_text_format_buffer, current_funds);
    redraw_window_text(0x03DD);

    return true;
}

/**
 * Decrements consumable item in satchel and triggers catalog rebuild upon depletion.
 * Corresponds to $8E:9060.
 */
bool consumable_item_satchel_deduct(uint8_t item_subindex) {
    uint8_t slot = item_subindex >> 1;
    if (slot >= 16 || g_consumable_inventory[slot] == 0) {
        return false;
    }

    g_consumable_inventory[slot]--;

    // If completely depleted, rebuild ring carousel dynamically:
    if (g_consumable_inventory[slot] == 0) {
        ring_menu_rebuild_catalog();
    }

    return true;
}

/**
 * Commits resale of an item, crediting funds to the 24-bit purse.
 * Corresponds to $8E:90CA.
 */
void shop_vendor_sell_commit(uint16_t credit_price) {
    uint8_t era = (uint8_t)(g_currency_era & 0x00FF);

    // 24-bit purse addition
    uint32_t current_funds = (uint32_t)g_purse_low[era] | ((uint32_t)g_purse_high[era] << 16);
    current_funds += credit_price;
    g_purse_low[era] = (uint16_t)(current_funds & 0xFFFF);
    g_purse_high[era] = (uint8_t)((current_funds >> 16) & 0xFF);

    // Play coin sale chime
    play_sound_effect_direct(SFX_PURCHASE_COIN);

    // Refresh UI display
    format_number_to_string(g_text_format_buffer, current_funds);
    redraw_window_text(0x03DD);
}
