---
addr: C45FF3
end: C4601E
size: 44
kind: table
category: 🧪
name: tbl_ingredient_names
title: Alchemy ingredient name text pointer table
confidence: confirmed
tags: [alchemy, ingredients, text]
evidence: ["disasm: formula cost inspection routines at $C4:3874 index $C4:5FF3 by ingredient ID 0..21 to display ingredient names in menus", "data: 22 words pointing into ASCII text strings right after cast names"]
see: [src/games/evermore/localizations/knowledge/routines/weapon_entries.md, src/games/evermore/localizations/knowledge/routines/CAST_AND_INGREDIENT_NAMES.md]
---
Table of 22 16-bit pointers within Bank `$C4` pointing to zero-terminated printable ASCII strings for each alchemy ingredient (Wax, Water, Vinegar, Root, etc.).
Indexed by ingredient IDs in formula cost descriptors (`$C4:3874`) and displayed in the Data tab (Enums › Ingredient names).

