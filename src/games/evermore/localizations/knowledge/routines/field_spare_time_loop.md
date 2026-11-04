---
addr: 8F9817
size: 80
end: 8F9866
kind: code
category: 🧠
name: field_spare_time_loop
title: "Run entity tasks until the next NMI, then finish the frame"
confidence: confirmed
tags: [main-loop, entity]
evidence:
  - "docs/disassembly/combat/boss-multipart.md"
  - "disasm: pushes $0100, loops: if $0100 changed JML $80:8F85, else steps $3BC3 through the entity slots and calls a task via JMP ($9867,x) with a fake return to $9820 (v0.201.19)"
  - "trace: the recomp's frame boundaries fall in $8F:9821..$9845 during field play"
---

Called at the end of the per-frame field tick (`$8E:E4B0`). On hardware the NMI arrives while this loop runs; it is the game's "use the spare CPU time" loop, stepping through the 6 child entity tracking slots (`0x0059` stride) to process background multipart and attachment tasks before jumping to `$80:8F85`.

The child flags `$3C12,x`: `$0200` suspends the child here, `$0010` ends the waypoint search task at once. Of 417,000 task calls on replay 01, 378,000 end in the task's head: the task at `$8F:9AC6` when the high byte of `$3C10,x` has bit 7 set, the task at `$8F:A4CA` on that flag or when the queue tail `$3BFF,x` equals the record. `$4E` holds the record and `$4C` the parent while a task runs.

C: `reconstructed-c/8F/8F9817_field_spare_time_loop.c`, a pass and the task heads, bound in the recomp at `$9821`. No G1: the routine only ends on the NMI, so the proof is the recomp against MesenCE.
