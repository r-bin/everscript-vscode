---
addr: 80D113
size: 282
end: 80D22C
kind: code
name: row_table_low_bytes_from_bank_b0
title: Second pass of the Mode 2 OPT sky row copy; reads bank $B0 (past the end of the 3 MB ROM) into unread WRAM $7E:2090..$7E:20AF
confidence: confirmed
tags: [engine, mapping, mode7, bug]
evidence: ["disasm: $80:D113 SEP #$20; PHB; PEA $B090; PLB; PLB (DB = $B0), then 32 unrolled LDA $E293+2n,X / STA $7E2090+n stores, followed by $80:D223 LDA $2050; AND #$01FF; STA $2050; RTS", "disasm: $80:D91B and $80:CA5E DMA 128 bytes ($0080) from $7E:2010..$7E:208F to VRAM $6400 (BG3SC = $64 Mode 2 OPT table), stopping at $7E:208F; no CPU instruction or DMA channel in the ROM ever reads $7E:2090..$7E:20AF", "cdl: on an ExHiROM trap image the reads land on file 0x30E653-0x30E691 (X = $03C0, $14C6 = 15) in 2 of 30 recorded movies, once each; room $46 in the one checked (v0.216.0)", "trace: exec breakpoint $80:D113 hit once per movie; stack shows the chain $8C:E6B0 -> $80:BC19 -> $80:CFA5 (v0.216.0)", "test: on the snes9x2005 core the WRAM of the original and of an ExHiROM image with a different 4th megabyte diverge right at that frame (tools/exhirom/prove.js, v0.216.0)"]
see: [docs/vanilla-bugs/mode7-bank-b0-oob-read.md, docs/disassembly/engine-core/mode7-overworld-engine.md, docs/exhirom/port.md, .agents/skills/memory-map/SKILL.md]
---
Tail of `$80:CFA9` (`mode7_camera_matrix_projection_update`), which copies one 32-word (64-byte) row
of the PPU Mode 2 Offset-Per-Tile (OPT) vertical scroll table at `$80:E293` (row index `$7E:14C6` in
`0..30`, `X = $14C6 << 6`) into `$7E:2050..$7E:208E` (adding `$7E:14C8`).

This second pass (`$80:D113–$80:D220`) unrolls 32 byte copies from `$E293+2n,X` into `$7E:2090..$7E:20AF`,
followed (`$80:D221–$80:D22C`) by masking the `$A000` Mode 2 OPT control bits off column 0
(`$7E:2050 &= $01FF`, since column 0 is scrolled via hardware `BG1VOFS` `$210E` in the scanline 5 IRQ
at `$80:DF72`).

Because `$80:D116` executes `PEA $B090; PLB; PLB`, the second `PLB` leaves `DB = $B0`, so the 32
`LDA $E293+2n,X` instructions read `$B0:E293,X` (file `0x30E293+X`), in the unpopulated 4th megabyte
of the 3 MB HiROM.

## Why It Is Invisible on Hardware
- In V-Blank (`$80:D91B` and `$80:CA5E`), DMA transfers 128 bytes (`$0080`) starting at `$7E:2010` to
  VRAM word `$6400` (`BG3SC = $64` in Mode 2): `$7E:2010..$7E:204F` (Row 0, horizontal OPT = 0) and
  `$7E:2050..$7E:208F` (Row 1, vertical OPT for the 32 sky tile columns).
- The DMA stops at `$7E:208F`, and **no CPU instruction or DMA transfer in the ROM ever reads
  `$7E:2090..$7E:20AF`**.
- However, because hardware (`0x20E293+X`), `snes9x2005` (`0x00E293+X`), `MesenCE` (`0x206293+X`),
  4 MB HiROM expansions (`0x308000+`), and ExHiROM builds return different bytes for `$B0:E293,X`,
  this routine causes immediate WRAM divergence at `$7E:2090..$7E:20AF` in lockstep comparisons
  (see `docs/vanilla-bugs/mode7-bank-b0-oob-read.md`).
