---
addr: 8E9D10
size: 78
end: 8E9D5D
kind: code
category: 🎮
name: call_bead_horace_spells
title: Call Bead: Horace's spells ring
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: CALL_BEAD_CALLER_ACTIONS entry; lda #imm : sta $0CB9.. with the ring item ids, count in $0CB5"]
see: ["docs/open-evermore/resources.md"]
---
Fills `RING_CALL_BEAD_SPELLS` with Horace's spells: Time Warp, First Aid, Confound, then Regenerate if `$22DB` bit 7 and Aura if bit 6.

Previously believed: "Build active ring menu action commands list in WRAM buffer ($8E:9D10)" (ring_menu_build_active_item_action_list).
