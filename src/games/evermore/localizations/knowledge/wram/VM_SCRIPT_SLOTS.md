---
addr: 7E28FC
size: 79
kind: struct
name: VM_SCRIPT_SLOTS
title: Primary Script VM execution slot (79-byte thread context)
lifetime: room
confidence: verified
tags: [script-vm, threads, widescreen, widescreen.cutscene]
evidence: ["disasm: func_CCCEE9 loops from $28FC to $2F28 in 79-byte ($4F) strides across all 20 thread slots", "disasm: func_CCCF18 initializes PC at +$00, bank at +$02, status at +$03, timer at +$05"]
---
The primary thread slot for the Secret of Evermore Event Script VM.
Contains:
- `+$00`: 16-bit Script PC
- `+$02`: 8-bit Script Bank (starts at `$92`)
- `+$03`: Thread status enum (0 = free, 2 = running, 4 = sleeping until the frame counter reaches the deadline in +5/+7, 6 = waiting for an entity's busy bits, 8 = waiting for the step-on trigger script, 10 = waiting for a text box / room object record, 12 = waiting for the camera; see routines/SCRIPT_THREAD_WAKE_TABLE.md. Previously believed: 6 window, 8 button, 10 entity wait)
- `+$05` / `+$07`: wake parameters of the waiting states: the 32-bit sleep deadline (`+5` low, `+7` high), the entity busy-bit word address, the trigger id or the camera position to compare against
- `+$09`: wait mask / thread flags
- `+$0D`: bound actor entity (opcode `0x4E`, read by `script_owner()`; the entity's reference count at its `+$3E` follows it). Previously believed: `+$0B` bound entity and `+$0D` a gosub return address; the opcode entry `opcodes/4e.md`, the expression sub-op `$2E` and the debugger layout all use `+$0D` for the entity, `+$0B` is not traced
- `+$0F`..`+$4E`: 32 local 16-bit variables (`local[0..31]`)

## Widescreen notes

Cheap cutscene watch: 20 slots x `$4F` bytes, `+$00` script address (24 bit), `+$03` state (2 run, 4 wait, 0 free), `+$0D` entity (layout from the debugger, src/games/evermore/debugger/script-frames.ts). A per-frame scan of 20 states and addresses against a list of cutscene scripts is enough for the recomp (unverified as a cutscene detector).
