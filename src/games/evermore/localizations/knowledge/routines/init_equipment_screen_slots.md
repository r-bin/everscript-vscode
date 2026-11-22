---
addr: 8E9A86
size: 61
end: 8E9AC2
kind: code
category: 🧠
name: init_equipment_screen_slots
title: Build the Boy's and the Dog's options rings
confidence: verified
tags: [ui, ring-menu, equipment, reconstructed-c, g1-pass]
evidence: ["disasm v0.455.0: lda #imm : sta $0814.. and $0838.."]
see: [routines/calc_equipped_armor_defense.md, routines/RING_ITEM_POINTERS.md]
---
Fills `RING_BOY_OPTIONS` (Player Status, Action, Control Prefs, Window Edit, Targeting; Alchemy when a formula is known; Equipment when armour is held; Weapon Skill) and `RING_DOG_OPTIONS` (Player Status, Action, Control Prefs, Window Edit, Targeting; Equipment when a collar is held). The item ids are code immediates (Open Evermore: `menus/rings/`). The name stays for the reconstructed C.

Previously believed: "Initialize UI equipment selection slots ($7E:0814..$081A)".
