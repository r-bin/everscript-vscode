---
addr: 8FD4FB
kind: code
category: 🧠
name: ai_chase_hovering
title: Behaviour $0C CHASE_HOVERING — bob the height by 16, then CHASE
confidence: confirmed
tags: [entities, ai]
evidence: ["disasm: decompiled in full (v0.342.0): +$1E += 16 below $50, −16 from $280, else ±16 by a coin; then jmp $8F:D34B", "cdl: executed", "rom: mosquitoes, Old Nick, Mephista, floating fan"]
see: [docs/entities/ai-behaviours.md]
---
A chaser that drifts up and down while it decides.
