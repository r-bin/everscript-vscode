---
addr: BD8000
size: 32768
end: BDFFFF
kind: region
category: 🗺️
name: rom_export_custom_map_arena
title: ROM export custom room map metatiles and collision arena in Bank $BD
confidence: confirmed
tags: [map, export, rom]
evidence: ["src/games/evermore/rooms/rom-exporter.ts places assembled custom room tilemaps and collision at $BD:8000"]
---
Target memory region in Bank `$BD` (`$BD:8000–$BD:FFFF`) where the ROM map exporter writes custom room layer metatiles, tilemaps, and collision buffers when building standalone modified test ROMs.