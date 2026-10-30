# alchemy_menu_formula_card_and_ingredients_formatter

Formats alchemy formula description cards, names, and required ingredient quantities for the Alchemy Ring Menu.

## Metadata
- **Address:** `$8D:B4FA`
- **Type:** `routine`
- **Bank:** `$8D`
- **Size:** 732 bytes

## Functionality
Builds the text and visual layout for an alchemy formula entry in the Alchemy Ring Menu.
Using the currently highlighted formula index from `$0B3B`, the routine looks up master formula parameters in ROM bank `$C4` at `$C4:599A`.

It retrieves the formula name at offset `+$26` and passes it to the string copy routine (`$80:B149`) targeting the UI buffer. It then reads the formula\'s ingredient requirements at offset `+$4A`, lookups current inventory counts in player storage, and formats ingredient icons and fractional quantity ratios (e.g., current/required) into the menu card buffer at `$0A35..$0A52`.

## Callers
- `$8D:B492` (`FUN_8db492`)

## Callees
- `$80:B149` (`func_80B149`)

## Variables and Memory
- `$0B3B` (Active selected alchemy formula index)
- `$C4:599A` (ROM master formula definition table)
- `$0A35..$0A52` (Alchemy menu display card text and icon buffer)
