---
addr: 8CCD35
size: 79
end: 8CCD83
kind: code
category: 🧠
name: decode_dialogue_string_key_secondary
title: Secondary dialogue string key unpacking entry point ($91:D000)
confidence: confirmed
tags: [ui, dialogue, strings, compression]
evidence: ["disasm: identical twin copy of $8C:CCF5; reads string keys from $91:D000 with pointer setup in DP $26", "docs: docs/reverse-engineering/asm-to-c-port.md § String key table"]
see: [routines/decode_dialogue_string_key.md, routines/tbl_dialogue_string_pointers_c9.md]
---
Secondary twin routine of `decode_dialogue_string_key` (`$8C:CCF5`), providing an alternate entry point for reading string key descriptors from `$91:D000`.
