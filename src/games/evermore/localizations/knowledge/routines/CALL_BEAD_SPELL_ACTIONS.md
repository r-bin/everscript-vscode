---
addr: 8EAD43
size: 36
end: 8EAD66
kind: table
category: 📋
name: CALL_BEAD_SPELL_ACTIONS
title: Call Bead spell → its cast routine
confidence: confirmed
tags: ["ring-menu","table"]
evidence: ["disasm v0.455.0: $8E:AD3D jsr ($AD43,x) in ring_call_bead_spells_loop, X = the spell item's index (+6)"]
see: ["docs/open-evermore/resources.md"]
---
18 words (16 spells in index order, two more), code follows. Open Evermore: `menus/spell_actions/`.

Previously believed: "CDL pointer table ($8E:AD43)" (ptrs_8EAD43).
