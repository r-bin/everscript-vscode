---
addr: $7E:246D
name: EXPLOSION_SCATTER_DIRECTION
type: u16
tags: [scripts, combat, effect]
confidence: verified
evidence: ["disasm", "cdl"]
---
Combat Visual Effects Subsystem: Random multi-hit explosion particle scatter direction index word ($7E:246D, values {$00..$07}; computed and evaluated in script $92:D60E). Sequences through 8 radial offsets around the target origin to displace subsequent explosion visual effect sprites.

