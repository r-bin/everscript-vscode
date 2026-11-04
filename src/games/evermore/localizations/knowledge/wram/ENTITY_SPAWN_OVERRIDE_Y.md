---
addr: $7E:23E1
name: ENTITY_SPAWN_OVERRIDE_Y
type: u16
tags: [scripts, entity, spawn]
confidence: verified
evidence: ["disasm", "cdl"]
---
Entity Subsystem: Spawn position vertical override coordinate word ($7E:23E1; evaluated in spawner func_CFB0A4 at $8F:B183). When $7E:23DF is not equal to $8000, overrides the spawned entity's default initial Y position with this value, and is reset to $8000.

