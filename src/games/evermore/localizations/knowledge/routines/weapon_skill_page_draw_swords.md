---
addr: 8E93E0
size: 6
end: 8E93E5
kind: code
category: 🎮
name: weapon_skill_page_draw_swords
title: Weapon skill screen: draw the sword page
confidence: confirmed
tags: ["ring-menu", "weapons"]
evidence: ["disasm v0.456.0: entry 0 (sword; also 3, the Bazooka) of the weapon skill screen's jump table $8E:93D8 (ring_option_weapon_skill, X = the equipped weapon's school, $C4:59DC); jsl $8D:8C26"]
see: ["docs/open-evermore/resources.md", "routines/ring_option_weapon_skill.md"]
---
Draws the weapon skill screen's page for the sword school (`$8D:8C26`), then joins the other pages at `$8E:93F0`. The Bazooka's school uses it too. Open Evermore names it in `equipment/weapon_schools/sword.json`.
