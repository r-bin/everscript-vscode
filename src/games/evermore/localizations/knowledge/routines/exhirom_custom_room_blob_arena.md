---
addr: FE0000
size: 32768
end: FE7FFF
kind: region
category: 🗺️
name: exhirom_custom_room_blob_arena
title: ExHiROM custom room data blobs arena in Bank $FE
confidence: confirmed
tags: [map, exhirom, export]
evidence: ["src/games/evermore/rooms/rom-exporter.ts exports custom room entity lists and tileset data into Bank $FE:0000"]
---
Dedicated ExHiROM arena at `$FE:0000–$FE:7FFF` allocated for custom room assets, decompressed tile blobs, and auxiliary room configuration tables exceeding 3 MB vanilla boundaries.