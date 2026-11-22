---
addr: 8E940C
size: 6
end: 8E9411
kind: code
category: 🎮
name: weapon_skill_page_loop_swords
title: Weapon skill screen: run the sword page
confidence: confirmed
tags: ["ring-menu", "weapons"]
evidence: ["disasm v0.456.0: entry 0 (sword; also 3, the Bazooka) of the weapon skill screen's jump table $8E:9404 (ring_option_weapon_skill, X = the equipped weapon's school, $C4:59DC); jsl $8D:91AF"]
see: ["docs/open-evermore/resources.md", "routines/ring_option_weapon_skill.md"]
---
Runs the sword page of the weapon skill screen until it is closed (`$8D:91AF`), then joins the other pages at `$8E:941C` (fade back to the field).
