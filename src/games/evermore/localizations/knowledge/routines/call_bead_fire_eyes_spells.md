---
addr: 8E9CE5
size: 43
end: 8E9D0F
kind: code
category: 🎮
name: call_bead_fire_eyes_spells
title: Call Bead: Fire Eyes's spells ring
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: CALL_BEAD_CALLER_ACTIONS entry; lda #imm : sta $0CB9.. with the ring item ids, count in $0CB5"]
see: ["docs/open-evermore/resources.md"]
---
Fills `RING_CALL_BEAD_SPELLS` with Fire Eyes's spells: Flare, Heat Wave, Storm, Life Spark.

Previously believed: "Populate alchemy formula action commands list in ring menu buffer ($8E:9CE5)" (ring_menu_build_alchemy_action_list).
