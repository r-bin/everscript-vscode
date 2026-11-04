---
addr: $7E:3DE3
name: ENTITY_RECORD_FREE_HEAD
type: u16
tags: [entity]
confidence: verified
evidence: ["disasm: head pointer to singly-linked pool of free entity records; popped by entity allocator at $8F:B2BE and $8F:B2DE, triggering BRK #$8B if exhausted (head == 0)"]
---
Head pointer to singly-linked pool of free runtime entity records in dynamic actor memory.

