---
addr: 8E93EC
size: 4
end: 8E93EF
kind: code
category: 🎮
name: weapon_skill_page_draw_spears
title: Weapon skill screen: draw the spear page
confidence: confirmed
tags: ["ring-menu", "weapons"]
evidence: ["disasm v0.456.0: entry 2 (spear) of the weapon skill screen's jump table $8E:93D8 (ring_option_weapon_skill, X = the equipped weapon's school, $C4:59DC); jsl $8D:8FD6"]
see: ["docs/open-evermore/resources.md", "routines/ring_option_weapon_skill.md"]
---
Draws the weapon skill screen's page for the spear school (`$8D:8FD6`) and runs on into `$8E:93F0`.
