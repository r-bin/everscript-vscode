---
addr: C459C0
end: C459DB
size: 28
kind: table
category: ⚔️
name: WEAPON_OWNED_BIT
title: Each weapon's owned bit in its byte
confidence: confirmed
tags: ["weapons", "tables"]
evidence: ["disasm v0.456.0: read by equipment_weapon_equip_and_buff_sync ($8F:9273), calc_equipped_armor_defense ($8E:99D2) and the weapon skill pages ($8D) with X = 2·weapon index", "rom: $01-$80 in weapon order, 0 for the fist"]
see: ["routines/WEAPON_OWNED_BYTE.md", "docs/open-evermore/resources.md"]
---
One word per weapon index: the bit in the byte `WEAPON_OWNED_BYTE` names. Taking every weapon away clears them in a loop up to index 13 (`$8F:927D`, `cpx #$1A`).

Previously named `tbl_C459C0` (a CDL lookup table, meaning not recorded).
