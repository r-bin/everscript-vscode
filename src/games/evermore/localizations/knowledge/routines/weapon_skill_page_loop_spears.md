---
addr: 8E9418
size: 4
end: 8E941B
kind: code
category: 🎮
name: weapon_skill_page_loop_spears
title: Weapon skill screen: run the spear page
confidence: confirmed
tags: ["ring-menu", "weapons"]
evidence: ["disasm v0.456.0: entry 2 (spear) of the weapon skill screen's jump table $8E:9404 (ring_option_weapon_skill, X = the equipped weapon's school, $C4:59DC); jsl $8D:9792"]
see: ["docs/open-evermore/resources.md", "routines/ring_option_weapon_skill.md"]
---
Runs the spear page of the weapon skill screen (`$8D:9792`) and runs on into `$8E:941C`.
