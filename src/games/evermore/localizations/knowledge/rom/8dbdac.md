---
addr: 8DBDAC
kind: code
category: 🎮
name: alchemy_ring_menu_init_ingredient_anims
title: Initialize alchemy formula ring menu ingredient sprite animations ($8D:BDAC)
confidence: confirmed
evidence: ["disasm: sets DB to $7E; loops Y=8 down to 0 over $0AD2,Y; for active ingredients, initializes animation records at $7E:06A3+Y*16 with sprite ID $C4:5E25,X; runs anim tick $90:80CE with base $C4:5D99,X; callers: menu setup $8D:B98F"]
see: ["rom/9080ce.md","rom/8db98f.md"]
tags: ["ring-menu","alchemy","ingredient","animation"]
---
Initializes animation VM records for the 9 ingredient slots on the alchemy ring menu. Iterates slots `$0AD2..$0ADA` in data bank `$7E`. For each assigned ingredient, configures animation record `$7E:06A3 + Y*16`, binds sprite graphic index from `$C4:5E25,X`, and seeds animation state via `anim_vm_tick` (`$90:80CE`) using definition table `$C4:5D99,X`.
