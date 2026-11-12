---
addr: 7E0B19
end: 7E0B1C
size: 4
kind: var
name: FIELD_FRAME_COUNTER
title: Field frame counter (32-bit)
lifetime: boot
confidence: confirmed
tags: [script-vm, system]
evidence: ["disasm: the per-frame field tick $8E:E41E increments the word at $0B19 and carries into $0B1B, then runs the script scheduler pass $8C:CFFD — during tick k a script reads start + k + 1", "disasm: the sleep wake handler $8C:D037 subtracts a thread's deadline (slot +5/+7) from $0B19 (low) and $0B1B (high); sleep opcodes $8C:D20F..$8C:D243 add their duration to it", "trace: one step per scheduler pass over 10051 traced ticks (tests/simulation/scheduler.test.js)", "disasm: reconstructed-c/8C/8CD220_sleep_wait.c already names the high word g_field_frame_counter_hi"]
see: [routines/script_thread_wake_timer.md, routines/script_scheduler_pass.md, docs/scripts/engine.md]
---
The clock of field play and of the script engine. The per-frame field tick adds one every frame, low word first, then the high word on overflow. Script `sleep` stores "now + duration" in its thread slot and the scheduler wakes the thread when the counter reaches it, so all script timing counts in these ticks.

## Notes
Previously believed: `WAVE_PHASE_COUNTER` (a u16 at `$0B19` driving the underwater HDMA wave) and a separate `controller_prev_input` at `$0B1B` (previous joypad state). Both are the two halves of this counter: the sleep handler reads `$0B1B` as the high word. The HDMA wave routine merely reads the low word as a phase.
Not yet checked: whether menus and cutscene freezes pause it (`$8E:E124` modifies it).
