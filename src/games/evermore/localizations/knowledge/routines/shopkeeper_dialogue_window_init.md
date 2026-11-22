---
addr: 8EA0B3
size: 823
end: 8EA3E9
kind: code
category: 🏪
name: shopkeeper_dialogue_window_init
title: Shopkeeper dialogue window coordinate initialization
confidence: likely
tags: [shop, dialogue, npc, window]
evidence: ["disasm: sets shop active flag $05A9 |= $8000; loads active NPC pointer $05A7 into $143A; reads entity position from $7E001A,X / $7E001C,X and offsets Y by -13 into $0615/$0617 to anchor speech window above shopkeeper head; special-cases merchant record IDs $4E89 and $4F37 (REA dossier 0x8ea0b3)"]
---
Initializes speech bubble and dialogue window positioning for shopkeepers, anchoring coordinates directly above the merchant NPC's world position.

It ends in `stz $95 : rtl` at `$8E:A3E7` (once believed alignment padding, BANK8E_PAD_A3E7); the byte after it is the debug ring's loop (`ring_debug_loop`, a bare `rts`).
