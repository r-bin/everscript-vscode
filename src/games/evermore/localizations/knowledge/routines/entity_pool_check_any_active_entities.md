---
addr: 8EDF85
size: 26
end: 8EDF9E
kind: code
category: 🎮
name: entity_pool_check_any_active_entities
title: Scan 8 active entity slots to check for running entity instances ($8E:DF85)
confidence: confirmed
evidence: ["disasm: iterates 8 entity slots $3294..$3364 stepping 26 bytes ($1A); checks active flag bit 0 in +$18,X; returns SEC if all slots checked, else CLC; callers: entity manager $91:9A94"]
see: ["routines/spell_projectile_spawn_and_velocity_init.md"]
tags: ["entity","pool","active","scan"]
---
Scans 8 active entity slots starting at `$3294` in steps of 26 bytes (`#$1A`) up to `$3364`. Inspects active flag bit 0 in `+$18,X`. Returns `SEC` if all slots processed without finding an inactive slot, else `CLC`.
