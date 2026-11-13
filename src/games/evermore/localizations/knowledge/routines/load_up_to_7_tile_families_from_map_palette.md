---
addr: 90D020
size: 132
end: 90D0A3
kind: code
category: 🧠
name: load_up_to_7_tile_families_from_map_palette
title: Load up to 7 tile families from `MAP_PALETTE`
confidence: verified
tags: [maps, palettes, graphics]
evidence: ["legacy: migrated from functions.ts; how it was learned was not recorded (sources then: the everscript wiki ROM map, the ROM tab's points.ts)", "decomp: fully decompiled in docs/disassembly/maps/palette-families.md", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.39): 9/9 states and 36/36 fuzzed match ROM, mutation caught", "disasm (v0.405.0): per family, A = id; five ASL; ADC #$C322 (16 bits) -> DMA source $4312, source bank fixed $9C ($4314)"]
see: [docs/disassembly/maps/palette-families.md, routines/reload_families_when_a_script_changes_map_palett.md]
---
Loads up to 7 tile families (32 bytes each: 16 colors × 2 bytes) from master palette table `$9C:C322` into WRAM `$7E:61A7` via SNES DMA Channel 1.
Reads the room's tile family definitions at `[$8B],y` where `y = $0F9C`, caches the active palette ID in `$7E:0F8A`, clamps count to 7, and queues a CGRAM palette transfer via `$80:85FA`.

A family's colours are read from bank `$9C` at `$C322 + 32·id` computed in 16 bits: ids past 1263 wrap inside bank `$9C`, so new families must replace table entries (the converted-map export takes the highest of the 365 vanilla ones).
