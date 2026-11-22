---
addr: 8E9D89
size: 37
end: 8E9DAD
kind: code
category: 🎮
name: call_bead_sidney_spells
title: Call Bead: Sidney's spells ring
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: CALL_BEAD_CALLER_ACTIONS entry; lda #imm : sta $0CB9.. with the ring item ids, count in $0CB5"]
see: ["docs/open-evermore/resources.md"]
---
Fills `RING_CALL_BEAD_SPELLS` with Sidney's spells: Disrupt, Restore, Electra-Bolt.

Previously believed: "Populate system options action commands list in ring menu buffer ($8E:9D89)" (ring_menu_build_system_action_list).
