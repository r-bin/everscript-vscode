---
addr: 8FADAA
end: 8FADB9
kind: code
category: 🧠
name: entity_mover_step_direction_dispatch
title: Entity terrain modifier direction dispatch (Conveyors, ramps, and diagonal stairs)
confidence: confirmed
tags: [physics, movement, collision, conveyor, stairs]
evidence: ["disasm: inspects tile collision attribute word from $003C,Y, tests bit 13 (0x2000), masks low 4 bits (AND #$000F), shifts left by 1, and dispatches indirectly through 16-entry jump table $8F:AF30", "trace: executed on every entity physics step to evaluate conveyor belts and stair ramps"]
see: [docs/disassembly/maps/conveyor-physics.md, rom/8fae46.md, rom/8fadb2.md]
---
Dispatches terrain physics modifiers for moving entities. Tests metatile collision attribute word bit 13 (`0x2000`).
If asserted, extracts the 4-bit modifier preset and jumps through the 16-entry table `ptrs_CFAF30` (`$8F:AF30`) to apply
conveyor belt thrust or diagonal stair shear; otherwise falls through to normal linear movement evaluation at `$8F:AE46`.
Full disassembly and clean C reconstruction: `docs/disassembly/maps/conveyor-physics.md`.
