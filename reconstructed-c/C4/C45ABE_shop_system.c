/*
 * Routine: $C45ABE (shop_system)
 * Bank: $C4 (ROM Offset: $045ABE)
 * Source: docs/disassembly/ui/shop-system.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_SHOP_ITEMS          16
#define MAX_INVENTORY_SLOTS     39
#define MAX_CONSUMABLE_QTY      6
#define SHOP_STREAM_TERMINATOR  0x80

typedef enum {
    CURRENCY_TALONS  = 0, /* Prehistoria */
    CURRENCY_JEWELS  = 1, /* Antiqua */
    CURRENCY_GOLD    = 2, /* Gothica */
    CURRENCY_CREDITS = 3  /* Omnitopia */
} CurrencyType;

typedef struct {
    uint16_t item_id;
    uint16_t base_price;
    uint8_t  category;    /* 0x02 = Reagent, 0x04 = Armor, 0x08 = Consumable */
    uint8_t  consumable_qty;
} ShopItemRecord;

typedef struct {
    uint32_t wallets[4];  /* Talons, Jewels, Gold, Credits */
    uint8_t  consumables[MAX_INVENTORY_SLOTS];
    uint8_t  inventory_items[MAX_INVENTORY_SLOTS];
} PlayerEconomy;

typedef struct {
    uint16_t item_count;
    uint16_t cursor_index;
    ShopItemRecord catalog[MAX_SHOP_ITEMS];
    CurrencyType active_currency;
} ShopState;

/* ROM master price and attribute table ($C4:5ABE) */
extern uint16_t rom_lookup_item_price(uint16_t item_id);
extern uint8_t  rom_lookup_item_category(uint16_t item_id);

/**
 * Loads a shopkeeper's item stock stream into the active shop state.
 * Corresponds to native routine $8E:9BC1.
 */
void shop_load_catalog(ShopState *shop, const uint8_t *item_stream) {
    shop->item_count = 0;
    shop->cursor_index = 0;

    int idx = 0;
    while (idx < MAX_SHOP_ITEMS) {
        uint8_t item_id = item_stream[idx];
        if (item_id & SHOP_STREAM_TERMINATOR) {
            break; /* Reached end of merchandise stream */
        }

        uint16_t price = rom_lookup_item_price(item_id);
        shop->catalog[shop->item_count].item_id = item_id;
        shop->catalog[shop->item_count].base_price = price;
        shop->catalog[shop->item_count].category = rom_lookup_item_category(item_id);
        shop->item_count++;
        idx++;
    }

    if (shop->cursor_index >= shop->item_count) {
        shop->cursor_index = 0;
    }
}

/**
 * Scans player inventory and builds the merchant sell/trade list with 50% resale value.
 * Corresponds to native routine $8E:9CA1.
 */
void shop_populate_sell_list(ShopState *shop, const PlayerEconomy *economy) {
    shop->item_count = 0;

    for (int i = 0; i < MAX_INVENTORY_SLOTS && shop->item_count < MAX_SHOP_ITEMS; i++) {
        uint8_t item_id = economy->inventory_items[i];
        if (item_id == 0) {
            continue; /* Skip empty inventory slots */
        }

        uint16_t base_price = rom_lookup_item_price(item_id);
        shop->catalog[shop->item_count].item_id = item_id;
        shop->catalog[shop->item_count].base_price = base_price / 2; /* 50% resale return */
        shop->catalog[shop->item_count].category = rom_lookup_item_category(item_id);
        shop->item_count++;
    }

    if (shop->cursor_index >= shop->item_count) {
        shop->cursor_index = 0;
    }
}

/**
 * Attempts to purchase the selected item from the shop catalog.
 * Validates wallet funds and the strict 6-unit consumable inventory cap.
 */
bool shop_execute_buy_transaction(ShopState *shop, PlayerEconomy *economy) {
    if (shop->cursor_index >= shop->item_count) {
        return false;
    }

    ShopItemRecord *item = &shop->catalog[shop->cursor_index];
    uint32_t current_funds = economy->wallets[shop->active_currency];

    /* Check 1: Insufficient funds */
    if (current_funds < item->base_price) {
        return false; /* Rejected: triggers buzzer sound */
    }

    /* Check 2: Max 6 units cap for consumable items */
    if (item->category == 0x08) { /* Consumable */
        uint8_t held_count = economy->consumables[item->item_id];
        if (held_count >= MAX_CONSUMABLE_QTY) {
            return false; /* Cannot carry more than 6 units */
        }
        economy->consumables[item->item_id]++;
    }

    /* Deduct currency from active era wallet */
    economy->wallets[shop->active_currency] -= item->base_price;
    return true;
}

/**
 * Sells an item from player inventory back to the merchant.
 * Credits active era wallet with resale value and clears inventory slot.
 */
bool shop_execute_sell_transaction(ShopState *shop, PlayerEconomy *economy, int inventory_slot) {
    if (inventory_slot < 0 || inventory_slot >= MAX_INVENTORY_SLOTS) {
        return false;
    }

    uint8_t item_id = economy->inventory_items[inventory_slot];
    if (item_id == 0) {
        return false;
    }

    uint16_t resale_value = rom_lookup_item_price(item_id) / 2;
    economy->wallets[shop->active_currency] += resale_value;
    economy->inventory_items[inventory_slot] = 0; /* Remove item */

    /* Refresh sell list */
    shop_populate_sell_list(shop, economy);
    return true;
}
