# alchemy_menu_selected_formula_ingredient_stock_check

Checks player inventory stocks for ingredients of the highlighted formula in the Alchemy Ring Menu.

## Metadata
- **Address:** `$8D:BCE9`
- **Type:** `routine`
- **Bank:** `$8D`
- **Size:** 135 bytes

## Functionality
Validates whether the player possesses the required ingredients to cast the currently highlighted alchemy formula.
The routine retrieves the formula index and calls `$91:CE38` (`alchemy_formula_calc_available_casts`).

If available casts are greater than zero, it sets formula readiness flags to normal active display; if insufficient ingredients remain, it flags the formula as depleted/grayed out in the ring menu interface.

## Callers
- `$8D:B98F` (`func_8DB98F`)

## Callees
- `$91:CE38` (`alchemy_formula_calc_available_casts`)

## Variables and Memory
- `$0B3B` (Currently highlighted alchemy formula index)
- `$7E:231D` (Player ingredient and item inventory stock table)
