---
addr: $7E:23DF
name: ENTITY_SPAWN_OVERRIDE_X
type: u16
tags: [scripts, entity, spawn]
confidence: verified
evidence: ["disasm", "cdl"]
---
Entity Subsystem: Spawn position horizontal override coordinate word ($7E:23DF; evaluated in spawner func_CFB0A4 at $8F:B178). When not equal to $8000, overrides the spawned entity's default initial X position with this value, and is reset to $8000.

