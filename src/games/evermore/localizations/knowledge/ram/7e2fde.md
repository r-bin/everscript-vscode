---
addr: 7E2FDE
end: 7E3023
kind: table
name: ALCHEMY_FORMULA_USAGE_COUNTERS
title: Alchemy formula lifetime cast usage counters
lifetime: save
confidence: confirmed
tags: [alchemy, statistics]
evidence: ["docs/disassembly/combat/alchemy-ingredients.md and reconstructed-c/91/91D800_alchemy_ingredients.c: FORMULA_USAGE_BASE at $2FDE, incremented on every successful cast in $91:D800"]
see: [src/games/evermore/localizations/knowledge/ram/7e2ed6.md, src/games/evermore/localizations/knowledge/ram/7e2f52.md]
---
35 contiguous 16-bit word registers storing the lifetime total cast counts for each of the 35 alchemy formulas.

Indexed by `formula_index * 2`. Incremented unconditionally by `alchemy_validate_and_deduct_cost` (`$91:D800`) whenever ingredient deduction succeeds and the spell cast begins. Preserved across saves to record player spell usage statistics.

