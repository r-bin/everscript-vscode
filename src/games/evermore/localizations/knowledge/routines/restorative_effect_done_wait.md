---
addr: 919D2E
size: 24
end: 919D45
kind: code
category: 🧠
name: restorative_effect_done_wait
title: Evaluate restorative effect animation phase completion bit
confidence: confirmed
tags: [alchemy, animation, healing, sync]
evidence: ["disasm: tests bit 1 of entity slot offset +0x26 for restorative formulas; if set, clears bit 1 (AND #$FFFD) and returns CLC to allow healing resolution to proceed; if clear, returns SEC to yield to next frame", "trace: executed by restorative formula coordinator to await healing animation completion"]
see: [docs/disassembly/combat/spell-targeting.md, routines/reads_an_effect_s_done_bit_set_by_animation_opco.md, routines/spell_heal_clamp_to_max_hp_999.md]
---
Inspects bit 1 of entity slot offset `+0x26` to determine if a restorative or
buff alchemy animation phase has completed.
Clears the bit and returns Carry Clear (`CLC`) to trigger heal resolution
or Carry Set (`SEC`) to yield.
Full disassembly and clean C reconstruction: `docs/disassembly/combat/spell-targeting.md`.
