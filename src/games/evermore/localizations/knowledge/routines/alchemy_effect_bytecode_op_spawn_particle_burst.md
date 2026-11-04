---
addr: 919A0F
end: 919A93
size: 133
kind: code
category: 🧠
name: alchemy_effect_bytecode_op_spawn_particle_burst
title: Alchemy effect script bytecode handler: spawn radial particle burst and advance script PC
confidence: confirmed
tags: [alchemy, script, bytecode, particles, projectile, fx]
evidence: ["disasm: 133 bytes at $91:9A0F..$91:9A93; sets projectile duration timer at +$54,Y, advances script PC at +$14,Y by 12 bytes, initializes radial particle trajectories, returns with CLC; RTS at $91:9A93"]
see: [routines/alchemy_play_formula_sfx_from_table.md, routines/spell_projectile_spawn_and_velocity_init.md, routines/alchemy_effect_set_timer_and_destination.md]
---
Alchemy formula animation script VM bytecode handler:
- Sets projectile particle slot lifetime duration at `+$54,Y` to `$FFFF`.
- Advances effect script PC `+$14,Y` by 12 bytes to consume parameter words.
- Allocates particle slots, computes radial burst trajectories `(X, Y, Z)`, and initializes particle velocity vectors.
- Exits with Carry clear (`CLC; RTS`).

