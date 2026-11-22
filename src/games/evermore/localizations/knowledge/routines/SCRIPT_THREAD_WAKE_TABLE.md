---
addr: 8CD02B
end: 8CD036
size: 12
kind: table
category: 📋
name: SCRIPT_THREAD_WAKE_TABLE
title: Script thread state table (wake handlers for states 2..12)
confidence: confirmed
tags: [script-vm, scheduler, table]
evidence: ["disasm: the scheduler loop does JSR ($D029,X) with X = thread slot +3; the table is 7 words at $8C:D029 (state 0 word sits in the padding entry BANK8C_PAD_D029, it points at an STP) followed by these 6 words", "read: the six targets are $8C:D09C, $D037, $D04A, $D05C, $D086, $D065 for states 2, 4, 6, 8, 10, 12"]
see: [routines/script_scheduler_pass.md, docs/scripts/engine.md]
---
Six code pointers, one per live thread state, that the scheduler [script_scheduler_pass](script_scheduler_pass.md) indexes with the state byte of a thread slot (`+3`):

| state | word at | handler | meaning |
|---|---|---|---|
| 2 | `$8C:D02B` | [script_thread_resume](script_thread_resume.md) | running |
| 4 | `$8C:D02D` | [script_thread_wake_timer](script_thread_wake_timer.md) | sleeping until the frame counter reaches a deadline |
| 6 | `$8C:D02F` | [script_thread_wake_busy_bits](script_thread_wake_busy_bits.md) | waiting for an entity's busy bits |
| 8 | `$8C:D031` | [script_thread_wake_trigger_done](script_thread_wake_trigger_done.md) | waiting for the step-on trigger script (`$2429`) |
| 10 | `$8C:D033` | [script_thread_wake_bytes_match](script_thread_wake_bytes_match.md) | waiting for a record to settle (text box or room object, open) |
| 12 | `$8C:D035` | [script_thread_wake_camera_still](script_thread_wake_camera_still.md) | waiting for the camera to stop |

Previously known only as an unnamed table found by the code/data logger.
