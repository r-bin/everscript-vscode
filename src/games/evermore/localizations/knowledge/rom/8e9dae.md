---
addr: 8E9DAE
size: 272
kind: code
category: 🧠
name: ring_menu_inventory_item_availability_filter
title: Filters and populates available usable items from player inventory into Item Ring Menu selection slots
confidence: guess
tags: [unverified, rea-partial-read]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Filters and populates available usable items from player inventory into Item Ring Menu selection slots.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Scans player inventory storage to populate the active Item Ring Menu.
The routine confirms the protagonist entity at `$05A7` (`#$4E89`), then iterates through 72 inventory slots in WRAM at `$7E:231D,X`.

For each non-zero quantity item, it checks the item master table at `$C4:5ABE` to confirm category eligibility, storing eligible item IDs into active ring menu slots at `$0C4B..$0C6F` and recording total available items in `$0C47`.

## Callers
- `$8E:9297` (`func_8E9297`)

## Callees
- None

## Variables and memory (hypotheses)
- `$05A7` (Active player entity pointer)
- `$7E:231D` (Player consumable item inventory quantity table)
- `$C4:5ABE` (ROM item category and properties table)
- `$0C47` (Total eligible items counter in ring menu)
- `$0C4B..$0C6F` (Item ring menu item ID slot array)
