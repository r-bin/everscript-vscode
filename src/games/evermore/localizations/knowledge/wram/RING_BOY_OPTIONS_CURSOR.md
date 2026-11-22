---
addr: 7E0812
size: 2
kind: var
name: RING_BOY_OPTIONS_CURSOR
title: Selected item of the Boy's options ring
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0810; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
The item the cursor rests on, 0 to count-1.
