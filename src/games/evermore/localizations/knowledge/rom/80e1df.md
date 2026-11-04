---
addr: 80E1DF
end: 80E210
size: 50
kind: table
category: 📋
name: tbl_fade_in_brightness_ramp_25_steps
title: Gradual 25-step screen brightness ramp lookup table
confidence: confirmed
tags: [ppu, brightness, fade, lookup, table]
evidence: ["disasm: 50 bytes at $80:E1DF..$80:E210 containing 25 16-bit word brightness values: 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15"]
see: [ram/7e0106.md, rom/80de45.md, rom/80e2b5.md]
---
Brightness curve lookup table holding 25 16-bit words progressing smoothly from brightness 4 up to full brightness 15 (holding each level for two steps). Used by scene transitions to produce non-linear gradual screen illumination.
