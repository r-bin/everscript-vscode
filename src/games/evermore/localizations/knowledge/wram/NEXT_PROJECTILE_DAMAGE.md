---
addr: $7E:23D1
name: NEXT_PROJECTILE_DAMAGE
type: u16
tags: [scripts, projectile, combat]
confidence: verified
evidence: ["disasm", "cdl"]
---
Script VM / Projectile Subsystem: Velocity and damage override parameter for spawned projectiles ($7E:23D1; read and consumed by opcode 0xCE spawner func_D0DCC0 at $90:DCC0). When non-zero, written to entity struct offset +$28 and immediately cleared to zero.

