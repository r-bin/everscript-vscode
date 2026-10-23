---
addr: 8FD3DC
kind: code
category: 🧠
name: ai_drift_east
title: Behaviour $16 DRIFT_EAST — keep walking, re-pick mostly east
confidence: confirmed
tags: [entities, ai]
evidence: ["disasm: decompiled in full (v0.342.0): when +$12 bit 0 or (x + y + 8) & 15 == 0: rand & 15 < 2 south, < 4 north, else east; walk", "rom: record 75 only"]
see: [docs/entities/ai-behaviours.md]
---
Moves on and on, east three times in four whenever it re-picks.
