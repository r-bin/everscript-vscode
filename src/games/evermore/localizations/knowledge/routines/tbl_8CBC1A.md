---
addr: 8CBC1A
end: 8CBC41
size: 40
kind: table
category: 📋
name: tbl_8CBC1A
title: Named items (charms, key items) — each one's name
confidence: confirmed
tags: ["table","menu","charm","item","text"]
evidence: ["disasm: $8C:C11E lda.l $8CBC1A,x / sta $22, lda #$00C4 / sta $24, jsl $8C:9E03 (print), X = 2·entry up to $26 (2026-11-23)", "rom: the 20 words point at the names $C4:7257-$72DD in list order"]
see: [docs/todo/growable-items.md]
---
20 words, entry `k` at `2·k`: named item `k`'s name, a 16-bit pointer into bank `$C4` (the printing loop sets the bank
itself, `$8C:C124`). See `tbl_8CBBB0` for the list.

Previously believed: 9 entries of 4 bytes (36 bytes), with `$8C:BC3E`-`$BC41` padding; those 4 bytes are entries 18 and 19.
