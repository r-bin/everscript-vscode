---
addr: $7E:3D86
name: boss_segment_slot_5
type: BossSegmentSlot
tags: [combat, script]
confidence: verified
evidence: ["cdl", "disasm: $8F:9C41"]
---
Boss child segment slot 5 descriptor (89 bytes: free link, joint offsets, parent ptr).

| Offset | Size | Name | Description |
|---|---|---|---|
| +$00 | 2 | JOINT_OFFSET_X | Horizontal joint offset from parent anchor |
| +$02 | 2 | JOINT_OFFSET_Y | Vertical joint offset from parent anchor |
| +$04 | 2 | TARGET_X | Target limb world horizontal coordinate |
| +$06 | 2 | TARGET_Y | Target limb world vertical coordinate |
| +$08 | 2 | ANGLE | Joint rotation angle index |
| +$0A | 2 | LIMB_ANIM_STATE | Satellite segment animation phase |
| +$0C | 2 | PARENT_ACTOR_PTR | Pointer to parent entity record |
| +$0E | 2 | FREE_LINK | Singly-linked list free pointer |
