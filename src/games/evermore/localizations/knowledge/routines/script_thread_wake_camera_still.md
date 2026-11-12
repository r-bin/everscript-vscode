---
addr: 8CD065
size: 33
end: 8CD085
kind: code
category: 🧠
name: script_thread_wake_camera_still
title: Thread state 12 (waiting for the camera): wake when the camera stopped moving
confidence: confirmed
tags: [script-vm, scheduler, wait, camera]
evidence: ["disasm: SEP #$20 ; LDA $BF / CMP +$05,Y / BNE store ; LDA $C1 / CMP +$06,Y / BEQ $8C:D082 ; store both ; REP #$30 ; RTS", "read: the 0x2e wait handler sets state 12 for operand 2 (opcodes/2e.md)"]
see: [routines/script_scheduler_pass.md, docs/scripts/engine.md]
---
The scheduler handler for a thread in state 12, started by `wait(2)`. It compares the camera scroll bytes in direct page `$BF` and `$C1` with the copy kept in slot `+5` and `+6`. If either differs the camera moved since the last pass: the new values are stored and the thread keeps waiting. If both match the camera is at rest and the thread takes the wake path (`$8C:D082` jumps to `$8C:D096`).

Previously believed: "cache the dialogue text cursor coordinates".
