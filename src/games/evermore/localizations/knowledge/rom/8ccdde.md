---
addr: 8CCDDE
end: 8CCE08
kind: code
category: 🧠
name: dialogue_mte_word_expand
title: Unpack null-terminated dictionary word from MTE repository in Bank $91
confidence: confirmed
tags: [ui, text, mte, word, dictionary]
evidence: ["disasm: masks token with 0x7E, adds offset from tbl_D1F3F0 to $F66C in Bank $91, and streams null-terminated ASCII word into $7F:DC1E"]
see: [docs/disassembly/ui/dialogue-digraph-huffman.md, rom/8ccdc6.md, rom/8cce09.md]
---
Unpacks a common English dictionary word using Multi-Tile Encoding (MTE):
- Masks token in range `0xC0`..`0xFE`.
- Reads 16-bit word offset from `tbl_D1F3F0` and accesses base `$F66C` in Bank `$91`.
- Copies null-terminated characters into the active output buffer.
Full disassembly and clean C reconstruction: `docs/disassembly/ui/dialogue-digraph-huffman.md`.
