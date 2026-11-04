---
addr: 819A78
end: 819B2F
size: 184
kind: data
category: 🎵
name: tbl_spc700_driver_song_table_terminator_and_alignment
title: SPC700 audio driver song table end terminator and memory alignment padding
confidence: confirmed
tags: [audio, spc700, driver, terminator, padding]
evidence: ["disasm: 184 bytes at $81:9A78..$81:9B2F containing 4-byte table terminator [03 D4 FD FF] followed by 180 uniform 0x00 zero-fill alignment bytes preceding asset_819b30"]
see: [routines/asset_819a1e_song_dependency_table.md, routines/asset_819b30_per_song_tables.md]
---
SPC700 audio soundbank dependency table terminator and driver segment alignment padding:
- Contains 4-byte end-of-table sentinel `0x03, 0xD4, 0xFD, 0xFF`.
- Followed by 180 bytes of zero padding (`0x00`) aligning the per-song table array at `$81:9B30`.
