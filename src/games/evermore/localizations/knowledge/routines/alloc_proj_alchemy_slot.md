---
addr: 919777
end: 919794
size: 30
kind: code
category: 🧠
name: alloc_proj_alchemy_slot
title: Find a free slot in the projectile-alchemy slot table
confidence: confirmed
tags: ["alchemy","projectile","allocator"]
evidence: ["disasm: full body read (16 instructions): Y starts at $3564 and steps by $76 while the word at +$14 is non-zero; stops below $3914; Y = 0 when all 8 slots are in use","disasm: callers are script op 0x9E and the item-target / direct-cast / Barrier / Corrosion / Crush handlers"]
see: ["knowledge/wram/PROJ_ALCHEMY_SLOTS_BASE.md","src/games/evermore/localizations/knowledge/routines/alloc_anim_alchemy_slot.md"]
---
Returns in Y the first free slot of the 8-slot projectile-alchemy table (knowledge/wram/PROJ_ALCHEMY_SLOTS_BASE.md, 118-byte stride), or Y = 0 when every slot is taken. A slot is free when its word at +$14 is zero. It only searches; the caller fills the slot.

Sibling for animation spells: routines/alloc_anim_alchemy_slot.md (64-byte stride).
