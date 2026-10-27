---
addr: 7E1276
size: 2
kind: ptr
name: SPRITE_FREE_LIST_HEAD
title: Head pointer to free node linked list in dynamic sprite pool
lifetime: frame
confidence: verified
tags: [sprites, memory-pool]
evidence: ["disasm: func_C09685 initializes pool $7E:50A7..$7E:512F with 8-byte nodes and sets $1276 to head $512F", "disasm: func_C096BB consumer pops free nodes from $1276"]
---
Maintains the head pointer of the free node list inside the engine's dynamic sprite allocation pool (`$7E:50A7..$7E:512F`).

