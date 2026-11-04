---
addr: $7E:0EE3
name: PROJECTILE_ACTIVE_SLOT_1
type: ProjectileSlot
tags: [weapon, script, combat]
confidence: verified
evidence: ["cdl", "disasm: $90:D7CB"]
---
Active projectile descriptor slot record 1 ($7E:0EE3..$7E:0EFD, 27 bytes).

| Offset | Size | Name | Description |
|---|---|---|---|
| +$00 | 1 | STATE | Active projectile slot state flag |
| +$01 | 2 | POS_X | Horizontal world position coordinate |
| +$03 | 2 | POS_Y | Vertical world position coordinate |
| +$05 | 2 | VEL_X | Horizontal velocity delta |
| +$07 | 2 | VEL_Y | Vertical velocity delta |
| +$09 | 2 | LIFETIME | Remaining flight lifetime ticks |
| +$0B | 2 | SPRITE_ID | Projectile sprite graphic / animation ID |
| +$0D | 2 | DAMAGE | Base attack damage value |
| +$0F | 2 | TARGET_ACTOR | Target actor entity record pointer |
| +$11 | 2 | FLAGS | Trajectory and collision flags |
