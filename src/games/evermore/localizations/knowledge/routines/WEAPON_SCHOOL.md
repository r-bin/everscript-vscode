---
addr: C459DC
end: C459F7
size: 28
kind: table
category: ⚔️
name: WEAPON_SCHOOL
title: Each weapon's school (2·school: sword, axe, spear, bazooka)
confidence: confirmed
tags: ["weapons", "tables"]
evidence: ["disasm v0.456.0: $8F:92C4 stores it to $2360 on equipping; ring_option_weapon_skill jumps by it twice (JMP ($93D8,x), JMP ($9404,x)): the weapon skill screen's page; character_defense_and_buff_rebuild ($8F:8499) adds a quarter of the attack again when it is 0", "rom: 0 for the fist, Bone Crusher and the swords, 2 the axes, 4 the spears, 6 the Bazooka"]
see: ["routines/weapon_skill_page_draw_swords.md", "routines/ring_option_weapon_skill.md", "docs/open-evermore/resources.md"]
---
One word per weapon index: its school as 2·school (0 sword, 2 axe, 4 spear, 6 bazooka). What a school does is code: the weapon skill screen shows the page of the equipped weapon's school (`weapon_skill_page_draw_*`, `weapon_skill_page_loop_*`; the Bazooka gets the sword page), and school 0 adds a quarter of the weapon's attack again. Open Evermore: `equipment/weapon_schools/`, and `school` in each weapon.

Previously named `tbl_C459DC` (a CDL lookup table, meaning not recorded).
