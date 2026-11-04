---
addr: $7E:23D9
name: ANIMATION_PLAY_OVERRIDE
type: u16
tags: [scripts, animation, entity]
confidence: verified
evidence: ["disasm", "cdl"]
---
Script VM / Animation Subsystem: Forced animation playback override flag word ($7E:23D9; evaluated in opcode 0x78 animate handler func_CCE0B0 at $8C:E0B0). When set to 1, forces the target entity to play the requested animation even if entity status flag bit $0008 (busy/locked) is set, and immediately clears the register to zero.

