---
addr: 8CD09C
size: 10
end: 8CD0A5
kind: code
category: 🧠
name: script_thread_resume
title: Thread state 2 (running) and the wake path: load the thread's script pointer
confidence: confirmed
tags: [script-vm, scheduler]
evidence: ["disasm: LDA +$00,Y / STA $82 ; LDA +$01,Y / STA $83 ; falls through to LDA [$82] at $8C:D0A6", "disasm: the state table word for state 2 points here"]
see: [routines/script_scheduler_pass.md, docs/scripts/engine.md]
---
Entry of the scheduler handler for a running thread (state 2); the wake handlers above also end up here through `$8C:D096`. It copies the thread's 24-bit script pointer from slot `+0`..`+2` into direct page `$82`..`$84` (two overlapping word moves: slot `+0` to `$82`, slot `+1` to `$83`) and falls straight into the opcode dispatcher [script_vm_opcode_dispatch](script_vm_opcode_dispatch.md) at `$8C:D0A6`.

Previously believed: "load a font glyph pointer".
