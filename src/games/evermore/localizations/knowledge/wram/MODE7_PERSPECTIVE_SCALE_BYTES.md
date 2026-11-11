---
addr: 7E2090
size: 32
kind: array
name: MODE7_PERSPECTIVE_SCALE_BYTES
title: Unread 32-byte buffer written by the $80:D113 Bank $B0 out-of-bounds read bug
lifetime: room
confidence: confirmed
tags: [mode7, flight, bug, unused]
evidence: ["disasm: func_80D113 unrolled byte-copy loop (SEP #$20; PEA $B090; PLB; PLB) writes 32 bytes from $B0:E293+2n,X into $7E:2090..$7E:20AF", "disasm: VRAM DMA at $80:D91B transfers 128 bytes ($0080) from $7E:2010..$7E:208F (stopping at $7E:208F), and no CPU instruction or DMA transfer in the ROM ever reads $7E:2090..$7E:20AF"]
see: [src/games/evermore/localizations/knowledge/routines/row_table_low_bytes_from_bank_b0.md, docs/vanilla-bugs/mode7-bank-b0-oob-read.md]
---
32-byte WRAM buffer (`$7E:2090`..`$7E:20AF`) written by `$80:D113` (`row_table_low_bytes_from_bank_b0`)
immediately after `$80:CFA9` populates `$7E:2050..$7E:208E`.
- Due to the vanilla `PEA $B090; PLB; PLB` bug at `$80:D116`, `$80:D113` reads `$B0:E293+2n,X` (file
  `0x30E293+X`, past the end of the 3 MB ROM) into `$7E:2090..$7E:20AF`.
- Because `$80:D91B`'s 128-byte DMA to VRAM `$6400` covers `$7E:2010..$7E:208F` and **no instruction or DMA
  channel in the ROM ever reads `$7E:2090..$7E:20AF`**, this buffer is dead WRAM on retail hardware, but
  diverges across emulators, static recompilation, 4 MB expansions, and ExHiROM builds (see
  `docs/vanilla-bugs/mode7-bank-b0-oob-read.md`).
