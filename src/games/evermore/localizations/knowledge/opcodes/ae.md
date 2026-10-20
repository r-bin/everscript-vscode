---
addr: AE
kind: opcode
title: Write a tile position to two argument words
confidence: confirmed
tags: ["opcode.variable"]
everscript: ["set_args()"]
evidence: ["disasm: handler at the table entry $8C:D71F"]
see: ["rom/8cd71f.md"]
---
As `0x1B` for the argument bytes (two byte offsets, then x and y).

## Why it exists

Pass a position to a call.
