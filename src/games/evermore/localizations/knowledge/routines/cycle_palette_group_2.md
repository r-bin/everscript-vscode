---
addr: 80A003
size: 253
end: 80A0FF
kind: code
category: 🧠
name: cycle_palette_group_2
title: Rotate animated palette cycle group 2 into WRAM shadow buffer $7E:7331
confidence: confirmed
tags: [graphics, palettes, animation, vram]
evidence: ["disasm: loads rotated color sequence, writes 4 16-bit BGR555 words to $7E:7331..$7E:7337, queues CGRAM DMA transfer", "docs: docs/map-format/map_palette_extraction.md; clean C in docs/disassembly/engine-core/weather-palette.md"]
see: [routines/copy_palette_group_1_prefix.md, routines/load_weather_preset_parameters.md]
---
Called during ambient environmental update pass to rotate animated palette gradient 2:
- Updates 4 color words in CGRAM shadow buffer `$7E:7331`.
- Drives acid river and swamp water shimmer animations.
- Uploaded to PPU CGRAM during VBLANK via DMA Channel 1.
