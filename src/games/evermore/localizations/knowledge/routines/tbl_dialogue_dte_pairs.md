---
addr: 91F32E
end: 91F3AD
size: 128
kind: table
category: 💬
name: tbl_dialogue_dte_pairs
title: Dialogue Dual Tile Encoding (DTE) character digraph pair table
confidence: confirmed
tags: [dialogue, dte, text, compression]
evidence: ["disasm: dialogue string decompressor $8C:CD84 indexes token (0x80..0xBF) to emit 2 consecutive ASCII characters from $91:F32E into cyclic buffer $7F:DC1E", "data: 64 2-byte English digraph pairs ('e ', ' t', 'th', 'ou', 'he', 'er', 'an')"]
see: [rom/91f300.md, docs/disassembly/ui/dialogue-text-decoder.md]
---
Master Dual Tile Encoding (DTE) digraph pair table used by the dialogue text decompression engine.
Contains 64 2-byte English character pairs (128 bytes total, `$91:F32E`..`$91:F3AD`) indexed by compressed string tokens `0x80` through `0xBF`.
Decompressed by `$8C:CD84` directly into WRAM cyclic buffer `$7F:DC1E`.
