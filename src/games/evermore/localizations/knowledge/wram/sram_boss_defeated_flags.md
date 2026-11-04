---
addr: 7E2533
size: 2
kind: var
name: sram_boss_defeated_flags
title: Persistent campaign boss defeat bitfield
lifetime: save
confidence: confirmed
tags: [save, sram, bosses]
evidence: ["disasm: event scripts assert bits in $7E:2533 upon boss death scripts", "disasm: func_C08D4D zeroes this flag during new game initialization"]
see: [knowledge/wram/ALCHEMY_KNOWN_FLAGS.md]
---
Persistent campaign boss defeat bitmask word saved in Cartridge SRAM.

Bits:
- Bit 0: Thraxx defeated (Bugmuck)
- Bit 1: Salabog defeated (Swamp)
- Bit 2: Magmar defeated (Volcano)
- Bit 3: Vigor defeated (Colosseum)
- Bit 4: Megataur defeated (Iglos)
- Bit 5: Rimsala defeated (Pyramid)
- Bit 6: Aegis / Sterling defeated
- Bit 7: Carltron defeated (Final boss)
