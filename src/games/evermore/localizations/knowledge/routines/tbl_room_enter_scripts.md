---
addr: 92801B
end: 928295
size: 635
kind: table
category: 🗺️
name: tbl_room_enter_scripts
title: Room enter script descriptor table
confidence: confirmed
tags: [rooms, scripts, script-vm]
evidence: ["disasm: script_start_room_enter_script ($8C:CE99) multiplies room ID by 5 and loads the packed script pointer from $92:801B ($8C:CECC)", "variants.json defines room_enter_scripts at $92:801B for US and $93:801B for European / PAL localizations", "test: Open Evermore grows it to 128 entries elsewhere with the operands at $8C:CECC / $8C:CED2 rewritten; the 128th map's record (a fade-in script) runs when load_map(0x7F) enters it (tests/open-evermore/maps-in-game.test.mts, 2026-11-20)"]
see: [routines/script_start_room_enter_script.md, docs/disassembly/engine-core/room-enter.md, docs/scripts/vm.md]
---
Master room enter script table for all 127 game rooms (rooms 0..126).
Contains 127 5-byte records (635 bytes total, `$92:801B`..`$92:8295` in the US ROM; Bank `$93` in PAL releases).

Record format (5 bytes per room):
- `+0x00`: 24-bit packed script pointer (bytes 0..2). A value of 0 indicates that the room has no dedicated enter script. Packed address is unpacked via `bank = $92 + (packed >> 15)`, `addr = $8000 | (packed & $7FFF)`.
- `+0x03`: 16-bit descriptor flags / parameter word (bytes 3..4). `$8C:CE99` does not read it (its two reads,
  `$92:801B,x` and `$92:801C,x`, cover bytes 0..2); no other reader is known. The last record's word lies on the
  script pointer table's first word.

Evaluated whenever entering a room via `script_start_room_enter_script` (`$8C:CE99`) during room load orchestration.
