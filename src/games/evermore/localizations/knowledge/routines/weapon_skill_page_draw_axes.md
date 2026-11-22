---
addr: 8E93E6
size: 6
end: 8E93EB
kind: code
category: 🎮
name: weapon_skill_page_draw_axes
title: Weapon skill screen: draw the axe page
confidence: confirmed
tags: ["ring-menu", "weapons"]
evidence: ["disasm v0.456.0: entry 1 (axe) of the weapon skill screen's jump table $8E:93D8 (ring_option_weapon_skill, X = the equipped weapon's school, $C4:59DC); jsl $8D:8DFF"]
see: ["docs/open-evermore/resources.md", "routines/ring_option_weapon_skill.md"]
---
Draws the weapon skill screen's page for the axe school (`$8D:8DFF`), then joins the other pages at `$8E:93F0`.
