---
addr: 8CA4F4
end: 8CA4FD
size: 10
kind: code
category: 🧠
name: sub_8CA4F4
title: Dialogue window attribute flag bit clear ($0040)
confidence: confirmed
tags: [code, subroutine, dialogue, window]
evidence: ["disasm: `lda $0012,y : and #$FFBF : sta $0012,y : rtl` at $8C:A4F4", "called by $8C:A3C4", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.46): 33/33 states (33/33 oracle, 526/526 fuzzed) match ROM, mutation caught"]
---

Dialogue window subsystem routine that clears bit $0040 in the window attribute word at `$0012,Y` and returns via RTL.

