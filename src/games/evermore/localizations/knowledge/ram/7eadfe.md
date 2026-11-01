---
addr: 7EADFE
end: 7EFFFD
size: 20992
kind: buffer
name: UNUSED_WRAM_BANK_7E
title: Large unallocated work RAM gap in Bank $7E (20.5 KB)
lifetime: boot
confidence: likely
tags: [wram, unallocated, candidate]
evidence: ["cdl: vanilla US CDL library (cdl-library/.../wram.flags) confirms 20,992 continuous untouched bytes ($7E:ADFE..$7E:FFFD)", "audit: docs/unused-wram.md documents range as confirmed free of CPU read/write, DMA, and script access in recorded play"]
see: [docs/unused-wram.md, ram/7eadde.md, ram/7efffe.md]
---
20.5 KB (20,992 bytes) unallocated memory block in Bank `$7E` immediately following the High OAM buffer (`$7E:ADDE`..`$7E:ADFD`) and extending up to `$7E:FFFD`.
Untouched by vanilla game code, DMA, or scripts during gameplay; prime candidate memory space for hacks, extended engine systems, and custom mods.
