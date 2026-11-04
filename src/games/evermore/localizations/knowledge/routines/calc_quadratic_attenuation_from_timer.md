---
addr: 80C3E2
size: 40
end: 80C409
kind: code
category: 🧠
name: calc_quadratic_attenuation_from_timer
title: Quadratic attenuation factor calculator from transition timer ($80:C3E2)
confidence: confirmed
evidence: ["disasm: divides transition timer $0E72 by 2 (LSR); computes absolute distance from midpoint 128 ($80); squares deviation via hardware multiplier $4202; normalizes product from $4216 into 7-bit factor $14BA; callers: $80:C4A3, $80:CBD1"]
see: [routines/apu_fade_volume_step_from_scene_timer.md, routines/ppu_fade_brightness_step_from_scene_timer.md]
tags: [math, audio, video, curves]
---
Computes a smooth parabolic/quadratic attenuation curve factor from scene transition timer `$0E72`. Calculates the absolute distance between `t/2` and midpoint 128, squares the deviation using the SNES hardware multiplier (`$4202`), and scales the resulting product from `$4216` into a 7-bit normalized attenuation coefficient in `$14BA`.
