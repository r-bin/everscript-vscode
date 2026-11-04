---
addr: 809E93
size: 368
end: 80A002
kind: code
category: 🧠
name: copy_palette_group_1_prefix
title: Copy eight palette words into WRAM shadow buffer $7E:7321
confidence: confirmed
tags: [graphics, palettes, animation, vram]
evidence: ["disasm: copies eight words from Y+$06..Y+$14 to $7E:7321,X..$7E:732F,X, advances Y by $10, and jumps to $80:9FFE", "C prefix model: reconstructed-c/80/809E93_weather_palette.c"]
see: [routines/cycle_palette_group_2.md, routines/load_weather_preset_parameters.md]
---
This entry copies eight 16-bit words from data-bank offsets `Y+$06, Y+$08, ... Y+$14` to `$7E:7321,X` through `$7E:732F,X`. It advances Y by `$10` and jumps to `$80:9FFE`. The meaning of the source words and the behavior of the continuation are not established by this entry alone.
