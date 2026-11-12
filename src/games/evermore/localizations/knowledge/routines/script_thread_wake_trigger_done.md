---
addr: 8CD05C
size: 9
end: 8CD064
kind: code
category: 🧠
name: script_thread_wake_trigger_done
title: Thread state 8 (waiting for the step-on trigger script): wake when $2429 changes
confidence: confirmed
tags: [script-vm, scheduler, wait, triggers]
evidence: ["disasm: LDA $2429 / CMP +$05,Y / BNE $8C:D096 else RTS", "read: the 0x2e wait handler sets state 8 for operand 1 and reads $2429 (opcodes/2e.md)"]
see: [routines/script_scheduler_pass.md, docs/scripts/engine.md]
---
The scheduler handler for a thread in state 8, started by `wait(1)`. It compares the active step-on trigger script id `$7E:2429` ([TRIGGER_SCRIPT_LOCK](../wram/TRIGGER_SCRIPT_LOCK.md)) with the value stored in slot `+5`; while they are equal the thread keeps waiting, and when `$2429` differs it takes the wake path `$8C:D096`.

Previously believed: "compare the dialogue selection against a boundary" and, in the scheduler entry, "text box wait" (state 8 and 10 were swapped there).
