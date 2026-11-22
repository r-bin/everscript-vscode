---
addr: 8EA777
size: 6
end: 8EA77C
kind: table
category: 📋
name: ALCHEMY_RING_ACTIONS
title: Formula → its cast routine
confidence: confirmed
tags: ["ring-menu","table"]
evidence: ["disasm v0.455.0: $8E:A76B jsr ($A777,x) in ring_alchemy_loop, X = the formula item's index (+6, 2·formula)"]
see: ["docs/open-evermore/resources.md"]
---
36 words (the 35 formulas in index order, Acid Rain first, then one more), code follows. Most are `alchemy_cast_action_direct_targeting` or `alchemy_cast_action_area_targeting`. Open Evermore: `menus/alchemy_actions/`.

Previously believed: "CDL pointer table ($8E:A777)" (ptrs_8EA777).
