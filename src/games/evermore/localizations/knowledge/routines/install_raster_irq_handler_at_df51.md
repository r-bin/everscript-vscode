---
addr: 80DF3F
size: 290
end: 80E060
kind: code
category: 🎮
name: install_raster_irq_handler_at_df51
title: Split-screen Mode 2 / Mode 7 scanline raster IRQ handlers ($80:DF3F, $80:DF51, $80:DFB4) and landing zone bounding-box check ($80:DFFF)
confidence: confirmed
evidence: ["disasm: $80:DF3F installs scanline 5 IRQ $80:DF51 via $80:8552", "disasm: $80:DF51 sets BGMODE=$12 (Mode 2 OPT sky, BG1SC=$60, BG3SC=$64) and arms $80:DFB4 at horizon scanline Y = 61 + $14B8", "disasm: $80:DFB4 waits for H-Blank ($4212 bit 6), writes M7X/M7Y ($14A0/$14A2) and M7HOFS/M7VOFS ($010E/$0110), switches BGMODE=$07 (Mode 7 ground), and re-arms $80:DF51 at Y=$00FF", "disasm: $80:DFFF checks ((MODE7_CENTER_X>>3)+1)&$7F and ((MODE7_CENTER_Y>>3)+1)&$7F against 5-byte bounding boxes at $80:E061 and writes matched landing ID to $7E:237D"]
see: ["routines/snes_set_timer_irq_scanline_and_vector.md","routines/sub_80C95B.md","docs/disassembly/engine-core/mode7-overworld-engine.md"]
tags: ["irq","raster","scanline","ppu","mode7","flight"]
---
Contains the two-stage scanline raster IRQ that splits the screen between a **PPU Mode 2 (Offset-Per-Tile)
sky** and a **PPU Mode 7 perspective ground plane**, followed at `$80:DFFF` by the overworld landing zone
bounding-box lookup:

1. **`$80:DF3F` – `$80:DF50` (Install IRQ)**: Masks interrupts (`SEI`), registers `$80:DF51` at scanline
   `Y = 5` via `$80:8552`, and clears `CLI`.
2. **`$80:DF51` – `$80:DFB3` (Scanline 5 / `$00FF` IRQ — Sky Layer)**:
   - Sets `BG1SC = $60`, `BG3SC = $64` (VRAM `$6400` OPT table), `BG12NBA = $44`, **`BGMODE = $12` (Mode 2 OPT)**,
     `TM = $11` (BG1 + OBJ), `TS = $01`, `CGADSUB = $10`.
   - Writes column 0 vertical scroll `$7E:2050` to `BG1VOFS` (`$210E`) and `$7E:14C2` to `BG1HOFS` (`$210D`).
   - Schedules `$80:DFB4` at dynamic horizon scanline **`Y = (60 + $7E:14B8 + 1) & $FF`** (`61 + $14B8`).
3. **`$80:DFB4` – `$80:DFFE` (Horizon Scanline `61 + $14B8` IRQ — Ground Plane)**:
   - Spins on `$4212` bit 6 (`BIT #$40`) until H-Blank.
   - Writes Mode 7 pivot `$7E:14A0` / `$7E:14A2` to `M7X` / `M7Y` (`$211F` / `$2120`), scroll `$7E:0110` / `$7E:010E`
     to `M7VOFS` / `M7HOFS` (`$210E` / `$210D`), and switches **`BGMODE = $07` (Mode 7)**.
   - Re-arms `$80:DF51` at scanline `Y = $00FF`.
4. **`$80:DFFF` – `$80:E060` (Landing Zone Bounding-Box Check)**:
   - Converts `MODE7_CENTER_X/Y` (`$7E:14A0` / `$7E:14A2`) into tile coordinates `(($14A0 >> 3) + 1) & $7F`
     and scans 5-byte records `(x_min, y_min, x_max, y_max, landing_id)` at **`$80:E061`**, storing the
     matched landing ID (or `$FFFF`) into `$7E:237D` (`MODE7_FLIGHT_STATUS_FLAG`).
