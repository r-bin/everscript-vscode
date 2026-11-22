---
addr: 8E93F0
size: 28
end: 8E940B
kind: code
category: 🎮
name: ring_option_weapon_skill_run_page
title: Weapon skill screen: run the page of the equipped weapon's school
confidence: confirmed
tags: ["ring-menu", "weapons"]
evidence: ["disasm v0.456.0: clears $0106, sets $0B83, then ldx $0ABA : lda $C4:59DC,x : tax : jmp ($9404,x); the table $8E:9404 (4 words) follows"]
see: ["routines/ring_option_weapon_skill.md", "routines/weapon_skill_page_loop_swords.md", "routines/WEAPON_SCHOOL.md"]
---
Where the page draws (`weapon_skill_page_draw_*`) join: the second half of `ring_option_weapon_skill`. It jumps by the
equipped weapon's school through the table at `$8E:9404` to that school's page loop (`weapon_skill_page_loop_*`).
Once believed alignment padding (the ROM map generator's name for a gap between entries).
