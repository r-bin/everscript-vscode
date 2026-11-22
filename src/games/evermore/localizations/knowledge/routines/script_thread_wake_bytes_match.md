---
addr: 8CD086
size: 22
end: 8CD09B
kind: code
category: 🧠
name: script_thread_wake_bytes_match
title: Thread state 10 (waiting for a record): wake when two bytes of its record match
confidence: confirmed
tags: [script-vm, scheduler, wait]
evidence: ["disasm: LDX +$05,Y ; SEP #$20 ; LDA $107E,X ; EOR $10CE,X ; REP #$30 ; BEQ $8C:D096 else RTS", "read: opcodes/2e.md sets state 10 for operands >= $0100 below $0FAE"]
see: [routines/script_scheduler_pass.md, docs/scripts/engine.md]
---
The scheduler handler for a thread in state 10, started by `wait($0100 + n)`. Slot `+5` holds an index X; the thread keeps waiting while the byte at `$7E:107E,X` differs from the byte at `$7E:10CE,X` and takes the wake path `$8C:D096` when they are equal (the two arrays are `$50` bytes apart: a current value and its target).

Open: the 0x2e entry calls the record a "text box", its bound check uses `$0FAE`, which the WRAM map names ROOM_OBJECTS_COUNT: the arrays may be per-room-object state. Not traced which; the name stays neutral.

Previously believed: "compare dialogue text buffer pages" and, in the scheduler entry, "entity walk finished".
