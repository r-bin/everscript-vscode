---
addr: 90DF44
end: 90DFA8
size: 101
kind: code
category: 🏹
name: projectile_orbit_tick
title: Projectile routine $10 — one tick on an ellipse
confidence: confirmed
tags: [combat, projectile, weapons]
evidence: ["disasm: tyx; dec +$1E,x (the lifetime) and leave through $90:DE7B when it runs out; jsl $90:80D2; angle +$1A += 2 (and #$01FE); lda.l $808923,x / $8088A3,x, shifted, give the offsets from the centre", "rom: the routine table $90:D967 word 8 (selector $10): per-tick routine (+$0C) of orbiting projectile records", "corrected v0.451.0: this was tbl_boomerang_orbit, a table; the tables are at $80:8923 / $80:88A3 (src/games/evermore/maps/projectiles.ts)"]
see: [routines/PROJECTILE_MOVEMENT_ROUTINES.md, docs/entities/animation_script.md]
---
Per-tick routine of an orbiting projectile (the boomerang-like ones): its lifetime counts down, its angle steps on, and
it sits on an ellipse round the centre the setup routine (`$90:DEF7`) chose, from the sine tables in bank `$80`.
