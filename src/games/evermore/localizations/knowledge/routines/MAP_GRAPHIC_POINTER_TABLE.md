---
addr: EE0000
end: EE4E5F
size: 20064
kind: table
category: 📋
name: MAP_GRAPHIC_POINTER_TABLE
title: Map graphic pointer table
confidence: confirmed
tags: [graphics, map, table]
evidence: ["disasm: as recorded in the legacy list (table-files.ts); details in the body", "disasm: the only code reading it is lda.l $EE0000,x / $EE0002,x at $8C:C898 / $8C:C8A1, $90:A16A / $90:A170 and $90:A237 / $90:A23D (a scan of every long operand into $EE0000-$EE4E5F, 2026-11-19)", "measured: tools/open-evermore moved all 6,688 graphics and rewrote only this table; the playbacks played the same (docs/open-evermore/progress.md S3)", "scan: no immediate builds an $EE pointer (lda/ldx/ldy #$00EE: three hits, all CDL data; no 8-bit lda #$EE in recorded code), 2026-11-20", "test: Open Evermore grows it past 6,688 ids elsewhere with the six operands rewritten; the round trip holds (tests/open-evermore/g0.test.mts)"]
---
3-byte pointers, one per 16×16 map graphic id, read by $8C:C88C at $EE0000 + id*3 (docs/map-format/map_tile_graphics_decompression.md)

All 6,688 graphics are used by some room (Block 1 or an animation frame); entries 6,688 and up are 0. A graphic in a
bank's upper half is pointed at in the `$80-$BF` form, one in a lower half in the `$C0-$FF` form; no graphic crosses
a bank. The graphics are scattered over about 80 banks, in the gaps other data leaves. Moving one means rewriting its
entry only (Open Evermore's tiles kind does).
