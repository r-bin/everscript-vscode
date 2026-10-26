---
addr: 7E3BBE
size: 1
kind: var
name: JOYPAD_CHORD_INDEX
title: Offset of the newest chord in the joypad chord history
lifetime: boot
confidence: confirmed
tags: [input, joypad]
evidence: ["disasm: $8C:F12C LDX $3BBE with 8-bit X; $8C:F13C STX $3BBE after DEX DEX"]
see: [ram/7e3abe.md, rom/8cf121.md]
---
A byte offset into `$3ABE`, always even, moved down by 2 per new chord. `$3BBF` right after it is
the text buffer cursor, an unrelated variable.
