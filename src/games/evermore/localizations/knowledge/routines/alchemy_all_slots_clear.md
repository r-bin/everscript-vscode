---
addr: 919795
size: 40
end: 9197BC
kind: code
category: ✨
name: alchemy_all_slots_clear
title: Animation and projectile alchemy slot active flag reset ($91:9795)
confidence: confirmed
evidence: ["disasm: switches DBR to $7E; iterates 8 Animation Alchemy slots $7E:3364..$7E:3564 (stride $40), zeroing active flag +$14,X; iterates 8 Projectile Alchemy slots $7E:3564..$7E:3914 (stride $76), zeroing active flag +$14,X; caller: $90:8E90"]
see: [routines/alloc_anim_alchemy_slot.md, routines/alloc_proj_alchemy_slot.md, knowledge/wram/ANIM_ALCHEMY_SLOTS_BASE.md, knowledge/wram/PROJ_ALCHEMY_SLOTS_BASE.md]
tags: [alchemy, projectile, animation, reset]
---
Deactivates and resets all alchemy visual and physical effect slots. Zeroes active state word `+$14,X` across all 8 Animation Alchemy slots (`$7E:3364..$7E:3564`, 64-byte stride), followed by all 8 Projectile Alchemy slots (`$7E:3564..$7E:3914`, 118-byte stride).
