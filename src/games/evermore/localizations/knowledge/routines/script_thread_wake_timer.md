---
addr: 8CD037
size: 19
end: 8CD049
kind: code
category: 🧠
name: script_thread_wake_timer
title: Thread state 4 (sleeping): wake when the field frame counter reaches the deadline
confidence: confirmed
tags: [script-vm, scheduler, sleep]
evidence: ["disasm: LDA $0B19 / SEC / SBC +$05,Y ; LDA $0B1B / SBC +$07,Y ; BPL wake ($8C:D047 JMP $D096) else RTS", "disasm: the state table word at $8C:D02D (state 4) points here (scheduler loop JSR ($D029,X) with X = slot +3)", "read: the sleep opcodes $8C:D20F..$8C:D243 write the deadline to +5/+7 and set state 4 (docs/disassembly/script-vm/sleep-wait.md)"]
see: [routines/script_scheduler_pass.md, docs/scripts/engine.md]
---
The scheduler handler for a thread in state 4 (a `sleep`). It subtracts the thread's 32-bit deadline (slot `+5` low word, `+7` high word) from the 32-bit field frame counter `$7E:0B19`/`$0B1B` and, when the result is not negative, jumps to the wake path `$8C:D096`; otherwise it returns and the thread stays asleep this tick.

Previously believed: "is the dialogue cursor inside rectangle A" (the counter at `$0B19` was read as a cursor position). The scheduler ([script_scheduler_pass](script_scheduler_pass.md)) reaches this code only through its state table, and the `sleep` opcodes ([script_op_a7_sleep](script_op_a7_sleep.md)) store the deadline in `+5`/`+7`.
