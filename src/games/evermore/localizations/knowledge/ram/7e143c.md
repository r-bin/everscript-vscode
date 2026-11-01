---
addr: 7E143C
end: 7E143D
kind: pointer
name: PLAYER_DAMAGE_REACTION_ACTOR
title: Pointer to player actor entity currently receiving damage or status reactions
lifetime: frame
confidence: confirmed
tags: [engine, entity, combat, damage]
evidence: ["rom-asm: $90:8554 STY $143C stores Boy entity pointer ($7E:4E89) during damage processing", "rom-asm: $80:8D49 STZ $143C resets pointer upon reaction cycle completion"]
see: [docs/disassembly/engine-core/wram-map.md]
---
16-bit WRAM pointer to the active player character entity (typically Boy at `$7E:4E89` or Dog at `$7E:4F37`) currently executing damage reaction logic:
- Assigned in `func_9084A7` (`STY $143C`) during hit reaction and invulnerability frame triggering.
- Cleared to zero (`STZ $143C`) by combat cleanup routines in `func_808CC9`.

