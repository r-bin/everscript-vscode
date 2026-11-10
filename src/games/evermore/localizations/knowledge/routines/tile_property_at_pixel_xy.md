---
addr: 909815
end: 909838
size: 36
kind: code
category: 🧠
name: tile_property_at_pixel_xy
title: Look up the tile property word under a pixel position
confidence: confirmed
tags: [map, collision, tile, widescreen, widescreen.collision, reconstructed-c, g1-pass]
reconstructed_c: reconstructed-c/90/909815_tile_property_at_pixel_xy.c
evidence: ["reconstructed-c/90/909815_tile_property_at_pixel_xy.c passes Gate G1 (33/33 reference states, 513/513 fuzzed, mutation caught)", "disasm: full body read (19 instructions): column = (X and $0FF0)>>3, row = (Y and $0FF0)>>3; hardware multiply of the row by the row pitch $08EE; the sum indexes a pointer in $56 to get a map word, which then indexes the table at $7F:0004", "disasm: callers are the companion / entity AI routines at $8F:A933, $8F:AA82, $8F:AF48, $8F:B0A4, $8F:B434, $8F:C2D1"]
see: ["knowledge/wram/CAMERA_MAX_ROOM_Y.md"]
---
X and Y are world pixel coordinates. The routine converts them to a map cell (16-pixel tiles, word-sized cells), reads the cell word through the pointer kept in $56, and uses that word as an index into the table at $7F:0004, returning the property word found there in A. The row pitch factor is $08EE (`ROOM_METATILE_WIDTH`).

## Widescreen notes

Verified: index = 2 * ((Y & `$FF0`) >> 4 * width + (X & `$FF0`) >> 4) into `$7F:0000`; returns the collision word `$7F:0004 + grid word`. Whole-room data, any world position (asm read 2026-11-09).
