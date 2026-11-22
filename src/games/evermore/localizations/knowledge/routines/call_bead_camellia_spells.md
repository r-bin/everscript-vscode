---
addr: 8E9D5E
size: 43
end: 8E9D88
kind: code
category: 🎮
name: call_bead_camellia_spells
title: Call Bead: Camellia's spells ring
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: CALL_BEAD_CALLER_ACTIONS entry; lda #imm : sta $0CB9.. with the ring item ids, count in $0CB5"]
see: ["docs/open-evermore/resources.md"]
---
Fills `RING_CALL_BEAD_SPELLS` with Camellia's spells: Shock Wave, Shield, Plague, Hypnotize.

Previously believed: "Populate equipment action commands list in ring menu buffer ($8E:9D5E)" (ring_menu_build_equipment_action_list).
