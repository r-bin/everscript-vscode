---
addr: 8C8658
size: 193
end: 8C8718
kind: code
category: 🧠
name: target_candidate_filter
title: Target candidate filter by request mask $05AD
confidence: likely
tags: [entities, targeting, ui, widescreen, widescreen.cull]
evidence: ["disasm: keeps entities on screen (±8 px) unless mask bit $0004; mask $0800 / $0400 accept the Boy / Dog; mask $4000 requires record +$07 bit 3; an entity with +$10 bit 1 (friendly) is kept only with mask $0020 and record +$07 bit 2; +$10 bit $4000 drops it; mask $1000 / $0080 choose living or dead targets (v0.340.1)", "disasm: the only code that reads record +$07 bits 2 and 3 ($8C:86A6, $8C:86DA)", "disasm: on screen = x +$1A − $59 in -8..$107 and y +$1C − $5B in -8..$F7; the filter reads only +$10, +$1A, +$1C, +$2A and the record through +$60 — no sprite or visibility field, and not +$10 bit 5 (the 'left out of targeting' bit other code checks)", "disasm: called only by the list builders $8C:8719-$8C:87EC"]
see: [routines/character_records.md, routines/target_list_builders.md, knowledge/wram/TARGET_REQUEST_MASK.md, docs/entities/character-properties.md]
---
Decides whether an entity can be picked as a target for a request, for example a cursor or an
effect looking for targets. The caller puts its rules in the mask at `$05AD`. Two bits of the
character record's `+$07` flags are only for this filter.

It never asks whether the entity is drawn. An entity that sits on screen with ordinary flags
and HP above 0 is a valid target even when it shows nothing, which explains the invisible
targets players find (`docs/disassembly/combat/spell-targeting.md` §4).

## Widescreen notes

Every candidate must be on screen: X − `$59` in [−8, 264) and Y − `$5B` in [−8, 248), unless the request mask `$05AD` has bit `$0004`. Enemies in a widescreen margin cannot be targeted by the ring menu / alchemy target lists (callers `$8C:8727`, `$8C:874C`, `$8C:877C`, `$8C:87AE`) (asm read 2026-11-09).
