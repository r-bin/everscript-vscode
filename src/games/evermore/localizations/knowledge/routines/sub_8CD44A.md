---
addr: 8CD44A
end: 8CD456
size: 13
kind: code
category: 🧠
name: sub_8CD44A
title: Script branch relative jump destination computation
confidence: confirmed
tags: [code, subroutine, script, vm]
evidence: ["disasm: `adc $82 : bmi : ora #$8000 : dec $84 : sta $82 : sec : rts` at $8C:D44A", "called by script branch opcodes at $8C:D432", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.47): 29/29 states (29/29 oracle, 464/464 fuzzed) match ROM, mutation caught"]
---

Script VM branch helper adding accumulator offset with Carry to script PC word `$82`; if non-negative, sets bit 15, decrements script page register `$84`, stores the updated address back to `$82`, and sets Carry before RTS.

