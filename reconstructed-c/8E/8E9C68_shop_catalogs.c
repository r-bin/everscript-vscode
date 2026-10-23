/*
 * Routine: $8E9C68 (shop_catalogs)
 * Bank: $8E (ROM Offset: $0E9C68)
 * Source: docs/disassembly/ui/shop-catalogs.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_ALCHEMY_SLOTS       8
#define MAX_INVENTORY_ITEMS     39
#define MAX_DISPLAY_SLOTS       16

typedef struct {
    uint16_t catalog_count;                  // $7E:0BA1
    uint16_t cursor_index;                  // $7E:0BA3
    uint16_t display_slots[MAX_DISPLAY_SLOTS]; // $7E:0BA5,y
} ShopBuyCatalog;

typedef struct {
    uint16_t sell_count;                     // $7E:0C23
    uint16_t sell_slots[MAX_INVENTORY_ITEMS];// $7E:0C27,y
} ShopSellMenu;

extern ShopBuyCatalog g_shop_buy;
extern ShopSellMenu   g_shop_sell;

extern uint8_t g_ingredient_inventory[MAX_ALCHEMY_SLOTS]; // $7E:2315
extern uint8_t g_general_inventory[MAX_INVENTORY_ITEMS];  // $7E:231D

// Master definition tables (Bank $C4)
extern const uint16_t g_shop_alchemy_records[]; // $C4:5AAE
extern const uint16_t g_shop_item_records[];    // $C4:5ABE

/**
 * Scans player ingredient inventory and populates the shop buy catalog.
 * Corresponds to $8E:9C68.
 */
void shop_ingredient_catalog_populator(void) {
    g_shop_buy.catalog_count = 0;
    uint16_t write_idx = 0;

    for (int i = 0; i < MAX_ALCHEMY_SLOTS; i++) {
        if (g_ingredient_inventory[i] != 0) {
            uint16_t record = g_shop_alchemy_records[i];
            g_shop_buy.display_slots[write_idx++] = record;
            g_shop_buy.catalog_count++;
            if (write_idx >= MAX_DISPLAY_SLOTS) break;
        }
    }

    // Clamp cursor index if past catalog boundary
    if (g_shop_buy.cursor_index >= g_shop_buy.catalog_count) {
        g_shop_buy.cursor_index = 0;
    }
}

/**
 * Scans general inventory and populates the shop sell menu with owned items.
 * Corresponds to $8E:9CA1.
 */
void shop_sell_inventory_populator(void) {
    g_shop_sell.sell_count = 0;
    uint16_t write_idx = 0;

    for (int i = 0; i < MAX_INVENTORY_ITEMS; i++) {
        if (g_general_inventory[i] != 0) {
            uint16_t item_id = g_shop_item_records[i];
            g_shop_sell.sell_slots[write_idx++] = item_id;
            g_shop_sell.sell_count++;
        }
    }
}
