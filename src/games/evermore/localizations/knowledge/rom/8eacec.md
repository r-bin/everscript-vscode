# shopkeeper_dialogue_show_confirm_sell_box

Displays the confirmation prompt window for selling items or equipment in shops, showing the payout amount.

## Metadata
- **Address:** `$8E:ACEC`
- **Type:** `routine`
- **Bank:** `$8E`
- **Size:** 87 bytes

## Functionality
Builds the sell confirmation prompt when offering an item to a merchant.
The routine closes active menus via `$8E:AE85`, clears the dialogue window tilemap via `$8C:AF2B`, reads the item\'s sell-back value from ROM table `$8E:8000,X`, formats the dialogue string via `$8C:9E03`, and waits for user confirmation via `$8E:ADBC`.

## Callers
- Shop sell transaction loops in Bank `$8E`

## Callees
- `$8C:9E03` (`dialogue_format_and_append_line`)
- `$8C:AF2B` (`window_tilemap_buffer_init`)
- `$8E:ADBC` (`func_8EADBC`)
- `$8E:AE85` (`ring_menu_close_and_restore_screen`)

## Variables and Memory
- `$95` (Selected shop sell item descriptor pointer)
- `$8E:8000` (ROM item sell value lookup table)
