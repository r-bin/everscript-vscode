---
addr: 8E941C
size: 52
end: 8E944F
kind: code
category: 🎮
name: ring_option_weapon_skill_close
title: Weapon skill screen: fade back to the field
confidence: confirmed
tags: ["ring-menu", "weapons"]
evidence: ["disasm v0.456.0: the page loops (weapon_skill_page_loop_*) join here; fade, wait for NMI, field layers and HUD back, rtl"]
see: ["routines/ring_option_weapon_skill.md"]
---
Where the page loops join: restores the field screen and the HUD and returns from the Weapon Skill action. Once
believed alignment padding.
