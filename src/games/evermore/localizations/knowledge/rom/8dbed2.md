# alchemy_menu_ingredient_stock_ratio_formatter

Formats required vs owned alchemy ingredient count fractions into the menu string buffer.

## Metadata
- **Address:** `$8D:BED2`
- **Type:** `routine`
- **Bank:** `$8D`
- **Size:** 97 bytes

## Functionality
Formats numerical ingredient ratios (e.g. `1/8`) displayed alongside alchemy formula cards.
The routine retrieves ingredient name strings from ROM table `$C4:5D09,X` and appends them via `$8C:9E03`.

It converts current inventory counts into decimal ASCII via `$80:B21F`, appending the required quantity and inserting the formatted fraction into string buffer `$7E:2FF4`.

## Callers
- `$8D:B98F` (`func_8DB98F`)

## Callees
- `$80:B21F` (`format_32bit_integer_to_decimal_ascii`)
- `$8C:9E03` (`dialogue_format_and_append_line`)

## Variables and Memory
- `$C4:5D09` (ROM ingredient name string pointer table)
- `$C4:6021` (ROM formula ingredient quantity requirements)
- `$7E:2FF4` (Formatted ingredient string output buffer)
