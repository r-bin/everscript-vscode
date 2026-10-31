---
addr: 8FB2DE
kind: code
category: ⚔️
name: alloc_entity_slot_from_free_list_alt
title: Entity record pool allocator alternate entry point ($8F:B2DE)
confidence: confirmed
evidence: ["disasm: secondary entry to $8F:B2BE; pops head from free entity list $7E:3DE3; crashes via BRK $8B on pool overflow; links allocated slot into active list $7E:3DE1; raises active flag $0200 in status word +$10,X; caller: $8F:B094"]
see: [rom/8fb2be.md, ram/7e3de1.md, ram/7e3de3.md]
tags: [entities, allocator, memory]
---
Alternate entry point for allocating an entity record from the singly-linked free pool at `$7E:3DE3`. Advances free list head, inserts allocated slot into active entity list `$7E:3DE1`, sets active flag `$0200` on entity status word `+$10,X`, or triggers breakpoint `BRK #$8B` on pool exhaustion.
