---
addr: 8E939C
size: 180
end: 8E944F
kind: code
category: 🎮
name: ring_option_weapon_skill
title: Options ring: Weapon Skill
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_OPTION_ACTIONS entry; fades out, $8D:896C, then a jump by $93D8"]
see: ["docs/open-evermore/resources.md"]
---
What pressing the options ring's Weapon Skill item does. Fades out, $8D:896C, then a jump by $93D8.

Previously believed: "Menu teardown, OAM sprite blanking and display frame sync ($8E:939C)" (menu_transition_teardown_and_oam_blank).
