---
addr: 808507
size: 28
end: 808522
kind: code
category: 🧠
name: enable_nmi_auto_joypad
title: Enable NMI + auto-joypad
confidence: verified
tags: [system, reconstructed-c, g1-pass]
evidence:
  - "[\"disasm: $80:8507-$80:8522; PHP/SEI, writes $4200 and $0E6B, stores $0080 at $012D and $858B at $012B, then PLP/RTL (docs/disassembly/engine-core/nmi-input-setup.md)\"]"
  - "Reconstructed in `reconstructed-c/80/808507_enable_nmi_auto_joypad.c` (SOE_BIND); passes Gate G1 differential verification (9/9 reference states, 144/144 fuzzed states, mutation caught: yes, 13 / 117 ROM/C instructions per call)."
see: [docs/disassembly/engine-core/nmi-input-setup.md]
---
Saves and restores processor status around the writes. Sets `$4200` and its WRAM mirror `$0E6B` to `$81`, then stores `$0080` at `$012D` and `$858B` at `$012B`. The purposes of `$012B` and `$012D` remain unknown. A maps to `$0080` on return; X is `$858B` when entered with 16-bit index-register mode.
