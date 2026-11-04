---
addr: 8FD9BB
size: 22
end: 8FD9D0
kind: code
category: 🧠
name: ai_fight
title: Fight step: retreat while recharging, attack when lined up, else approach
confidence: confirmed
tags: [entities, ai]
evidence: ["disasm: decompiled in full (v0.342.0): stamina < $400 → $8F:DBCC; $8F:D9D1 in reach → $8F:DA4B; else $8F:DA6D", "cdl: executed"]
see: [docs/entities/ai-behaviours.md]
---
Fight step: retreat while recharging, attack when lined up, else approach.
