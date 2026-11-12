---
addr: 8CC543
size: 26
end: 8CC55C
kind: code
category: 🧠
name: cutscene_pause_activate
title: Enable cutscene pause guard and lock player engine inputs
confidence: confirmed
tags: [cutscene, pause, script-vm]
evidence: ["disasm: tests $0B2B & $7FFF; clears active window via $8C:ADE5 with Y = $034D; sets bit 15 ($8000) of $0B2B via TSB", "trace: executed when event cutscene suspends player field movement", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.41): 7/7 states (7/7 oracle) and 112/112 fuzzed match ROM, mutation caught"]
see: [docs/disassembly/script-vm/cutscene-scheduler.md, routines/cutscene_dialogue_queue_reset.md, routines/cutscene_dialogue_activate.md]
---
Activates the cutscene pause guard by setting bit 15 (`$8000`) of `$0B2B`. Clears any open dialogue
window through `$8C:ADE5` if active. When bit 15 is asserted, player controller polling and normal actor
movement ticks are locked out during cutscene sequencing.
Full disassembly and clean C reconstruction: `docs/disassembly/script-vm/cutscene-scheduler.md`.
