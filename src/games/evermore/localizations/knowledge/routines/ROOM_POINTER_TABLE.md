---
addr: 9FFDE7
end: 9FFFE2
size: 508
kind: table
category: 📋
name: ROOM_POINTER_TABLE
title: Room pointer table
confidence: confirmed
evidence: ["disasm: read only by lda.l $9FFDE7,x at $90:8F69 and lda.l $9FFDE8,x at $90:8F6F (tools/table-hack/tables.js); moved to $B1:8000 by the table hack, attract loop identical (v0.222.0)", "test: Open Evermore grows it to 128 entries elsewhere with those two operands rewritten; load_map(0x7F) then loads the 128th map, screen and VRAM as the same blob as room 0x15 (tests/open-evermore/in-game.test.mts, 2026-11-20)", "test: 127 rooms decode from entries 0..126 (docs/map-format/room-reference.md); the bytes after them are no room"]
tags: [script-vm, map, table]
see: [routines/tbl_room_enter_scripts.md, wram/CURRENT_ROOM_ID.md]
---
127 × [blob pointer:24 (`$80–$BF:8000+` form), pad:8], indexed by room id × 4. The engine allows up to 256 ids
(the enter-script lookup multiplies the id byte by 5); in place the table cannot grow past 134 entries (the end of
bank `$9F`), so more rooms need the table moved and its two reader operands rewritten.
