---
addr: EE0000
end: EE4E5F
size: 20064
kind: table
category: 📋
name: MAP_GRAPHIC_POINTER_TABLE
title: Map graphic pointer table
confidence: likely
tags: [graphics, map, table]
evidence: ["disasm: as recorded in the legacy list (table-files.ts); details in the body"]
---
3-byte pointers, one per 16×16 map graphic id, read by $8C:C88C at $EE0000 + id*3 (docs/map-format/map_tile_graphics_decompression.md)
