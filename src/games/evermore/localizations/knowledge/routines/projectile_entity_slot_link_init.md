---
addr: 90DC21
size: 20
end: 90DC34
kind: code
category: 🎮
name: projectile_entity_slot_link_init
title: Initialize projectile entity slot link pool structures ($90:DC21)
confidence: verified
evidence: ["reconstructed-c/90/90DC21_projectile_entity_slot_link_init.c passes Gate G1 (9/9 reference states, 144/144 fuzzed, mutation caught)", "disasm: initializes slot pointer $0EC2 = $6387; loops stepping 44 bytes ($2C) up to $64E7 clearing field +$10,X; callers: engine boot $8F:B1AC, $8F:B38E"]
see: ["routines/combat_hitbox_tables_and_collision_init.md","routines/entities_frame_tick_update.md"]
tags: ["projectile","entity","init","pool","reconstructed-c","g1-pass"]
---
Initializes projectile entity slot structures `$6387..$64E7`. Sets `$0EC2 = $6387`, steps in increments of 44 bytes (`#$2C`), and clears slot field `+$10,X`.
