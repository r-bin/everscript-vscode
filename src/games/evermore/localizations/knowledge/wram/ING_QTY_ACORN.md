---
addr: $7E:2314
name: ING_QTY_ACORN
type: u8
tags: [ingredient, inventory]
lifetime: save
confidence: confirmed
evidence: ["rom: ingredient id = index into the name pointers $C4:5FF3 (alchemy/ingredients in Open Evermore); $91:D800 deducts and $8E:8DC5 adds 5 at $22FF + id", "test: the loot script 0x3e, simulated once per reward, increments $22FF + (reward - 0x0200) (ING_QTY_WAX.md, v0.202.0)"]
see: [knowledge/wram/ING_QTY_WAX.md]
---
Acorn held (ingredient 0x15, cap 99): one byte of the ingredient counts at `$22FF` + id.

Corrected v0.459.1: the WRAM map had this stretch one cell off from `$2309` (it left Gunpowder out here and invented a
23rd ingredient, "Root Extra", at `$2314`).
