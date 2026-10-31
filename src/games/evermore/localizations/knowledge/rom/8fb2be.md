---
addr: 8FB2BE
kind: code
category: ⚔️
name: alloc_entity_slot_from_free_list
title: Entity record allocator from singly-linked free list ($8F:B2BE)
confidence: confirmed
evidence: ["disasm: pops head of free entity list from $7E:3DE3; if 0 (empty), crashes via BRK $8B (entity pool overflow); advances free list head via next-pointer +$5E,X; prepends slot to active list $7E:3DE1; sets active flag $0200 in status word +$10,X; returns entity pointer in Y and X; caller: $8F:B094"]
see: [ram/7e3de1.md, ram/7e3de3.md]
tags: [entities, allocator, memory]
---
Allocates a new entity record from the singly-linked free entity pool. Pops the head pointer from `$7E:3DE3`: if no free slots remain (head is 0), triggers game crash breakpoint `BRK #$8B` (entity allocation overflow). Advances free list head to next link `+$5E,X`, prepends allocated slot onto active entity list `$7E:3DE1`, sets active flag `$0200` on entity status word `+$10,X`, and returns the entity pointer in index registers `Y` and `X`.
