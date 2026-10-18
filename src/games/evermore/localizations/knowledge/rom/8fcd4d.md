---
addr: 8FCD4D
kind: code
category: 🧠
name: companion_entity_update
title: Companion entity movement, waypoint following, and ingredient sniffing update
confidence: confirmed
tags: [entities, companion, dog, waypoints]
evidence: ["disasm: updates collision box via $8F:A8E2, clears transient obstacle bits in entity+$10/$12, checks waypoint node at entity+$98, calls navigation routine $8F:9937", "recomp: func_CFCD4D_M0X0 in bank8f_v2.c; clean C in docs/disassembly/entities/dog-ai.md"]
see: [rom/8cdac5.md, ram/7e4f37.md, rom/92a44c.md]
---
Updates companion entity state every frame:
1. Clears transient collision status bits at `entity+$10` and `+$12`.
2. Compares entity address against Boy (`$4E89`): if companion is the Dog (`$4F37`), checks for ingredient sniff spots within proximity.
3. Leashes companion to leader: follows waypoints at `entity+$98` via `$8F:9937`.
4. Resets to leader coordinates if distance exceeds 384 pixels to prevent desync across screen boundaries.
