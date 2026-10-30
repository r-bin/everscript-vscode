---
addr: 8DBED2
size: 97
kind: code
category: 🧠
name: alchemy_menu_ingredient_stock_ratio_formatter
title: Formats required vs owned alchemy ingredient count fractions into the menu string buffer
confidence: guess
tags: [unverified, rea-partial-read]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Formats required vs owned alchemy ingredient count fractions into the menu string buffer.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Formats numerical ingredient ratios (e.g. `1/8`) displayed alongside alchemy formula cards.
The routine retrieves ingredient name strings from ROM table `$C4:5D09,X` and appends them via `$8C:9E03`.

It converts current inventory counts into decimal ASCII via `$80:B21F`, appending the required quantity and inserting the formatted fraction into string buffer `$7E:2FF4`.

## Callers
- `$8D:B98F` (`func_8DB98F`)

## Callees
- `$80:B21F` (`format_32bit_integer_to_decimal_ascii`)
- `$8C:9E03` (`dialogue_format_and_append_line`)

## Variables and memory (hypotheses)
- `$C4:5D09` (ROM ingredient name string pointer table)
- `$C4:6021` (ROM formula ingredient quantity requirements)
- `$7E:2FF4` (Formatted ingredient string output buffer)
