---
addr: 90D743
size: 6
end: 90D748
kind: code
category: 🎮
name: projectile_cluster_clear_slot
title: Deactivate projectile cluster slot and clear control word ($90:D743)
confidence: confirmed
evidence: ["disasm: clears projectile cluster slot control word $0ECA,X = 0; returns with CLC"]
see: []
tags: ["projectile","cluster","slot","dealloc"]
---
Deactivates projectile cluster slot by clearing slot control word `$0ECA,X = 0`, returning with `CLC`.
