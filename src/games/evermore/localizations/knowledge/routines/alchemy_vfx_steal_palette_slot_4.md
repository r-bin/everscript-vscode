---
addr: 91C5D6
size: 24
end: 91C5ED
kind: code
category: 🎮
name: alchemy_vfx_steal_palette_slot_4
title: Steal CGRAM palette slot 4 for alchemy visual effect ($91:C5D6)
confidence: confirmed
evidence: ["disasm: advances script PC +$14,Y by 4 bytes; reads palette index from $91:0002,X; calls palette_steal_slot_4 $90:CE92; stores allocated slot into entity palette field +$0C,Y"]
see: ["routines/palette_steal_slot_4.md"]
tags: ["alchemy","palette","cgram","slot4"]
---
Advances script PC `+$14,Y` by 4 bytes. Reads palette index from `$91:0002,X`, invokes `palette_steal_slot_4` (`$90:CE92`), and stores allocated slot index into entity palette field `+$0C,Y`.
