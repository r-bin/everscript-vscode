---
addr: 8E9412
size: 6
end: 8E9417
kind: code
category: 🎮
name: weapon_skill_page_loop_axes
title: Weapon skill screen: run the axe page
confidence: confirmed
tags: ["ring-menu", "weapons"]
evidence: ["disasm v0.456.0: entry 1 (axe) of the weapon skill screen's jump table $8E:9404 (ring_option_weapon_skill, X = the equipped weapon's school, $C4:59DC); jsl $8D:94A7"]
see: ["docs/open-evermore/resources.md", "routines/ring_option_weapon_skill.md"]
---
Runs the axe page of the weapon skill screen (`$8D:94A7`), then joins the other pages at `$8E:941C`.
