---
addr: 90D6EB
size: 14
end: 90D6F8
kind: code
category: 🎮
name: projectile_cluster_inc_decay_timer_if_even
title: Increment cluster particle decay counter on alternate coordinate ticks ($90:D6EB)
confidence: confirmed
evidence: ["disasm: tests coordinate $0B19 bit 0; if even, increments decay counter +$ECF,X before branching to update handler", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.43): 48/48 states (48/48 oracle) and 376/376 fuzzed match ROM, mutation caught"]
see: []
tags: ["projectile","particle","decay","timer"]
---
If coordinate `$0B19` bit 0 is clear, increments cluster particle decay counter `+$ECF,X` before branching to update loop.
