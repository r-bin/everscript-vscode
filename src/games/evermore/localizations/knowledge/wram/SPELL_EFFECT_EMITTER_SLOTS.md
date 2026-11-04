---
addr: 7E3294
end: 7E3363
size: 208
kind: array
name: SPELL_EFFECT_EMITTER_SLOTS
type: SpellEmitterSlot[8]
title: Active spell particle and effect emitter slots (8 slots × 26 bytes)
lifetime: room
confidence: confirmed
tags: [spells, alchemy, particles, combat]
evidence: ["disasm: func_8EDF85 ($8E:DF85) scans 8 slots ($7E:3294 + slot * 0x1A up to $3364) checking bit 0 of +$18 for an inactive slot", "disasm: func_8EDF9F ($8E:DF9F) writes coordinates and marks slot active with #$01 at +$18,X", "disasm: called by spell emission routine func_919A94 ($91:9A94)"]
see: [knowledge/wram/ANIM_ALCHEMY_SLOTS_BASE.md, docs/disassembly/engine-core/wram-map.md]
---
208-byte active spell particle emitter array in Bank `$7E` (`$7E:3294`..`$7E:3363`) consisting of 8 emitter records (stride 26 bytes / `$1A`).
Searched and allocated by `func_8EDF85` and initialized by `func_8EDF9F` during spell casting in `func_919A94`. Precedes the alchemy animation slot array at `$7E:3364`.
