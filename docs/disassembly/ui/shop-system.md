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

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/C45ABE](soe://rom/code/C45ABE?asm=1&c=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/C4/C45ABE_shop_system.c`](../../../reconstructed-c/C4/C45ABE_shop_system.c).
> [View in VFS: soe://rom/code/C45ABE](soe://rom/code/C45ABE?c=1&asm=0)

