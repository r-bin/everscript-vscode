---
addr: 7FFFFF
size: 1
kind: var
name: WRAM_TOP
title: Upper limit of SNES 128 KB Work RAM (Bank $7F top)
lifetime: boot
confidence: confirmed
tags: [memory, platform, snes]
evidence: ["code: src/games/evermore/cdl/regions.ts defines 0x7FFFFF as WRAM upper limit", "code: tools/c-to-rom/gen-ram-header.mts uses 0x7FFFFF as bus boundary"]
see: [docs/disassembly/engine-core/wram-map.md]
---
Final byte of SNES 128 KB Work RAM (`$7F:FFFF`).
Marks the highest address of the 64 KB Bank `$7F` memory space on the SNES memory bus.
