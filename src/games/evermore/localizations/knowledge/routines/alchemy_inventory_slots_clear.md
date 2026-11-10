---
addr: 91CC15
size: 16
end: 91CC24
kind: code
category: 🎮
name: alchemy_inventory_slots_clear
title: Clear alchemy ingredient inventory slots ($91:CC15)
confidence: verified
evidence: ["reconstructed-c/91/91CC15_alchemy_inventory_slots_clear.c passes Gate G1 (3/3 reference states, 48/48 fuzzed, mutation caught)", "disasm: loops 9 times (X=8 down to 0) in 8-bit mode writing $FF into ingredient array $0AD2,X; callers: engine boot $80:8CC9, menu init $8D:B492"]
see: ["routines/gameplay_session_subsystems_init.md","routines/sram_compute_checksum.md"]
tags: ["alchemy","inventory","init","reconstructed-c","g1-pass"]
---
Resets the 9 active alchemy formula ingredient slots `$0AD2..$0ADA` to `$FF` (empty/unassigned). Called during engine initialization and ring menu resets.
