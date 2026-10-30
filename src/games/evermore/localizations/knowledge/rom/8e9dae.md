# ring_menu_inventory_item_availability_filter

Filters and populates available usable items from player inventory into Item Ring Menu selection slots.

## Metadata
- **Address:** `$8E:9DAE`
- **Type:** `routine`
- **Bank:** `$8E`
- **Size:** 272 bytes

## Functionality
Scans player inventory storage to populate the active Item Ring Menu.
The routine confirms the protagonist entity at `$05A7` (`#$4E89`), then iterates through 72 inventory slots in WRAM at `$7E:231D,X`.

For each non-zero quantity item, it checks the item master table at `$C4:5ABE` to confirm category eligibility, storing eligible item IDs into active ring menu slots at `$0C4B..$0C6F` and recording total available items in `$0C47`.

## Callers
- `$8E:9297` (`func_8E9297`)

## Callees
- None

## Variables and Memory
- `$05A7` (Active player entity pointer)
- `$7E:231D` (Player consumable item inventory quantity table)
- `$C4:5ABE` (ROM item category and properties table)
- `$0C47` (Total eligible items counter in ring menu)
- `$0C4B..$0C6F` (Item ring menu item ID slot array)
