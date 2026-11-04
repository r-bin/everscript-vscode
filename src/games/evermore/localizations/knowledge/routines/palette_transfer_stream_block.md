---
addr: 80A100
size: 110
end: 80A16D
kind: code
category: 🧠
name: palette_transfer_stream_block
title: Palette Transfer Stream Block to CGRAM Buffer
confidence: confirmed
evidence: ["disasm: $80:A100 copies color stream data from $0007,y into WRAM CGRAM shadow buffer $7E:7339..$7E:734F ready for VBLANK transfer"]
see: [routines/palette_cgram_buffer_commit.md, routines/load_weather_preset_parameters.md, engine-core/screen-effects.md]
---
Streams dynamic palette color records into WRAM:
- Copies color words into CGRAM shadow buffer `$7E:7339`–`$7E:734F`.
- Used for animated water, lava glows, and damage flash palette alterations.
Full clean C decompilation: `docs/disassembly/engine-core/screen-effects.md`.
