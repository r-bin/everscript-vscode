---
addr: 8CDAC5
kind: code
category: 🧠
name: companion_input_ai_dispatcher
title: Party input and companion AI dispatcher (Boy $4E89 and Dog $4F37)
confidence: confirmed
tags: [entities, companion, dog, boy, input]
evidence: ["disasm: tests active control bits in DP $02; routes Boy ($4E89) or Dog ($4F37) to companion_entity_update $8F:CD4D or controller input", "recomp: func_CCDAC5_M0X0 in bank8c_part0b_v2.c; clean C in docs/disassembly/entities/dog-ai.md"]
see: [rom/8fcd4d.md, ram/7e4e89.md, ram/7e4f37.md]
---
Called once per frame to tick active player control and companion following/combat AI:
1. Tests player index at DP `$02`: bit 0 for Boy (`$7E:4E89`), bit 1 for Dog (`$7E:4F37`).
2. If character is player-controlled, parses controller input register `$7E:000D`.
3. If character is companion, sets active actor `$4C` and executes follower AI routine `$8F:CD4D`.
