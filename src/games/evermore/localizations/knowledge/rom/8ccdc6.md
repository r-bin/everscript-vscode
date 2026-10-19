---
addr: 8CCDC6
end: 8CCDDD
kind: code
category: 🧠
name: dialogue_dte_digraph_expand
title: Expand 2-character DTE digraph pair from Bank $91 table
confidence: confirmed
tags: [ui, text, dte, compression, string]
evidence: ["disasm: doubles token index ($80..$BF), loads 2 consecutive characters from tbl_D1F32E, and stores both bytes into cyclic buffer at $7F:DC1E"]
see: [docs/disassembly/ui/dialogue-digraph-huffman.md, rom/8ccdde.md, rom/8ccd84.md]
---
Unpacks a 2-byte Dual Tile Encoded (DTE) digram pair from master table `tbl_D1F32E` in Bank `$91`:
- Decodes token in range `0x80`..`0xBF`.
- Multiplies index by 2 and streams two characters into the active destination buffer.
Full disassembly and clean C reconstruction: `docs/disassembly/ui/dialogue-digraph-huffman.md`.
