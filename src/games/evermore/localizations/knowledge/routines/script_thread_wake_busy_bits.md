---
addr: 8CD04A
size: 18
end: 8CD05B
kind: code
category: 🧠
name: script_thread_wake_busy_bits
title: Thread state 6 (waiting for an entity): wake when its busy bits are set
confidence: confirmed
tags: [script-vm, scheduler, wait]
evidence: ["disasm: LDA +$05,Y / AND +$09,Y / BNE $8C:D053 else RTS (instructions $8C:D04A..$8C:D052)", "disasm: state 6 is entered by the 0x2e wait handler for an entity operand (routines/script_op_wait.md)"]
see: [routines/script_scheduler_pass.md, docs/scripts/engine.md]
---
The scheduler handler for a thread in state 6, started by `wait(entity)` ([script_op_wait](script_op_wait.md)). Slot `+5` holds the address of a word (an entity's busy-bit word) and slot `+9` the mask the thread waits on. While `word & mask` is zero the thread keeps waiting (the handler returns); once a bit is set it takes the wake path `$8C:D096` (the exact bit clearing happens at `$8C:D053`).

Previously believed: "toggle a dialogue cursor selection bit".
