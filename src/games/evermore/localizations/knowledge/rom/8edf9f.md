---
addr: 8EDF9F
kind: code
category: 🎮
name: entity_init_bounding_box_and_active_flag
title: Configure entity bounding box dimensions and assert active instance flag ($8E:DF9F)
confidence: confirmed
evidence: ["disasm: sets bounding box size +$08,X = A and +$0A,X = A; clears velocity vectors +$12,X and +$14,X; asserts active instance flag +$18,X = 1; callers: entity spawn $91:9A94"]
see: ["rom/919a94.md"]
tags: ["entity","spawn","hitbox","init"]
---
Sets bounding box dimensions `+$08,X = A` and `+$0A,X = A`, clears velocity vectors `+$12,X = 0` and `+$14,X = 0`, and asserts active instance flag `+$18,X = 1`.
