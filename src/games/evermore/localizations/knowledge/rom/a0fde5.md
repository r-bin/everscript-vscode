---
addr: A0FDE5
size: 512
kind: table
category: 📋
name: ROOM_POINTER_TABLE_PAL
title: Room pointer table (PAL European variants)
confidence: confirmed
tags: [map-format, variant]
evidence: ["variants.json: europe, germany, france, spain1, spain2 map_pointers table is at snes $A0:FDE5 (file 0x20FDE5)", "rom-readers.ts / maps/rom.ts: mapTableOffset resolves to 0x20FDE5 on PAL builds"]
see: [rom/9ffde7.md, docs/evermore-variants.md]
---
In PAL European releases, the master room pointer table is relocated to `$A0:FDE5` (file offset `0x20FDE5`).
Contains 128 × [ptr:24, pad:8] entries indexed by room ID × 4, pointing to room definition blobs.
