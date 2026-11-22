---
addr: 928000
size: 27
end: 92801A
kind: table
category: 📋
name: SCRIPT_BANK_HEADER
title: Script bank header
confidence: likely
tags: [script-vm]
evidence: ["disasm: $8C:D3A0 reads words +0 and +8 to index the pointer table; $8C:CE63 and the trigger handlers use +0", "read: the packed pointer at +$0C unpacks to $92:DE49, a script the game runs (tests/script-vm/goldens.json)", "test: a walk from the pointer table, the header pointer and the rooms reaches every instruction the game ran (tests/script-vm/rom.test.js)", "scan: code starts a script only through $8C:CF18, called (JSL) from five places in the script engine: $8C:CE3C (the +$0C pointer), $8C:CE73 (the pointer table), $8C:CED8 (the enter table), $8C:D3DA and $8C:D40E (opcodes), 2026-11-20", "test: Open Evermore moves the pointer table and every script, rebasing lda.l $928000,x / $928002,x at $8C:CE63, $8C:CE69, $8C:D3B5, $8C:D3BB by -word +0 (the header stays); both stored playbacks play identically (docs/open-evermore/progress.md S6)"]
see: [routines/script_op_call_global.md, routines/script_named_by_header.md, docs/scripts/vm.md]
---
The first bytes of the script bank. Word `+0` is the offset of the pointer table (`$92:8294` in the US
ROM): trigger ids and `0xA4` operands are byte offsets into it, and it runs up to the first script it
points at. Word `+8` is where the global ids of `0xA3` start in it (`$1677`). `+$0C` holds a packed
pointer to `$92:DE49`. The room enter table follows at `+$1B`. The other words are not traced yet.
