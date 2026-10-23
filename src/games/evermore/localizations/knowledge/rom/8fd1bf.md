---
addr: 8FD1BF
kind: code
category: 🧠
name: ai_companion_tether
title: Companion tether: limits in breadcrumb steps, drop the target and follow
confidence: likely
tags: [entities, ai]
evidence: ["disasm: decompiled in full (v0.342.0): limits 10/6/8/3 (4/3/3/1 with $23C3) into $146A-$1470, measured by $8F:AB0B; outcomes: carry on, or +$24 = 0 and follow in state 1 (run) / 2 (walk)", "cdl: executed"]
see: [docs/entities/ai-behaviours.md]
---
How `$8F:AB0B` measures is not decoded.
