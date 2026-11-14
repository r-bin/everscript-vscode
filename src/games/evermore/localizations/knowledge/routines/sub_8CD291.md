---
addr: 8CD291
end: 8CD298
size: 8
kind: code
category: 🧠
name: sub_8CD291
title: Script thread status set to 6 (sleep/waiting state)
confidence: confirmed
tags: [code, subroutine, script, vm]
evidence: ["disasm: `lda #$0006 : sta $0003,x : clc : rts` at $8C:D291", "called by $8C:D265, $8C:D28D in script sleep handlers", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.46): 23/23 states (23/23 oracle, 367/367 fuzzed) match ROM, mutation caught"]
---

Script VM thread management helper setting thread record status offset `+$03` to 6, clearing Carry, and returning via RTS.

