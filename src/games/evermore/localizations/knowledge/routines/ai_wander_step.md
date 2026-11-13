---
addr: 8FD917
size: 113
end: 8FD987
kind: code
category: 🧠
name: ai_wander_step
title: Wander: stand 20-147 ticks, walk 30-93 ticks one cardinal way
confidence: confirmed
tags: [entities, ai]
evidence: ["disasm: decompiled in full (v0.342.0): state 4 = stand until +$7A (now + 20 + rand & $7F); state 5 = walk facing rand & $C until now + 30 + rand & $3F; alternates", "cdl: executed", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.45): 28/28 states (28/28 oracle) match ROM, mutation caught"]
see: [docs/entities/ai-behaviours.md]
---
Wander: stand 20-147 ticks, walk 30-93 ticks one cardinal way.
