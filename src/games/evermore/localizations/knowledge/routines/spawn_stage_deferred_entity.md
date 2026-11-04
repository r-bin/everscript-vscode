---
addr: 8FDE98
size: 74
end: 8FDEE1
kind: code
category: 🧠
name: spawn_stage_deferred_entity
title: Allocate and stage deferred entity record in spawn table
confidence: confirmed
tags: [entities, tables, script-vm]
evidence: ["disasm: called at $8C:DD2D when spawn opcode argument 2 has bit 15 set (spawner/deferred entity flag); allocates 16-byte slot at WRAM $0EC0 up to $6183, storing character record, leash radius (record +$17, or $23DD when not negative; v0.340.1), world X/Y, flags, direct page, and room state $7E:2431/$7E:2433", "recomp: clean C in docs/disassembly/script-vm/opcode-spawning.md"]
see: [routines/script_op_a2_spawn_at.md, routines/script_op_c2_spawn_spawner.md, routines/script_op_3c_spawn.md]
---
Allocates and writes a 16-byte deferred entity spawn descriptor into the staging table:
- Checks staging buffer pointer at `$0EC0` against limit `$6183`.
- Clears bit 15 (`0x8000`) of argument 2 in `DP $08`.
- Records:
  - `+0x00`: Character record pointer (`DP $02`)
  - `+0x0E`: leash radius, record `+$17` (or `$23DD` when not negative), later copied to entity `+$40` (`$8F:DE91`; `routines/enemy_leash_check.md`). Previously believed: a sprite / animation pointer
  - `+0x02`: Target world X coordinate (`DP $46`)
  - `+0x04`: Target world Y coordinate (`DP $48`)
  - `+0x06`: Spawn flags (`DP $08`)
  - `+0x08`: Direct Page offset (`TDC`)
  - `+0x0A`: Room state shadow `$7E:2431`
  - `+0x0C`: Room state shadow `$7E:2433`
- Advances table pointer `$0EC0 += 0x10`.
- Full clean C decompilation: `docs/disassembly/script-vm/opcode-spawning.md`.
