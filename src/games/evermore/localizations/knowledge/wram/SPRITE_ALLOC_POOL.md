---
addr: $7E:50A7
name: SPRITE_ALLOC_POOL
type: SpriteAllocNode[17]
tags: [graphics, map]
confidence: verified
evidence: ["cdl", "disasm: func_C09685, func_C0960A"]
---
Y-sorted sprite display list spatial bucket header table (17 nodes × 8 bytes: 16 screen partition buckets covering 64 scanlines each, plus 1 root sentinel node at $7E:5127).

Each node (`SpriteBucketNode`) is 8 bytes:
| Offset | Size | Name | Description |
|---|---|---|---|
| +$00 | 2 | PREV | Previous bucket node pointer |
| +$02 | 2 | NEXT | Next bucket node pointer |
| +$04 | 2 | KEY | Sentinel sort key ($FFFE for root, $FFFF for tail) |
| +$06 | 2 | TAIL | Tail node pointer |
