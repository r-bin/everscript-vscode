---
addr: 9086A9
size: 26
end: 9086C2
kind: code
category: 🎮
name: animation_step_direction_if_flag_2000
title: Dispatch directional animation step when flag bit $2000 is set ($90:86A9)
confidence: verified
evidence:
  - "[\"disasm: checks animation flag bit $2000 in +$3C,Y; if set, clears step angle <$02, sets orientation from +$22,Y into <$04, and calls movement handler $8F:AD51\"]"
  - "Reconstructed in `reconstructed-c/90/9086A9_animation_step_direction_if_flag_2000.c` (SOE_BIND); passes Gate G1 differential verification (40/40 reference states, 615/615 fuzzed states, mutation caught: yes, 6 / 140 ROM/C instructions per call)."
see: ["routines/entity_mover_step_direction_table.md"]
tags: ["animation", "movement", "step", "vector", reconstructed-c, g1-pass]
---
Checks entity animation flag bit `$2000` in `+$3C,Y`. If set, clears direction offset `<$02>`, sets direction `<$04>` from `+$22,Y`, and dispatches movement step via `Entity_mover_step_direction_table_8F_AF18_8FAD51` (`$8F:AD51`).
