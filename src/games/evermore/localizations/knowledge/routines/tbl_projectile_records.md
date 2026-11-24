---
addr: 90D9A6
end: 90DB9D
size: 504
kind: table
category: 👾
name: tbl_projectile_records
title: Projectile records (21 records × 24 bytes)
confidence: confirmed
evidence: ["disasm: $90:DCA4 and $90:DC35 index $900000 + id (docs/entities/animation_script.md § Projectiles)", "code: src/games/evermore/maps/projectiles.ts reads 24-byte projectile definitions spawned by opcode $4C", "mirror: HiROM alias of $D0:D9A6"]
see: [routines/PROJECTILE_RECORDS.md, routines/PROJECTILE_MOVEMENT_ROUTINES.md]
---
21 projectile records × 24 bytes at `$90:D9A6` (504 bytes total, ending at `$90:DB9D`).
Each record specifies an animation record in bank `$C4` (`+0x00`), palette group (`+0x02`),
movement dispatch routine ID (`+0x08`), behavior type (`+0x0C`: falling, timed, orbit),
speed in 1/16 px per tick (`+0x0E`), and base power (`+0x16`). Spawned by animation command `$4C`.
`+0x0A` is the setup routine when script opcode `0xB5` launches the record (`$90:DCDD`), `+0x14` its attack proc
(2·id, `g_attack_proc_table`). 16 of the 21 are listed by `SCRIPT_PROJECTILE_TABLE` and written as
`characters/projectiles/projectile_NN`; the other five (`$D9EE`, `$DB0E`, `$DB26`, `$DB56`, `$DB6E`) only animation scripts throw (opcode `$4C`) and are `anim_projectile_00`..`04` (v0.465.0).

