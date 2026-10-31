---
addr: 8FA7AA
kind: code
category: 🗺️
name: waypoint_set_target_coordinates
title: Waypoint target coordinate scaler and route initiator ($8F:A7AA)
confidence: confirmed
evidence: ["disasm: loads waypoint node index from DP $4E; stores target pixel X/Y from DP $46/$48 to node +$20/$22 ($3C1C,X and $3C1E,X); divides by 16 (LSR 4) to write tile coordinates to +$00/$01 ($3BF9,X and $3BFA,X); clears state word +$1A ($3C16,X); jumps to path step resolver $8F:A723"]
see: [rom/8f9916.md, rom/8fa8e2.md, ram/7e3bc7.md]
tags: [waypoints, navigation, entities]
---
Configures a waypoint node (index in DP `$4E`) with world target coordinates. Writes high-precision target pixel coordinates to node fields `$3C1C,X` and `$3C1E,X`, scales down by 16 (`LSR x 4`) to store 16x16 tile grid coordinates at `$3BF9,X` and `$3BFA,X`, stores elevation/layer flag `$44` into `$3BFB,X`, clears progress word `$3C16,X`, and branches to route navigation processor `$8F:A723`.
