---
addr: 8EA444
size: 18
end: 8EA455
kind: table
category: 📋
name: RING_OPTION_ACTIONS
title: Options ring item → what pressing it opens
confidence: confirmed
tags: ["ring-menu","table"]
evidence: ["disasm v0.455.0: $8E:A43E jsr ($A444,x) in ring_options_loop, X = the item's index (+6); the item's name says which: Player Status 0/2, Weapon Skill 4, Action 6, Control Prefs 8, Window Edit $0A, Equipment $0C, Targeting $0E, Alchemy $10"]
see: ["docs/open-evermore/resources.md"]
---
9 words, code follows. Each screen routine fades out, runs an init and a loop in bank `$8D` and fades back (Action `$8D:82F0`/`$8D:862A`, Control Prefs `$8D:9DB4`/`$8D:9FB6`, Window Edit `$8D:9B2A`/`$8D:9CD1`, Alchemy `$8D:C321`/`$8D:C803`; the `$8D` names still say other screens). Equipment switches to the equipment flow; Targeting runs the target cursor. Open Evermore: `menus/option_actions/`.

Previously believed: "CDL pointer table ($8E:A444)" (ptrs_8EA444).
