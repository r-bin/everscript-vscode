---
addr: 8CCCF5
kind: code
name: string_key_lookup
title: Look up a string by key in the string key table ($91:D000), pointer built from two immediates
confidence: confirmed
tags: [text, tables]
evidence: ["disasm: at $8C:CCF7 `lda #$0091 : sta $28 : ldy #$D000`, then `lda [$26],y`; the identical pattern sits again at $8C:CD35 (export: func_CCCCF5, string_key_readers in src/emulator/cdl/known-regions.js)", "scan: these two are the only occurrences of the 8-byte pattern in the ROM (v0.222.0)", "test: tools/table-hack moved the table to $B1:A000 by rewriting both immediates; the attract-loop playback plays identically, the only WRAM difference being $7E0028 = $B1 instead of $91 at frame 5140 (v0.222.0)", "test: a string key appended at index 3002 (key $232E) is shown in game through the moved table (tools/table-hack/evs/string-3003.evs, v0.222.0)"]
see: [docs/extension-tables.md, tools/table-hack/tables.js, rom/8cd3a0.md]
---
Reads a 3-byte string key from the key table. The table address is never one operand: the bank
goes into `$7E0028` as an immediate (`#$0091`), the offset into Y (`#$D000`), and the key's byte
offset is added before `lda [$26],y`.

Moving the table means patching both immediates in both copies (`$8C:CCF7` and `$8C:CD35`). The
table must then stay inside one 32 KB half, because Y is 16-bit and the bank is fixed.

`$7E0028` keeps the table's bank until the next pointer is built. A ROM with the table elsewhere
differs from vanilla in that byte only.
