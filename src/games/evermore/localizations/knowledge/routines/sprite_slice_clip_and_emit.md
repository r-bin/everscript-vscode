---
addr: 8090F8
size: 166
end: 80919D
kind: code
category: 🧠
name: sprite_slice_clip_and_emit
title: 8x8 sprite slice boundary clipper and Low/High OAM packer
confidence: confirmed
tags: [sprite, oam, clipping, vram, widescreen, widescreen.oam, widescreen.cull]
evidence: ["disasm: loops across remaining slices in $E0, parses 4-byte slice descriptor, validates screen coordinates against [-7, 255] x [-7, 223], queries 8x8 LRU cache $7E:7D51, calls obj_tile_allocate on miss, emits into Low OAM $7E:ABDE,X, and packs high OAM bits", "trace: executed on every visible entity slice"]
see: [docs/disassembly/entities/sprite-clip-cull.md, routines/direct_sprite_draw_oam.md, routines/sprite_slice_16x16_clip_and_emit.md]
---
Iterates over 8x8 sprite slices, validating bounds within $[-7, 255] \times [-7, 223]$ to allow smooth screen boundary entry.
Resolves dynamic VRAM allocation via 8x8 LRU cache `$7E:7D51`, writes 4-byte sprite entry to Low OAM (`$7E:ABDE,X`),
and updates the corresponding 2-bit field in High OAM (`$7E:ADDE`).
Full disassembly and clean C reconstruction: `docs/disassembly/entities/sprite-clip-cull.md`.

## Widescreen notes

Verified: 8x8 chunk kept when X in [−7, 256) and Y in [−7, 224) (signed 16-bit `cmp #$FFF9` / `cmp #$0100`); X8 set from the sign (`bit $17`). Also stops when OAM is full (`$D4` high bits) or the dynamic tile budget `$D8` runs out (asm read 2026-11-09).
