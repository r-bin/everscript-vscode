---
addr: 8CCCF5
size: 62
end: 8CCD32
kind: code
category: 🧠
name: decode_dialogue_string_key
title: Unpack 24-bit dialogue string key from table $91:D000 into buffer $7F:D81E
confidence: confirmed
tags: [ui, dialogue, strings, compression]
evidence: ["disasm: `sta $26` then `lda [$26, "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.42): 14/14 states (14/14 oracle) and 212/212 fuzzed match ROM, mutation caught"],y` with Y = the table: the script key is a byte offset into $91:D000, so string = key / 3 (text(0x15DB): string 1865 \"Hey, kid!\"; v0.378.0)", "disasm: sets bank $91, reads 3-byte key from $91:D000, evaluates compression bit 23, unpacks through dictionary tables into $7F:D81E", "docs: docs/reverse-engineering/asm-to-c-port.md § String key table; clean C in docs/disassembly/ui/dialogue-window.md"]
see: [routines/decode_dialogue_string_key_secondary.md, routines/tbl_dialogue_string_pointers_c9.md, knowledge/wram/DIALOGUE_DECODE_TEXT_BUF.md]
---
Called by Script VM opcode `0x51` (`dialogue(key)`) and UI menus to decode strings:
- Resolves the 3-byte key descriptor from table `$91:D000`.
- Bit 23 (`0x800000`) marks dictionary-compressed strings vs plain ASCII.
- Expands word dictionary pointers (`$91:F46C` / `$91:F3EC`), digraph substitutions (`$91:F32E`), and character tables into text buffer `$7F:D81E`.
- Provides text streams for font tile generation in VRAM.
