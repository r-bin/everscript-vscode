---
addr: 8FACB1
size: 27
end: 8FACCB
kind: code
category: 🧠
name: step_on_trigger_search
title: Search room step-on triggers against actor metatile cell position
confidence: confirmed
tags: [maps, triggers, movement, collision]
evidence: ["disasm: loads trigger count from $1067 and 24-bit pointer from $7E:1069; calls scan_room_triggers coordinate conversion ($8F:ACCE); iterates 6-byte entries [y1, x1, y2, x2, scriptId] testing bounds via $8F:ACEF; updates current latched trigger in $7E:2429; launches script thread via $8C:CE5C", "trace: executed on entity movement to evaluate floor doorway transitions and cutscene trigger lines"]
see: [docs/disassembly/maps/step-triggers.md, routines/trigger_box_test_origin_added_far_edge_exclusive.md, routines/bit_14_gate_before_step_on_search_current_trigge.md, routines/scan_room_triggers.md]
---
Scans active room step-on triggers against the actor's metatile coordinates,
testing bounding box inclusion and updating the latched trigger ID in `$7E:2429`
to launch room transitions and cutscene scripts.
Full disassembly and clean C reconstruction: `docs/disassembly/maps/step-triggers.md`.
