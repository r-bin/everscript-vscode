---
addr: 80CA5A
end: 80CAAC
size: 83
kind: code
category: 🧠
name: sub_80CA5A
title: Mode 7 flight primary inner execution loop, waypoint steering, and display commit ($80:CA5A)
confidence: confirmed
tags: ["code","subroutine","cdl", "mode7"]
evidence: ["disasm: $80:CA5A polls $4212 for VBlank, stages and executes 128-byte VRAM tile DMA to $2010 via JSL $80:8650, triggers HDMA channels ($420C = $7E:0072), commits OAM buffer DMA on NMI (JSL $80:8F85), steps waypoint steering path (JSR $80:CBD1), updates rotation matrix ($80:D934), pans camera ($80:DA9A), calculates screen offsets ($80:DCE1), shakes screen ($80:CE35), sets up HUD window OAM ($80:D22D), slides dialogue window ($80:D786), smooths compass needle ($80:DEC4), steps fade brightness ($80:DE96), ticks cockpit indicator ($80:C881), reloads palette family queue (JSL $90:D55F), finalizes OAM ($80:8FEE), and loops via JMP $CA58"]
see: [routines/sub_80CA2D.md, routines/sub_80CA58.md, routines/mode7_flight_waypoint_path_step.md, routines/mode7_flight_heading_yaw_rotation_matrix_calc.md]
---

Primary inner per-frame execution loop for Mode 7 flight scenes.
1. **VBlank Synchronization**: Polls PPU status register `HVBJOY` (`$4212`) until vertical blanking begins.
2. **Tile & HDMA Commit**: Transfers a 128-byte VRAM tile block to `$2010` via `vram_dma_upload_tile_block` (`$80:8650`), writes active channel bits from `$7E:0072` to hardware register `HDMAEN` (`$420C`), and commits OAM sprite buffers via `vram_oam_buffer_dma_commit_on_nmi` (`$80:8F85`).
3. **Flight Physics & Navigation**:
   - Updates waypoint steering path and autopilot tracking via `mode7_flight_waypoint_path_step` (`$80:CBD1`).
   - Recomputes aircraft heading angle and trigonometric yaw rotation matrix via `mode7_flight_heading_yaw_rotation_matrix_calc` (`$80:D934`).
   - Executes rotated camera pan step (`$80:DA9A`) and calculates screen-offset camera coordinates (`$80:DCE1`).
   - Applies screen shake damping (`$80:CE35`).
4. **UI & HUD Updating**:
   - Sets up flight HUD window OAM sprites (`$80:D22D`) and advances dialogue window slide transitions (`$80:D786`).
   - Dampens compass needle tracking angle towards true heading (`$80:DEC4`).
   - Advances screen brightness fading towards target level (`$80:DE96`).
   - Ticks cockpit heading indicator sprite animation (`$80:C881`).
5. **Palette & Sprite Finalization**: Processes queued palette family reloads (`$90:D55F`), finalizes OAM sprites (`$80:8FEE`), and loops unconditionally back to `sub_80CA58` (`$80:CA58`) via `JMP $CA58`.
