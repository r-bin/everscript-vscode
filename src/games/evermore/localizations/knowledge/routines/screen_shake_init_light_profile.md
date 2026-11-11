---
addr: 909A81
size: 23
end: 909A97
kind: code
category: 🎮
name: screen_shake_init_light_profile
title: Configure light screen shake effect parameters ($90:9A81)
confidence: verified
evidence:
  - "[\"disasm: sets frequency registers $7E:22FA = $10 and $7E:22FB = $10; clears coordinate offset registers $2417 and $2419\"]"
  - "Reconstructed in `reconstructed-c/90/909A81_screen_shake_init_light_profile.c` (SOE_BIND); passes Gate G1 differential verification (8/8 reference states, 128/128 fuzzed states, mutation caught: yes, 9 / 99 ROM/C instructions per call)."
see: []
tags: ["shake", "screen", "vfx", "profile", reconstructed-c, g1-pass]
---
Initializes light screen shake effect profile. Sets amplitude factors `$7E:22FA = $10` and `$7E:22FB = $10`, and clears displacement offsets `$2417` and `$2419`.
