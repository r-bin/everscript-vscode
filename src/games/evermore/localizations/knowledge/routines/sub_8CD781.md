---
addr: 8CD781
end: 8CD79C
size: 28
kind: code
category: 🧠
name: sub_8CD781
title: Script VM dual 8-bit operand reader and coordinate multiplier (x8)
confidence: confirmed
tags: [code, subroutine, script, vm]
evidence: ["disasm: reads two bytes via `[$82]` with `inc $82`, scales each with 3x `asl a`, stores to `$0000,X` and `$0000,Y`, and sets Carry via `sec : rts` at $8C:D781", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.47): 18/18 states (18/18 oracle, 280/280 fuzzed) match ROM, mutation caught"]
---

Script VM argument unpacker reading two sequential bytes from the script stream pointer at DP `$82`, multiplying each by 8 (converting tile coordinates to pixel offsets), writing them into destination records indexed by X and Y, and returning with Carry set via RTS.

