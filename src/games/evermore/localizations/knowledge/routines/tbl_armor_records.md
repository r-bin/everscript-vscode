---
addr: C43B02
end: C43C91
size: 400
kind: table
category: 🛡️
name: tbl_armor_records
title: Master armor and collar attributes table (40 records × 10 bytes)
confidence: confirmed
evidence: ["disasm: $8E:99D2 (calc_equipped_armor_defense) reads armor records to sum physical defense and magic defense", "rom: 40 records x 10 bytes ($C4:3B02..$C4:3C91), immediately preceding tbl_animate_id_records at $C4:3C92", "data: 12 vests, 12 helmets, 12 armbands, 4 collars with names, defense values, and ring icon indices"]
see: [knowledge/wram/ARMOR_QTY_GRASS_VEST.md, routines/BOY_WEAPON_TABLE.md, routines/animate_id_records.md, docs/disassembly/engine-core/rom-tables.md]
---
Master equipment database for all 40 pieces of equippable defense gear:
- 12 Chest Armors (`$C4:3B02`..`$C4:3B79`, stride 10): Grass Vest through Virtual Vest
- 12 Helmets (`$C4:3B7A`..`$C4:3BF1`, stride 10): Grass Hat through Brainstorm
- 12 Armbands / Gauntlets (`$C4:3BF2`..`$C4:3C69`, stride 10): Vine Bracelet through Virtual Glove
- 4 Dog Collars (`$C4:3C6A`..`$C4:3C91`, stride 10): Leather Collar through Spot's Collar

Record format (10 bytes):
- `+0x00`: the defence the stats add (`$8F:84BD`: `adc.l $C40000,x` with X = the equipped record, `$0AC0`-`$0AC4`)
- `+0x02`: the defence the armour ring shows for it (`$8E:A66B`); equal to +0 in all 40
- `+0x04`: pointer in bank $C4 to the name (the ring item's text)
- `+0x06`: pointer in bank $C4 to a second text: all 40 point at the same empty string (`$C4:60AD`)
- `+0x08`: the ring item id ($00A0..$00EE)

WRAM keeps the equipped record's address, not an index (and the save keeps WRAM), so a record cannot move. Corrected v0.456.0: +2 was believed magic defence, +6 a description. Open Evermore: `equipment/armour/`.
