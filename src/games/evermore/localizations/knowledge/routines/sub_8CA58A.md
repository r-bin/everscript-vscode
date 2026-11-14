---
addr: 8CA58A
end: 8CA590
size: 7
kind: code
category: 🧠
name: sub_8CA58A
title: Window row buffer accumulator addition with carry
confidence: confirmed
tags: [code, subroutine, dialogue, window]
evidence: ["disasm: `adc $0000,y : sta $0000,y : rtl` at $8C:A58A", "called by $8C:A538", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.46): 33/33 states (33/33 oracle, 524/524 fuzzed) match ROM, mutation caught"]
---

Dialogue window stream accumulator addition routine that adds the accumulator with carry to `$0000,Y` and stores the sum back before returning via RTL.

