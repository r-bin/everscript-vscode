---
addr: 7E156C
size: 2
kind: var
name: BARRIER_SCANLINE_OFFSET
title: Barrier and spotlight window scanline offset accumulator
lifetime: frame
confidence: confirmed
tags: [window, hdma, spotlight, barrier]
evidence: ["disasm: func_91C899 adds $156C and active window buffer $158E to calculate scanline boundary index in $7E:6869", "disasm: func_91C7F5 shifts $156C left (ASL) during window geometry updates"]
see: [knowledge/wram/BARRIER_RADIUS.md, knowledge/wram/HDMA_WINDOW_INDIRECT_TABLE.md]
---
16-bit scanline offset accumulator added to the base address of the active window coordinate buffer (`$7E:6869`/`$7E:6A7D`).
- Evaluated by `func_91C899` to index the midpoint circle rasterization output relative to the vertical center of the barrier circle (`$7E:23AF`) or dark room spotlight.
