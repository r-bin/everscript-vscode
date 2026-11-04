---
addr: $7F:0000
name: ROOM_METATILE_GRID
type: u8[0x8000]
tags: [map, metatiles, bank7f]
confidence: verified
evidence: ["disasm: Primary decompressed room metatile grid buffer ($7F:0000..$7F:7FFF) holding live metatile IDs, Layer 1/2 VRAM tile words, and elevation/collision attributes ($80:C0B5, $8F:9F05, $90:9DE8, $90:A739)"]
---
Primary decompressed room field metatile grid and attributes buffer ($7F:0000..$7F:7FFF). Holds live metatile IDs, Layer 1/2 VRAM tile words, and 2-bit elevation/collision attributes ($80:C0B5, $8F:9F05, $90:9DE8, $90:A739).
