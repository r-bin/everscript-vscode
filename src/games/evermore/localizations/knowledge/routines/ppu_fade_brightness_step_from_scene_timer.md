---
addr: 80C450
size: 61
end: 80C48C
kind: code
category: 🎨
name: ppu_fade_brightness_step_from_scene_timer
title: PPU screen brightness fader from scene transition timer ($80:C450)
confidence: confirmed
evidence: ["disasm: resets $0B83; inspects transition state $0E70 and timer $0E72; calculates linear brightness 0..15 ($0F); stores brightness level to $0106 (PPU_INIDISP_SHADOW); callers: $80:C4A3, $80:CBD1"]
see: [routines/fade_brightness_step_towards_target.md]
tags: [ppu, brightness, fade, widescreen, widescreen.fade, mode7]
---
Calculates and applies the PPU master screen brightness level during scene transitions. Evaluates transition timer `$0E72` against mode `$0E70`, computing linear fade-in and fade-out ramps between black (0) and full brightness (15), and writes the resulting brightness value to `$0106` (`PPU_INIDISP_SHADOW`, which commits to PPU register `$2100` during VBlank).
