---
addr: 8CAC8A
end: 8CACCF
kind: code
category: 🧠
name: window_open_setup
title: Initialize window frame dimensions, cursor, and prepare tile staging
confidence: confirmed
tags: [ui, window, graphics]
evidence: ["disasm: stores window pointer Y into DP $8E; tests bit 1 of flags +$2A,Y; calls $8C:ACD0 to commit tilemap; initializes cursor coordinates +$00,Y and +$02,Y from origin; sets bit 1 in flags; clears $061F and +$12,Y"]
see: [docs/disassembly/ui/dialogue-box-frame.md, rom/8cacd0.md, rom/8cc463.md]
---
Initializes window frame geometry, cursor coordinates, and visibility flags in the window descriptor.
Calls `$8C:ACD0` to synthesize window border and background tile patterns into shadow RAM at `$7F:C800`
and queue DMA uploads to VRAM.
Full disassembly and clean C reconstruction: `docs/disassembly/ui/dialogue-box-frame.md`.

