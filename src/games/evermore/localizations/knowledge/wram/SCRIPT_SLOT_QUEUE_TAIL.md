---
addr: $7E:2F28
kind: table
name: SCRIPT_SLOT_QUEUE_TAIL
title: Script run list — slots in run order, zero-terminated
type: u16[21]
lifetime: room
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: $8C:CE86 appends (end index in $86); END $8C:D2E1 closes the gap; the scheduler $8C:CFFD walks it with $80"]
see: [rom/8ccffd.md]
---
Script VM: Active thread run list ($7E:2F28..$7E:2F51, 21 words).
One word per running thread: the slot of the script that runs next for it (a callee replaces
its caller in place). New threads are appended. `$86` is the end index, `$80` the index of the
thread whose turn it is.
