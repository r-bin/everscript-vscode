---
addr: 80CA58
end: 80CA59
size: 2
kind: code
category: 🧠
name: sub_80CA58
title: Mode 7 flight main frame loop 8-bit accumulator entry stub ($80:CA58)
confidence: confirmed
tags: ["code","subroutine","cdl", "mode7"]
evidence: ["disasm: $80:CA58 executes SEP #$20 to configure 8-bit accumulator mode for PPU HVBJOY polling before falling directly through into sub_80CA5A ($80:CA5A); looped back to by JMP $CA58 at $80:CAAA"]
see: [routines/sub_80CA2D.md, routines/sub_80CA5A.md]
---

8-bit accumulator entry point stub for the primary Mode 7 flight scene execution loop. Configures 8-bit accumulator mode (`SEP #$20`) for PPU status register reads and falls through into `sub_80CA5A` (`$80:CA5A`). Looped back to continuously from `$80:CAAA`.
