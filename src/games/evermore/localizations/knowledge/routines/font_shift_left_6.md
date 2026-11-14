---
addr: 8C9D4C
end: 8C9D52
size: 7
kind: code
category: 🧠
name: font_shift_left_6
title: Font glyph shift jump table target (6-bit ASL)
confidence: confirmed
tags: [code, subroutine, font, dialogue]
evidence: ["disasm: 6x ASL A followed by RTS at $8C:9D4C", "jump table target of $8C:9D5B indexed by $8C:9BF0", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.46): 39/39 states (39/39 oracle, 624/624 fuzzed) match ROM, mutation caught"]
---

Font glyph shift jump table entry shifting the 16-bit accumulator left by 6 bits (`A <<= 6`) and returning via RTS.

