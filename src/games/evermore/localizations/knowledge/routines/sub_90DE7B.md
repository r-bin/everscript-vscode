---
addr: 90DE7B
end: 90DE7F
size: 5
kind: code
category: 🧠
name: sub_90DE7B
title: Projectile slot field $0010 clear via TDC
confidence: confirmed
tags: [code, subroutine, projectile, combat]
evidence: ["disasm: `tdc : sta $0010,y : rts` at $90:DE7B", "called by $90:DFAF, $90:DEF4, $90:DF4A", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.46): 46/46 states (46/46 oracle, 728/728 fuzzed) match ROM, mutation caught"]
---

Projectile field zeroing subroutine clearing word field `$0010,Y` to zero using `TDC` (direct page D = 0) and returning via RTS.

