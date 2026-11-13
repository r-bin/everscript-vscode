---
addr: 8DA07F
size: 18
end: 8DA090
kind: code
category: 🎮
name: ring_menu_load_icon_palette_attributes
title: Load ring menu item category icon palette attributes ($8D:A07F)
confidence: verified
evidence:
  - "disasm: indexes control tables $8D:A091 and $8D:A095 with $0B21 (CONTROL_CONFIGURATION); writes action and run button bitmasks to $0B25 (ACTION_BUTTON) and $0B23 (RUN_BUTTON); callers: menu init $80:8CC9, $8D:B492"
  - "Reconstructed in `reconstructed-c/8D/8DA07F_ring_menu_load_icon_palette_attributes.c` (SOE_BIND); passes Gate G1 differential verification (3/3 reference states, 48/48 fuzzed states, mutation caught: yes, 6 / 142 ROM/C instructions per call)."
see: ["routines/gameplay_session_subsystems_init.md","routines/sram_compute_checksum.md"]
tags: ["ring-menu", "palette", "category", "icon", reconstructed-c, g1-pass]
---
Loads ring menu icon palette descriptor indices from tables `$8D:A091,X` and `$8D:A095,X` (indexed by item category `$0B21`) into `$0B25` and `$0B23`.
