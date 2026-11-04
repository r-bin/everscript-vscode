---
addr: 8FAD51
size: 78
end: 8FAD9E
kind: code
category: 🧠
name: entity_mover_step_direction_table
title: Move entity along 8-directional compass vector scaled by speed
confidence: confirmed
tags: [entities, physics, movement, vectors]
evidence: ["disasm: masks facing direction +0x34 to 0..7, indexes direction vector table $8F:AF18 (stride 4 bytes: dx, dy); scales by entity step speed +0x36; invokes diagonal stairway drift check $8F:ADB2; integrates X (+0x30) and Y (+0x32); triggers bit-14 step-on gate $8F:B078", "trace: executed on entity movement step update"]
see: [docs/disassembly/entities/entity-movement.md, routines/drift_diagonal_stairs_bit_13_also.md, routines/bit_14_gate_before_step_on_search_current_trigge.md]
---
Updates actor world coordinates by indexing the 8-directional movement vector table
at `$8F:AF18`, scaling by speed (`+0x36`), applying diagonal stairway drift (`$8F:ADB2`),
and evaluating floor trigger gates (`$8F:B078`).
Full disassembly and clean C reconstruction: `docs/disassembly/entities/entity-movement.md`.
