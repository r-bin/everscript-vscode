---
addr: 7E0128
size: 3
kind: var
name: NMI_USER_HOOK_FAR_PTR
title: 24-bit far vector hook for VBlank NMI interrupt dispatch
lifetime: boot
confidence: confirmed
tags: [nmi, interrupt, hook, vector]
evidence: ["disasm: func_80857F writes target address to low word $128 and bank byte to $129; defaults to dummy RTL at $80:858B", "disasm: hardware VBlank handler vectors through [$0128] to run custom screen update routines"]
see: [knowledge/wram/IRQ_USER_HOOK_FAR_PTR.md]
---
24-bit far indirect vector (`$0128` low word, `$012A` bank byte) executed during the SNES VBlank NMI interrupt handler.
- Initialized by `func_80857F` to point to a default return stub (`$80:858B`).
- Overridden by cutscenes, minigames, and Mode 7 flight routines to inject specialized raster transfers during VBlank.

