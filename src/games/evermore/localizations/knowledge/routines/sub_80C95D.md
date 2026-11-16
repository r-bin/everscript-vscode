---
addr: 80C95D
end: 80C984
size: 40
kind: code
category: 🧠
name: sub_80C95D
title: Mode 7 flight VBlank synchronization, terrain collision DMA, and sky CGRAM update ($80:C95D)
confidence: confirmed
tags: ["code","subroutine","cdl", "mode7"]
evidence: ["disasm: $80:C95D polls PPU status register $4212 bit 7 for VBlank, enables forced blanking ($2100 = $80), calls map_decompression_terrain_collision_words_dma via JSL $80:8E9A, disables forced blanking ($2100 = $00), checks MODE7_FLIGHT_HUD_VISIBLE ($7E:0B1D), and dispatches mode7_sky_color_gradient_and_fade_cgram_dma ($80:D7B0) and hide_window_frame_sprites ($80:D763) before falling into sub_80C985"]
see: [routines/sub_80C95B.md, routines/sub_80C985.md, routines/map_decompression_terrain_collision_words_dma.md, routines/mode7_sky_color_gradient_and_fade_cgram_dma.md]
---

Mode 7 flight scene display setup and terrain collision streaming.
1. Polls PPU status register `HVBJOY` (`$4212`) until VBlank begins.
2. Writes `$80` to `INIDISP` (`$2100`) to force display blanking.
3. Invokes `map_decompression_terrain_collision_words_dma` (`$80:8E9A`) to decompress world map terrain collision matrices and stage them via DMA into PPU VRAM.
4. Clears display dirty flag (`$7E:0106`) and restores display output by writing `$00` to `INIDISP` (`$2100`).
5. Checks `MODE7_FLIGHT_HUD_VISIBLE` (`$7E:0B1D`): if visible, calls `mode7_sky_color_gradient_and_fade_cgram_dma` (`$80:D7B0`) and hides window frame sprites (`$80:D763`).
6. Falls through into `sub_80C985` (`$80:C985`) for camera coordinate projection and OAM frame assembly.
