---
addr: 7E0ABE
end: 7E0ABF
kind: var
name: DOG_EQUIPPED_COLLAR
title: ID of collar armor currently equipped by Dog companion
lifetime: save
confidence: confirmed
tags: [entity, dog, equipment, stats]
evidence: ["reconstructed-c: 8F857D_companion_form_stats.c reads collar ID at $7E:0ABE to look up collar defense bonus from table $C4:0000", "applies +25% defense bonus if Collar Polish charm ($7E:2261 bit 5) is owned"]
see: [docs/disassembly/engine-core/wram-map.md]
---
16-bit identifier for the Dog companion's equipped collar item:
- Read during stat recalculation in `func_8F857D` to index into the armor defense table at `$C4:0000`.
- If the Collar Polish alchemy charm (`$7E:2261` bit 5) is active, the retrieved collar defense bonus is augmented by +25% (`defense += (defense >> 4)`) before adding to Dog physical defense (`$7E:0A8B`).

