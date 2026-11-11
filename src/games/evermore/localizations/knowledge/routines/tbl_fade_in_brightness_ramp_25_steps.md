---
addr: 80E1DF
end: 80E210
size: 50
kind: table
category: 📋
name: tbl_fade_in_brightness_ramp_25_steps
title: Gradual 25-step screen brightness ramp lookup table
confidence: confirmed
tags: [ppu, brightness, fade, lookup, table, mode7]
evidence: ["disasm: 50 bytes at $80:E1DF..$80:E210 containing 25 16-bit word brightness values: 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15"]
see: [knowledge/wram/JOYPAD1_TRIGGERED.md, routines/screen_fade_in_from_black_sync.md, routines/tbl_80E2B5.md]
---
Brightness curve lookup table holding 25 16-bit words progressing smoothly from brightness 4 up to full brightness 15 (holding each level for two steps). Used by scene transitions to produce non-linear gradual screen illumination.
