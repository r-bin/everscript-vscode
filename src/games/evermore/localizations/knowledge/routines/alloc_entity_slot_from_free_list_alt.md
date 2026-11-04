---
addr: 8FB2DE
size: 64
end: 8FB31D
kind: code
category: ⚔️
name: alloc_entity_slot_from_free_list_alt
title: Entity record pool allocator alternate entry point ($8F:B2DE)
confidence: confirmed
evidence: ["disasm: secondary entry to $8F:B2BE; pops head from free entity list $7E:3DE3; crashes via BRK $8B on pool overflow; links allocated slot into active list $7E:3DE1; raises active flag $0200 in status word +$10,X; caller: $8F:B094"]
see: [routines/alloc_entity_slot_from_free_list.md, knowledge/wram/ACTIVE_COMPANION_HEAD.md, knowledge/wram/ENTITY_RECORD_FREE_HEAD.md]
tags: [entities, allocator, memory]
---
Alternate entry point for allocating an entity record from the singly-linked free pool at `$7E:3DE3`. Advances free list head, inserts allocated slot into active entity list `$7E:3DE1`, sets active flag `$0200` on entity status word `+$10,X`, or triggers breakpoint `BRK #$8B` on pool exhaustion.
