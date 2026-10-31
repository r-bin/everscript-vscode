---
addr: 8C9DAF
kind: code
category: 🧠
name: font_metrics_table_setup
title: Font metrics header parser and pointer calculator ($8C:9DAF)
confidence: confirmed
evidence: ["disasm: sets bank $94 = $C4; reads 2 header bytes from $C4:0000+X into $0B3D and $0B43; performs hardware 8x8 multiply via $4202 and reads product from $4216 into $0B3F; computes 24-bit font table pointer in DP $92..$94","c: docs/disassembly/ui/string-digraphs.md"]
see: [rom/8c9e03.md]
tags: [ui, dialogue, font]
---
Initializes the active font metrics table descriptor for dialogue rendering. Takes font index in X, reads dimension and pitch header bytes from Bank `$C4:0000+X`, performs hardware multiplication using SNES registers `$4202`/`$4216`, and stores the resolved 24-bit pointer to the font glyph width table at direct page `$92..$94` (bank `$C4`).
