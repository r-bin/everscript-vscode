---
addr: 8FD6FB
kind: code
category: 🧠
name: ai_stationary
title: Behaviour $08 STATIONARY — engage test, face 4 ways, attack
confidence: confirmed
tags: [entities, ai]
evidence: ["disasm: decompiled in full (v0.342.0): jsr $8F:D69B (full charge, (rand & $FF) < +$15, Boy or Dog alive within +$13 on both axes), face $80:AE78, engage $8F:DC1D", "cdl: executed", "rom: 12 records: flowers, stone cobras, claws, tiny tentacles, sphere bot"]
see: [docs/entities/ai-behaviours.md]
---
Never moves. When charged it rolls its `+$15` chance each decision and attacks a living party member inside its `+$13` square, turned toward it in one of the four cardinal directions.
