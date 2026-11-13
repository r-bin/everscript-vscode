---
addr: 90836C
size: 10
end: 908375
kind: code
category: 🎮
name: animation_script_store_scaled_duration
title: Scale index operand by 2 and store frame duration and 24-bit PC ($90:836C)
confidence: verified
evidence:
  - "[\"disasm: divides index X by 2 via LSR; stores into duration +$05,Y; saves 24-bit script PC <$5D..<$5E into +$00..+$01,Y\"]"
  - "Reconstructed in `reconstructed-c/90/90836C_animation_script_store_scaled_duration.c` (SOE_BIND); passes Gate G1 differential verification (47/47 reference states, 751/751 fuzzed states, mutation caught: yes, 8 / 222 ROM/C instructions per call)."
see: []
tags: ["animation", "duration", "pc", "script", reconstructed-c, g1-pass]
---
Divides index in X by 2 (`LSR`), stores into frame duration `+$05,Y`, and saves 24-bit script PC `<$5D..$5E` into record `+$00..+$01,Y`.
