---
addr: 80D524
size: 19
end: 80D536
kind: code
category: 🎨
name: oam_ramp_sprite_x_coordinates_16px
title: Low OAM 16-sprite horizontal coordinate 16px ramp generator ($80:D524)
confidence: confirmed
evidence: ["disasm: loops 16 times: writes coordinate to $00,Y, adds 16 ($10) to coordinate, advances Y by 4 bytes (Low OAM stride); caller: $80:D508"]
see: [routines/oam_init_hud_window_sprite_grid.md]
tags: [oam, sprites, math, mode7]
---
Generates a 16-step horizontal coordinate ramp (0, 16, 32..240 px) across 16 Low OAM sprite descriptors (4-byte stride), establishing a continuous row of 16x16 window border tiles.
