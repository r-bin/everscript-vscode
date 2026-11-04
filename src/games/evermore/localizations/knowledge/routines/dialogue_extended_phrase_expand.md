---
addr: 8CCE09
size: 33
end: 8CCE29
kind: code
category: 🧠
name: dialogue_extended_phrase_expand
title: Decompress 256-entry extended phrase from dictionary index table in Bank $91
confidence: confirmed
tags: [ui, text, phrase, dictionary, string]
evidence: ["disasm: reads secondary token byte, doubles index to read 16-bit word offset from tbl_D1F46C, and copies phrase bytes from Bank $91 into $7F:DC1E"]
see: [docs/disassembly/ui/dialogue-digraph-huffman.md, routines/dialogue_dte_digraph_expand.md, routines/dialogue_mte_word_expand.md]
---
Unpacks full phrases and dialogue clauses via 2-byte token escape `0xFF`:
- Reads secondary phrase index from the compressed stream.
- Accesses 16-bit offset from `tbl_D1F46C` in Bank `$91`.
- Emits the complete null-terminated phrase into destination RAM.
Full disassembly and clean C reconstruction: `docs/disassembly/ui/dialogue-digraph-huffman.md`.
