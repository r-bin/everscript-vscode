---
addr: $7E:23E3
name: SCRIPT_MOVE_COLLISION_RESULT
type: u16
tags: [scripts, physics, collision]
confidence: verified
evidence: ["disasm", "cdl"]
---
Script VM Subsystem: Opcode 0xB9 (move_entity_by_pixel_offset) path collision outcome result word ($7E:23E3; set in func_CCE040 at $8C:E084/89). Set to 1 if the scripted movement completed without obstruction; set to 0 if movement was blocked by environment or collision boundaries.

