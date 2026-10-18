# Merchant Shop Buying, Selling & Multi-Currency Engine

> **ROM Bank**: `$8E` (Shop Logic), `$C4` (Master Price Table `$C4:5ABE`)  
> **Source Routines**: `$8E:9BC1` (`shop_load_catalog`), `$8E:9CA1` (`shop_populate_sell_list`), `$8E:9EBE` / `$8E:9FA8` (`shop_transaction_handler`)  
> **Related Routines**: `$8E:8400` (Shop screen layout), `$8C:DE8F` (Opcode 0x5A shop script trigger), `$8C:DE95` (Opcode 0x5B shop close)  
> **Memory Map**: `$0B95` (Shop item stream buffer), `$0BA1` (Shop catalog item count), `$0BA3` (Cursor selection), `$0BA5` (Active shop item descriptor table), `$7E:231D` (Player inventory items), `$7E:0E6C` (Shop transaction control bits), `$7E:05A9` (Menu mode bits), `$7E:0B79` (Active currency type)

---

## 1. Architectural Overview

Merchant transactions in *Secret of Evermore* are managed by a specialized UI and inventory subsystem in Bank `$8E`. When script opcodes `0x5A` or `0x5B` invoke a merchant dialogue, the engine initializes catalog tables in WRAM and coordinates buying and selling across the game's four distinct chronological eras and currencies.

### Key Subsystems:
1. **Catalog Stream Parsing (`$8E:9BC1`)**:
   - The shopkeeper's stock is provided as a byte stream at `$0B95,y`.
   - The engine iterates through item IDs until encountering the terminator `0x80` (bit 7 set).
   - For each valid item ID, it indexes the master equipment/item table at `$C4:5ABE,x` to fetch the item's purchase price and item category.
   - Populates WRAM array `$0BA5,x` with active merchandise descriptors and writes the total catalog count into `$0BA1`.
2. **Sell / Trade List Construction (`$8E:9CA1`)**:
   - When the player selects the "Sell" option, the engine scans the player's held inventory in WRAM `$7E:231D,x` (up to 39 items / `$27`).
   - Non-zero item slots are cross-referenced against `$C4:5ABE,x` to calculate the resale value (typically $50\%$ of base cost).
   - Available items are staged into `$0BA5,y` for ring/list rendering.
3. **Four-Era Currency System**:
   - Secret of Evermore features four regional currencies tracked in separate 32-bit registers:
     1. **Talons** (Prehistoria): `$7E:22B5`
     2. **Jewels** (Antiqua): `$7E:22B9`
     3. **Gold Coins** (Gothica): `$7E:22BD`
     4. **Credits** (Omnitopia): `$7E:22C1`
   - Currency conversion vendors (e.g. Blimp in Antiqua or market brokers in Ivor Tower) evaluate fixed exchange ratios between eras with a commission fee.
4. **Transaction Constraints & Caps**:
   - **Consumable Cap**: Consumable items (Petals, Nectar, Biscuits, etc.) are strictly capped at **6 units** in the player's satchel. Transactions that would exceed 6 are rejected.
   - **Balance Validation**: The purchase price is compared against the active era's wallet; insufficient funds trigger an error buzz tone and abort deduction.

---

## 2. 65816 Assembly Implementation

```assembly
; ==============================================================================
; $8E:9BC1 - Shop Item Catalog Loader
; Inputs: $0B95 = Buffer of shop item IDs terminated by $80
; Outputs: $0BA5 = Staged item table; $0BA1 = Item count
; ==============================================================================
shop_load_catalog:
    LDY #$0000                  ; Catalog stream index
    STZ $12                     ; Staged table offset
    STZ $0BA1                   ; Total count = 0

.loop:
    LDA $0B95,Y                 ; Fetch item ID from stream
    AND #$00FF
    BIT #$0080                  ; Test end-of-list terminator ($80)
    BNE .done

    TAX
    LDA $C45ABE,X               ; Read item price & descriptor from ROM table
    LDX $12
    STA $0BA5,X                 ; Store in active shop table
    INX
    INX
    STX $12                     ; Advance write pointer by 2 bytes
    INY                         ; Next item in stream
    INC $0BA1                   ; item_count++
    BRA .loop

.done:
    LDA $0BA3                   ; Validate cursor index
    CMP $0BA1
    BMI .valid_cursor
    STZ $0BA3                   ; Reset cursor to top if out-of-bounds
.valid_cursor:
    RTL

; ==============================================================================
; $8E:9CA1 - Inventory Sell List Populator
; Reads $7E:231D (player inventory) and populates shop staging buffer $0BA5
; ==============================================================================
shop_populate_sell_list:
    LDA #$0027                  ; Scan up to 39 player inventory slots
    STA $42
    LDY #$0000
    STZ $0BA1                   ; Eligible sell count = 0
    STZ $12

.scan_inventory:
    LDA $0BA1
    CMP #$0010                  ; Limit displayed list to 16 items
    BEQ .finish_sell_list

    LDX $12
    LDA $7E231D,X               ; Read player item slot
    AND #$00FF
    BEQ .empty_slot             ; Skip empty slots

    STA $14
    TXA
    INC A
    ASL A
    TAX
    LDA $C45ABE,X               ; Fetch base item price
    LSR A                       ; Resale price = 50% of base
    STA $0BA5,Y                 ; Store resale price in display buffer
    INY
    INY
    INC $0BA1                   ; sell_count++

.empty_slot:
    INC $12                     ; Next player slot
    DEC $42
    BNE .scan_inventory

.finish_sell_list:
    LDA $0BA3
    CMP $0BA1
    BMI .exit
    STZ $0BA3                   ; Reset cursor
.exit:
    RTL
```

---

## 3. Clean C Decompilation

```c
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
```
