---
addr: 8E939C
size: 68
end: 8E93DF
kind: code
category: 🎮
name: ring_option_weapon_skill
title: Options ring: Weapon Skill
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_OPTION_ACTIONS entry; fades out, $8D:896C, then a jump by $93D8"]
see: ["docs/open-evermore/resources.md"]
---
What pressing the options ring's Weapon Skill item does. Fades out, `$8D:896C`, then jumps by the equipped weapon's school (`WEAPON_SCHOOL`) through the table at `$8E:93D8` to that school's page draw (`weapon_skill_page_draw_*`), which goes on in `ring_option_weapon_skill_run_page` and `ring_option_weapon_skill_close` (v0.456.0: one routine split at the stubs).

Previously believed: "Menu teardown, OAM sprite blanking and display frame sync ($8E:939C)" (menu_transition_teardown_and_oam_blank).
