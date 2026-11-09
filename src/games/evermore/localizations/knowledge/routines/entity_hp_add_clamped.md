---
addr: 8FC0A5
end: 8FC0D2
size: 46
kind: code
category: 🧠
name: entity_hp_add_clamped
title: Add HP to an entity, capped at its maximum
confidence: confirmed
tags: ["hp","combat","entity"]
evidence: ["disasm: full body read (19 instructions): HP word is +$2A; the cap is the word at $8E:000F + [Y+$60]; entities at or above $4E89 also get their HP string redrawn via $8F:9144","disasm: caller add_entity_hp ($8C:E420) and the alchemy heal handlers $91:9D63 / 9D7A / 9E66","c: G1 passed (tools/c-to-rom/g1.mts): the bound C equals the ROM on 2 entry states sampled from the 2:20 no-input reference and 32 fuzzed ones; snes9x agrees with the interpreter on 2; a mutation is caught"]
see: ["src/games/evermore/localizations/knowledge/routines/add_entity_hp.md","src/games/evermore/localizations/knowledge/routines/hud_render_entity_hp_string.md"]
---
Adds A to the HP word (+$2A) of the entity in Y and caps the result at that entity type's maximum, read from the per-type record at $8E:0000 + [Y+$60], field +$0F. For party entities (address $4E89 and above) the HUD text is refreshed with routines/hud_render_entity_hp_string.md. Afterwards +$76 is cleared and bits $0478 of the flag word +$12 are cleared.

The +$76 and +$12 clearing is observed, but its purpose is not known.

Previously believed: some of the guess entries from the v0.387.7-12 batches treat +$2A as an action/animation state; it is the HP word.
