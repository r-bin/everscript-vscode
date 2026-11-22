---
addr: C459A4
end: C459BF
size: 28
kind: table
category: ⚔️
name: WEAPON_OWNED_BYTE
title: The WRAM byte that holds each weapon's owned bit
confidence: confirmed
tags: ["weapons", "tables"]
evidence: ["disasm v0.456.0: read by equipment_weapon_equip_and_buff_sync ($8F:9273), calc_equipped_armor_defense ($8E:99D2) and the weapon skill pages ($8D) with X = 2·weapon index", "rom: index 0 (fist) 0, 1-7 $22DA, 8-13 $22DB"]
see: ["routines/WEAPON_OWNED_BIT.md", "knowledge/wram/WEAPONS_OWNED_FLAGS_0.md", "docs/open-evermore/resources.md"]
---
One word per weapon index (0 the fist, 1-12 the weapons, 13 the Bazooka): the WRAM address of the byte whose bit `WEAPON_OWNED_BIT` marks the weapon owned. Open Evermore writes it as `owned/flags` in `equipment/weapons/<name>.json` (by WRAM name). Bits `$40`, `$80` of `$22DB` are unused: room for two more weapons.

Previously named `tbl_C459A4` (a CDL lookup table, meaning not recorded).
