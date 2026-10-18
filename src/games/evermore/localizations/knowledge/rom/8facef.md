---
addr: 8FACEF
end: 8FAD22
kind: code
category: 🧠
name: trigger_box_test_origin_added_far_edge_exclusive
title: Evaluate 6-byte trigger bounding box with far-edge exclusive bounds
confidence: confirmed
tags: [maps, triggers, collision, bounds]
evidence: ["disasm: tests y1 <= Cell Y < y2 and x1 <= Cell X < x2 across 6-byte trigger records [$26],y; returns matching record in Y register, or advances by +6 bytes until Y >= trigger count in $1067", "trace: inner loop of room trigger spatial scanner"]
see: [docs/disassembly/maps/step-triggers.md, rom/8facb1.md, rom/8facce.md]
---
Evaluates a 6-byte trigger bounding box (`[y1, x1, y2, x2, scriptId]`) against
an actor's current metatile coordinates using far-edge exclusive containment
(`y1 <= Y < y2` and `x1 <= X < x2`).
Full disassembly and clean C reconstruction: `docs/disassembly/maps/step-triggers.md`.
