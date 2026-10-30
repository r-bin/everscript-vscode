---
addr: 8DBCE9
size: 135
kind: code
category: 🧠
name: alchemy_menu_selected_formula_ingredient_stock_check
title: Checks player inventory stocks for ingredients of the highlighted formula in the Alchemy Ring Menu
confidence: guess
tags: [unverified, rea-partial-read]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Checks player inventory stocks for ingredients of the highlighted formula in the Alchemy Ring Menu.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Validates whether the player possesses the required ingredients to cast the currently highlighted alchemy formula.
The routine retrieves the formula index and calls `$91:CE38` (`alchemy_formula_calc_available_casts`).

If available casts are greater than zero, it sets formula readiness flags to normal active display; if insufficient ingredients remain, it flags the formula as depleted/grayed out in the ring menu interface.

## Callers
- `$8D:B98F` (`func_8DB98F`)

## Callees
- `$91:CE38` (`alchemy_formula_calc_available_casts`)

## Variables and memory (hypotheses)
- `$0B3B` (Currently highlighted alchemy formula index)
- `$7E:231D` (Player ingredient and item inventory stock table)
