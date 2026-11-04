---
addr: $7E:2467
name: PATH_VECTOR_ORIGIN_Y
type: u16
tags: [scripts, movement, interpolation]
confidence: verified
evidence: ["disasm", "cdl"]
---
Script Subsystem: Interpolated movement path origin vertical coordinate word ($7E:2467; written via opcode 0x19 coords instruction in script $97:A52F). Paired with PATH_VECTOR_ORIGIN_X ($7E:2465) to establish the starting world coordinate for distance calculation and linear movement interpolation.

